"use client";

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
  const taskHeight = large ? 28 : 24;
  const minimumWidth = large ? 72 : 64;
  const segmentWidth = large ? 18 : 16;
  const inset = 4;
  const [tip, setTip] = useState<{
    task: CockpitTask;
    x: number;
    y: number;
  } | null>(null);

  return (
    <div
      className="cockpit-map relative min-w-0 max-w-full overflow-x-auto p-0.5"
      data-testid="task-map"
    >
      <nav
        className="flex flex-wrap gap-3"
        aria-label={`${tasks.length} tasks`}
      >
        {sorted.map((task) => {
          const signal = SIGNAL[task.signal];
          const checklist = (task.card_checklist_items ?? [])
            .slice()
            .sort((a, b) => a.position - b.position);
          const completed = checklist.filter((s) => s.completed).length;
          const taskWidth = Math.max(
            minimumWidth,
            checklist.length * segmentWidth + inset * 2,
          );
          const innerWidth = taskWidth - inset * 2;
          const href = `${cardBase}/${task.external_id}?from=cockpit&epic=${encodeURIComponent(task.epic_id ?? "")}`;
          return (
            <a
              key={task.id}
              className="block shrink-0"
              style={{ width: taskWidth, height: taskHeight }}
              href={href}
              aria-label={`#${task.external_id} ${task.title}. ${signal.label}.${checklist.length ? ` ${completed}/${checklist.length} checklist items completed.` : ""}`}
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
              <span className="sr-only">
                #{task.external_id} {task.title} — {signal.label}
              </span>
              <svg
                width={taskWidth}
                height={taskHeight}
                viewBox={`0 0 ${taskWidth} ${taskHeight}`}
                className="block"
                aria-hidden="true"
              >
                <rect
                  x={1}
                  y={1}
                  width={taskWidth - 2}
                  height={taskHeight - 2}
                  rx="1"
                  fill={signal.color}
                  className="cockpit-task-square"
                />
                {checklist.map((item, n) => (
                  <rect
                    key={item.id}
                    x={inset + (n * innerWidth) / checklist.length}
                    y={inset}
                    width={innerWidth / checklist.length}
                    height={taskHeight - inset * 2}
                    fill={
                      item.completed
                        ? "var(--pen-green)"
                        : "var(--color-grey-faint)"
                    }
                    stroke="white"
                    strokeWidth={1}
                    data-completed={item.completed}
                    pointerEvents="none"
                  />
                ))}
                {signal.mark && !checklist.length && (
                  <text
                    x={taskWidth / 2}
                    y={taskHeight / 2 + 3.5}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="700"
                    fill="var(--pen-ink)"
                    pointerEvents="none"
                  >
                    {signal.mark}
                  </text>
                )}
              </svg>
            </a>
          );
        })}
      </nav>
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
              {!!tip.task.card_checklist_items?.length && (
                <span>
                  {
                    tip.task.card_checklist_items.filter((s) => s.completed)
                      .length
                  }
                  /{tip.task.card_checklist_items.length} checklist items
                  completed
                </span>
              )}
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
      <span>
        Background: task status · green segments: completed checklist items
      </span>
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
