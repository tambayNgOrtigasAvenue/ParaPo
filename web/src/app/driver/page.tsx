"use client";
import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { AppGate } from "@/components/AppGate";
import { Balance } from "@/components/Balance";
import { Qr } from "@/components/Qr";
import { RouteMap } from "@/components/RouteMap";
import { useSession } from "@/lib/store";
import { ROUTES, getRoute, routeMaxFare, VEHICLE_LABEL } from "@/lib/fares";
import { buildQrToken, newSessionId, QR_ROTATE_MS } from "@/lib/qr";
import { useGeolocation } from "@/lib/gps";
import { fetchRides, Ride } from "@/lib/stellar/escrow";
import { fromStroops, sendXlm } from "@/lib/stellar/xlm";
import { xlm, shortKey, formatDateTime } from "@/lib/format";
import { RideStatusPill } from "@/components/RideStatusPill";

type Tab = "drive" | "earnings" | "cashout";

export default function DriverPage() {
  return (
    <AppGate>
      <Header title="Driver" back="/" />
      <DriverApp />
    </AppGate>
  );
}

function DriverApp() {
  const [tab, setTab] = useState<Tab>("drive");
  return (
    <main className="flex flex-1 flex-col gap-4 px-5 py-5">
      <Balance />
      <nav className="flex gap-2 rounded-full bg-slate-100 p-1">
        {(["drive", "earnings", "cashout"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold capitalize transition ${
              tab === t ? "bg-ink text-white shadow-card" : "text-slate-500 hover:text-ink"
            }`}
          >
            {t === "cashout" ? "Cash out" : t}
          </button>
        ))}
      </nav>
      {tab === "drive" && <DriveTab />}
      {tab === "earnings" && <EarningsTab />}
      {tab === "cashout" && <CashOutTab />}
    </main>
  );
}

function DriveTab() {
  const { keypair } = useSession();
  const [routeId, setRouteId] = useState<string | null>(null);
  const [sid, setSid] = useState<string | null>(null);
  const [token, setToken] = useState<string>("");
  const gps = useGeolocation();

  const route = routeId ? getRoute(routeId) : undefined;

  useEffect(() => {
    if (!keypair || !routeId || !sid) return;
    const rotate = () => setToken(buildQrToken(keypair, routeId, sid));
    rotate();
    const iv = setInterval(rotate, QR_ROTATE_MS);
    return () => clearInterval(iv);
  }, [keypair, routeId, sid]);

  function start(id: string) {
    setRouteId(id);
    setSid(newSessionId());
    gps.reset();
    gps.start();
  }
  function end() {
    setRouteId(null);
    setSid(null);
    setToken("");
    gps.stop();
  }

  if (!route || !sid) {
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-ink">Start a biyahe</h2>
        {ROUTES.map((r) => (
          <button
            key={r.id}
            onClick={() => start(r.id)}
            className="card flex w-full items-center justify-between text-left transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-glow"
          >
            <span>
              <span className="font-semibold text-ink">{r.name}</span>
              <span className="block text-xs text-slate-500">
                {VEHICLE_LABEL[r.vehicle]} · max {xlm(routeMaxFare(r))}
              </span>
            </span>
            <span className="pill bg-brand/10 text-brand-dark">{r.id}</span>
          </button>
        ))}
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="card text-center">
        <p className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-dark">
          <span className="h-2 w-2 animate-pulse rounded-full bg-brand" /> Live · {route.id}
        </p>
        <h2 className="mt-2 font-bold text-ink">{route.name}</h2>
        <div className="mt-4 flex justify-center">
          {token ? <Qr value={token} /> : <p className="text-slate-400">Generating…</p>}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Rotating every {QR_ROTATE_MS / 1000}s · session {sid.slice(0, 6)}…
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Passengers scan this to board, and again to pay when they alight.
        </p>
      </div>

      <div className="card">
        <RouteMap route={route} progressKm={gps.distanceKm} />
        <p className="mt-1 text-center text-xs text-slate-500">
          {gps.watching
            ? `GPS on · ${gps.distanceKm.toFixed(2)} km travelled`
            : gps.error ?? "GPS idle"}
        </p>
      </div>

      <button className="btn-danger w-full" onClick={end}>
        End biyahe
      </button>
    </section>
  );
}

function EarningsTab() {
  const { record } = useSession();
  const [rides, setRides] = useState<Ride[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!record) return;
    fetchRides(record.publicKey)
      .then((all) => setRides(all.filter((r) => r.driver === record.publicKey)))
      .catch((e) => setError(e?.message ?? "Failed to load rides"));
  }, [record]);

  const total = useMemo(
    () =>
      (rides ?? [])
        .filter((r) => r.status === "Completed")
        .reduce((sum, r) => sum + Number(fromStroops(r.actualFare)), 0),
    [rides]
  );

  return (
    <section className="space-y-3">
      <div className="card">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total earned (on-chain)</p>
        <p className="mt-1 text-3xl font-extrabold text-brand-dark">{xlm(total)}</p>
      </div>
      {error && <p className="text-sm font-medium text-danger">{error}</p>}
      {!rides && !error && <p className="text-sm text-slate-400">Loading rides…</p>}
      {rides?.length === 0 && (
        <p className="text-sm text-slate-400">No rides yet. Start a biyahe to collect fares.</p>
      )}
      {rides?.map((r) => (
        <div key={r.id} className="card flex items-center justify-between">
          <div>
            <p className="font-semibold text-ink">
              {r.routeId} · #{r.id}
            </p>
            <p className="text-xs text-slate-500">
              {shortKey(r.commuter)} · {formatDateTime(r.startedAt * 1000)}
            </p>
          </div>
          <div className="text-right">
            <RideStatusPill status={r.status} />
            <p className="mt-1 text-sm font-bold text-brand-dark">
              {r.status === "Completed" ? xlm(Number(fromStroops(r.actualFare))) : "—"}
            </p>
          </div>
        </div>
      ))}
    </section>
  );
}

function CashOutTab() {
  const { keypair, balances, refreshBalances } = useSession();
  const [dest, setDest] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const amt = Number(amount) || 0;
  const stellarFee = 0.00001; // ~100 stroops base fee, in XLM

  async function withdraw(e: React.FormEvent) {
    e.preventDefault();
    if (!keypair) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const hash = await sendXlm(keypair, dest.trim(), amount);
      setMsg(`Sent ${xlm(amt)} · tx ${hash.slice(0, 8)}…`);
      setAmount("");
      await refreshBalances();
    } catch (e: any) {
      setError(e?.response?.data?.extras?.result_codes?.operations?.join(", ") ?? e?.message ?? "Withdrawal failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="card">
        <h2 className="text-sm font-bold text-ink">Cash out XLM</h2>
        <p className="mt-1 text-xs text-slate-500">
          Send your decentralized earnings to any Stellar address.
        </p>
        <form onSubmit={withdraw} className="mt-4 space-y-3">
          <div>
            <label className="label">Destination (G… address)</label>
            <input
              className="input font-mono text-sm"
              value={dest}
              onChange={(e) => setDest(e.target.value)}
              placeholder="G…"
            />
          </div>
          <div>
            <label className="label">Amount (XLM)</label>
            <input
              className="input"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
            <p className="mt-1 text-xs text-slate-500">
              Available: {balances ? xlm(balances.xlm) : "—"}
            </p>
          </div>
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          {msg && <p className="text-sm font-medium text-brand-dark">{msg}</p>}
          <button className="btn-primary w-full" disabled={busy || !dest || amt <= 0}>
            {busy ? "Sending…" : "Withdraw"}
          </button>
        </form>
      </div>

      {amt > 0 && (
        <div className="card">
          <h3 className="text-sm font-bold text-brand-dark">Stellar keeps fees tiny</h3>
          <div className="mt-3 space-y-2 text-sm">
            <Row label="Stellar network fee" value={xlm(stellarFee)} />
            <div className="border-t border-slate-100 pt-2">
              <Row label="You keep" value={xlm(Math.max(0, amt - stellarFee))} good />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Row({ label, value, good, bad }: { label: string; value: string; good?: boolean; bad?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={good ? "font-bold text-brand-dark" : bad ? "font-medium text-danger" : "font-medium text-ink"}>
        {value}
      </span>
    </div>
  );
}
