// The oracle reads the SAME route + policy data as the web app, so the two can
// never drift apart. The single source of truth is web/src/lib/fares.data.json.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(
  readFileSync(join(here, "..", "web", "src", "lib", "fares.data.json"), "utf8")
);

export const POLICIES = data.policies;
export const ROUTES = data.routes;

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
