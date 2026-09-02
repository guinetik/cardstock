"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LaneMap } from "@/components/lane-map";
import type { CockpitEpic, CockpitModel, EpicOutlook } from "@/lib/cockpit";
import { OUTLOOK_LABEL } from "@/lib/cockpit";
import type { LaneMicrocosmRow } from "@/lib/lane-map";
import { CreateEpicDialog } from "./create-epic-dialog";
import { EpicOnboarding } from "./epic-onboarding";
import { TaskLegend, TaskMap } from "./task-map";

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

function EpicTile({
  view,
  cockpitBase,
  cardBase,
}: {
  view: CockpitEpic;
  cockpitBase: string;
  cardBase: string;
}) {
  const metrics = view.metrics;
  return (
    <article
      className={`cockpit-epic cockpit-epic--${view.outlook}`}
      data-outlook={view.outlook}
    >
      <header className="flex items-start gap-3 border-b border-[var(--border-hairline)] pb-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--color-grey-faint)]">
            Epic · {view.epic.owner_label || "Owner not set"}
          </p>
          <h2 className="truncate text-lg">
            <Link
              className="hover:underline"
              href={`${cockpitBase}/${view.epic.id}`}
            >
              {view.epic.source_name}
            </Link>
          </h2>
          <p className="mt-1 line-clamp-2 min-h-9 text-xs text-[var(--color-grey)]">
            {view.epic.outcome || "Outcome not described yet."}
          </p>
        </div>
        <span className={`stat ${outlookClass[view.outlook]}`}>
          {OUTLOOK_LABEL[view.outlook]}
        </span>
      </header>
      <div className="mt-3">
        {view.tasks.length ? (
          <TaskMap tasks={view.tasks} cardBase={cardBase} />
        ) : (
          <p className="py-2 text-xs text-[var(--color-grey-faint)]">
            No tasks yet — open the epic to clip tasks in, or assign them from
            the board.
          </p>
        )}
      </div>
      <footer className="mt-3 flex flex-wrap items-end justify-between gap-2 border-t border-[var(--border-hairline)] pt-3 text-xs">
        <span>
          <b>
            {metrics.deliveredCount} of {metrics.taskCount}
          </b>{" "}
          delivered
          {metrics.blockedCount ? ` · ${metrics.blockedCount} blocked` : ""}
          {metrics.lateCount ? ` · ${metrics.lateCount} late` : ""}
        </span>
        <span className="text-right text-[var(--color-grey)]">
          <small className="block uppercase tracking-[0.1em]">Commitment</small>
          <b className="font-mono text-[var(--color-ink)]">
            {prettyDate(view.epic.target_date)}
          </b>
        </span>
      </footer>
    </article>
  );
}

function SummaryMetric({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: "info" | "danger" | "attention" | "success";
}) {
  const toneClass = {
    info: "stat--info",
    danger: "stat--danger",
    attention: "stat--attention",
    success: "stat--success",
  }[tone];
  return (
    <div className="paper-card paper-card--static p-4">
      <p className={`stat ${toneClass}`}>{label}</p>
      <p className="mt-3 font-mono text-[26px] leading-none text-[var(--color-ink)]">
        {value}
      </p>
      <p className="mt-2 text-xs text-[var(--color-grey)]">{note}</p>
    </div>
  );
}

export function CockpitView({
  model,
  boardId,
  cockpitBase,
  cardBase,
  boardHref,
  laneRows,
  cardCount,
}: {
  model: CockpitModel;
  boardId: string;
  cockpitBase: string;
  cardBase: string;
  boardHref: string;
  laneRows: LaneMicrocosmRow[];
  cardCount: number;
}) {
  const [query, setQuery] = useState("");
  const [outlook, setOutlook] = useState<"all" | EpicOutlook>("all");
  // Sticky for the visit: createEpic revalidates the page mid-flow, and the
  // arriving epics must not yank the onboarding away before Done is clicked.
  const [onboarding, setOnboarding] = useState(
    model.active.length + model.completed.length === 0,
  );
  const filtered = useMemo(
    () =>
      model.active.filter((view) => {
        const search = query.trim().toLowerCase();
        return (
          (outlook === "all" || view.outlook === outlook) &&
          (!search ||
            [
              view.epic.source_name,
              view.epic.outcome,
              view.epic.owner_label,
              ...view.tasks.map((task) => task.title),
            ].some((value) => value?.toLowerCase().includes(search)))
        );
      }),
    [model.active, outlook, query],
  );
  const atRisk = model.active.filter(
    (view) => view.outlook === "at-risk",
  ).length;
  const blocked = model.active.reduce(
    (count, view) => count + view.metrics.blockedCount,
    0,
  );
  const today = new Date();
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const next30 = model.active.filter(
    (view) =>
      view.epic.target_date &&
      new Date(`${view.epic.target_date}T00:00:00Z`).getTime() >= todayUtc &&
      new Date(`${view.epic.target_date}T00:00:00Z`).getTime() <=
        todayUtc + 30 * 86_400_000,
  ).length;

  return (
    <>
      <section>
        <div className="mb-2 flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-grey)]">
            Fleet status
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-grey-faint)]">
            Live from this board
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryMetric
            label="Active epics"
            value={String(model.active.length)}
            note="Across this board"
            tone="info"
          />
          <SummaryMetric
            label="Date at risk"
            value={String(atRisk)}
            note="Needs a decision"
            tone="danger"
          />
          <SummaryMetric
            label="Blocked tasks"
            value={String(blocked)}
            note="Across active epics"
            tone="attention"
          />
          <SummaryMetric
            label="Landing in 30 days"
            value={String(next30)}
            note="By committed date"
            tone="success"
          />
        </div>
      </section>

      <section className="mt-6" aria-label="Board at a glance">
        <div className="mb-2 flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-grey)]">
            On the board
          </h2>
          <Link href={boardHref} className="paper-link text-xs">
            Open board →
          </Link>
        </div>
        <div className="paper-card paper-card--static p-3">
          {cardCount > 0 ? (
            <>
              <LaneMap href={boardHref} rows={laneRows} />
              <p className="binder-count mt-2">
                {cardCount} card{cardCount === 1 ? "" : "s"}
              </p>
            </>
          ) : (
            <p className="text-sm text-[var(--color-grey)]">No cards yet</p>
          )}
        </div>
      </section>

      {model.unassigned.length > 0 && (
        <p className="mt-4 border-l-2 border-[var(--pen-amber)] bg-[var(--surface-card)] px-3 py-2 text-sm">
          <b>
            {model.unassigned.length} unassigned task
            {model.unassigned.length === 1 ? "" : "s"}
          </b>{" "}
          cannot contribute to an epic outlook yet.
        </p>
      )}

      {onboarding ? (
        <EpicOnboarding
          boardId={boardId}
          unassigned={model.unassigned}
          onDoneAction={() => setOnboarding(false)}
        />
      ) : (
        <>
          <section className="mt-8">
            <div className="mb-2 flex items-baseline justify-between gap-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-grey)]">
                Epics
              </h2>
              <CreateEpicDialog boardId={boardId} />
            </div>
            <div className="paper-lane p-3">
              <div className="flex flex-wrap gap-2">
                <input
                  className="paper-field h-8 min-w-64 flex-1 bg-[var(--surface-raised)]"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Find an epic, owner, outcome, or task"
                  aria-label="Search epics"
                />
                <select
                  className="paper-field h-8 bg-[var(--surface-raised)]"
                  value={outlook}
                  onChange={(event) =>
                    setOutlook(event.target.value as typeof outlook)
                  }
                  aria-label="Filter by outlook"
                >
                  <option value="all">All outlooks</option>
                  <option value="at-risk">Date at risk</option>
                  <option value="attention">Needs attention</option>
                  <option value="planning">Planning needed</option>
                  <option value="on-track">On track</option>
                </select>
              </div>
              <div className="mt-3 border-t border-[var(--border-hairline)] pt-2">
                <TaskLegend />
              </div>
            </div>
          </section>

          <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((view) => (
              <EpicTile
                key={view.epic.id}
                view={view}
                cockpitBase={cockpitBase}
                cardBase={cardBase}
              />
            ))}
            {!filtered.length && (
              <p className="py-10 text-sm text-[var(--color-grey)]">
                No active epics match this search or outlook filter.
              </p>
            )}
          </section>

          {model.completed.length > 0 && (
            <details className="mt-8 border-t border-[var(--border-strong)] pt-4">
              <summary className="cursor-pointer text-sm font-medium">
                Recent arrivals · {model.completed.length} completed epic
                {model.completed.length === 1 ? "" : "s"}
              </summary>
              <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {model.completed.map((view) => (
                  <EpicTile
                    key={view.epic.id}
                    view={view}
                    cockpitBase={cockpitBase}
                    cardBase={cardBase}
                  />
                ))}
              </section>
            </details>
          )}
        </>
      )}
    </>
  );
}
