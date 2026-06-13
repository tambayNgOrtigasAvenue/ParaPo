"use client";
import Link from "next/link";
import { OnlineBadge } from "./OnlineBadge";
import { useSession } from "@/lib/store";
import { shortKey } from "@/lib/format";

export function Header({ title, back }: { title?: string; back?: string }) {
  const { record, lock, keypair } = useSession();
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-200/70 bg-paper/80 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-2">
        {back ? (
          <Link
            href={back}
            className="grid h-8 w-8 place-items-center rounded-full bg-white text-slate-500 shadow-card transition hover:text-ink"
            aria-label="Back"
          >
            ←
          </Link>
        ) : null}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-extrabold tracking-tight text-ink">Para<span className="text-brand">Po</span></span>
        </Link>
        {title && <span className="text-sm font-medium text-slate-400">/ {title}</span>}
      </div>
      <div className="flex items-center gap-2">
        <OnlineBadge />
        {record && keypair && (
          <button
            className="pill bg-white text-slate-600 shadow-card hover:text-ink"
            onClick={lock}
            title={record.publicKey}
          >
            {shortKey(record.publicKey)} · Lock
          </button>
        )}
      </div>
    </header>
  );
}
