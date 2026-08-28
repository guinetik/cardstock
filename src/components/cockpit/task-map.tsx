"use client";

import { scaleBand } from "d3-scale";
import { useState } from "react";
import { createPortal } from "react-dom";
import type { CockpitTask, TaskSignal } from "@/lib/cockpit";

const SIGNAL: Record<
  TaskSignal,
  { label: string; color: string; mark: string }
> = {
  delivered: { label: "Delivered", color: "var(--pen-green)", mark: "✓" },
  blocked: { label: "Blocked", color: "var(--pen-red)", mark: "!" },
  late: { label: "Late", color: "var(--pen-amber)", mark: "◷" },
  moving: { label: "Moving", color: "var(--pen-blue)", mark: "→" },
  queued: { label: "Queued", color: "var(--color-grey-faint)", mark: "" },
};

export function TaskMap({
  tasks,
  cardBase,
  large = false,
}: {
  tasks: CockpitTask[];
  cardBase: string;
  large?: boolean;
}) {
  const sorted = tasks.slice().sort((a, b) => {
    const order: Record<TaskSignal, number> = {
      blocked: 0,
      late: 1,
      moving: 2,
      queued: 3,
      delivered: 4,
    };
    return (
      order[a.signal] - order[b.signal] ||
      (a.target_date ?? "9999").localeCompare(b.target_date ?? "9999") ||
      a.external_id.localeCompare(b.external_id)
    );
  });
  const cols = Math.min(
    large ? 24 : 16,
    Math.max(6, Math.ceil(Math.sqrt(sorted.length * (large ? 2.8 : 2)))),
  );
  const rows = Math.max(1, Math.ceil(sorted.length / cols));
  const width = large ? 720 : 320;
  const height = Math.max(28, rows * (large ? 25 : 20));
  const x = scaleBand<number>()
    .domain(Array.from({ length: cols }, (_, i) => i))
    .range([0, width])
    .padding(0.18);
  const y = scaleBand<number>()
    .domain(Array.from({ length: rows }, (_, i) => i))
    .range([0, height])
    .padding(0.18);
  const [tip, setTip] = useState<{
    task: CockpitTask;
    x: number;
    y: number;
  } | null>(null);

  return (
    <div className="cockpit-map relative" data-testid="task-map">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block w-full"
        aria-label={`${tasks.length} tasks`}
      >
        {sorted.map((task, i) => {
          const cx = x(i % cols) ?? 0;
          const cy = y(Math.floor(i / cols)) ?? 0;
          const signal = SIGNAL[task.signal];
          const href = `${cardBase}/${task.external_id}?from=cockpit&epic=${encodeURIComponent(task.epic_id ?? "")}`;
          return (
            <a
              key={task.id}
              href={href}
              aria-label={`#${task.external_id} ${task.title}. ${signal.label}.`}
              onPointerEnter={(e) =>
                setTip({ task, x: e.clientX, y: e.clientY })
              }
              onPointerMove={(e) =>
                setTip({ task, x: e.clientX, y: e.clientY })
              }
              onPointerLeave={() => setTip(null)}
              onFocus={(e) => {
                const box = e.currentTarget.getBoundingClientRect();
                setTip({ task, x: box.right, y: box.top + box.height / 2 });
              }}
              onBlur={() => setTip(null)}
            >
              <rect
                x={cx}
                y={cy}
                width={x.bandwidth()}
                height={y.bandwidth()}
                rx="1"
                fill={signal.color}
                className="cockpit-task-square"
              />
              {signal.mark && x.bandwidth() >= 12 && (
                <text
                  x={cx + x.bandwidth() / 2}
                  y={cy + y.bandwidth() / 2 + 3.5}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="700"
                  fill="var(--pen-ink)"
                  pointerEvents="none"
                >
                  {signal.mark}
                </text>
              )}
            </a>
          );
        })}
      </svg>
      {tip && typeof document !== "undefined"
        ? createPortal(
            <div
              className="cockpit-tooltip"
              style={{
                left: Math.max(
                  8,
                  Math.min(tip.x + 12, window.innerWidth - 288),
                ),
                top:
                  tip.y + 104 > window.innerHeight
                    ? Math.max(8, tip.y - 92)
                    : tip.y + 12,
              }}
              role="tooltip"
            >
              <b>
                #{tip.task.external_id} {tip.task.title}
              </b>
              <span>
                {SIGNAL[tip.task.signal].label}
                {tip.task.effort
                  ? ` · ${tip.task.effort} effort`
                  : " · effort not set"}
                {tip.task.target_date ? ` · due ${tip.task.target_date}` : ""}
              </span>
              {tip.task.needs && <span>Needs {tip.task.needs}</span>}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function TaskLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] uppercase tracking-[0.09em] text-[var(--color-grey)]">
      {(
        Object.entries(SIGNAL) as [TaskSignal, (typeof SIGNAL)[TaskSignal]][]
      ).map(([key, item]) => (
        <span key={key} className="flex items-center gap-1.5">
          <i className="block size-2.5" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
