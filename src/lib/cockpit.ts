import type { Card, Epic, EpicSnapshot, Lane } from "./types";

export type TaskSignal = "delivered" | "blocked" | "late" | "moving" | "queued";
export type EpicOutlook = "at-risk" | "attention" | "planning" | "on-track";

export interface CardMove {
  card_id: string;
  at: string;
  payload: { to_lane?: string } | null;
}

export interface CockpitTask extends Card {
  signal: TaskSignal;
  delivered_at: string | null;
}

export interface EpicMetrics {
  taskCount: number;
  deliveredCount: number;
  blockedCount: number;
  lateCount: number;
  movingCount: number;
  estimatedCount: number;
  totalEffort: number;
  remainingEffort: number;
  completionPercent: number;
  coveragePercent: number;
  weeklyPace: number | null;
  likelyLanding: string | null;
  medianDeliveryDays: number | null;
}

export interface CockpitEpic {
  epic: Epic;
  tasks: CockpitTask[];
  snapshots: EpicSnapshot[];
  metrics: EpicMetrics;
  outlook: EpicOutlook;
  reasons: string[];
  confidenceMismatch: string | null;
  completed: boolean;
}

export interface CockpitModel {
  active: CockpitEpic[];
  completed: CockpitEpic[];
  unassigned: Card[];
}

const DAY = 86_400_000;
const EFFORT = { L: 1, M: 3, H: 5 } as const;
const OUTLOOK_ORDER: Record<EpicOutlook, number> = {
  "at-risk": 0,
  attention: 1,
  planning: 2,
  "on-track": 3,
};

function utcDay(value: string | Date): Date {
  const d =
    value instanceof Date
      ? value
      : new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function addDays(value: Date, days: number): string {
  return new Date(value.getTime() + days * DAY).toISOString().slice(0, 10);
}

export function effortOf(card: Card): number | null {
  return card.effort ? EFFORT[card.effort] : null;
}

export function taskSignal(
  card: Pick<Card, "status" | "needs" | "target_date">,
  lane: Pick<Lane, "kind"> | undefined,
  today = new Date(),
): TaskSignal {
  if (
    lane?.kind === "done" ||
    card.status === "shipped" ||
    card.status === "done"
  )
    return "delivered";
  if (
    card.status === "blocked" ||
    lane?.kind === "waiting" ||
    !!card.needs?.trim()
  )
    return "blocked";
  if (
    card.target_date &&
    utcDay(card.target_date).getTime() < utcDay(today).getTime()
  )
    return "late";
  if (
    card.status === "wip" ||
    card.status === "built" ||
    card.status === "handed" ||
    lane?.kind === "built"
  )
    return "moving";
  return "queued";
}

function deliveredAt(
  card: Card,
  moves: CardMove[],
  doneLaneIds: Set<string>,
): string | null {
  if (card.shipped_on) return card.shipped_on;
  const move = moves
    .filter(
      (m) =>
        m.card_id === card.id &&
        !!m.payload?.to_lane &&
        doneLaneIds.has(m.payload.to_lane),
    )
    .sort((a, b) => a.at.localeCompare(b.at))[0];
  return (
    move?.at ??
    (card.status === "done" || card.status === "shipped"
      ? card.updated_at
      : null)
  );
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]!
    : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

function sortFleet(a: CockpitEpic, b: CockpitEpic): number {
  return (
    OUTLOOK_ORDER[a.outlook] - OUTLOOK_ORDER[b.outlook] ||
    (a.epic.target_date ?? "9999-12-31").localeCompare(
      b.epic.target_date ?? "9999-12-31",
    ) ||
    (a.epic.priority ?? 9) - (b.epic.priority ?? 9) ||
    a.epic.source_name.localeCompare(b.epic.source_name)
  );
}

export function buildCockpitModel(args: {
  cards: Card[];
  lanes: Lane[];
  epics: Epic[];
  snapshots: EpicSnapshot[];
  moves: CardMove[];
  now?: Date;
}): CockpitModel {
  const now = args.now ?? new Date();
  const laneById = new Map(args.lanes.map((l) => [l.id, l]));
  const doneLaneIds = new Set(
    args.lanes.filter((l) => l.kind === "done").map((l) => l.id),
  );
  const openCards = args.cards.filter((c) => !c.archived_at);
  const unassigned = openCards.filter((c) => !c.epic_id);
  const views: CockpitEpic[] = [];

  for (const epic of args.epics) {
    const source = openCards.filter((c) => c.epic_id === epic.id);
    const tasks: CockpitTask[] = source.map((card) => ({
      ...card,
      signal: taskSignal(card, laneById.get(card.lane_id ?? ""), now),
      delivered_at: deliveredAt(card, args.moves, doneLaneIds),
    }));
    const delivered = tasks.filter((t) => t.signal === "delivered");
    const remaining = tasks.filter((t) => t.signal !== "delivered");
    const known = tasks.filter((t) => effortOf(t) != null);
    const knownRemaining = remaining.filter((t) => effortOf(t) != null);
    const totalEffort = known.reduce((sum, t) => sum + effortOf(t)!, 0);
    const remainingEffort = knownRemaining.reduce(
      (sum, t) => sum + effortOf(t)!,
      0,
    );
    const blocked = remaining.filter((t) => t.signal === "blocked");
    const late = remaining.filter((t) => t.signal === "late");
    const recentCutoff = now.getTime() - 42 * DAY;
    const recentKnown = delivered.filter(
      (t) =>
        effortOf(t) != null &&
        t.delivered_at &&
        new Date(t.delivered_at).getTime() >= recentCutoff,
    );
    const recentEffort = recentKnown.reduce((sum, t) => sum + effortOf(t)!, 0);
    const weeklyPace =
      recentKnown.length >= 2 && recentEffort > 0 ? recentEffort / 6 : null;
    const coverage = remaining.length
      ? knownRemaining.length / remaining.length
      : 1;
    const likelyLanding =
      weeklyPace && coverage >= 0.7
        ? addDays(utcDay(now), Math.ceil((remainingEffort / weeklyPace) * 7))
        : null;
    const deliveryDays = delivered.flatMap((t) => {
      if (!t.delivered_at) return [];
      const start = t.raised_on ?? t.created_at;
      return [
        Math.max(
          0,
          Math.round(
            (utcDay(t.delivered_at).getTime() - utcDay(start).getTime()) / DAY,
          ),
        ),
      ];
    });
    const reasons: string[] = [];
    const targetPast =
      !!epic.target_date &&
      utcDay(epic.target_date).getTime() < utcDay(now).getTime() &&
      remaining.length > 0;
    const forecastLate =
      !!epic.target_date && !!likelyLanding && likelyLanding > epic.target_date;
    const blockedEffort = blocked.reduce(
      (sum, t) => sum + (effortOf(t) ?? 0),
      0,
    );
    const blockedShare =
      remainingEffort > 0 ? blockedEffort / remainingEffort : 0;
    const blockedP1Soon = blocked.some(
      (t) =>
        t.priority === 1 &&
        t.target_date &&
        utcDay(t.target_date).getTime() <= utcDay(now).getTime() + 14 * DAY,
    );
    if (targetPast) reasons.push("The committed date has passed.");
    if (forecastLate)
      reasons.push(
        `Current pace points to ${likelyLanding}, after the commitment.`,
      );
    if (blockedP1Soon)
      reasons.push("A highest-priority task due soon is blocked.");
    if (blockedShare >= 0.25)
      reasons.push(
        "At least a quarter of the remaining estimated work is blocked.",
      );
    if (blocked.length && !blockedP1Soon && blockedShare < 0.25)
      reasons.push(
        `${blocked.length} task${blocked.length === 1 ? " is" : "s are"} blocked.`,
      );
    if (late.length)
      reasons.push(
        `${late.length} task${late.length === 1 ? " is" : "s are"} late.`,
      );
    if (!tasks.length) reasons.push("No tasks are attached to this epic yet.");
    if (!epic.target_date) reasons.push("A committed date has not been set.");
    if (epic.target_date && !likelyLanding && remaining.length)
      reasons.push(
        "There is not enough estimated delivery history for a forecast yet.",
      );

    const atRisk =
      targetPast || forecastLate || blockedP1Soon || blockedShare >= 0.25;
    const outlook: EpicOutlook = !tasks.length
      ? "planning"
      : atRisk
        ? "at-risk"
        : blocked.length || late.length
          ? "attention"
          : !epic.target_date || (!likelyLanding && remaining.length > 0)
            ? "planning"
            : "on-track";
    const confidenceMismatch =
      epic.confidence === "confident" &&
      (outlook === "at-risk" || outlook === "attention")
        ? "The owner is confident, but the task signals disagree."
        : epic.confidence === "concerned" && outlook === "on-track"
          ? "The owner has concerns even though the task signals look on track."
          : null;

    views.push({
      epic,
      tasks,
      snapshots: args.snapshots
        .filter((s) => s.epic_id === epic.id)
        .sort((a, b) => a.captured_on.localeCompare(b.captured_on)),
      outlook,
      reasons,
      confidenceMismatch,
      completed: tasks.length > 0 && delivered.length === tasks.length,
      metrics: {
        taskCount: tasks.length,
        deliveredCount: delivered.length,
        blockedCount: blocked.length,
        lateCount: late.length,
        movingCount: tasks.filter((t) => t.signal === "moving").length,
        estimatedCount: known.length,
        totalEffort,
        remainingEffort,
        completionPercent: tasks.length
          ? Math.round((delivered.length / tasks.length) * 100)
          : 0,
        coveragePercent: Math.round(coverage * 100),
        weeklyPace:
          weeklyPace == null ? null : Math.round(weeklyPace * 10) / 10,
        likelyLanding,
        medianDeliveryDays: median(deliveryDays),
      },
    });
  }

  return {
    active: views.filter((v) => !v.completed).sort(sortFleet),
    completed: views
      .filter((v) => v.completed)
      .sort((a, b) =>
        (b.epic.target_date ?? "").localeCompare(a.epic.target_date ?? ""),
      ),
    unassigned,
  };
}

export const OUTLOOK_LABEL: Record<EpicOutlook, string> = {
  "at-risk": "Date at risk",
  attention: "Needs attention",
  planning: "Planning needed",
  "on-track": "On track",
};
