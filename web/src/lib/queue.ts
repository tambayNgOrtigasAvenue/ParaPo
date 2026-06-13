// Offline-first outbox. When connectivity is flaky, finalize/cancel actions are
// queued here and retried automatically when the device comes back online.
import { Keypair } from "@stellar/stellar-sdk";
import { finalizeRide, cancelRide } from "./stellar/escrow";

export type QueuedAction =
  | { kind: "finalize"; rideId: string; actualFareStroops: string; createdAt: number }
  | { kind: "cancel"; rideId: string; createdAt: number };

const KEY = "parapo.outbox";

export function loadOutbox(): QueuedAction[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function save(actions: QueuedAction[]) {
  localStorage.setItem(KEY, JSON.stringify(actions));
}

export function enqueue(action: QueuedAction): void {
  const out = loadOutbox();
  out.push(action);
  save(out);
}

export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

/** Attempt to flush the outbox. Returns the number of actions completed. */
export async function flushOutbox(signer: Keypair): Promise<number> {
  if (!isOnline()) return 0;
  let actions = loadOutbox();
  let done = 0;
  for (const action of [...actions]) {
    try {
      if (action.kind === "finalize") {
        await finalizeRide(signer, action.rideId, BigInt(action.actualFareStroops));
      } else if (action.kind === "cancel") {
        await cancelRide(signer, action.rideId);
      }
      actions = actions.filter((a) => a !== action);
      save(actions);
      done++;
    } catch {
      // Leave it queued for the next flush.
      break;
    }
  }
  return done;
}
