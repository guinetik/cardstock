"use client";

import Link from "next/link";
import { LaneMap } from "@/components/lane-map";
import type { CockpitEpic, EpicOutlook } from "@/lib/cockpit";
import { OUTLOOK_LABEL } from "@/lib/cockpit";
import type { LaneMicrocosmRow } from "@/lib/lane-map";
import type { Lane } from "@/lib/types";
import { ClipTaskDialog } from "./clip-task-dialog";
import { EpicEditor } from "./epic-editor";
import { EpicGantt } from "./gantt";
import { TaskLegend, TaskMap } from "./task-map";
import { WorkLeftTrend } from "./trend";

const outlookClass: Record<EpicOutlook, string> = {
  "at-risk": "stat--danger",
  attention: "stat--attention",
  planning: "stat--muted",
  "on-track": "stat--success",
};

const prettyDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${value}T00:00:00Z`))
    : "Not set";

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="cockpit-instrument p-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--color-grey)]">
        {label}
      </p>
      <p className="mt-1 text-xl leading-none">{value}</p>
      <p className="mt-2 text-[11px] text-[var(--color-grey)]">{note}</p>
    </div>
  );
}

export function EpicDetail({
  view,
  cockpitBase,
  cardBase,
  boardHref,
  boardId,
  laneRows,
  inboxLane,
}: {
  view: CockpitEpic;
  cockpitBase: string;
  cardBase: string;
  boardHref: string;
  boardId: string;
  laneRows: LaneMicrocosmRow[];
  inboxLane: Lane | null;
}) {
  const m = view.metrics;
  const unscheduled = view.tasks.filter(
    (task) => !task.planned_start_date || !task.target_date,
  );
  return (
    <>
      <header className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <Link
            href={cockpitBase}
            className="text-xs text-muted-foreground hover:underline"
          >
            ← Whole fleet
          </Link>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-grey)]">
            Epic flight plan
          </p>
          <h1 className="text-[32px] leading-tight">{view.epic.source_name}</h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--color-grey)]">
            {view.epic.outcome ||
              "Describe the outcome so a reader can understand the promise without opening a task."}
          </p>
          <nav
            className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]"
            aria-label="Board views"
          >
            <Link className="paper-link" href={boardHref}>
              Board
            </Link>
            <Link className="paper-link" href={`${boardHref}/timeline`}>
              Timeline
            </Link>
            <Link className="paper-link" href={`${boardHref}/calendar`}>
              Calendar
            </Link>
            <Link className="paper-link" href={`${boardHref}/manage`}>
              Manage
            </Link>
            <Link
              className="paper-link"
              href={boardHref.replace(/\/b\/[^/]+$/, "")}
            >
              Project
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {inboxLane && (
            <ClipTaskDialog
              boardId={boardId}
              lane={inboxLane}
              epic={view.epic}
            />
          )}
          <span className={`stat ${outlookClass[view.outlook]}`}>
            {OUTLOOK_LABEL[view.outlook]}
          </span>
        </div>
      </header>

      <section className="mt-5" aria-label="Where the tasks sit on the board">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-grey)]">
            On the board
          </h2>
          <Link href={boardHref} className="paper-link text-xs">
            Move things on the board →
          </Link>
        </div>
        <LaneMap href={boardHref} rows={laneRows} marks />
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-grey)]">
          Commitment
        </h2>
        <EpicEditor epic={view.epic} />
      </section>

      {(view.reasons.length > 0 || view.confidenceMismatch) && (
        <div className="mt-4 border-l-2 border-[var(--pen-amber)] bg-[var(--surface-card)] p-3 text-sm">
          <b>What needs attention</b>
          <ul className="mt-1 list-disc pl-5 text-[var(--color-grey)]">
            {view.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
            {view.confidenceMismatch && <li>{view.confidenceMismatch}</li>}
          </ul>
        </div>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-grey)]">
          Delivery outlook
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Work left"
            value={
              m.totalEffort
                ? `${m.remainingEffort} of ${m.totalEffort}`
                : `${m.taskCount - m.deliveredCount} tasks`
            }
            note={`${m.coveragePercent}% of remaining tasks estimated`}
          />
          <Metric
            label="Delivery pace"
            value={m.weeklyPace == null ? "Learning" : `${m.weeklyPace}/week`}
            note="Known effort delivered over the last six weeks"
          />
          <Metric
            label="Time to deliver"
            value={
              m.medianDeliveryDays == null
                ? "Learning"
                : `${m.medianDeliveryDays} days`
            }
            note="Typical request-to-delivery time"
          />
          <Metric
            label="Likely landing"
            value={
              m.likelyLanding
                ? prettyDate(m.likelyLanding)
                : "Not enough history"
            }
            note={
              view.epic.target_date
                ? `Committed for ${prettyDate(view.epic.target_date)}`
                : "Set a committed date"
            }
          />
        </div>
      </section>

      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,.55fr)]">
        <section className="cockpit-instrument p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-lg">Task cabin</h2>
              <p className="text-xs text-[var(--color-grey)]">
                Every square is a task. Focus, hover, or click for detail.
              </p>
            </div>
            <TaskLegend />
          </div>
          <TaskMap tasks={view.tasks} cardBase={cardBase} large />
        </section>
        <section className="cockpit-instrument p-4">
          <h2 className="text-lg">Work left</h2>
          <p className="text-xs text-[var(--color-grey)]">
            Measured from real changes, starting with this release.
          </p>
          <div className="mt-3">
            <WorkLeftTrend snapshots={view.snapshots} />
          </div>
        </section>
      </div>

      <section className="cockpit-instrument mt-6 p-4">
        <div className="mb-2">
          <h2 className="text-lg">Flight plan</h2>
          <p className="text-xs text-[var(--color-grey)]">
            Planned start to target. Click a bar to open the task.
          </p>
        </div>
        <EpicGantt
          tasks={view.tasks}
          cardBase={cardBase}
          epicStart={view.epic.start_date}
          epicTarget={view.epic.target_date}
        />
        {unscheduled.length > 0 && (
          <details className="border-t border-[var(--border-hairline)] pt-3">
            <summary className="cursor-pointer text-xs font-medium">
              {unscheduled.length} task
              {unscheduled.length === 1 ? " needs" : "s need"} complete dates
            </summary>
            <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
              {unscheduled.map((task) => (
                <li key={task.id}>
                  <a
                    className="paper-link"
                    href={`${cardBase}/${task.external_id}?from=cockpit&epic=${view.epic.id}`}
                  >
                    #{task.external_id} {task.title}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </>
  );
}
