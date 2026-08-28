"use client";

import { scaleUtc } from "d3-scale";
import { timeFormat } from "d3-time-format";
import type { CockpitTask } from "@/lib/cockpit";

const fmt = timeFormat("%b %d");
const parse = (s: string) => new Date(`${s}T00:00:00Z`);

export function EpicGantt({
  tasks,
  cardBase,
  epicStart,
  epicTarget,
}: {
  tasks: CockpitTask[];
  cardBase: string;
  epicStart: string | null;
  epicTarget: string | null;
}) {
  const scheduled = tasks
    .filter((t) => t.planned_start_date && t.target_date)
    .sort((a, b) => a.planned_start_date!.localeCompare(b.planned_start_date!));
  if (!scheduled.length)
    return (
      <p className="py-8 text-sm text-[var(--color-grey)]">
        No complete task date ranges yet. Add a planned start and target to
        place a task on the flight plan.
      </p>
    );
  const dates = scheduled.flatMap((t) => [
    parse(t.planned_start_date!),
    parse(t.target_date!),
  ]);
  if (epicStart) dates.push(parse(epicStart));
  if (epicTarget) dates.push(parse(epicTarget));
  const start = new Date(Math.min(...dates.map(Number)) - 3 * 86_400_000);
  const end = new Date(Math.max(...dates.map(Number)) + 3 * 86_400_000);
  const width = 980,
    label = 190,
    right = 24,
    row = 30,
    top = 36;
  const height = top + scheduled.length * row + 18;
  const x = scaleUtc()
    .domain([start, end])
    .range([label, width - right]);
  const ticks = x.ticks(
    Math.min(
      8,
      Math.max(
        3,
        Math.round((end.getTime() - start.getTime()) / (14 * 86_400_000)),
      ),
    ),
  );
  const colors = {
    delivered: "var(--pen-green)",
    blocked: "var(--pen-red)",
    late: "var(--pen-amber)",
    moving: "var(--pen-blue)",
    queued: "var(--color-grey-faint)",
  };
  const todayX = x(new Date());
  return (
    <div className="overflow-x-auto pb-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="min-w-[760px] w-full"
        aria-label="Epic task flight plan"
      >
        {ticks.map((tick) => (
          <g key={tick.toISOString()}>
            <line
              x1={x(tick)}
              x2={x(tick)}
              y1={top - 12}
              y2={height}
              stroke="var(--border-hairline)"
            />
            <text
              x={x(tick)}
              y="13"
              textAnchor="middle"
              className="fill-[var(--color-grey)] text-[10px]"
            >
              {fmt(tick)}
            </text>
          </g>
        ))}
        {todayX >= label && todayX <= width - right && (
          <g>
            <line
              x1={todayX}
              x2={todayX}
              y1={top - 18}
              y2={height}
              stroke="var(--color-ink)"
              strokeDasharray="3 3"
            />
            <text
              x={todayX + 4}
              y="25"
              className="fill-[var(--color-ink)] text-[9px] uppercase"
            >
              Today
            </text>
          </g>
        )}
        {scheduled.map((task, i) => {
          const y = top + i * row;
          const from = x(parse(task.planned_start_date!));
          const to = x(parse(task.target_date!));
          return (
            <a
              key={task.id}
              href={`${cardBase}/${task.external_id}?from=cockpit&epic=${task.epic_id}`}
              aria-label={`#${task.external_id} ${task.title}, ${task.planned_start_date} to ${task.target_date}`}
            >
              <text
                x="0"
                y={y + 16}
                className="fill-[var(--color-ink)] text-[11px]"
              >
                <tspan className="fill-[var(--color-grey)] font-mono">
                  #{task.external_id}
                </tspan>{" "}
                {task.title.length > 23
                  ? `${task.title.slice(0, 22)}…`
                  : task.title}
              </text>
              <rect
                x={from}
                y={y + 6}
                width={Math.max(5, to - from)}
                height="12"
                rx="1"
                fill={colors[task.signal]}
              >
                <title>
                  {task.title}: {task.planned_start_date} → {task.target_date}
                </title>
              </rect>
            </a>
          );
        })}
      </svg>
    </div>
  );
}
