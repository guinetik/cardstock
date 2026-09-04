import type { Person } from "@/lib/assignee";
import type { CardColor } from "./card-color";

export type LaneKind =
  | "inbox"
  | "work"
  | "waiting"
  | "built"
  | "done"
  | "archive";

export interface Lane {
  id: string;
  key: string;
  name: string;
  position: number;
  kind: LaneKind;
  sla_days: number | null;
  wip_limit: number | null;
  /** Optional tint shared with board cards; null keeps the neutral lane stock. */
  color: CardColor | null;
}

export interface Tag {
  id: string;
  key: string;
  name: string;
  color: string | null;
  group_id: string;
}

export interface TagGroup {
  id: string;
  key: string;
  name: string;
  position: number;
  color: string | null;
  tags: Tag[];
}

export interface Card {
  id: string;
  external_id: string;
  title: string;
  summary: string | null;
  status: string;
  epic: string | null;
  epic_id: string | null;
  area: string | null;
  raised_by: string | null;
  assignee_id: string | null;
  /** The assignee's email. Set even when `assignee_id` is null (an off-roster file). */
  assignee: string | null;
  raised_on: string | null;
  shipped_on: string | null;
  needs: string | null;
  lane_id: string | null;
  rank: number;
  priority: 1 | 2 | 3 | null;
  effort: "L" | "M" | "H" | null;
  target_date: string | null;
  planned_start_date: string | null;
  target_label: string | null;
  audience: "all" | "internal";
  archived_at: string | null;
  archived_by: string | null;
  updated_at: string;
  created_at: string;
  tag_ids: string[];
  lane_entered_at: string | null;
  /** Most recent known entry into a built lane. */
  built_at?: string | null;
  /** Explicit shipped date or most recent known entry into a done lane. */
  delivered_at?: string | null;
  /** Frontmatter-owned pastel tint, or null for the neutral paper surface. */
  color: CardColor | null;
}

export type EpicConfidence = "confident" | "concerned" | "unknown";

export interface Epic {
  id: string;
  board_id: string;
  source_name: string;
  outcome: string | null;
  owner_label: string | null;
  start_date: string | null;
  target_date: string | null;
  priority: 1 | 2 | 3 | null;
  confidence: EpicConfidence;
  created_at: string;
  updated_at: string;
}

export interface EpicSnapshot {
  epic_id: string;
  captured_on: string;
  task_count: number;
  delivered_count: number;
  total_effort: number;
  delivered_effort: number;
  remaining_effort: number;
  estimated_count: number;
}

export interface BoardData {
  project: {
    id: string;
    slug: string;
    name: string;
    settings: Record<string, unknown>;
  };
  board: {
    id: string;
    slug: string;
    name: string;
    settings: Record<string, unknown>;
  };
  lanes: Lane[];
  groups: TagGroup[];
  epics: Pick<Epic, "id" | "source_name" | "outcome">[];
  cards: Card[];
  /** This board's project roster, for the assignee select and filter. */
  people: Person[];
}

export const PRIORITY_LABEL: Record<1 | 2 | 3, string> = {
  1: "P1",
  2: "P2",
  3: "P3",
};
export const EFFORT_LABEL: Record<"L" | "M" | "H", string> = {
  L: "Low",
  M: "Medium",
  H: "High",
};

/**
 * Highlighter hue per tag group, by the group's own order on the board. Amber
 * leads because the first group is usually the one read most; red is last
 * because a red mark should stay rare enough to mean something.
 */
export const MARK_HUES = [2, 4, 3, 5, 1] as const;

/** The mark class for the nth tag group. */
export function markHue(groupIndex: number): number {
  return MARK_HUES[groupIndex % MARK_HUES.length]!;
}

/** Pen hue per decision — the same square in the board, the peek and the timeline. */
export const PRIORITY_PEN: Record<1 | 2 | 3, string> = {
  1: "sq--red",
  2: "sq--blue",
  3: "sq--violet",
};
export const EFFORT_PEN: Record<"L" | "M" | "H", string> = {
  L: "sq--green",
  M: "sq--amber",
  H: "sq--red",
};
