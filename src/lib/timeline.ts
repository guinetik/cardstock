import {
  type BoardGate,
  cardGate,
  gateOutcomeSets,
  resolveBoardGates,
} from "./gates";
import type { Card, Lane } from "./types";

export {
  DEFAULT_BUILT_STATUSES,
  DEFAULT_SHIPPED_STATUSES,
  TIMELINE_BUILT_STATUSES_SETTING,
  TIMELINE_SHIPPED_STATUSES_SETTING,
} from "./gates";

const DAY = 86_400_000;

export const DEFAULT_FORGOTTEN_AFTER_DAYS = 14;
export const MIN_FORGOTTEN_AFTER_DAYS = 1;
export const MAX_FORGOTTEN_AFTER_DAYS = 365;
export const TIMELINE_FORGOTTEN_SETTING = "timeline_forgotten_after_days";

/**
 * The delivery-pulse window is a view control, not a setting: the page offers
 * these choices in a dropdown and carries the pick in a `window` query param.
 */
export const TIMELINE_WINDOW_OPTIONS = [7, 14, 30] as const;
export const DEFAULT_TIMELINE_WINDOW_DAYS = 14;

/** Read the window from a raw query-param value; anything odd is the default. */
export function timelineWindowDays(value: unknown): number {
  const parsed = typeof value === "string" ? Number(value) : Number.NaN;
  return (TIMELINE_WINDOW_OPTIONS as readonly number[]).includes(parsed)
    ? parsed
    : DEFAULT_TIMELINE_WINDOW_DAYS;
}

export interface TimelineOutcomeStatuses {
  built: ReadonlySet<string>;
  shipped: ReadonlySet<string>;
}

/**
 * Status-only outcome sets; milestones use gates.
 */
export function timelineOutcomeStatuses(
  settings: Record<string, unknown> | null | undefined,
): TimelineOutcomeStatuses {
  const sets = gateOutcomeSets(resolveBoardGates(settings, []));
  return {
    built: sets.built.statuses,
    shipped: sets.shipped.statuses,
  };
}

export type TimelineSignal =
  | "delivered"
  | "overdue"
  | "forgotten"
  | "planned"
  | "active";

export interface TimelineHistoryEvent {
  card_id: string;
  at: string;
  kind: string;
  payload: unknown;
}

export interface TimelineMilestones {
  enteredAt: Map<string, string>;
  builtAt: Map<string, string>;
  deliveredAt: Map<string, string>;
}

function objectPayload(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Resolve every lane notation written by UI moves and both import paths. */
function eventLane(
  payloadValue: unknown,
  laneById: Map<string, Pick<Lane, "id" | "key" | "kind">>,
  laneByKey: Map<string, Pick<Lane, "id" | "key" | "kind">>,
) {
  const payload = objectPayload(payloadValue);
  if (!payload) return undefined;
  const direct =
    typeof payload.to_lane === "string"
      ? payload.to_lane
      : typeof payload.lane === "string"
        ? payload.lane
        : null;
  if (direct) return laneById.get(direct) ?? laneByKey.get(direct);

  if (!Array.isArray(payload.changes)) return undefined;
  const laneChange = payload.changes.find((change) => {
    const row = objectPayload(change);
    return row?.key === "lane" && typeof row.to === "string";
  });
  const destination = objectPayload(laneChange)?.to;
  return typeof destination === "string"
    ? (laneById.get(destination) ?? laneByKey.get(destination))
    : undefined;
}

/** The status an event left the card in, across the same payload shapes. */
function eventStatus(payloadValue: unknown): string | undefined {
  const payload = objectPayload(payloadValue);
  if (!payload) return undefined;
  if (typeof payload.status === "string") return payload.status;
  if (!Array.isArray(payload.changes)) return undefined;
  const statusChange = payload.changes.find((change) => {
    const row = objectPayload(change);
    return row?.key === "status" && typeof row.to === "string";
  });
  const destination = objectPayload(statusChange)?.to;
  return typeof destination === "string" ? destination : undefined;
}

/**
 * Read lifecycle dates from the mixed history formats already stored by the
 * board UI, the legacy ETL, and file imports. Events must be newest first.
 * Outcome stamps follow resolved gates, not raw lane kinds.
 */
export function timelineMilestones(
  cards: Pick<Card, "id" | "lane_id" | "created_at" | "status">[],
  lanes: Pick<Lane, "id" | "key" | "kind">[],
  events: TimelineHistoryEvent[],
  gates: readonly BoardGate[] = resolveBoardGates(null, lanes),
): TimelineMilestones {
  const enteredAt = new Map<string, string>();
  const builtAt = new Map<string, string>();
  const deliveredAt = new Map<string, string>();
  const createdAt = new Map<string, string>();
  const laneById = new Map(lanes.map((lane) => [lane.id, lane]));
  const laneByKey = new Map(lanes.map((lane) => [lane.key, lane]));
  const sets = gateOutcomeSets(gates);

  for (const event of events) {
    if (event.kind === "moved" && !enteredAt.has(event.card_id))
      enteredAt.set(event.card_id, event.at);
    if (event.kind === "created" && !createdAt.has(event.card_id))
      createdAt.set(event.card_id, event.at);

    const lane = eventLane(event.payload, laneById, laneByKey);
    if (lane && sets.built.laneIds.has(lane.id) && !builtAt.has(event.card_id))
      builtAt.set(event.card_id, event.at);
    if (
      lane &&
      sets.shipped.laneIds.has(lane.id) &&
      !deliveredAt.has(event.card_id)
    )
      deliveredAt.set(event.card_id, event.at);
  }

  // Status evidence, oldest first. Import events restate the whole status on
  // every sync, so only a transition into an outcome set is a crossing — a
  // re-import that still says "built" is not news. Lane evidence wins ties.
  const lastStatus = new Map<string, string>();
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]!;
    const status = eventStatus(event.payload);
    if (!status) continue;
    const was = lastStatus.get(event.card_id);
    if (
      sets.built.statuses.has(status) &&
      !(was && sets.built.statuses.has(was)) &&
      !builtAt.has(event.card_id)
    )
      builtAt.set(event.card_id, event.at);
    if (
      sets.shipped.statuses.has(status) &&
      !(was && sets.shipped.statuses.has(was)) &&
      !deliveredAt.has(event.card_id)
    )
      deliveredAt.set(event.card_id, event.at);
    lastStatus.set(event.card_id, status);
  }

  // A newly imported card may have no lane or status in its history. When it
  // currently matches a built or shipped gate, creation is the best known
  // crossing.
  for (const card of cards) {
    const created = createdAt.get(card.id) ?? card.created_at;
    const gate = cardGate(card, gates);
    if (gate?.outcome === "built" && !builtAt.has(card.id))
      builtAt.set(card.id, created);
    if (gate?.outcome === "shipped" && !deliveredAt.has(card.id))
      deliveredAt.set(card.id, created);
  }

  return { enteredAt, builtAt, deliveredAt };
}

function utcDay(value: string | Date): Date {
  const parsed =
    value instanceof Date
      ? value
      : new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
    ),
  );
}

export function timelineToday(value = new Date()): string {
  return utcDay(value).toISOString().slice(0, 10);
}

export function daysSince(date: string, today: string | Date): number {
  return Math.max(
    0,
    Math.floor((utcDay(today).getTime() - utcDay(date).getTime()) / DAY),
  );
}

export function forgottenAfterDays(
  settings: Record<string, unknown> | null | undefined,
): number {
  const value = settings?.[TIMELINE_FORGOTTEN_SETTING];
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_FORGOTTEN_AFTER_DAYS &&
    value <= MAX_FORGOTTEN_AFTER_DAYS
    ? value
    : DEFAULT_FORGOTTEN_AFTER_DAYS;
}

/**
 * A forgotten card is still active, was raised at least the project's watch
 * window ago, and has neither a calendar target nor a rough target. The rule
 * deliberately stays objective: changing lanes alone does not hide old,
 * unplanned work. Delivered is a ship date or a shipped-outcome gate.
 */
export function timelineSignal(
  card: Pick<
    Card,
    "raised_on" | "shipped_on" | "status" | "target_date" | "target_label"
  >,
  today: string | Date,
  watchDays: number,
  gate: BoardGate | null,
): TimelineSignal {
  if (card.shipped_on || gate?.outcome === "shipped") return "delivered";

  const todayKey = timelineToday(
    typeof today === "string" ? new Date(`${today}T00:00:00Z`) : today,
  );
  if (card.target_date && card.target_date < todayKey) return "overdue";
  if (
    card.raised_on &&
    !card.target_date &&
    !card.target_label &&
    daysSince(card.raised_on, todayKey) >= watchDays
  )
    return "forgotten";
  if (card.target_date || card.target_label) return "planned";
  return "active";
}

const DIAGNOSTIC_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function formatDiagnosticDate(value: string) {
  return DIAGNOSTIC_DATE.format(utcDay(value));
}

/**
 * Date-line copy: diagnostic word, then the rail's remaining/target phrasing.
 */
export function timelineDiagnosticLine(
  item: {
    signal: TimelineSignal;
    raisedOn: string;
    targetDate: string | null;
    targetLabel: string | null;
    deliveredAt: string | null;
  },
  today: string,
  watchDays: number,
): string {
  switch (item.signal) {
    case "planned": {
      if (item.targetDate) {
        const remaining = daysSince(today, item.targetDate);
        return `Planned · Target ${formatDiagnosticDate(item.targetDate)}${
          remaining ? ` · in ${remaining} days` : " · today"
        }`;
      }
      if (item.targetLabel)
        return `Planned · Rough target · ${item.targetLabel}`;
      return "Planned";
    }
    case "overdue":
      return item.targetDate
        ? `Overdue · Target was ${formatDiagnosticDate(item.targetDate)}`
        : "Overdue";
    case "forgotten": {
      const beyond = daysSince(item.raisedOn, today) - watchDays;
      return beyond > 0
        ? `Forgotten · No target · ${beyond} days past the watch window`
        : `Forgotten · No target · reached the ${watchDays}-day watch window`;
    }
    case "delivered":
      return item.deliveredAt
        ? `Delivered · Shipped ${formatDiagnosticDate(item.deliveredAt)}`
        : "Delivered";
    case "active":
      return item.targetLabel
        ? `Open · Rough target · ${item.targetLabel}`
        : "Open · No target yet";
  }
}

export function addTimelineDays(date: string, days: number): string {
  return new Date(utcDay(date).getTime() + days * DAY)
    .toISOString()
    .slice(0, 10);
}

/** Inclusive trailing calendar window ending today. */
export function isInTimelineWindow(
  value: string | null | undefined,
  today: string | Date,
  windowDays: number,
): boolean {
  if (!value || windowDays < 1) return false;
  const todayKey = timelineToday(
    typeof today === "string" ? new Date(`${today}T00:00:00Z`) : today,
  );
  const valueKey = timelineToday(new Date(value));
  const firstDay = addTimelineDays(todayKey, -(windowDays - 1));
  return valueKey >= firstDay && valueKey <= todayKey;
}
