import Link from "next/link";
import { Header } from "@/components/Header";

function RoleCard({ href, emoji, title, desc }: { href: string; emoji: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="card group flex items-center gap-4 transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-glow"
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand/10 text-2xl">
        {emoji}
      </span>
      <div className="flex-1">
        <h2 className="font-bold text-ink">{title}</h2>
        <p className="text-sm text-slate-500">{desc}</p>
      </div>
      <span className="text-brand transition group-hover:translate-x-0.5">→</span>
    </Link>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <li className="flex items-start gap-3 text-sm text-slate-600">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/10 text-xs font-bold text-brand-dark">
        {n}
      </span>
      <span>{text}</span>
    </li>
  );
}

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex flex-1 flex-col gap-6 px-5 py-6">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink via-surface to-ink px-6 py-8 text-center text-white shadow-balance">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-brand/25 blur-3xl"
          />
          <span className="relative inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-brand-light">
            ● Stellar-powered fares
          </span>
          <h1 className="relative mt-4 text-4xl font-extrabold tracking-tight">
            Para<span className="text-brand-light">Po</span>
          </h1>
          <p className="relative mx-auto mt-2 max-w-xs text-sm text-white/70">
            Decentralized PUV fares on Stellar. Scan to ride, pay the exact fare,
            get the rest refunded — automatically.
          </p>
          <Link
            href="/onboarding"
            className="relative mt-5 inline-flex w-full items-center justify-center rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white shadow-glow transition hover:bg-brand-dark"
          >
            Get started
          </Link>
        </section>

        <section className="grid gap-3">
          <RoleCard href="/driver" emoji="🚍" title="I'm a Driver" desc="Start a biyahe, show your rotating QR, collect fares on-chain." />
          <RoleCard href="/commuter" emoji="🧑‍🦱" title="I'm a Commuter" desc="Scan to board, ride, then scan to alight. Pay only for distance." />
          <RoleCard href="/coop" emoji="🏛️" title="Cooperative dashboard" desc="Read-only visibility into rides and earnings. No custody." />
          <RoleCard href="/wallet" emoji="🛰️" title="Freighter wallet" desc="Connect Freighter, view your XLM balance, and send a testnet payment." />
        </section>

        <section className="card">
          <h3 className="text-sm font-bold text-ink">How escrow protects everyone</h3>
          <ol className="mt-3 space-y-3">
            <Step n={1} text="Board → the full route fare is locked in escrow." />
            <Step n={2} text="Ride → GPS tracks the distance travelled." />
            <Step n={3} text="Alight → driver gets the exact fare, you're refunded the rest." />
          </ol>
        </section>

        <footer className="mt-auto pt-2 text-center text-xs text-slate-400">
          Stellar testnet · Native XLM · No real funds
        </footer>
      </main>
    </>
  );
}
