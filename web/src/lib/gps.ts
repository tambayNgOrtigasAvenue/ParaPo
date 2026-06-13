// Geolocation utilities: a React hook + haversine distance.
"use client";
import { useEffect, useRef, useState } from "react";

export interface GeoPoint {
  lat: number;
  lng: number;
  accuracy?: number;
  ts: number;
}

const R_KM = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance between two points, in kilometers. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(h));
}

/** Total distance travelled along an ordered track of points (km). */
export function trackDistanceKm(track: GeoPoint[]): number {
  let total = 0;
  for (let i = 1; i < track.length; i++) {
    total += haversineKm(track[i - 1], track[i]);
  }
  return total;
}

export interface GeoState {
  supported: boolean;
  watching: boolean;
  current: GeoPoint | null;
  track: GeoPoint[];
  distanceKm: number;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useGeolocation(): GeoState {
  const [current, setCurrent] = useState<GeoPoint | null>(null);
  const [track, setTrack] = useState<GeoPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
  const watchId = useRef<number | null>(null);

  const supported = typeof navigator !== "undefined" && "geolocation" in navigator;

  const start = () => {
    if (!supported) {
      setError("Geolocation is not supported on this device.");
      return;
    }
    if (watchId.current !== null) return;
    setWatching(true);
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const p: GeoPoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          ts: pos.timestamp,
        };
        setCurrent(p);
        setTrack((t) => {
          const last = t[t.length - 1];
          // Skip near-duplicate points to avoid GPS jitter inflating distance.
          if (last && haversineKm(last, p) < 0.005) return t;
          return [...t, p];
        });
        setError(null);
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );
  };

  const stop = () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setWatching(false);
  };

  const reset = () => {
    setTrack([]);
    setCurrent(null);
  };

  useEffect(() => () => stop(), []);

  return {
    supported,
    watching,
    current,
    track,
    distanceKm: trackDistanceKm(track),
    error,
    start,
    stop,
    reset,
  };
}
