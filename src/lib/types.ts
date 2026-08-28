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
  area: string | null;
  raised_by: string | null;
  raised_on: string | null;
  shipped_on: string | null;
  needs: string | null;
  lane_id: string | null;
  rank: number;
  priority: 1 | 2 | 3 | null;
  effort: "L" | "M" | "H" | null;
  target_date: string | null;
  target_label: string | null;
  audience: "all" | "internal";
  archived_at: string | null;
  archived_by: string | null;
  updated_at: string;
  tag_ids: string[];
  lane_entered_at: string | null;
}

export interface BoardData {
  project: { id: string; slug: string; name: string };
  board: {
    id: string;
    slug: string;
    name: string;
    settings: Record<string, unknown>;
  };
  lanes: Lane[];
  groups: TagGroup[];
  cards: Card[];
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
