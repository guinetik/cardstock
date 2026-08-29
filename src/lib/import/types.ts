import type { Change } from "@/lib/frontmatter/sheet";

export interface SheetFile {
  /** `<n>.md`, folder stripped. */
  name: string;
  text: string;
}

export interface BoardLane {
  id: string;
  key: string;
  name: string;
  kind: string;
  position: number;
}
export interface BoardGroup {
  id: string;
  key: string;
  name: string;
  position: number;
  color: string | null;
  tags: { id: string; key: string; name: string }[];
}
/** The columns the planner compares and the applier patches. */
export interface ExistingCard {
  id: string;
  external_id: string;
  title: string;
  status: string;
  epic: string | null;
  area: string | null;
  raised_by: string | null;
  raised_on: string | null;
  shipped_on: string | null;
  needs: string | null;
  summary: string | null;
  body_md: string | null;
  lane_id: string | null;
  rank: number;
  priority: 1 | 2 | 3 | null;
  effort: "L" | "M" | "H" | null;
  planned_start_date: string | null;
  target_date: string | null;
  target_label: string | null;
  archived_at: string | null;
  archived_by: string | null;
  color: string | null;
  source_hash: string | null;
  frontmatter_extra: Record<string, unknown>;
  tag_ids: string[];
  relates: number[];
}
export interface BoardState {
  id: string;
  lanes: BoardLane[];
  groups: BoardGroup[];
  cards: Map<string, ExistingCard>;
  /** epic source_name → id */
  epics: Map<string, string>;
}

/** What the applier writes for one card. Lane and tags are keys/refs; the applier resolves ids after creating what is new. */
export interface CardPatch {
  columns: Record<string, unknown>;
  laneKey: string | null;
  /** undefined: keep the rank the board has (or append for a new card). */
  rank: number | undefined;
  tagRefs: string[] | undefined;
  relates: number[] | undefined;
  epic: string | undefined;
}

export type PlanRow =
  | {
      id: string;
      title: string;
      verdict: "new";
      lane: string;
      changes: Change[];
      patch: CardPatch;
      hash: string;
    }
  | {
      id: string;
      title: string;
      verdict: "changed";
      changes: Change[];
      patch: CardPatch;
      hash: string;
    }
  | { id: string; title: string; verdict: "unchanged" }
  | { id: string; title?: string; verdict: "error"; message: string };

export interface Plan {
  ok: boolean;
  rows: PlanRow[];
  newLanes: { key: string; name: string }[];
  newGroups: { key: string; name: string }[];
  newTags: { groupKey: string; key: string; name: string }[];
  unappliedTags: { tag: string; cards: string[] }[];
  ambiguousTags: { tag: string; cards: string[] }[];
  counts: { new: number; changed: number; unchanged: number; error: number };
}
