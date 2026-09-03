"use server";
import { revalidatePath } from "next/cache";
import { loadBoard } from "@/lib/board-data";
import { type CardColor, isCardColor } from "@/lib/card-color";
import { isCardStatus, normalizeNeeds } from "@/lib/card-status";
import { cardTemplate } from "@/lib/card-template";
import {
  formatCommentAt,
  joinIssueBody,
  splitIssueBody,
} from "@/lib/issue-body";
import { cleanName, keyFromName } from "@/lib/keys";
import { needsNormalize, normalized } from "@/lib/rank";
import { currentMember, supabaseServer } from "@/lib/supabase/server";
import type { Card, Lane } from "@/lib/types";

type Result = { ok: true } | { ok: false; error: string };

export type LaneMutationResult =
  | {
      ok: true;
      lanes: Lane[];
      movedCards?: { id: string; rank: number }[];
    }
  | { ok: false; error: string };

export type LaneCardMutationResult =
  | {
      ok: true;
      cards: { id: string; rank: number }[];
    }
  | { ok: false; error: string };

export interface CreateCardInput {
  boardId: string;
  laneId: string;
  title: string;
  summary?: string;
  bodyMarkdown?: string;
  status?: Card["status"];
  epicId?: string | null;
  epic?: string;
  area?: string;
  priority?: Card["priority"];
  effort?: Card["effort"];
  plannedStartDate?: string;
  targetDate?: string;
  targetLabel?: string;
  audience?: Card["audience"];
  tagIds?: string[];
  /** Optional pastel tint; omit or null for the neutral paper surface. */
  color?: CardColor | null;
}

export type CreateCardResult =
  | { ok: true; card: Card }
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
    .select("id, key, name, position, kind, sla_days, wip_limit, color")
    .eq("board_id", boardId)
    .order("position");
  return (data ?? []) as Lane[];
}

function refreshBoards() {
  revalidatePath("/p/[project]", "page");
  revalidatePath("/p/[project]/b/[board]", "page");
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Create an app-owned issue at the top of a lane, ready for markdown export. */
export async function createCard(
  input: CreateCardInput,
): Promise<CreateCardResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Not signed in." };
  if (!UUID.test(input.boardId) || !UUID.test(input.laneId))
    return { ok: false, error: "Invalid board or lane." };

  const title = input.title.trim();
  if (!title || title.length > 240)
    return { ok: false, error: "Title must be between 1 and 240 characters." };
  const status = input.status ?? "backlog";
  if (!isCardStatus(status)) return { ok: false, error: "Invalid status." };
  const validDate = (value?: string) => !value || ISO_DATE.test(value);
  if (!validDate(input.plannedStartDate) || !validDate(input.targetDate))
    return { ok: false, error: "Dates must use YYYY-MM-DD." };
  if (input.priority != null && !([1, 2, 3] as const).includes(input.priority))
    return { ok: false, error: "Invalid priority." };
  if (
    input.effort != null &&
    !(["L", "M", "H"] as const).includes(input.effort)
  )
    return { ok: false, error: "Invalid effort." };
  if (
    input.audience &&
    !(["all", "internal"] as const).includes(input.audience)
  )
    return { ok: false, error: "Invalid audience." };
  if (input.color != null && !isCardColor(input.color)) {
    return { ok: false, error: "Invalid color." };
  }

  const { data: lane } = await c.db
    .from("lanes")
    .select("id, board_id")
    .eq("id", input.laneId)
    .eq("board_id", input.boardId)
    .maybeSingle();
  if (!lane) return { ok: false, error: "Lane not found on this board." };

  const tagIds = [...new Set(input.tagIds ?? [])];
  if (tagIds.some((id) => !UUID.test(id)))
    return { ok: false, error: "Invalid tag." };
  if (tagIds.length) {
    const { data: allowed } = await c.db
      .from("tags")
      .select("id, tag_groups!inner(board_id)")
      .in("id", tagIds)
      .eq("tag_groups.board_id", input.boardId);
    if ((allowed ?? []).length !== tagIds.length)
      return {
        ok: false,
        error: "One or more tags do not belong to this board.",
      };
  }

  let selectedEpic: { id: string; source_name: string } | null = null;
  if (input.epicId) {
    if (!UUID.test(input.epicId)) return { ok: false, error: "Invalid epic." };
    const { data: epic } = await c.db
      .from("epics")
      .select("id, source_name")
      .eq("id", input.epicId)
      .eq("board_id", input.boardId)
      .maybeSingle();
    if (!epic) return { ok: false, error: "Epic not found on this board." };
    selectedEpic = epic;
  }

  const [{ data: existing }, { data: first }, { data: boardRow }] =
    await Promise.all([
      c.db.from("cards").select("external_id").eq("board_id", input.boardId),
      c.db
        .from("cards")
        .select("rank")
        .eq("lane_id", input.laneId)
        .order("rank")
        .limit(1)
        .maybeSingle(),
      c.db
        .from("boards")
        .select("settings")
        .eq("id", input.boardId)
        .maybeSingle(),
    ]);
  const nextId =
    Math.max(
      0,
      ...(existing ?? []).map((row) =>
        /^\d+$/.test(row.external_id) ? Number(row.external_id) : 0,
      ),
    ) + 1;
  const now = new Date().toISOString();
  const row = {
    board_id: input.boardId,
    lane_id: input.laneId,
    title,
    summary: input.summary?.trim() || null,
    // An empty body starts from the board's template so a site-born card has
    // the same section skeleton a markdown-born one must.
    body_md:
      input.bodyMarkdown?.trim() ||
      cardTemplate(boardRow?.settings as Record<string, unknown> | null),
    // Frontmatter parity with imported sheets: markdown-born cards carry who
    // raised them and when; site-born cards must too, or age goes blank.
    raised_on: now.slice(0, 10),
    raised_by: c.me.display_name?.trim() || c.me.email.split("@")[0],
    status,
    epic: selectedEpic?.source_name ?? input.epic?.trim() ?? "Unassigned",
    epic_id: selectedEpic?.id ?? null,
    area: input.area?.trim() || "general",
    rank: (first?.rank ?? 1) - 1,
    priority: input.priority ?? null,
    effort: input.effort ?? null,
    planned_start_date: input.plannedStartDate || null,
    target_date: input.targetDate || null,
    target_label: input.targetLabel?.trim() || null,
    audience: input.audience ?? "all",
    color: input.color ?? null,
    summary_edited_at: now,
    body_edited_at: now,
  };

  let card: Record<string, unknown> | null = null;
  let insertError: { code?: string; message: string } | null = null;
  // A simultaneous create can claim the same numeric tracker id. Retry the
  // unique insert with the next id; the board/lane checks above remain valid.
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await c.db
      .from("cards")
      .insert({ ...row, external_id: String(nextId + attempt) })
      .select(
        "id, external_id, title, summary, status, epic, epic_id, area, assignee_id, assignee, raised_by, raised_on, shipped_on, needs, lane_id, rank, priority, effort, planned_start_date, target_date, target_label, audience, archived_at, archived_by, created_at, updated_at, color",
      )
      .single();
    card = result.data;
    insertError = result.error;
    if (card || insertError?.code !== "23505") break;
  }
  if (!card)
    return {
      ok: false,
      error: insertError?.message ?? "Could not create card.",
    };

  if (tagIds.length) {
    const { error } = await c.db
      .from("card_tags")
      .insert(tagIds.map((tag_id) => ({ card_id: card!.id, tag_id })));
    if (error) {
      await c.db.from("cards").delete().eq("id", card.id);
      return { ok: false, error: error.message };
    }
  }
  await c.db.from("card_events").insert({
    card_id: card.id,
    actor: c.me.email,
    kind: "created",
    // board_id lets a notification listener scope a brand-new card — the
    // events table has no board column and the card is not on desks yet.
    payload: { lane_id: input.laneId, board_id: input.boardId },
  });
  refreshBoards();
  return {
    ok: true,
    card: { ...card, tag_ids: tagIds, lane_entered_at: now } as unknown as Card,
  };
}

/** Create a plain work lane. Its key is permanent once generated. */
export async function createLane(
  boardId: string,
  name: string,
  color: CardColor | null = null,
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
  if (color !== null && !isCardColor(color))
    return { ok: false, error: "Invalid color." };

  const { error } = await c.db.rpc("create_work_lane", {
    p_board_id: boardId,
    p_key: key,
    p_name: clean,
    p_color: color,
  });
  if (error) return { ok: false, error: error.message };
  refreshBoards();
  return { ok: true, lanes: await laneList(c.db, boardId) };
}

export interface LanePatch {
  name?: string;
  color?: CardColor | null;
}

/** Edit a lane tint and, for work lanes, its display name. */
export async function updateLane(
  laneId: string,
  patch: LanePatch,
): Promise<LaneMutationResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Not signed in." };
  if (!UUID.test(laneId)) return { ok: false, error: "Invalid lane." };
  const hasName = Object.hasOwn(patch, "name");
  const hasColor = Object.hasOwn(patch, "color");
  if (!hasName && !hasColor)
    return { ok: false, error: "No lane changes supplied." };
  const clean = hasName ? cleanName(patch.name ?? "") : null;
  if (hasName && !clean)
    return {
      ok: false,
      error: "Lane name must be between 1 and 80 characters.",
    };
  if (hasColor && patch.color != null && !isCardColor(patch.color))
    return { ok: false, error: "Invalid color." };
  const { data: lane } = await c.db
    .from("lanes")
    .select("board_id, kind")
    .eq("id", laneId)
    .maybeSingle();
  if (!lane) return { ok: false, error: "Lane not found." };
  if (hasName && lane.kind !== "work")
    return { ok: false, error: "Only work lanes can be renamed." };
  const changes: { name?: string; color?: CardColor | null } = {};
  if (hasName) changes.name = clean!;
  if (hasColor) changes.color = patch.color ?? null;
  const { error } = await c.db.from("lanes").update(changes).eq("id", laneId);
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

/** Atomically append every source-lane card to another lane. */
export async function moveAllLaneCards(
  sourceLaneId: string,
  destinationLaneId: string,
): Promise<LaneCardMutationResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Not signed in." };
  if (!UUID.test(sourceLaneId) || !UUID.test(destinationLaneId))
    return { ok: false, error: "Invalid lane." };
  const { data, error } = await c.db.rpc("move_all_lane_cards", {
    p_source_lane_id: sourceLaneId,
    p_destination_lane_id: destinationLaneId,
  });
  if (error) return { ok: false, error: error.message };
  const payload = data as {
    moved_cards?: { id: string; rank: number }[];
  } | null;
  refreshBoards();
  return { ok: true, cards: payload?.moved_cards ?? [] };
}

/** Persist ascending or descending card-number order for one manual lane. */
export async function sortLaneCards(
  laneId: string,
  direction: "asc" | "desc",
): Promise<LaneCardMutationResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Not signed in." };
  if (!UUID.test(laneId) || !["asc", "desc"].includes(direction))
    return { ok: false, error: "Invalid lane order." };
  const { data, error } = await c.db.rpc("sort_lane_cards", {
    p_lane_id: laneId,
    p_direction: direction,
  });
  if (error) return { ok: false, error: error.message };
  const payload = data as {
    ranked_cards?: { id: string; rank: number }[];
  } | null;
  refreshBoards();
  return { ok: true, cards: payload?.ranked_cards ?? [] };
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
  /** Frontmatter `area`; blank falls back to "general", never null — the
   * sync scheme lists area among required keys. */
  area?: string;
  priority?: 1 | 2 | 3 | null;
  effort?: "L" | "M" | "H" | null;
  planned_start_date?: string | null;
  target_date?: string | null;
  target_label?: string | null;
  audience?: "all" | "internal";
  title?: string;
  /** Pastel tint to persist, or null to clear back to neutral. */
  color?: CardColor | null;
  /** Tracker status word; validated with `isCardStatus` when present. */
  status?: string;
  /** Free-text blocker note; any value marks the card blocked, null clears it. */
  needs?: string | null;
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
  if (
    Object.hasOwn(clean, "color") &&
    clean.color != null &&
    !isCardColor(clean.color)
  ) {
    return { ok: false, error: "Invalid color." };
  }
  if (Object.hasOwn(clean, "status") && !isCardStatus(clean.status)) {
    return { ok: false, error: "Invalid status." };
  }
  // A blank note is no blocker: trim so a stray space cannot hold a card blocked.
  if (Object.hasOwn(clean, "needs")) {
    clean.needs = normalizeNeeds(clean.needs as string | null);
  }
  if (Object.hasOwn(clean, "area")) {
    clean.area = String(clean.area ?? "").trim() || "general";
  }
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
  revalidatePath("/p/[project]/b/[board]/calendar", "page");
  revalidatePath("/p/[project]/calendar", "page");
  return { ok: true };
}

/**
 * Replace the issue body, keeping the comments suffix currently in the database.
 *
 * @param cardId - Card uuid.
 * @param bodyMarkdown - New issue markdown from the WYSIWYG (no comments fence).
 */
export async function updateCardBody(
  cardId: string,
  bodyMarkdown: string,
): Promise<Result> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Not signed in." };
  if (!UUID.test(cardId)) return { ok: false, error: "Invalid card." };
  const { data: card } = await c.db
    .from("cards")
    .select("body_md")
    .eq("id", cardId)
    .single();
  if (!card) return { ok: false, error: "Card not found." };
  const { comments, leftover } = splitIssueBody(card.body_md ?? "");
  const body_md = joinIssueBody(bodyMarkdown, comments, leftover);
  const { error } = await c.db
    .from("cards")
    .update({ body_md, body_edited_at: new Date().toISOString() })
    .eq("id", cardId);
  if (error) return { ok: false, error: error.message };
  await c.db.from("card_events").insert({
    card_id: cardId,
    actor: c.me.email,
    kind: "edited",
    payload: { body: true },
  });
  return { ok: true };
}

/**
 * Append one comment block to `body_md`.
 *
 * @param cardId - Card uuid.
 * @param text - Composer value; whitespace-only is rejected.
 */
export async function addCardComment(
  cardId: string,
  text: string,
): Promise<Result> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Not signed in." };
  if (!UUID.test(cardId)) return { ok: false, error: "Invalid card." };
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Write a comment first." };
  const { data: card } = await c.db
    .from("cards")
    .select("body_md")
    .eq("id", cardId)
    .single();
  if (!card) return { ok: false, error: "Card not found." };
  const { body, comments, leftover } = splitIssueBody(card.body_md ?? "");
  const comment = {
    at: formatCommentAt(),
    author: c.me.email,
    text: trimmed,
  };
  const body_md = joinIssueBody(body, [...comments, comment], leftover);
  const { error } = await c.db
    .from("cards")
    .update({ body_md, body_edited_at: new Date().toISOString() })
    .eq("id", cardId);
  if (error) return { ok: false, error: error.message };
  await c.db.from("card_events").insert({
    card_id: cardId,
    actor: c.me.email,
    kind: "commented",
    payload: {
      author: comment.author,
      at: comment.at,
      preview: comment.text.slice(0, 80),
    },
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

/**
 * Hand a card to somebody on its project, or take it back.
 *
 * Writes the FK and the tracker text in one patch so exported frontmatter
 * always mirrors the assignment, exactly as `assignCardEpic` does. The roster
 * check here is the only one there is — the database deliberately allows an
 * off-roster email so that import can carry a file naming someone not yet
 * invited.
 */
export async function assignCard(
  cardId: string,
  memberId: string | null,
): Promise<Result> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Not signed in." };
  if (!UUID.test(cardId)) return { ok: false, error: "Invalid card." };
  if (memberId !== null && !UUID.test(memberId))
    return { ok: false, error: "Invalid person." };

  let email: string | null = null;
  if (memberId) {
    const { data: card } = await c.db
      .from("cards")
      .select("board_id, boards!inner(project_id)")
      .eq("id", cardId)
      .maybeSingle();
    const projectId = (
      card as unknown as { boards?: { project_id: string } } | null
    )?.boards?.project_id;
    if (!projectId) return { ok: false, error: "Card not found." };
    const { data: membership } = await c.db
      .from("project_members")
      .select("members!inner(email)")
      .eq("project_id", projectId)
      .eq("member_id", memberId)
      .maybeSingle();
    const found = (
      membership as unknown as { members?: { email: string } } | null
    )?.members?.email;
    if (!found)
      return { ok: false, error: "That person is not on this project." };
    email = found;
  }

  const { error } = await c.db
    .from("cards")
    .update({ assignee_id: memberId, assignee: email })
    .eq("id", cardId);
  if (error) return { ok: false, error: error.message };

  // One key, not the two-column patch: the history formatter turns
  // `{assignee}` into a sentence, while `{assignee_id, assignee}` would read
  // "changed assignee_id and changed assignee".
  await c.db.from("card_events").insert({
    card_id: cardId,
    actor: c.me.email,
    kind: "edited",
    payload: { assignee: email },
  });

  revalidatePath("/p/[project]/b/[board]", "page");
  revalidatePath("/p/[project]/b/[board]/c/[externalId]", "page");
  return { ok: true };
}

export async function revalidateBoard(project: string, board: string) {
  revalidatePath(`/p/${project}/b/${board}`);
}

/**
 * A fresh snapshot of what moves on the board, for the realtime doorbell.
 * Same loader as the page, so a refetch can never disagree with a reload.
 */
export async function refreshBoard(
  projectSlug: string,
  boardSlug: string,
): Promise<{ cards: Card[]; lanes: Lane[] }> {
  const { cards, lanes } = await loadBoard(projectSlug, boardSlug);
  return { cards, lanes };
}
