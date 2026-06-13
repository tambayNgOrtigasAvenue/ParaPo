"use client";
import { useEffect } from "react";
import { useSession } from "@/lib/store";
import { php } from "@/lib/format";

export function Balance() {
  const { balances, refreshBalances, loading } = useSession();

  useEffect(() => {
    refreshBalances();
  }, [refreshBalances]);

  return (
    <div className="relative flex items-center justify-between overflow-hidden rounded-3xl bg-gradient-to-br from-ink via-surface to-ink p-5 text-white shadow-balance">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-brand/25 blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-brand/10 blur-2xl"
      />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-light/90">
          PHPx balance
        </p>
        <p className="mt-1 text-4xl font-extrabold tracking-tight text-white">
          {balances ? php(balances.phpx) : "—"}
        </p>
        <p className="mt-1 text-xs text-white/55">
          {balances ? `${Number(balances.xlm).toFixed(2)} XLM for fees` : "Loading wallet…"}
        </p>
      </div>
      <button
        onClick={refreshBalances}
        className="relative grid h-10 w-10 place-items-center rounded-full bg-white/10 text-base text-white backdrop-blur transition hover:bg-white/20 disabled:opacity-50"
        disabled={loading}
        aria-label="Refresh balance"
      >
        {loading ? "…" : "↻"}
      </button>
    </div>
  );
}
