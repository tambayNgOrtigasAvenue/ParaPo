"use client";
import { useEffect, useMemo, useState } from "react";
import { StrKey } from "@stellar/stellar-sdk";
import { Header } from "@/components/Header";
import { useFreighter } from "@/lib/freighterStore";
import { shortKey } from "@/lib/format";
import { fundWithFriendbot } from "@/lib/stellar/client";
import { sendXlm, describeSubmitError, type SendXlmResult } from "@/lib/stellar/payments";

type TxState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "success"; result: SendXlmResult }
  | { kind: "error"; message: string };

export default function WalletPage() {
  const {
    installed,
    address,
    network,
    xlm,
    funded,
    connecting,
    loadingBalance,
    error,
    init,
    connect,
    disconnect,
    refreshBalance,
  } = useFreighter();

  useEffect(() => {
    init();
  }, [init]);

  const onTestnet = network ? network.toUpperCase() === "TESTNET" : null;

  return (
    <>
      <Header title="Freighter" back="/" />
      <main className="flex flex-1 flex-col gap-4 px-5 py-6">
        <section className="card">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-extrabold text-ink">Freighter wallet</h1>
              <p className="text-xs text-slate-500">
                Connect a Stellar Testnet wallet to send XLM.
              </p>
            </div>
            <span className="text-2xl">🛰️</span>
          </div>

          {installed === false && (
            <div className="mt-4 rounded-2xl bg-danger/10 p-3 text-sm text-danger">
              Freighter extension not detected.{" "}
              <a
                href="https://www.freighter.app/"
                target="_blank"
                rel="noreferrer"
                className="font-semibold underline"
              >
                Install it
              </a>{" "}
              and refresh this page.
            </div>
          )}

          {!address ? (
            <button
              className="btn-primary mt-4 w-full"
              onClick={connect}
              disabled={connecting || installed === false}
            >
              {connecting ? "Connecting…" : "Connect Freighter"}
            </button>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="label mb-0">Connected account</p>
                  <p className="font-mono text-sm text-ink" title={address}>
                    {shortKey(address, 6)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <NetworkBadge network={network} onTestnet={onTestnet} />
                  <button className="pill bg-white text-slate-600 shadow-card hover:text-ink" onClick={disconnect}>
                    Disconnect
                  </button>
                </div>
              </div>
              {onTestnet === false && (
                <p className="rounded-2xl bg-accent/15 p-3 text-xs font-medium text-accent">
                  Freighter is on <b>{network}</b>. Switch the extension to <b>Testnet</b> to send.
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-2xl bg-danger/10 p-3 text-sm font-medium text-danger">{error}</p>
          )}
        </section>

        {address && (
          <>
            <BalanceCard
              xlm={xlm}
              funded={funded}
              loading={loadingBalance}
              address={address}
              onRefresh={refreshBalance}
            />
            <SendCard
              source={address}
              disabled={onTestnet === false || !funded}
              onSent={refreshBalance}
            />
          </>
        )}
      </main>
    </>
  );
}

function NetworkBadge({ network, onTestnet }: { network: string | null; onTestnet: boolean | null }) {
  if (!network) return null;
  const ok = onTestnet === true;
  return (
    <span className={`pill ${ok ? "bg-brand/10 text-brand-dark" : "bg-accent/15 text-accent"}`}>
      ● {network}
    </span>
  );
}

function BalanceCard({
  xlm,
  funded,
  loading,
  address,
  onRefresh,
}: {
  xlm: string | null;
  funded: boolean;
  loading: boolean;
  address: string;
  onRefresh: () => void;
}) {
  const [funding, setFunding] = useState(false);
  const [fundError, setFundError] = useState<string | null>(null);

  async function fund() {
    setFunding(true);
    setFundError(null);
    try {
      await fundWithFriendbot(address);
      await onRefresh();
    } catch (e: any) {
      setFundError(e?.message ?? "Friendbot funding failed.");
    } finally {
      setFunding(false);
    }
  }

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink via-surface to-ink p-5 text-white shadow-balance">
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-brand/25 blur-2xl" />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-light/90">XLM balance</p>
          <p className="mt-1 text-4xl font-extrabold tracking-tight">
            {xlm !== null ? `${Number(xlm).toFixed(4)}` : "—"}
            <span className="ml-1 text-lg font-bold text-white/70">XLM</span>
          </p>
          <p className="mt-1 text-xs text-white/55">Stellar testnet · native asset</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh balance"
          className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-base backdrop-blur transition hover:bg-white/20 disabled:opacity-50"
        >
          {loading ? "…" : "↻"}
        </button>
      </div>

      {!funded && (
        <div className="relative mt-4">
          <p className="text-xs text-white/70">
            This account isn&apos;t funded yet. Use Friendbot to get free testnet XLM.
          </p>
          <button
            onClick={fund}
            disabled={funding}
            className="mt-2 inline-flex items-center justify-center rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/25 disabled:opacity-50"
          >
            {funding ? "Funding…" : "Fund with Friendbot"}
          </button>
          {fundError && <p className="mt-2 text-xs text-accent">{fundError}</p>}
        </div>
      )}
    </section>
  );
}

function SendCard({
  source,
  disabled,
  onSent,
}: {
  source: string;
  disabled: boolean;
  onSent: () => void;
}) {
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [tx, setTx] = useState<TxState>({ kind: "idle" });

  const destValid = useMemo(() => {
    try {
      return StrKey.isValidEd25519PublicKey(destination.trim());
    } catch {
      return false;
    }
  }, [destination]);

  const amountValid = useMemo(() => {
    const n = Number(amount);
    return Number.isFinite(n) && n > 0;
  }, [amount]);

  const selfSend = destination.trim() === source;
  const canSend = destValid && amountValid && !selfSend && !disabled && tx.kind !== "pending";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setTx({ kind: "pending" });
    try {
      const result = await sendXlm({ source, destination: destination.trim(), amount, memo });
      setTx({ kind: "success", result });
      setAmount("");
      setMemo("");
      onSent();
    } catch (err) {
      setTx({ kind: "error", message: describeSubmitError(err) });
    }
  }

  return (
    <section className="card">
      <h2 className="text-sm font-bold text-ink">Send XLM</h2>
      <p className="text-xs text-slate-500">Sign with Freighter and submit to testnet.</p>

      <form onSubmit={submit} className="mt-4 space-y-3">
        <div>
          <label className="label">Destination address (G…)</label>
          <input
            className="input font-mono text-sm"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="GABC…"
            spellCheck={false}
          />
          {destination && !destValid && (
            <p className="mt-1 text-xs text-danger">Not a valid Stellar public key.</p>
          )}
          {selfSend && (
            <p className="mt-1 text-xs text-danger">You can&apos;t send to your own address.</p>
          )}
        </div>

        <div>
          <label className="label">Amount (XLM)</label>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.0000001"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1.0"
          />
        </div>

        <div>
          <label className="label">Memo (optional)</label>
          <input
            className="input"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Fare, note, etc."
            maxLength={28}
          />
        </div>

        <button className="btn-primary w-full" disabled={!canSend}>
          {tx.kind === "pending" ? "Awaiting signature…" : "Send payment"}
        </button>
      </form>

      <TxFeedback tx={tx} onDismiss={() => setTx({ kind: "idle" })} />
    </section>
  );
}

function TxFeedback({ tx, onDismiss }: { tx: TxState; onDismiss: () => void }) {
  if (tx.kind === "idle") return null;

  if (tx.kind === "pending") {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
        <span className="h-3 w-3 animate-pulse rounded-full bg-brand" />
        Confirm in Freighter, then waiting for the network…
      </div>
    );
  }

  if (tx.kind === "error") {
    return (
      <div className="mt-4 rounded-2xl bg-danger/10 p-3 text-sm text-danger">
        <p className="font-semibold">Transaction failed</p>
        <p className="mt-1 break-words">{tx.message}</p>
        <button onClick={onDismiss} className="mt-2 text-xs font-semibold underline">
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl bg-brand/10 p-3 text-sm text-brand-dark">
      <p className="font-semibold">✓ Payment confirmed</p>
      <p className="mt-1 break-all font-mono text-xs text-slate-600">{tx.result.hash}</p>
      <div className="mt-2 flex items-center gap-3">
        <a
          href={tx.result.explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold text-brand-dark underline"
        >
          View on Stellar Expert ↗
        </a>
        <button onClick={onDismiss} className="text-xs font-semibold text-slate-500 underline">
          Dismiss
        </button>
      </div>
    </div>
  );
}
