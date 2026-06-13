"use client";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/store";
import { flushOutbox, loadOutbox } from "@/lib/queue";

export function OutboxFlusher() {
  const { keypair } = useSession();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    setPending(loadOutbox().length);
    if (!keypair) return;

    const run = async () => {
      await flushOutbox(keypair).catch(() => {});
      setPending(loadOutbox().length);
    };
    run();
    window.addEventListener("online", run);
    const iv = setInterval(run, 20_000);
    return () => {
      window.removeEventListener("online", run);
      clearInterval(iv);
    };
  }, [keypair]);

  if (pending === 0) return null;
  return (
    <div className="rounded-2xl border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-medium text-accent">
      {pending} payment{pending > 1 ? "s" : ""} queued — will settle automatically when online.
    </div>
  );
}
