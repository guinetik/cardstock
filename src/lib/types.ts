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

/** Board settings the UI reads. */
export interface BoardSettings {
  priority_label?: string;
  needs_lane?: string;
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
