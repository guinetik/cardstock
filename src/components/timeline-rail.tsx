import { BookIcon, Columns3Icon, FlagIcon } from "lucide-react";
import Link from "next/link";
import { statusChipClass } from "@/lib/card-status";
import type { GateOutcome } from "@/lib/gates";
import {
  daysSince,
  type TimelineSignal,
  timelineDiagnosticLine,
} from "@/lib/timeline";
import { EFFORT_PEN, PRIORITY_LABEL, PRIORITY_PEN } from "@/lib/types";

export interface TimelineRailItem {
  id: string;
  externalId: string;
  title: string;
  href: string;
  epicName: string | null;
  raisedOn: string;
  laneName: string;
  status: string;
  signal: TimelineSignal;
  targetDate: string | null;
  targetLabel: string | null;
  deliveredAt: string | null;
  priority: 1 | 2 | 3 | null;
  effort: "L" | "M" | "H" | null;
  gateId: string | null;
  gateName: string | null;
  gateOutcome: GateOutcome | null;
}

const MONTH = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const SHORT_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const SIGNAL_LABEL: Record<TimelineSignal, string> = {
  forgotten: "Forgotten",
  overdue: "Overdue",
  planned: "Planned",
  active: "Open",
  delivered: "Delivered",
};
const SIGNAL_COLOR: Record<TimelineSignal, string> = {
  forgotten: "var(--pen-red)",
  overdue: "var(--pen-amber)",
  planned: "var(--pen-blue)",
  active: "var(--color-grey-faint)",
  delivered: "var(--pen-green)",
};
const GATE_COLOR: Record<GateOutcome, string> = {
  built: "var(--pen-blue)",
  shipped: "var(--pen-green)",
};

function date(value: string) {
  return new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
}

function ageLabel(value: string, today: string) {
  const age = daysSince(value, today);
  if (age === 0) return "today";
  if (age === 1) return "yesterday";
  return `${age} days ago`;
}

/** Raised-date rail: coloured assessment plus gate name, date line underneath. */
export function TimelineRail({
  items,
  today,
  watchDays,
}: {
  items: TimelineRailItem[];
  today: string;
  watchDays: number;
}) {
  const byMonth = new Map<string, TimelineRailItem[]>();
  for (const item of items) {
    const key = item.raisedOn.slice(0, 7);
    byMonth.set(key, [...(byMonth.get(key) ?? []), item]);
  }

  return (
    <section aria-label="Cards by date raised">
      {[...byMonth.entries()].map(([month, cards]) => (
        <section key={month} className="mt-6 first:mt-0">
          <div className="mb-2 flex items-baseline justify-between border-b border-[var(--border-strong)] pb-1.5">
            <h3 className="text-lg">{MONTH.format(date(`${month}-01`))}</h3>
            <span className="font-mono text-xs text-[var(--color-grey)]">
              {cards.length}
            </span>
          </div>
          <ol>
            {cards.map((item) => {
              const color = SIGNAL_COLOR[item.signal];
              return (
                <li
                  key={item.id}
                  data-timeline-id={item.externalId}
                  className="grid grid-cols-[4.25rem_1.25rem_minmax(0,1fr)] gap-x-2 sm:grid-cols-[5.5rem_1.5rem_minmax(0,1fr)] sm:gap-x-3"
                >
                  <time
                    dateTime={item.raisedOn}
                    className="pt-3 text-right font-mono text-[10px] text-[var(--color-grey)] sm:text-xs"
                  >
                    {SHORT_DATE.format(date(item.raisedOn))}
                    <span className="mt-0.5 block font-sans text-[9px]">
                      {ageLabel(item.raisedOn, today)}
                    </span>
                  </time>
                  <span
                    className="relative flex justify-center"
                    aria-hidden="true"
                  >
                    <span className="absolute inset-y-0 w-px bg-[var(--border-strong)]" />
                    <span
                      className="relative mt-[1.05rem] h-2.5 w-2.5 border-2 bg-[var(--surface-page)]"
                      style={{ borderColor: color }}
                    />
                  </span>
                  <article className="min-w-0 border-b border-[var(--border-hairline)] py-3">
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                      <Link
                        href={item.href}
                        className="min-w-0 flex-1 text-[15px] leading-snug hover:underline"
                      >
                        <span className="font-mono text-[10px] text-[var(--color-grey-faint)]">
                          #{item.externalId}
                        </span>{" "}
                        {item.title}
                      </Link>
                      <span className="flex shrink-0 flex-col items-end gap-0.5">
                        <span
                          className="border-l-2 pl-2 text-[9px] font-semibold uppercase tracking-[0.1em]"
                          style={{ borderColor: color, color }}
                          aria-label={`Assessment ${SIGNAL_LABEL[item.signal]}`}
                        >
                          {SIGNAL_LABEL[item.signal]}
                        </span>
                        {item.gateName && (
                          <span
                            className="text-[9px] font-semibold uppercase tracking-[0.1em]"
                            style={{
                              color: item.gateOutcome
                                ? GATE_COLOR[item.gateOutcome]
                                : "var(--color-ink)",
                            }}
                            aria-label={`Gate ${item.gateName}`}
                          >
                            {item.gateName}
                          </span>
                        )}
                      </span>
                    </div>
                    <p
                      className="mt-1 text-xs"
                      style={{ color: SIGNAL_COLOR[item.signal] }}
                    >
                      {timelineDiagnosticLine(item, today, watchDays)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {item.priority && (
                        <span
                          className={`sq sq--on ${PRIORITY_PEN[item.priority]}`}
                        >
                          {PRIORITY_LABEL[item.priority]}
                        </span>
                      )}
                      {item.effort && (
                        <span
                          className={`sq sq--on ${EFFORT_PEN[item.effort]}`}
                        >
                          {item.effort}
                        </span>
                      )}
                      {item.status !== "backlog" && !item.gateName && (
                        <span className="flex items-center gap-1">
                          <FlagIcon
                            className="size-3 shrink-0 text-[var(--color-grey)]"
                            aria-hidden="true"
                          />
                          <span className="sr-only">Status </span>
                          <span className={statusChipClass(item.status)}>
                            {item.status}
                          </span>
                        </span>
                      )}
                      {item.epicName && (
                        <span className="flex max-w-52 items-center gap-1 truncate text-[9px] uppercase tracking-[0.08em] text-[var(--color-grey)]">
                          <BookIcon
                            className="size-3 shrink-0"
                            aria-hidden="true"
                          />
                          <span className="sr-only">Epic </span>
                          {item.epicName}
                        </span>
                      )}
                      <span className="ml-auto flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.11em] text-[var(--color-grey)]">
                        <Columns3Icon
                          className="size-3 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="sr-only">Lane </span>
                        {item.laneName}
                      </span>
                    </div>
                  </article>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </section>
  );
}
