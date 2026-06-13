// Local ride receipts (per wallet), persisted in localStorage. This is a cache
// for the UI/history; the on-chain contract remains the source of truth.
export interface RideReceipt {
  rideId: string;
  role: "driver" | "commuter";
  self: string; // this wallet's public key
  counterparty: string; // the other party
  routeId: string;
  routeName: string;
  boardStop?: string;
  alightStop?: string;
  maxFarePhp: number;
  actualFarePhp?: number;
  refundPhp?: number;
  status: "active" | "completed" | "cancelled";
  startedAt: number;
  finalizedAt?: number;
  startTxHash?: string;
  finalizeTxHash?: string;
}

const KEY = (pub: string) => `parapo.rides.${pub}`;

export function loadRides(pub: string): RideReceipt[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY(pub)) || "[]");
  } catch {
    return [];
  }
}

export function saveRide(pub: string, ride: RideReceipt): void {
  const rides = loadRides(pub);
  const idx = rides.findIndex((r) => r.rideId === ride.rideId);
  if (idx >= 0) rides[idx] = ride;
  else rides.unshift(ride);
  localStorage.setItem(KEY(pub), JSON.stringify(rides.slice(0, 100)));
}

export function getActiveRide(pub: string): RideReceipt | undefined {
  return loadRides(pub).find((r) => r.status === "active");
}
