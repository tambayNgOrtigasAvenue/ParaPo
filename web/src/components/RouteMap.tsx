"use client";
import { Route } from "@/lib/fares";

export function RouteMap({
  route,
  boardIdx,
  alightIdx,
  progressKm,
}: {
  route: Route;
  boardIdx?: number;
  alightIdx?: number;
  progressKm?: number;
}) {
  const total = route.stops[route.stops.length - 1].km || 1;
  const pad = 18;
  const width = 320;
  const innerW = width - pad * 2;
  const x = (km: number) => pad + (km / total) * innerW;
  const y = 46;

  return (
    <svg viewBox={`0 0 ${width} 92`} className="w-full">
      {/* base line */}
      <line x1={pad} y1={y} x2={width - pad} y2={y} stroke="rgba(7,42,30,0.12)" strokeWidth={4} strokeLinecap="round" />
      {/* travelled segment */}
      {boardIdx != null && alightIdx != null && (
        <line
          x1={x(route.stops[Math.min(boardIdx, alightIdx)].km)}
          y1={y}
          x2={x(route.stops[Math.max(boardIdx, alightIdx)].km)}
          y2={y}
          stroke="#0FB866"
          strokeWidth={5}
          strokeLinecap="round"
        />
      )}
      {route.stops.map((s, i) => {
        const cx = x(s.km);
        const isBoard = i === boardIdx;
        const isAlight = i === alightIdx;
        const active = isBoard || isAlight;
        return (
          <g key={s.name}>
            <circle
              cx={cx}
              cy={y}
              r={active ? 7 : 4}
              fill={active ? "#F5A623" : "#FFFFFF"}
              stroke={active ? "#F5A623" : "rgba(7,42,30,0.35)"}
              strokeWidth={2}
            />
            <text
              x={cx}
              y={i % 2 === 0 ? y - 14 : y + 22}
              textAnchor="middle"
              fontSize="8"
              fill={active ? "#B26A00" : "rgba(7,42,30,0.55)"}
            >
              {s.name}
            </text>
          </g>
        );
      })}
      {/* live position */}
      {progressKm != null && (
        <circle cx={x(Math.min(progressKm, total))} cy={y} r={5} fill="#0FB866">
          <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  );
}
