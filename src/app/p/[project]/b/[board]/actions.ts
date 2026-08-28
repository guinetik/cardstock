"use server";
import { revalidatePath } from "next/cache";
import { cleanName, keyFromName } from "@/lib/keys";
import { needsNormalize, normalized } from "@/lib/rank";
import { currentMember, supabaseServer } from "@/lib/supabase/server";
import type { Lane } from "@/lib/types";

type Result = { ok: true } | { ok: false; error: string };

export type LaneMutationResult =
  | {
      ok: true;
      lanes: Lane[];
      movedCards?: { id: string; rank: number }[];
    }
  | { ok: false; error: string };

async function ctx() {
  const me = await currentMember();
  if (!me) return null;
  return { me, db: await supabaseServer() };
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function laneList(
  db: Awaited<ReturnType<typeof supabaseServer>>,
  boardId: string,
): Promise<Lane[]> {
  const { data } = await db
    .from("lanes")
    .select("id, key, name, position, kind, sla_days, wip_limit")
    .eq("board_id", boardId)
    .order("position");
  return (data ?? []) as Lane[];
}

function refreshBoards() {
  revalidatePath("/p/[project]/b/[board]", "page");
}

/** Create a plain work lane. Its key is permanent once generated. */
export async function createLane(
  boardId: string,
  name: string,
): Promise<LaneMutationResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Not signed in." };
  if (!UUID.test(boardId)) return { ok: false, error: "Invalid board." };
  const clean = cleanName(name);
  if (!clean)
    return {
      ok: false,
      error: "Lane name must be between 1 and 80 characters.",
    };
  const key = keyFromName(clean);
  if (!key)
    return { ok: false, error: "Lane name must contain a letter or number." };

  const { error } = await c.db.rpc("create_work_lane", {
    p_board_id: boardId,
    p_key: key,
    p_name: clean,
  });
  if (error) return { ok: false, error: error.message };
  refreshBoards();
  return { ok: true, lanes: await laneList(c.db, boardId) };
}

/** Rename only the display name; the markdown-facing key is immutable. */
export async function renameLane(
  laneId: string,
  name: string,
): Promise<LaneMutationResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Not signed in." };
  if (!UUID.test(laneId)) return { ok: false, error: "Invalid lane." };
  const clean = cleanName(name);
  if (!clean)
    return {
      ok: false,
      error: "Lane name must be between 1 and 80 characters.",
    };
  const { data: lane } = await c.db
    .from("lanes")
    .select("board_id, kind")
    .eq("id", laneId)
    .maybeSingle();
  if (!lane) return { ok: false, error: "Lane not found." };
  if (lane.kind !== "work")
    return { ok: false, error: "Only work lanes can be renamed." };
  const { error } = await c.db
    .from("lanes")
    .update({ name: clean })
    .eq("id", laneId);
  if (error) return { ok: false, error: error.message };
  refreshBoards();
  return { ok: true, lanes: await laneList(c.db, lane.board_id) };
}

export async function moveLane(
  laneId: string,
  delta: -1 | 1,
): Promise<LaneMutationResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Not signed in." };
  if (!UUID.test(laneId) || (delta !== -1 && delta !== 1))
    return { ok: false, error: "Invalid lane movement." };
  const { data: lane } = await c.db
    .from("lanes")
    .select("board_id")
    .eq("id", laneId)
    .maybeSingle();
  if (!lane) return { ok: false, error: "Lane not found." };
  const { error } = await c.db.rpc("move_work_lane", {
    p_lane_id: laneId,
    p_delta: delta,
  });
  if (error) return { ok: false, error: error.message };
  refreshBoards();
  return { ok: true, lanes: await laneList(c.db, lane.board_id) };
}

export async function deleteLane(
  laneId: string,
  destinationLaneId: string,
): Promise<LaneMutationResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Not signed in." };
  if (!UUID.test(laneId) || !UUID.test(destinationLaneId))
    return { ok: false, error: "Invalid lane." };
  const { data: lane } = await c.db
    .from("lanes")
    .select("board_id")
    .eq("id", laneId)
    .maybeSingle();
  if (!lane) return { ok: false, error: "Lane not found." };
  const { data, error } = await c.db.rpc("delete_work_lane", {
    p_lane_id: laneId,
    p_destination_lane_id: destinationLaneId,
  });
  if (error) return { ok: false, error: error.message };
  const payload = data as {
    moved_cards?: { id: string; rank: number }[];
  } | null;
  refreshBoards();
  return {
    ok: true,
    lanes: await laneList(c.db, lane.board_id),
    movedCards: payload?.moved_cards ?? [],
  };
}

/** Move a card to a lane at a rank; renormalises the lane when ranks get too close. */
export async function moveCard(
  cardId: string,
  laneId: string,
  rank: number,
  orderedIds?: string[],
): Promise<Result> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Not signed in." };
  const { data: before } = await c.db
    .from("cards")
    .select("lane_id, rank")
    .eq("id", cardId)
    .single();
  const { error } = await c.db
    .from("cards")
    .update({ lane_id: laneId, rank })
    .eq("id", cardId);
  if (error) return { ok: false, error: error.message };
  await c.db.from("card_events").insert({
    card_id: cardId,
    actor: c.me.email,
    kind: "moved",
    payload: { from_lane: before?.lane_id, to_lane: laneId, rank },
  });
  // Renormalise if the client tells us the lane order and the gaps are getting tight.
  if (orderedIds?.length) {
    const { data: laneCards } = await c.db
      .from("cards")
      .select("id, rank")
      .eq("lane_id", laneId);
    if (laneCards && needsNormalize(laneCards.map((x) => x.rank))) {
      const ranks = normalized(orderedIds);
      await Promise.all(
        [...ranks].map(([id, r]) =>
          c.db.from("cards").update({ rank: r }).eq("id", id),
        ),
      );
    }
  }
  return { ok: true };
}

export interface CardPatch {
  summary?: string | null;
  priority?: 1 | 2 | 3 | null;
  effort?: "L" | "M" | "H" | null;
  target_date?: string | null;
  target_label?: string | null;
  audience?: "all" | "internal";
  title?: string;
}

export async function updateCard(
  cardId: string,
  patch: CardPatch,
): Promise<Result> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Not signed in." };
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch))
    if (v !== undefined) clean[k] = v === "" ? null : v;
  if (!Object.keys(clean).length) return { ok: true };
  // Hand ownership of the summary to the app: the next import must not replace
  // these words with the frontmatter's. The exporter writes it back out.
  if ("summary" in clean) clean.summary_edited_at = new Date().toISOString();
  const { error } = await c.db.from("cards").update(clean).eq("id", cardId);
  if (error) return { ok: false, error: error.message };
  await c.db.from("card_events").insert({
    card_id: cardId,
    actor: c.me.email,
    kind: "edited",
    payload: clean,
  });
  return { ok: true };
}

export async function archiveCard(
  cardId: string,
  archive: boolean,
): Promise<Result> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Not signed in." };
  const { data: card } = await c.db
    .from("cards")
    .select("board_id, lane_id")
    .eq("id", cardId)
    .single();
  if (!card) return { ok: false, error: "Card not found." };
  const { data: lanes } = await c.db
    .from("lanes")
    .select("id, kind")
    .eq("board_id", card.board_id);
  const archiveLane = lanes?.find((l) => l.kind === "archive");
  const inboxLane = lanes?.find((l) => l.kind === "inbox");
  let patch: Record<string, unknown>;
  let payload: Record<string, unknown> = {};
  if (archive) {
    patch = {
      archived_at: new Date().toISOString(),
      archived_by: c.me.email,
      ...(archiveLane ? { lane_id: archiveLane.id } : {}),
    };
    payload = { from_lane: card.lane_id };
  } else {
    // Restore returns the card to the lane it was archived from; the inbox if that is unknown.
    const { data: last } = await c.db
      .from("card_events")
      .select("payload")
      .eq("card_id", cardId)
      .eq("kind", "archived")
      .order("at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const from = (last?.payload as { from_lane?: string } | null)?.from_lane;
    const target =
      (from && lanes?.some((l) => l.id === from) ? from : undefined) ??
      inboxLane?.id ??
      null;
    patch = {
      archived_at: null,
      archived_by: null,
      ...(target ? { lane_id: target } : {}),
    };
    payload = { to_lane: target };
  }
  const { error } = await c.db.from("cards").update(patch).eq("id", cardId);
  if (error) return { ok: false, error: error.message };
  await c.db.from("card_events").insert({
    card_id: cardId,
    actor: c.me.email,
    kind: archive ? "archived" : "restored",
    payload,
  });
  return { ok: true };
}

export async function setCardTags(
  cardId: string,
  tagIds: string[],
): Promise<Result> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Not signed in." };
  await c.db.from("card_tags").delete().eq("card_id", cardId);
  if (tagIds.length) {
    const { error } = await c.db
      .from("card_tags")
      .insert(tagIds.map((tag_id) => ({ card_id: cardId, tag_id })));
    if (error) return { ok: false, error: error.message };
  }
  await c.db.from("card_events").insert({
    card_id: cardId,
    actor: c.me.email,
    kind: "edited",
    payload: { tags: tagIds },
  });
  return { ok: true };
}

export async function savePrefs(
  prefs: Record<string, unknown>,
): Promise<Result> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Not signed in." };
  const { error } = await c.db
    .from("members")
    .update({ prefs: { ...(c.me.prefs as Record<string, unknown>), ...prefs } })
    .eq("id", c.me.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function revalidateBoard(project: string, board: string) {
  revalidatePath(`/p/${project}/b/${board}`);
}
