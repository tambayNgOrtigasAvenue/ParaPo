"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { useSession } from "@/lib/store";
import {
  createWallet,
  importWallet,
  listWallets,
  setActiveWallet,
  unlock,
  WalletRecord,
  Role,
} from "@/lib/stellar/wallet";
import { fundWithFriendbot } from "@/lib/stellar/client";
import { establishTrustline } from "@/lib/stellar/phpx";
import { Keypair } from "@stellar/stellar-sdk";
import { shortKey } from "@/lib/format";

type Tab = "create" | "import" | "demo";
const DEMO_PIN = "0000";

export default function Onboarding() {
  const router = useRouter();
  const { adopt, hydrate } = useSession();
  const [tab, setTab] = useState<Tab>("create");
  const [wallets, setWallets] = useState<WalletRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listWallets().then(setWallets);
  }, []);

  async function provision(kp: Keypair, secret: string) {
    setStatus("Funding account via Friendbot…");
    await fundWithFriendbot(kp.publicKey());
    setStatus("Enabling PHPx trustline…");
    try {
      await establishTrustline(kp);
    } catch {
      // Trustline may already exist (re-imported wallet) — ignore.
    }
  }

  function go(role: Role) {
    router.push(role === "driver" ? "/driver" : "/commuter");
  }

  // --- Create -------------------------------------------------------------
  const [role, setRole] = useState<Role>("commuter");
  const [pin, setPin] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { secret, publicKey, record } = await createWallet(role, pin);
      await provision(Keypair.fromSecret(secret), secret);
      adopt(record, secret);
      setStatus(`Created ${shortKey(publicKey)}`);
      go(role);
    } catch (e: any) {
      setError(e?.message ?? "Failed to create wallet.");
    } finally {
      setBusy(false);
    }
  }

  // --- Import -------------------------------------------------------------
  const [secretIn, setSecretIn] = useState("");
  const [importRole, setImportRole] = useState<Role>("commuter");
  const [importPin, setImportPin] = useState("");

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { secret, record } = await importWallet(secretIn, importRole, importPin);
      await provision(Keypair.fromSecret(secret), secret);
      adopt(record, secret);
      go(importRole);
    } catch (e: any) {
      setError(e?.message ?? "Invalid secret key.");
    } finally {
      setBusy(false);
    }
  }

  // --- Demo ---------------------------------------------------------------
  const [demo, setDemo] = useState<any | null>(null);
  useEffect(() => {
    fetch("/demo-accounts.json")
      .then((r) => (r.ok ? r.json() : null))
      .then(setDemo)
      .catch(() => setDemo(null));
  }, []);

  async function importDemo(acc: { role: Role; secret: string }) {
    setBusy(true);
    setError(null);
    try {
      const { secret, record } = await importWallet(acc.secret, acc.role, DEMO_PIN, `Demo ${acc.role}`);
      adopt(record, secret);
      go(acc.role);
    } catch (e: any) {
      setError(e?.message ?? "Failed to import demo wallet.");
    } finally {
      setBusy(false);
    }
  }

  async function switchTo(w: WalletRecord) {
    await setActiveWallet(w.publicKey);
    await hydrate();
    router.push(w.role === "driver" ? "/driver" : "/commuter");
  }

  return (
    <>
      <Header title="Wallet" back="/" />
      <main className="flex flex-1 flex-col gap-4 px-5 py-6">
        {wallets.length > 0 && (
          <section className="card">
            <h2 className="text-sm font-bold text-ink">Existing wallets</h2>
            <div className="mt-2 space-y-2">
              {wallets.map((w) => (
                <button
                  key={w.publicKey}
                  onClick={() => switchTo(w)}
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-brand/40 hover:bg-white"
                >
                  <span>
                    <span className="font-semibold text-ink">{w.label}</span>
                    <span className="block text-xs text-slate-500">{shortKey(w.publicKey)}</span>
                  </span>
                  <span className="pill bg-brand/10 text-brand-dark capitalize">{w.role}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="flex gap-2 rounded-full bg-slate-100 p-1">
          {(["create", "import", "demo"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold capitalize transition ${
                tab === t ? "bg-white text-ink shadow-card" : "text-slate-500 hover:text-ink"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "create" && (
          <form onSubmit={handleCreate} className="card space-y-4">
            <div>
              <span className="label">I am a</span>
              <div className="grid grid-cols-2 gap-2">
                <RolePick value="commuter" current={role} onPick={setRole} label="Commuter" emoji="🧑‍🦱" />
                <RolePick value="driver" current={role} onPick={setRole} label="Driver" emoji="🚍" />
              </div>
            </div>
            <div>
              <label className="label">Set a PIN (min 4 digits)</label>
              <input
                className="input"
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
              />
              <p className="mt-1 text-xs text-slate-400">
                Encrypts your secret key on this device. It never leaves your phone.
              </p>
            </div>
            <button className="btn-primary w-full" disabled={busy || pin.length < 4}>
              {busy ? status ?? "Working…" : "Create wallet"}
            </button>
          </form>
        )}

        {tab === "import" && (
          <form onSubmit={handleImport} className="card space-y-4">
            <div>
              <label className="label">Stellar secret key (S…)</label>
              <input
                className="input font-mono text-sm"
                value={secretIn}
                onChange={(e) => setSecretIn(e.target.value)}
                placeholder="SB…"
              />
            </div>
            <div>
              <span className="label">Role</span>
              <div className="grid grid-cols-2 gap-2">
                <RolePick value="commuter" current={importRole} onPick={setImportRole} label="Commuter" emoji="🧑‍🦱" />
                <RolePick value="driver" current={importRole} onPick={setImportRole} label="Driver" emoji="🚍" />
              </div>
            </div>
            <div>
              <label className="label">Set a PIN</label>
              <input
                className="input"
                type="password"
                inputMode="numeric"
                value={importPin}
                onChange={(e) => setImportPin(e.target.value)}
                placeholder="••••"
              />
            </div>
            <button className="btn-primary w-full" disabled={busy || importPin.length < 4}>
              {busy ? status ?? "Working…" : "Import wallet"}
            </button>
          </form>
        )}

        {tab === "demo" && (
          <section className="card space-y-3">
            <p className="text-sm text-slate-500">
              Pre-funded testnet wallets seeded by{" "}
              <code className="rounded bg-brand/10 px-1 text-brand-dark">npm run seed</code>. PIN is{" "}
              <code className="rounded bg-brand/10 px-1 text-brand-dark">{DEMO_PIN}</code>.
            </p>
            {!demo && <p className="text-sm text-slate-400">No demo accounts found yet.</p>}
            {demo?.accounts?.map((acc: any) => (
              <button
                key={acc.publicKey}
                onClick={() => importDemo(acc)}
                disabled={busy}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:border-brand/40 hover:bg-white"
              >
                <span>
                  <span className="font-semibold capitalize text-ink">{acc.role}</span>
                  <span className="block text-xs text-slate-500">{shortKey(acc.publicKey)}</span>
                </span>
                <span className="pill bg-accent/15 text-accent">{acc.phpx} PHPx</span>
              </button>
            ))}
          </section>
        )}

        {error && <p className="rounded-2xl bg-danger/10 p-3 text-sm font-medium text-danger">{error}</p>}
        {busy && status && <p className="text-center text-sm text-slate-500">{status}</p>}
      </main>
    </>
  );
}

function RolePick({
  value,
  current,
  onPick,
  label,
  emoji,
}: {
  value: Role;
  current: Role;
  onPick: (r: Role) => void;
  label: string;
  emoji: string;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onPick(value)}
      className={`flex items-center gap-2 rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
        active ? "border-brand bg-brand/10 text-brand-dark" : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300"
      }`}
    >
      <span className="text-xl">{emoji}</span>
      {label}
    </button>
  );
}
