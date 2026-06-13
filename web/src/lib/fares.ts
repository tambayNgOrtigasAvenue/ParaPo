// PUV fare matrix + discount logic. Distances are in kilometers; fares in PHP.
// Simplified from LTFRB-style distance fares (base fare + per-km increment).

export type Vehicle = "jeep" | "ejeep" | "bus";
export type Discount = "regular" | "student" | "senior" | "pwd";

export interface FarePolicy {
  base: number; // base fare covering the first `baseKm`
  baseKm: number;
  perKm: number; // increment per km beyond baseKm
}

export const POLICIES: Record<Vehicle, FarePolicy> = {
  jeep: { base: 13, baseKm: 4, perKm: 1.8 },
  ejeep: { base: 15, baseKm: 4, perKm: 2.2 },
  bus: { base: 15, baseKm: 5, perKm: 2.65 },
};

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

export const ROUTES: Route[] = [
  {
    id: "R_EDSA",
    name: "EDSA Carousel (Monumento - Taft)",
    vehicle: "bus",
    stops: [
      { name: "Monumento", km: 0 },
      { name: "Balintawak", km: 3.2 },
      { name: "Cubao", km: 8.5 },
      { name: "Ortigas", km: 12.1 },
      { name: "Guadalupe", km: 15.0 },
      { name: "Ayala", km: 18.4 },
      { name: "Taft Ave", km: 22.0 },
    ],
  },
  {
    id: "R_CUBAO",
    name: "Cubao - SSS Village (Jeep)",
    vehicle: "jeep",
    stops: [
      { name: "Cubao", km: 0 },
      { name: "Anonas", km: 1.8 },
      { name: "Katipunan", km: 3.5 },
      { name: "Marikina Bridge", km: 6.2 },
      { name: "SSS Village", km: 8.0 },
    ],
  },
  {
    id: "R_BGC",
    name: "BGC Loop (E-Jeep)",
    vehicle: "ejeep",
    stops: [
      { name: "Market! Market!", km: 0 },
      { name: "Mind Museum", km: 1.2 },
      { name: "High Street", km: 2.0 },
      { name: "Uptown", km: 3.1 },
      { name: "Terminal", km: 4.4 },
    ],
  },
];

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
