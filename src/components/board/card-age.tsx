"use client";

import type { BoardGate } from "@/lib/gates";
import { cardGate } from "@/lib/gates";
import type { Card } from "@/lib/types";
import { CalendarClock } from "lucide-react";
import {
  PaperTooltip,
  PaperTooltipLines,
} from "@/components/paper-tooltip";
import {
  daysSince,
  type TimelineSignal,
  timelineSignal,
} from "@/lib/timeline";

const RAISED_SHORT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const RING_R = 5.5;
const RING_C = 2 * Math.PI * RING_R;

const SIGNAL_HINT: Record<TimelineSignal, string> = {
  forgotten: "Past the watch window with no target — give it a date or close it.",
  overdue: "Target date passed and this is not shipped.",
  planned: "Has a target date and is not late yet.",
  active: "Still inside the watch window, no target yet.",
  delivered: "This work has shipped.",
};

/** Props for {@link CardAge}. */
export interface CardAgeProps {
  card: Pick<
    Card,
    | "raised_on"
    | "shipped_on"
    | "status"
    | "target_date"
    | "target_label"
    | "lane_id"
  >;
  today: string;
  watchDays: number;
  gates: readonly BoardGate[];
}

/** Compact raised date for the card chrome, e.g. "Sep 1". */
export function formatRaisedShort(value: string): string {
  return RAISED_SHORT.format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

/**
 * Timeline assessment for a board card: signal, age in days, and how far
 * through the project's forgotten watch window the card has aged.
 */
export function cardAgeState(
  card: CardAgeProps["card"],
  today: string,
  watchDays: number,
  gates: readonly BoardGate[],
) {
  const gate = cardGate(card, gates);
  const signal = timelineSignal(card, today, watchDays, gate);
  const ageDays = card.raised_on ? daysSince(card.raised_on, today) : null;
  const progress =
    ageDays != null && watchDays > 0
      ? Math.min(ageDays / watchDays, 1)
      : 0;
  const pastWindow =
    ageDays != null && watchDays > 0
      ? Math.max(0, ageDays - watchDays) / watchDays
      : 0;
  return { signal, ageDays, progress, pastWindow, gate };
}

/**
 * Read-only raised date with a ring that fills toward the forgotten watch
 * window. Forgotten and overdue cards wear the same assessment colours as the
 * timeline view.
 */
export function CardAge({ card, today, watchDays, gates }: CardAgeProps) {
  if (!card.raised_on) return null;

  const { signal, ageDays, progress, pastWindow } = cardAgeState(
    card,
    today,
    watchDays,
    gates,
  );
  const fill = RING_C * (1 - progress);
  const overrun = Math.min(pastWindow, 1) * RING_C;

  return (
    <PaperTooltip
      side="top"
      align="end"
      triggerClassName="inline-flex items-center"
      content={
        <PaperTooltipLines
          lines={[
            `Raised ${formatRaisedShort(card.raised_on)}`,
            ageDays != null ? `${ageDays} days on the board` : null,
            SIGNAL_HINT[signal],
          ]}
        />
      }
    >
      <span data-signal={signal} className="card-age inline-flex items-center">
      <CalendarClock
        className="card-age__icon shrink-0"
        size={11}
        strokeWidth={2.2}
        aria-hidden="true"
      />
      <svg
        className="card-age-ring"
        width="14"
        height="14"
        viewBox="0 0 14 14"
        aria-hidden="true"
      >
        <circle
          className="card-age-ring__track"
          cx="7"
          cy="7"
          r={RING_R}
          fill="none"
          strokeWidth="1.5"
        />
        <circle
          className="card-age-ring__fill"
          cx="7"
          cy="7"
          r={RING_R}
          fill="none"
          strokeWidth="1.5"
          strokeDasharray={RING_C}
          strokeDashoffset={fill}
          transform="rotate(-90 7 7)"
        />
        {pastWindow > 0 && (
          <circle
            className="card-age-ring__overrun"
            cx="7"
            cy="7"
            r={RING_R + 2}
            fill="none"
            strokeWidth="1"
            strokeDasharray={RING_C + 12.57}
            strokeDashoffset={RING_C + 12.57 - overrun}
            transform="rotate(-90 7 7)"
          />
        )}
      </svg>
      <time
        className="card-age-date"
        dateTime={card.raised_on}
        aria-label={`Raised ${formatRaisedShort(card.raised_on)}`}
      >
        {formatRaisedShort(card.raised_on)}
      </time>
      </span>
    </PaperTooltip>
  );
}
