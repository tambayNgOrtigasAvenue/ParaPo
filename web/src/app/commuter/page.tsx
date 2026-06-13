"use client";
import { useState } from "react";
import { Header } from "@/components/Header";
import { AppGate } from "@/components/AppGate";
import { Balance } from "@/components/Balance";
import { OutboxFlusher } from "@/components/OutboxFlusher";
import { Scanner } from "@/components/Scanner";
import { RouteMap } from "@/components/RouteMap";
import { useSession } from "@/lib/store";
import {
  getRoute,
  Route,
  Discount,
  DISCOUNT_LABEL,
  fareBetween,
  nearestStopIndex,
  VEHICLE_LABEL,
} from "@/lib/fares";
import { parseQrToken, verifyQrToken } from "@/lib/qr";
import { useGeolocation } from "@/lib/gps";
import { startRide, finalizeRide } from "@/lib/stellar/escrow";
import { toStroops } from "@/lib/stellar/phpx";
import { enqueue, isOnline } from "@/lib/queue";
import { saveRide } from "@/lib/rides";
import { php, shortKey } from "@/lib/format";

type Phase =
  | "idle"
  | "scanBoard"
  | "boardConfirm"
  | "riding"
  | "scanAlight"
  | "alightConfirm"
  | "receipt";

interface SessionInfo {
  driver: string;
  routeId: string;
  sid: string;
}

export default function CommuterPage() {
  return (
    <AppGate>
      <Header title="Commuter" back="/" />
      <CommuterApp />
    </AppGate>
  );
}

function CommuterApp() {
  const { keypair, record, refreshBalances } = useSession();
  const gps = useGeolocation();

  const [phase, setPhase] = useState<Phase>("idle");
  const [discount, setDiscount] = useState<Discount>("regular");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [boardIdx, setBoardIdx] = useState(0);
  const [alightIdx, setAlightIdx] = useState(1);
  const [rideId, setRideId] = useState<string | null>(null);
  const [maxFare, setMaxFare] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{
    actual: number;
    refund: number;
    queued?: boolean;
  } | null>(null);

  function reset() {
    setPhase("idle");
    setSession(null);
    setRoute(null);
    setRideId(null);
    setReceipt(null);
    setError(null);
    gps.stop();
    gps.reset();
    refreshBalances();
  }

  // --- Scan to board ------------------------------------------------------
  function handleBoardScan(raw: string) {
    const payload = parseQrToken(raw);
    if (!payload) return setError("That QR isn't a ParaPo driver code.");
    const check = verifyQrToken(payload);
    if (!check.ok) return setError(check.reason ?? "Invalid QR.");
    const r = getRoute(payload.route);
    if (!r) return setError(`Unknown route ${payload.route}.`);
    setSession({ driver: payload.driver, routeId: payload.route, sid: payload.sid });
    setRoute(r);
    setBoardIdx(0);
    setError(null);
    setPhase("boardConfirm");
  }

  async function confirmBoard() {
    if (!keypair || !route || !session) return;
    setBusy(true);
    setError(null);
    try {
      const lastIdx = route.stops.length - 1;
      const max = fareBetween(route, boardIdx, lastIdx, discount);
      const id = await startRide(
        keypair,
        session.driver,
        session.routeId,
        toStroops(max)
      );
      setRideId(id);
      setMaxFare(max);
      saveRide(record!.publicKey, {
        rideId: id,
        role: "commuter",
        self: record!.publicKey,
        counterparty: session.driver,
        routeId: route.id,
        routeName: route.name,
        boardStop: route.stops[boardIdx].name,
        maxFarePhp: max,
        status: "active",
        startedAt: Date.now(),
      });
      gps.reset();
      gps.start();
      setPhase("riding");
    } catch (e: any) {
      setError(e?.message ?? "Could not board. Check your PHPx balance.");
    } finally {
      setBusy(false);
    }
  }

  // --- Scan to alight -----------------------------------------------------
  function handleAlightScan(raw: string) {
    const payload = parseQrToken(raw);
    if (!payload) return setError("Invalid QR.");
    if (!session || payload.sid !== session.sid) {
      return setError("This is a different vehicle's QR. Scan the same driver.");
    }
    const check = verifyQrToken(payload);
    if (!check.ok) return setError(check.reason ?? "Invalid QR.");
    // Default the alighting stop to the GPS-estimated position.
    if (route) {
      const boardKm = route.stops[boardIdx].km;
      const est = nearestStopIndex(route, boardKm + gps.distanceKm);
      setAlightIdx(Math.max(boardIdx + 1, est));
    }
    setError(null);
    setPhase("alightConfirm");
  }

  async function confirmAlight() {
    if (!keypair || !route || !rideId) return;
    setBusy(true);
    setError(null);
    const actual = fareBetween(route, boardIdx, alightIdx, discount);
    const refund = Math.max(0, maxFare - actual);
    try {
      if (!isOnline()) throw new Error("offline");
      await finalizeRide(keypair, rideId, toStroops(actual));
      saveRide(record!.publicKey, {
        rideId,
        role: "commuter",
        self: record!.publicKey,
        counterparty: session!.driver,
        routeId: route.id,
        routeName: route.name,
        boardStop: route.stops[boardIdx].name,
        alightStop: route.stops[alightIdx].name,
        maxFarePhp: maxFare,
        actualFarePhp: actual,
        refundPhp: refund,
        status: "completed",
        startedAt: Date.now(),
        finalizedAt: Date.now(),
      });
      setReceipt({ actual, refund });
      gps.stop();
      setPhase("receipt");
    } catch (e: any) {
      // Offline or failed — queue the finalize for automatic retry.
      enqueue({
        kind: "finalize",
        rideId,
        actualFareStroops: toStroops(actual).toString(),
        createdAt: Date.now(),
      });
      setReceipt({ actual, refund, queued: true });
      gps.stop();
      setPhase("receipt");
    } finally {
      setBusy(false);
    }
  }

  // --- Render -------------------------------------------------------------
  return (
    <main className="flex flex-1 flex-col gap-4 px-5 py-5">
      <Balance />
      <OutboxFlusher />

      {error && <p className="rounded-2xl bg-danger/10 p-3 text-sm font-medium text-danger">{error}</p>}

      {phase === "idle" && (
        <section className="space-y-4">
          <div className="card">
            <span className="label">Fare type</span>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(DISCOUNT_LABEL) as Discount[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDiscount(d)}
                  className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
                    discount === d
                      ? "border-brand bg-brand/10 text-brand-dark"
                      : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  {DISCOUNT_LABEL[d]}
                </button>
              ))}
            </div>
          </div>
          <button className="btn-primary w-full py-4 text-base" onClick={() => setPhase("scanBoard")}>
            Scan to board
          </button>
          <p className="text-center text-xs text-slate-400">
            Point your camera at the driver&apos;s rotating QR code.
          </p>
        </section>
      )}

      {phase === "scanBoard" && (
        <Scanner onResult={handleBoardScan} onCancel={() => setPhase("idle")} />
      )}

      {phase === "boardConfirm" && route && session && (
        <ConfirmBoard
          route={route}
          driver={session.driver}
          boardIdx={boardIdx}
          setBoardIdx={setBoardIdx}
          discount={discount}
          busy={busy}
          onConfirm={confirmBoard}
          onBack={() => setPhase("scanBoard")}
        />
      )}

      {phase === "riding" && route && (
        <RidingView
          route={route}
          boardIdx={boardIdx}
          maxFare={maxFare}
          distanceKm={gps.distanceKm}
          gpsOn={gps.watching}
          onAlight={() => setPhase("scanAlight")}
        />
      )}

      {phase === "scanAlight" && (
        <Scanner onResult={handleAlightScan} onCancel={() => setPhase("riding")} />
      )}

      {phase === "alightConfirm" && route && (
        <ConfirmAlight
          route={route}
          boardIdx={boardIdx}
          alightIdx={alightIdx}
          setAlightIdx={setAlightIdx}
          discount={discount}
          maxFare={maxFare}
          busy={busy}
          onConfirm={confirmAlight}
        />
      )}

      {phase === "receipt" && receipt && route && (
        <Receipt
          route={route}
          boardIdx={boardIdx}
          alightIdx={alightIdx}
          maxFare={maxFare}
          actual={receipt.actual}
          refund={receipt.refund}
          queued={receipt.queued}
          onDone={reset}
        />
      )}
    </main>
  );
}

function ConfirmBoard({
  route,
  driver,
  boardIdx,
  setBoardIdx,
  discount,
  busy,
  onConfirm,
  onBack,
}: {
  route: Route;
  driver: string;
  boardIdx: number;
  setBoardIdx: (i: number) => void;
  discount: Discount;
  busy: boolean;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const lastIdx = route.stops.length - 1;
  const max = fareBetween(route, boardIdx, lastIdx, discount);
  return (
    <section className="space-y-4">
      <div className="card">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">Boarding</p>
        <h2 className="mt-1 font-bold text-ink">{route.name}</h2>
        <p className="text-xs text-slate-500">
          {VEHICLE_LABEL[route.vehicle]} · driver {shortKey(driver)}
        </p>
        <div className="mt-3">
          <RouteMap route={route} boardIdx={boardIdx} alightIdx={lastIdx} />
        </div>
        <label className="label mt-3">Where did you board?</label>
        <select
          className="input"
          value={boardIdx}
          onChange={(e) => setBoardIdx(Number(e.target.value))}
        >
          {route.stops.slice(0, lastIdx).map((s, i) => (
            <option key={s.name} value={i}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="card flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Locked in escrow (max fare)</p>
          <p className="mt-1 text-3xl font-extrabold text-accent">{php(max)}</p>
          <p className="mt-1 text-xs text-slate-400">Refunded if you alight early.</p>
        </div>
      </div>

      <button className="btn-primary w-full py-4" onClick={onConfirm} disabled={busy}>
        {busy ? "Locking fare on-chain…" : `Confirm & lock ${php(max)}`}
      </button>
      <button className="btn-ghost w-full" onClick={onBack} disabled={busy}>
        Rescan
      </button>
    </section>
  );
}

function RidingView({
  route,
  boardIdx,
  maxFare,
  distanceKm,
  gpsOn,
  onAlight,
}: {
  route: Route;
  boardIdx: number;
  maxFare: number;
  distanceKm: number;
  gpsOn: boolean;
  onAlight: () => void;
}) {
  const boardKm = route.stops[boardIdx].km;
  const estIdx = Math.max(boardIdx, nearestStopIndex(route, boardKm + distanceKm));
  return (
    <section className="space-y-4">
      <div className="card text-center">
        <p className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-dark">
          <span className="h-2 w-2 animate-pulse rounded-full bg-brand" /> On board · {route.id}
        </p>
        <p className="mt-2 text-sm text-slate-500">
          {php(maxFare)} locked. You&apos;ll only pay for distance travelled.
        </p>
        <div className="mt-4">
          <RouteMap route={route} boardIdx={boardIdx} alightIdx={estIdx} progressKm={boardKm + distanceKm} />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {gpsOn ? `GPS on · ${distanceKm.toFixed(2)} km · near ${route.stops[estIdx].name}` : "GPS idle"}
        </p>
      </div>
      <button className="btn-primary w-full py-4 text-base" onClick={onAlight}>
        Scan to alight & pay
      </button>
    </section>
  );
}

function ConfirmAlight({
  route,
  boardIdx,
  alightIdx,
  setAlightIdx,
  discount,
  maxFare,
  busy,
  onConfirm,
}: {
  route: Route;
  boardIdx: number;
  alightIdx: number;
  setAlightIdx: (i: number) => void;
  discount: Discount;
  maxFare: number;
  busy: boolean;
  onConfirm: () => void;
}) {
  const actual = fareBetween(route, boardIdx, alightIdx, discount);
  const refund = Math.max(0, maxFare - actual);
  return (
    <section className="space-y-4">
      <div className="card">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">Alighting</p>
        <div className="mt-2">
          <RouteMap route={route} boardIdx={boardIdx} alightIdx={alightIdx} />
        </div>
        <label className="label mt-3">Where are you getting off?</label>
        <select
          className="input"
          value={alightIdx}
          onChange={(e) => setAlightIdx(Number(e.target.value))}
        >
          {route.stops.map((s, i) =>
            i > boardIdx ? (
              <option key={s.name} value={i}>
                {s.name}
              </option>
            ) : null
          )}
        </select>
      </div>
      <div className="card space-y-2">
        <Line label="Locked" value={php(maxFare)} />
        <Line label="Actual fare" value={php(actual)} strong />
        <div className="border-t border-slate-100 pt-2">
          <Line label="Refund to you" value={php(refund)} good />
        </div>
      </div>
      <button className="btn-primary w-full py-4" onClick={onConfirm} disabled={busy}>
        {busy ? "Finalizing on-chain…" : `Pay ${php(actual)}`}
      </button>
    </section>
  );
}

function Receipt({
  route,
  boardIdx,
  alightIdx,
  maxFare,
  actual,
  refund,
  queued,
  onDone,
}: {
  route: Route;
  boardIdx: number;
  alightIdx: number;
  maxFare: number;
  actual: number;
  refund: number;
  queued?: boolean;
  onDone: () => void;
}) {
  return (
    <section className="space-y-4">
      <div className="card text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand/10 text-4xl">
          {queued ? "📡" : "✅"}
        </div>
        <h2 className="mt-3 text-xl font-extrabold text-ink">
          {queued ? "Queued — will settle when online" : "Salamat! Paid."}
        </h2>
        <p className="text-sm text-slate-500">
          {route.stops[boardIdx].name} → {route.stops[alightIdx].name}
        </p>
        <div className="mt-4">
          <RouteMap route={route} boardIdx={boardIdx} alightIdx={alightIdx} />
        </div>
      </div>
      <div className="card space-y-2">
        <Line label="Locked in escrow" value={php(maxFare)} />
        <Line label="Fare paid to driver" value={php(actual)} strong />
        <Line label="Refunded to you" value={php(refund)} good />
      </div>
      <button className="btn-primary w-full" onClick={onDone}>
        Done
      </button>
    </section>
  );
}

function Line({ label, value, strong, good }: { label: string; value: string; strong?: boolean; good?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={good ? "font-bold text-brand-dark" : strong ? "font-bold text-ink" : "font-medium text-ink"}>
        {value}
      </span>
    </div>
  );
}
