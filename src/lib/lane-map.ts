import { parseCardColor, type CardColor } from "./card-color";
import { taskSignal, type TaskSignal } from "./cockpit";

/** Lane kinds the board already uses; archive is only appended as a filed-away column. */
export type LaneKind =
  | "inbox"
  | "work"
  | "waiting"
  | "built"
  | "done"
  | "archive";

/** One lane as the binder microcosm consumes it. */
export type LaneMicrocosmInput = {
  id: string;
  name: string;
  kind: LaneKind;
  position: number;
};

/** Occupancy wraps this many cards to a row inside each lane column. */
export const LANE_MAP_SPAN = 3;

/** One card as occupancy: tint, cockpit signal inputs, and board order. */
export type LaneMicrocosmCard = {
  lane_id: string | null;
  archived_at: string | null;
  color: string | null;
  rank: number;
  status?: string | null;
  needs?: string | null;
  target_date?: string | null;
};

/** One slip: the card's tint if set, otherwise the cockpit signal. */
export type LaneMicrocosmSlip = {
  color: CardColor | null;
  signal: TaskSignal;
};

/** One column in the lane microcosm: occupancy on that lane's stock. */
export type LaneMicrocosmRow = {
  id: string;
  name: string;
  kind: LaneKind;
  count: number;
  vacant: boolean;
  slips: LaneMicrocosmSlip[];
};

/**
 * Live lanes in board order, then an archived column when anything is filed
 * away. Empty live lanes stay in the list (`vacant`) so the map still shows
 * a place. The archive *kind* on the board is omitted; archived cards are
 * counted via `archived_at`.
 *
 * A slip uses the card's own tint when it has one. Untinted slips use
 * `taskSignal` — the same queued / moving / late / blocked / delivered
 * pens as the cockpit map.
 */
export function laneMicrocosm(
  lanes: LaneMicrocosmInput[],
  cards: LaneMicrocosmCard[],
): LaneMicrocosmRow[] {
  const live = cards.filter((card) => !card.archived_at);
  const archived = cards.filter((card) => card.archived_at);
  const laneById = new Map(lanes.map((lane) => [lane.id, lane]));
  const byLane = new Map<string, LaneMicrocosmCard[]>();
  for (const card of live) {
    if (!card.lane_id) continue;
    const list = byLane.get(card.lane_id) ?? [];
    list.push(card);
    byLane.set(card.lane_id, list);
  }
  for (const list of byLane.values()) {
    list.sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  }
  archived.sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));

  const slipOf = (card: LaneMicrocosmCard): LaneMicrocosmSlip => ({
    color: parseCardColor(card.color),
    signal: taskSignal(
      {
        status: card.status ?? "backlog",
        needs: card.needs ?? null,
        target_date: card.target_date ?? null,
      },
      card.lane_id ? laneById.get(card.lane_id) : undefined,
    ),
  });

  const rows: LaneMicrocosmRow[] = [...lanes]
    .filter((lane) => lane.kind !== "archive")
    .sort((a, b) => a.position - b.position)
    .map((lane) => {
      const occupants = byLane.get(lane.id) ?? [];
      return {
        id: lane.id,
        name: lane.name,
        kind: lane.kind,
        count: occupants.length,
        vacant: occupants.length === 0,
        slips: occupants.map(slipOf),
      };
    });
  if (archived.length > 0) {
    rows.push({
      id: "archived",
      name: "archived",
      kind: "archive",
      count: archived.length,
      vacant: false,
      slips: archived.map(slipOf),
    });
  }
  return rows;
}

/** CSS modifier when a slip has no card tint — matches the cockpit pens. */
export const LANE_MAP_SIGNAL: Record<TaskSignal, string> = {
  delivered: "lane-map-cell--delivered",
  blocked: "lane-map-cell--blocked",
  late: "lane-map-cell--late",
  moving: "lane-map-cell--moving",
  queued: "lane-map-cell--queued",
};
