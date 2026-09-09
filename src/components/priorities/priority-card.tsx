"use client";

import { CalendarClock, CalendarDays, UserRound } from "lucide-react";
import Link from "next/link";
import type { ComponentProps } from "react";
import { EpicLabel } from "@/components/epic-label";
import { cardColorModifier } from "@/lib/card-color";
import { statusChipClass } from "@/lib/card-status";
import type { PriorityCard as PriorityCardData } from "@/lib/priorities";
import { EFFORT_LABEL, EFFORT_PEN, PRIORITY_PEN } from "@/lib/types";

const DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function dateLabel(value: string) {
  return DATE.format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

/** The board's card vocabulary, with every planning detail visible at rest. */
export function PriorityCard({
  card,
  href,
  rank,
  showBoard,
  ...articleProps
}: {
  card: PriorityCardData;
  href: string;
  rank?: number;
  showBoard: boolean;
} & Omit<ComponentProps<"article">, "children">) {
  return (
    <article
      {...articleProps}
      data-priority-card={card.id}
      data-timeline-signal={card.signal}
      className={`paper-card paper-card--static priority-card relative flex h-full min-w-0 flex-col gap-2.5 p-3 ${cardColorModifier(card.color) ?? ""} ${articleProps.className ?? ""}`}
      style={{
        ...(!card.priority && !card.color
          ? { background: "var(--surface-postit)" }
          : {}),
        ...articleProps.style,
      }}
    >
      <div className="flex items-center gap-2">
        {rank != null && (
          <span
            className="priority-stamp h-6 min-w-6 px-1 text-[12px]"
            style={{
              color:
                card.priority === 1
                  ? "var(--pen-red)"
                  : card.priority === 2
                    ? "var(--pen-blue)"
                    : "var(--pen-violet)",
            }}
          >
            <span className="sr-only">Rank </span>
            {rank}
          </span>
        )}
        <span className="font-mono text-[11.5px] text-[var(--color-grey-faint)]">
          #{card.external_id}
        </span>
        <span className="ml-auto flex gap-1">
          {card.priority && (
            <span
              className={`sq sq--on ${PRIORITY_PEN[card.priority]}`}
              title={`Priority ${card.priority}`}
            >
              P{card.priority}
            </span>
          )}
          {card.effort && (
            <span
              className={`sq sq--on ${EFFORT_PEN[card.effort]}`}
              title={`Effort: ${EFFORT_LABEL[card.effort]}`}
            >
              {card.effort}
            </span>
          )}
        </span>
      </div>
      <h3 className="font-sans text-[18px] font-medium leading-snug text-[var(--color-ink)]">
        <Link
          href={href}
          draggable={false}
          className="break-words hover:underline"
        >
          {card.title}
        </Link>
      </h3>
      {card.epic && <EpicLabel name={card.epic} />}
      <div className="card-meta flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={statusChipClass(card.status)}>{card.status}</span>
        <span className="text-[12px] text-[var(--color-ink2)]" title="Lane">
          {card.lane_name}
        </span>
        {showBoard && (
          <span className="text-[12px] text-[var(--color-grey)]" title="Board">
            {card.board_name}
          </span>
        )}
      </div>
      <div className="flex items-start gap-1.5 text-[12px] text-[var(--color-ink2)]">
        <UserRound size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span className="break-words">
          <span className="sr-only">Assignee: </span>
          {card.assignee_label ?? "Unassigned"}
        </span>
      </div>
      <div className="mt-auto flex flex-col gap-1.5 border-t border-[var(--border-hairline)] pt-2 text-[12px]">
        <div className="flex items-start gap-1.5 text-[var(--color-ink)]">
          <CalendarDays
            size={13}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          {card.target_date ? (
            <span>
              Target{" "}
              <time dateTime={card.target_date}>
                {dateLabel(card.target_date)}
              </time>
            </span>
          ) : (
            <span className="text-[var(--color-ink2)]">
              {card.target_label
                ? `Target ${card.target_label}`
                : "No target date"}
            </span>
          )}
        </div>
        {(card.signal === "overdue" ||
          card.signal === "forgotten" ||
          card.late_days != null) && (
          <div className="flex flex-wrap gap-x-2 gap-y-1">
            {card.signal === "overdue" && (
              <span className="stat stat--blocked">
                Overdue
                {card.overdue_days != null ? ` · ${card.overdue_days}d` : ""}
              </span>
            )}
            {card.signal === "forgotten" && (
              <span
                className="stat stat--blocked"
                title="No target past the project's watch window"
              >
                Forgotten
              </span>
            )}
            {card.late_days != null && (
              <span
                className="stat stat--blocked"
                title="Past the waiting lane's time limit"
              >
                Late · {card.late_days}d in lane
              </span>
            )}
          </div>
        )}
        <div className="flex items-center gap-1.5 text-[var(--color-grey)]">
          <CalendarClock size={13} className="shrink-0" aria-hidden="true" />
          {card.raised_on ? (
            <span>
              Raised{" "}
              <time dateTime={card.raised_on}>{dateLabel(card.raised_on)}</time>
            </span>
          ) : (
            <span>No raised date</span>
          )}
        </div>
      </div>
    </article>
  );
}
