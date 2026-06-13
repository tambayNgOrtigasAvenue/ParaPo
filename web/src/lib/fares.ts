// PUV fare matrix + discount logic. Distances are in kilometers; fares in PHP.
// Simplified from LTFRB-style distance fares (base fare + per-km increment).
//
// The route + policy DATA lives in `fares.data.json` (the single source of
// truth shared with the oracle). This file adds the TypeScript types and the
// fare math on top of that data.
import fareData from "./fares.data.json";

export type Vehicle = "jeep" | "ejeep" | "bus";
export type Discount = "regular" | "student" | "senior" | "pwd";

export interface FarePolicy {
  base: number; // base fare covering the first `baseKm`
  baseKm: number;
  perKm: number; // increment per km beyond baseKm
}

export const POLICIES = fareData.policies as Record<Vehicle, FarePolicy>;

export interface Stop {
  name: string;
  km: number; // cumulative distance from the route origin
}

export interface Route {
  id: string; // Soroban Symbol, <= 9 chars, e.g. "R_EDSA"
  name: string;
  vehicle: Vehicle;
  stops: Stop[];
}

export const ROUTES = fareData.routes as unknown as Route[];

export function getRoute(id: string): Route | undefined {
  return ROUTES.find((r) => r.id === id);
}

export function discountRate(d: Discount): number {
  return d === "regular" ? 0 : 0.2; // 20% for student / senior / PWD
}

/** Fare for travelling `distanceKm` on a vehicle, after discount. PHP. */
export function fareForDistance(
  vehicle: Vehicle,
  distanceKm: number,
  discount: Discount = "regular"
): number {
  const p = POLICIES[vehicle];
  const extraKm = Math.max(0, distanceKm - p.baseKm);
  const gross = p.base + extraKm * p.perKm;
  const net = gross * (1 - discountRate(discount));
  return roundFare(net);
}

/** Fare between two stop indices on a route. */
export function fareBetween(
  route: Route,
  fromIdx: number,
  toIdx: number,
  discount: Discount = "regular"
): number {
  const a = route.stops[Math.min(fromIdx, toIdx)];
  const b = route.stops[Math.max(fromIdx, toIdx)];
  return fareForDistance(route.vehicle, Math.abs(b.km - a.km), discount);
}

/** Maximum end-to-end fare for a route (boarding at origin, full distance). */
export function routeMaxFare(route: Route, discount: Discount = "regular"): number {
  const last = route.stops[route.stops.length - 1];
  return fareForDistance(route.vehicle, last.km, discount);
}

/** Index of the stop nearest to a given cumulative km. */
export function nearestStopIndex(route: Route, km: number): number {
  let best = 0;
  let bestDist = Infinity;
  route.stops.forEach((s, i) => {
    const d = Math.abs(s.km - km);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

export function roundFare(n: number): number {
  // Round to the nearest 0.25 PHP, the common coin granularity.
  return Math.round(n * 4) / 4;
}

export const VEHICLE_LABEL: Record<Vehicle, string> = {
  jeep: "Jeepney",
  ejeep: "E-Jeep",
  bus: "Bus",
};

export const DISCOUNT_LABEL: Record<Discount, string> = {
  regular: "Regular",
  student: "Student (-20%)",
  senior: "Senior (-20%)",
  pwd: "PWD (-20%)",
};
