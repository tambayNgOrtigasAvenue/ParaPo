// Plain-JS mirror of web/src/lib/fares.ts so the oracle can compute fares.
export const POLICIES = {
  jeep: { base: 13, baseKm: 4, perKm: 1.8 },
  ejeep: { base: 15, baseKm: 4, perKm: 2.2 },
  bus: { base: 15, baseKm: 5, perKm: 2.65 },
};

export const ROUTES = [
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

export function getRoute(id) {
  return ROUTES.find((r) => r.id === id);
}

export function discountRate(d) {
  return d === "regular" || !d ? 0 : 0.2;
}

export function roundFare(n) {
  return Math.round(n * 4) / 4;
}

export function fareForDistance(vehicle, distanceKm, discount = "regular") {
  const p = POLICIES[vehicle];
  const extraKm = Math.max(0, distanceKm - p.baseKm);
  const gross = p.base + extraKm * p.perKm;
  return roundFare(gross * (1 - discountRate(discount)));
}
