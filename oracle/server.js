// ParaPo oracle: serves the route fare matrix and attests GPS distance -> fare.
// Optional component; the PWA can compute fares locally if the oracle is offline.
import express from "express";
import cors from "cors";
import { ROUTES, getRoute, fareForDistance } from "./fares.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

app.get("/health", (_req, res) => res.json({ ok: true, service: "parapo-oracle" }));

// Full fare matrix.
app.get("/routes", (_req, res) => res.json({ routes: ROUTES }));

// Fare between two stop indices: /fare?route=R_EDSA&from=0&to=3&discount=senior
app.get("/fare", (req, res) => {
  const route = getRoute(req.query.route);
  if (!route) return res.status(404).json({ error: "unknown route" });
  const from = Number(req.query.from ?? 0);
  const to = Number(req.query.to ?? route.stops.length - 1);
  const a = route.stops[Math.min(from, to)];
  const b = route.stops[Math.max(from, to)];
  if (!a || !b) return res.status(400).json({ error: "bad stop index" });
  const distanceKm = Math.abs(b.km - a.km);
  const fare = fareForDistance(route.vehicle, distanceKm, req.query.discount);
  res.json({ route: route.id, distanceKm, fare, discount: req.query.discount ?? "regular" });
});

// Attest a travelled distance into a fare: { route, distanceKm, discount }
app.post("/attest", (req, res) => {
  const { route: routeId, distanceKm, discount } = req.body || {};
  const route = getRoute(routeId);
  if (!route) return res.status(404).json({ error: "unknown route" });
  const km = Number(distanceKm);
  if (!Number.isFinite(km) || km < 0) {
    return res.status(400).json({ error: "bad distanceKm" });
  }
  const fare = fareForDistance(route.vehicle, km, discount);
  res.json({
    route: route.id,
    distanceKm: km,
    fare,
    discount: discount ?? "regular",
    attestedAt: Date.now(),
  });
});

app.listen(PORT, () => {
  console.log(`ParaPo oracle listening on http://localhost:${PORT}`);
});
