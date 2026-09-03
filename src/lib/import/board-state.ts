import type { SupabaseClient } from "@supabase/supabase-js";
import type { Person } from "@/lib/assignee";
import type { BoardState, ExistingCard } from "./types";

/** Everything the planner compares against, from the database, through whatever client the caller holds. */
export async function loadBoardState(
  db: SupabaseClient,
  boardId: string,
): Promise<BoardState> {
  const [
    { data: lanes, error: lanesError },
    { data: groups, error: groupsError },
    { data: cards, error: cardsError },
    { data: epics, error: epicsError },
    { data: roster, error: rosterError },
  ] = await Promise.all([
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
        "id, external_id, title, status, epic, area, assignee, assignee_id, raised_by, raised_on, shipped_on, needs, summary, summary_edited_at, body_md, body_edited_at, lane_id, rank, priority, effort, planned_start_date, target_date, target_label, archived_at, archived_by, color, source_hash, source_text, frontmatter_extra, card_tags(tag_id), card_links!card_links_from_card_fkey(to_card, kind)",
      )
      .eq("board_id", boardId),
    db.from("epics").select("id, source_name").eq("board_id", boardId),
    db
      .from("boards")
      .select(
        "project_id, projects!inner(project_members(members(id, email, display_name)))",
      )
      .eq("id", boardId)
      .maybeSingle(),
  ]);
  // An empty `?? []` fallback on error would hand the planner an empty
  // board state and every card would come back "new" — the exact thing a
  // dry run exists to prevent — so a failed read must throw, not vanish.
  if (lanesError) throw new Error(`board state: lanes: ${lanesError.message}`);
  if (groupsError)
    throw new Error(`board state: tag_groups: ${groupsError.message}`);
  if (cardsError) throw new Error(`board state: cards: ${cardsError.message}`);
  if (epicsError) throw new Error(`board state: epics: ${epicsError.message}`);
  if (rosterError)
    throw new Error(`board state: roster: ${rosterError.message}`);
  const idToExternal = new Map(
    (cards ?? []).map((c) => [c.id as string, c.external_id as string]),
  );
  const map = new Map<string, ExistingCard>();
  for (const row of cards ?? []) {
    // The joins and the sheet itself are shaped here, not carried: an
    // `ExistingCard` is columns, and the sheet can be megabytes per card.
    const { card_tags, card_links, source_text, ...c } = row as Record<
      string,
      unknown
    >;
    const links =
      (card_links as { to_card: string; kind: string }[] | null) ?? [];
    map.set(c.external_id as string, {
      ...(c as unknown as ExistingCard),
      has_source_text: source_text != null,
      frontmatter_extra: (c.frontmatter_extra as Record<string, unknown>) ?? {},
      tag_ids: ((card_tags as { tag_id: string }[] | null) ?? []).map(
        (t) => t.tag_id,
      ),
      relates: links
        .filter((l) => l.kind === "relates")
        .map((l) => Number(idToExternal.get(l.to_card)))
        .filter((n) => Number.isInteger(n)),
    });
  }
  // The roster is read through the board's project so import resolves an
  // assignee email without the caller having to know the project id.
  const memberships =
    (
      roster as unknown as {
        projects?: {
          project_members?: {
            members?: {
              id: string;
              email: string;
              display_name: string | null;
            } | null;
          }[];
        } | null;
      } | null
    )?.projects?.project_members ?? [];
  const members: Person[] = memberships
    .map((m) => m.members)
    .filter(
      (m): m is { id: string; email: string; display_name: string | null } =>
        m != null,
    )
    .map((m) => ({
      memberId: m.id,
      email: m.email,
      displayName: m.display_name,
    }));
  return {
    id: boardId,
    lanes: (lanes ?? []) as BoardState["lanes"],
    groups: (groups ?? []) as BoardState["groups"],
    cards: map,
    epics: new Map(
      (epics ?? []).map((e) => [e.source_name as string, e.id as string]),
    ),
    members,
  };
}
