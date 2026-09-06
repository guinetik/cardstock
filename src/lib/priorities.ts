import { rankBetween } from "./rank";

/**
 * A card as the priorities planning screen sees it. `priority` is the band
 * (P1 highest); `priority_rank` is the stakeholder-importance ordering —
 * distinct from lane `rank`, which is execution order. Null `priority_rank`
 * means the card was never dragged on the planning screen.
 */
export interface PriorityCard {
  id: string;
  external_id: string;
  title: string;
  epic: string | null;
  status: string;
  effort: "L" | "M" | "H" | null;
  priority: 1 | 2 | 3 | null;
  priority_rank: number | null;
  lane_name: string;
  lane_position: number;
  lane_rank: number;
  board_slug: string;
  board_name: string;
}

export interface PriorityBands {
  bands: Record<1 | 2 | 3, PriorityCard[]>;
  unweighed: PriorityCard[];
}

/** Execution order as the tiebreak: where work sits is the best guess at importance until someone drags it. */
function byLane(a: PriorityCard, b: PriorityCard): number {
  return (
    a.lane_position - b.lane_position ||
    a.lane_rank - b.lane_rank ||
    a.external_id.localeCompare(b.external_id, undefined, { numeric: true })
  );
}

/** Ranked cards first in rank order; never-dragged cards after, in lane order. */
function byImportance(a: PriorityCard, b: PriorityCard): number {
  if (a.priority_rank != null && b.priority_rank != null)
    return a.priority_rank - b.priority_rank || byLane(a, b);
  if (a.priority_rank != null) return -1;
  if (b.priority_rank != null) return 1;
  return byLane(a, b);
}

/** Split into P1/P2/P3 bands plus the unweighed desk, each in display order. */
export function partitionBands(cards: readonly PriorityCard[]): PriorityBands {
  const bands: PriorityBands["bands"] = { 1: [], 2: [], 3: [] };
  const unweighed: PriorityCard[] = [];
  for (const card of cards) {
    if (card.priority) bands[card.priority].push(card);
    else unweighed.push(card);
  }
  bands[1].sort(byImportance);
  bands[2].sort(byImportance);
  bands[3].sort(byImportance);
  unweighed.sort(byLane);
  return { bands, unweighed };
}

/**
 * The `priority_rank` for an insertion at `index` of a band's display order
 * (dragged card already removed). A null-ranked neighbour is an open end;
 * the server renormalises the band whenever the client names its order.
 */
export function rankForDrop(
  band: readonly PriorityCard[],
  index: number,
): number {
  const before = index > 0 ? (band[index - 1]?.priority_rank ?? null) : null;
  const after =
    index < band.length ? (band[index]?.priority_rank ?? null) : null;
  return rankBetween(before, after);
}
