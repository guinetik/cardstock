"use client";

import { extent } from "d3-array";
import { scaleLinear, scaleUtc } from "d3-scale";
import { line } from "d3-shape";
import type { EpicSnapshot } from "@/lib/types";

export function WorkLeftTrend({ snapshots }: { snapshots: EpicSnapshot[] }) {
  if (snapshots.length < 2)
    return (
      <div className="flex h-28 items-center justify-center border border-dashed border-[var(--border-hairline)] text-xs text-[var(--color-grey)]">
        Tracking since {snapshots[0]?.captured_on ?? "this release"}. A trend
        appears after work changes.
      </div>
    );
  const points = snapshots.map((s) => ({
    date: new Date(`${s.captured_on}T00:00:00Z`),
    value: s.remaining_effort,
  }));
  const domain = extent(points, (p) => p.date) as [Date, Date];
  const width = 520,
    height = 132;
  const x = scaleUtc()
    .domain(domain)
    .range([10, width - 10]);
  const y = scaleLinear()
    .domain([0, Math.max(1, ...points.map((p) => p.value))])
    .nice()
    .range([height - 22, 10]);
  const path = line<(typeof points)[number]>()
    .x((p) => x(p.date))
    .y((p) => y(p.value))(points);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-32 w-full"
      aria-label="Work left over time"
    >
      <line
        x1="10"
        x2={width - 10}
        y1={height - 22}
        y2={height - 22}
        stroke="var(--border-strong)"
      />
      {path && (
        <path d={path} fill="none" stroke="var(--pen-blue)" strokeWidth="2" />
      )}
      {points.map((p) => (
        <circle
          key={p.date.toISOString()}
          cx={x(p.date)}
          cy={y(p.value)}
          r="3"
          fill="var(--pen-blue)"
        >
          <title>
            {p.date.toISOString().slice(0, 10)}: {p.value} effort left
          </title>
        </circle>
      ))}
    </svg>
  );
}
