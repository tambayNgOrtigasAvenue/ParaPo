// High-level fare-escrow contract bindings.
import { Address, nativeToScVal, Keypair } from "@stellar/stellar-sdk";
import { STELLAR } from "./config";
import { invokeContract, readContract } from "./client";

export type RideStatus = "Active" | "Completed" | "Cancelled";

export interface Ride {
  id: string;
  commuter: string;
  driver: string;
  routeId: string;
  maxFare: bigint;
  actualFare: bigint;
  status: RideStatus;
  startedAt: number;
  finalizedAt: number;
}

function addr(pub: string) {
  return new Address(pub).toScVal();
}
function i128(v: bigint) {
  return nativeToScVal(v, { type: "i128" });
}
function u64(v: number | bigint | string) {
  return nativeToScVal(BigInt(v), { type: "u64" });
}
function sym(v: string) {
  return nativeToScVal(v, { type: "symbol" });
}

function normalizeStatus(raw: unknown): RideStatus {
  // scValToNative may yield "Active" or { tag: "Active" } depending on SDK.
  if (typeof raw === "string") return raw as RideStatus;
  if (raw && typeof raw === "object" && "tag" in raw) {
    return (raw as { tag: RideStatus }).tag;
  }
  return "Active";
}

function decodeRide(raw: any): Ride {
  return {
    id: String(raw.id),
    commuter: raw.commuter,
    driver: raw.driver,
    routeId: raw.route_id,
    maxFare: BigInt(raw.max_fare),
    actualFare: BigInt(raw.actual_fare),
    status: normalizeStatus(raw.status),
    startedAt: Number(raw.started_at),
    finalizedAt: Number(raw.finalized_at),
  };
}

/** Board: lock `maxFareStroops` PHPx and open a ride. Returns the ride id. */
export async function startRide(
  signer: Keypair,
  driver: string,
  routeId: string,
  maxFareStroops: bigint
): Promise<string> {
  const { value } = await invokeContract<bigint>(
    STELLAR.fareEscrowId,
    "start_ride",
    [addr(signer.publicKey()), addr(driver), sym(routeId), i128(maxFareStroops)],
    signer
  );
  return String(value);
}

/** Alight: pay the driver `actualFareStroops` and refund the remainder. */
export async function finalizeRide(
  signer: Keypair,
  rideId: string,
  actualFareStroops: bigint
): Promise<Ride> {
  const { value } = await invokeContract<any>(
    STELLAR.fareEscrowId,
    "finalize_ride",
    [u64(rideId), i128(actualFareStroops)],
    signer
  );
  return decodeRide(value);
}

/** Cancel an active ride; refunds the full locked amount to the commuter. */
export async function cancelRide(signer: Keypair, rideId: string): Promise<Ride> {
  const { value } = await invokeContract<any>(
    STELLAR.fareEscrowId,
    "cancel_ride",
    [u64(rideId), addr(signer.publicKey())],
    signer
  );
  return decodeRide(value);
}

export async function getRide(rideId: string, readerPublicKey: string): Promise<Ride> {
  const raw = await readContract<any>(
    STELLAR.fareEscrowId,
    "get_ride",
    [u64(rideId)],
    readerPublicKey
  );
  return decodeRide(raw);
}

export async function getRideCount(readerPublicKey: string): Promise<number> {
  const raw = await readContract<bigint>(
    STELLAR.fareEscrowId,
    "get_ride_count",
    [],
    readerPublicKey
  );
  return Number(raw);
}

/** Read every ride on-chain (newest first). Fine for a hackathon-scale ledger. */
export async function fetchRides(
  readerPublicKey: string,
  limit = 50
): Promise<Ride[]> {
  const count = await getRideCount(readerPublicKey);
  const start = Math.max(0, count - limit);
  const ids: number[] = [];
  for (let i = count - 1; i >= start; i--) ids.push(i);
  const rides = await Promise.all(
    ids.map((id) =>
      getRide(String(id), readerPublicKey).catch(() => null as Ride | null)
    )
  );
  return rides.filter((r): r is Ride => r !== null);
}
