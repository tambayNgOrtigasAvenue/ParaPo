"use client";
import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { fetchRides, Ride } from "@/lib/stellar/escrow";
import { fromStroops } from "@/lib/stellar/xlm";
import { STELLAR, isConfigured } from "@/lib/stellar/config";
import { xlm, shortKey, formatDateTime } from "@/lib/format";
import { RideStatusPill } from "@/components/RideStatusPill";

export default function CoopPage() {
  const [rides, setRides] = useState<Ride[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfigured()) {
      setError("Not configured. Run the deploy scripts first.");
      return;
    }
    // The cooperative reads on-chain data with a public reader account.
    // It can observe, but never holds custody of, earnings.
    fetchRides(STELLAR.readerPublicKey)
      .then(setRides)
      .catch((e) => setError(e?.message ?? "Failed to load rides."));
  }, []);

  const stats = useMemo(() => {
    const all = rides ?? [];
    const completed = all.filter((r) => r.status === "Completed");
    const active = all.filter((r) => r.status === "Active");
    const settled = completed.reduce((s, r) => s + Number(fromStroops(r.actualFare)), 0);
    const refunded = completed.reduce(
      (s, r) => s + Number(fromStroops(r.maxFare - r.actualFare)),
      0
    );
    const drivers = new Set(all.map((r) => r.driver));
    return { total: all.length, completed: completed.length, active: active.length, settled, refunded, drivers: drivers.size };
  }, [rides]);

  return (
    <>
      <Header title="Cooperative" back="/" />
      <main className="flex flex-1 flex-col gap-4 px-5 py-5">
        <div className="card">
          <h1 className="text-lg font-extrabold text-ink">Cooperative dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Read-only visibility into on-chain rides and earnings. Drivers keep
            full custody of their funds — the coop never holds them.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Stat label="Total rides" value={String(stats.total)} />
          <Stat label="Active now" value={String(stats.active)} accent />
          <Stat label="Fares settled" value={xlm(stats.settled)} brand />
          <Stat label="Auto-refunded" value={xlm(stats.refunded)} />
          <Stat label="Completed" value={String(stats.completed)} />
          <Stat label="Drivers" value={String(stats.drivers)} />
        </div>

        {error && <p className="rounded-2xl bg-danger/10 p-3 text-sm font-medium text-danger">{error}</p>}
        {!rides && !error && <p className="text-sm text-slate-400">Loading on-chain rides…</p>}

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-ink">Recent rides</h2>
          {rides?.length === 0 && <p className="text-sm text-slate-400">No rides yet.</p>}
          {rides?.map((r) => (
            <div key={r.id} className="card">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink">
                  {r.routeId} · #{r.id}
                </span>
                <RideStatusPill status={r.status} />
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                <span>
                  {shortKey(r.commuter)} → {shortKey(r.driver)}
                </span>
                <span>{formatDateTime(r.startedAt * 1000)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  Locked {xlm(Number(fromStroops(r.maxFare)))}
                </span>
                <span className="font-bold text-brand-dark">
                  {r.status === "Completed"
                    ? `Paid ${xlm(Number(fromStroops(r.actualFare)))}`
                    : "—"}
                </span>
              </div>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}

function Stat({ label, value, brand, accent }: { label: string; value: string; brand?: boolean; accent?: boolean }) {
  return (
    <div className="card py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-extrabold ${brand ? "text-brand-dark" : accent ? "text-accent" : "text-ink"}`}>
        {value}
      </p>
    </div>
  );
}
