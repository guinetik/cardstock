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

const GAUGE_R = 6;
const GAUGE_CX = 8;
const GAUGE_CY = 8;
const GAUGE_ARC = Math.PI * GAUGE_R;
const GAUGE_PATH = `M ${GAUGE_CX - GAUGE_R} ${GAUGE_CY} A ${GAUGE_R} ${GAUGE_R} 0 0 1 ${GAUGE_CX + GAUGE_R} ${GAUGE_CY}`;
const GAUGE_OUTER_R = GAUGE_R + 2;
const GAUGE_OUTER_PATH = `M ${GAUGE_CX - GAUGE_OUTER_R} ${GAUGE_CY} A ${GAUGE_OUTER_R} ${GAUGE_OUTER_R} 0 0 1 ${GAUGE_CX + GAUGE_OUTER_R} ${GAUGE_CY}`;
const GAUGE_OUTER_ARC = Math.PI * GAUGE_OUTER_R;

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
 * Read-only raised date with a speedometer arc that fills toward the
 * forgotten watch window. Forgotten and overdue cards wear the same assessment
 * colours as the timeline view.
 */
export function CardAge({ card, today, watchDays, gates }: CardAgeProps) {
  if (!card.raised_on) return null;

  const { signal, ageDays, progress, pastWindow } = cardAgeState(
    card,
    today,
    watchDays,
    gates,
  );
  const fillOffset = GAUGE_ARC * (1 - progress);
  const overrun = Math.min(pastWindow, 1) * GAUGE_OUTER_ARC;

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
          size={13}
          strokeWidth={2}
          aria-hidden="true"
        />
        <svg
          className="card-age-gauge"
          width="16"
          height="10"
          viewBox="0 0 16 10"
          aria-hidden="true"
        >
          <path
            className="card-age-gauge__track"
            d={GAUGE_PATH}
            fill="none"
            strokeWidth="1.6"
            pathLength={GAUGE_ARC}
          />
          <path
            className="card-age-gauge__fill"
            d={GAUGE_PATH}
            fill="none"
            strokeWidth="1.6"
            pathLength={GAUGE_ARC}
            strokeDasharray={GAUGE_ARC}
            strokeDashoffset={fillOffset}
          />
          {pastWindow > 0 && (
            <path
              className="card-age-gauge__overrun"
              d={GAUGE_OUTER_PATH}
              fill="none"
              strokeWidth="1.1"
              pathLength={GAUGE_OUTER_ARC}
              strokeDasharray={GAUGE_OUTER_ARC}
              strokeDashoffset={GAUGE_OUTER_ARC - overrun}
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
