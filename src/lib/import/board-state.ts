import type { SupabaseClient } from "@supabase/supabase-js";
import type { BoardState, ExistingCard } from "./types";

/** Everything the planner compares against, from the database, through whatever client the caller holds. */
export async function loadBoardState(
  db: SupabaseClient,
  boardId: string,
): Promise<BoardState> {
  const [{ data: lanes }, { data: groups }, { data: cards }, { data: epics }] =
    await Promise.all([
      db
        .from("lanes")
        .select("id, key, name, kind, position")
        .eq("board_id", boardId)
        .order("position"),
      db
        .from("tag_groups")
        .select("id, key, name, position, color, tags(id, key, name)")
        .eq("board_id", boardId)
        .order("position"),
      db
        .from("cards")
        .select(
          "id, external_id, title, status, epic, area, raised_by, raised_on, shipped_on, needs, summary, body_md, lane_id, rank, priority, effort, planned_start_date, target_date, target_label, archived_at, archived_by, color, source_hash, frontmatter_extra, card_tags(tag_id), card_links!card_links_from_card_fkey(to_card, kind)",
        )
        .eq("board_id", boardId),
      db.from("epics").select("id, source_name").eq("board_id", boardId),
    ]);
  const idToExternal = new Map(
    (cards ?? []).map((c) => [c.id as string, c.external_id as string]),
  );
  const map = new Map<string, ExistingCard>();
  for (const c of cards ?? []) {
    const links =
      (c.card_links as { to_card: string; kind: string }[] | null) ?? [];
    map.set(c.external_id as string, {
      ...(c as unknown as ExistingCard),
      frontmatter_extra: (c.frontmatter_extra as Record<string, unknown>) ?? {},
      tag_ids: ((c.card_tags as { tag_id: string }[] | null) ?? []).map(
        (t) => t.tag_id,
      ),
      relates: links
        .filter((l) => l.kind === "relates")
        .map((l) => Number(idToExternal.get(l.to_card)))
        .filter((n) => Number.isInteger(n)),
    });
  }
  return {
    id: boardId,
    lanes: (lanes ?? []) as BoardState["lanes"],
    groups: (groups ?? []) as BoardState["groups"],
    cards: map,
    epics: new Map(
      (epics ?? []).map((e) => [e.source_name as string, e.id as string]),
    ),
  };
}
