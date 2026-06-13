"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/store";
import { Unlock } from "./Unlock";
import { isConfigured } from "@/lib/stellar/config";

export function AppGate({ children }: { children: React.ReactNode }) {
  const { record, keypair, hydrate } = useSession();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    hydrate().finally(() => setReady(true));
  }, [hydrate]);

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center text-slate-400">Loading…</div>
    );
  }

  if (!isConfigured()) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="card w-full">
          <h1 className="text-lg font-extrabold text-accent">Not configured</h1>
          <p className="mt-2 text-sm text-slate-500">
            The contract + XLM addresses are missing. Run the deploy scripts to
            generate <code className="rounded bg-brand/10 px-1 text-brand-dark">web/.env.local</code>:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-2xl bg-ink p-3 text-left text-xs text-brand-light">
{`cd scripts
npm install
npm run setup && npm run deploy && npm run seed`}
          </pre>
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="card w-full">
          <h1 className="text-lg font-extrabold text-ink">No wallet yet</h1>
          <p className="mt-2 text-sm text-slate-500">
            Create or import a wallet to continue.
          </p>
          <Link href="/onboarding" className="btn-primary mt-4 w-full">
            Set up wallet
          </Link>
        </div>
      </div>
    );
  }

  if (!keypair) return <Unlock />;

  return <>{children}</>;
}
