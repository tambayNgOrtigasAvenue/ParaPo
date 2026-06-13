"use client";
import { useState } from "react";
import { useSession } from "@/lib/store";
import { shortKey } from "@/lib/format";

export function Unlock() {
  const { record, unlock } = useSession();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!record) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await unlock(pin);
    } catch {
      setError("Wrong PIN. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="card w-full">
        <h1 className="text-xl font-extrabold text-ink">Unlock wallet</h1>
        <p className="mt-1 text-sm text-slate-500">
          {record.label} · {shortKey(record.publicKey)}
        </p>
        <form onSubmit={submit} className="mt-5 space-y-3">
          <input
            className="input text-center text-2xl tracking-[0.5em]"
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
          />
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <button className="btn-primary w-full" disabled={busy || pin.length < 4}>
            {busy ? "Unlocking…" : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}
