"use server";

import { revalidatePath } from "next/cache";
import { currentMember, supabaseServer } from "@/lib/supabase/server";
import type { EpicConfidence } from "@/lib/types";

export interface EpicPatch {
  outcome?: string | null;
  owner_label?: string | null;
  start_date?: string | null;
  target_date?: string | null;
  priority?: 1 | 2 | 3 | null;
  confidence?: EpicConfidence;
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Create an epic on a board, or return the existing one with the same name.
 * The importer upserts on (board_id, source_name) the same way; this is the
 * interactive counterpart for the cockpit's onboarding and add-epic flows.
 */
export async function createEpic(
  boardId: string,
  input: { name: string; outcome?: string },
): Promise<
  | { ok: true; epic: { id: string; source_name: string } }
  | { ok: false; error: string }
> {
  const me = await currentMember();
  if (!me) return { ok: false, error: "Not signed in." };
  if (!UUID.test(boardId)) return { ok: false, error: "Invalid board." };
  const name = input.name.trim().slice(0, 200);
  if (!name) return { ok: false, error: "Give the epic a name." };
  const outcome = input.outcome?.trim().slice(0, 500) || null;
  const db = await supabaseServer();
  const { data, error } = await db
    .from("epics")
    .upsert(
      { board_id: boardId, source_name: name, outcome },
      { onConflict: "board_id,source_name", ignoreDuplicates: false },
    )
    .select("id, source_name")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Failed." };
  revalidatePath("/p/[project]/b/[board]/cockpit", "page");
  return { ok: true, epic: data };
}

/**
 * Point a card at an epic (or clear it). Writes both the FK and the `epic`
 * tracker text so exported frontmatter always mirrors the assignment.
 */
export async function assignCardEpic(
  cardId: string,
  epicId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await currentMember();
  if (!me) return { ok: false, error: "Not signed in." };
  if (!UUID.test(cardId)) return { ok: false, error: "Invalid card." };
  if (epicId !== null && !UUID.test(epicId))
    return { ok: false, error: "Invalid epic." };
  const db = await supabaseServer();
  let epicName: string | null = null;
  if (epicId) {
    const { data: target } = await db
      .from("epics")
      .select("source_name")
      .eq("id", epicId)
      .maybeSingle();
    if (!target) return { ok: false, error: "Epic not found." };
    epicName = target.source_name;
  }
  const patch = { epic_id: epicId, epic: epicName };
  const { error } = await db.from("cards").update(patch).eq("id", cardId);
  if (error) return { ok: false, error: error.message };
  await db.from("card_events").insert({
    card_id: cardId,
    actor: me.email,
    kind: "edited",
    payload: patch,
  });
  revalidatePath("/p/[project]/b/[board]/cockpit", "page");
  return { ok: true };
}

export async function updateEpic(
  epicId: string,
  patch: EpicPatch,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await currentMember();
  if (!me) return { ok: false, error: "Not signed in." };
  if (!UUID.test(epicId)) return { ok: false, error: "Invalid epic." };
  const clean: EpicPatch = {};
  if (patch.outcome !== undefined)
    clean.outcome = patch.outcome?.trim().slice(0, 500) || null;
  if (patch.owner_label !== undefined)
    clean.owner_label = patch.owner_label?.trim().slice(0, 120) || null;
  for (const key of ["start_date", "target_date"] as const) {
    const value = patch[key];
    if (value !== undefined) {
      if (value && !ISO_DATE.test(value))
        return { ok: false, error: "Use a valid date." };
      clean[key] = value || null;
    }
  }
  if (
    patch.priority !== undefined &&
    (patch.priority === null || [1, 2, 3].includes(patch.priority))
  )
    clean.priority = patch.priority;
  if (
    patch.confidence &&
    ["confident", "concerned", "unknown"].includes(patch.confidence)
  )
    clean.confidence = patch.confidence;
  const db = await supabaseServer();
  const { data: current } = await db
    .from("epics")
    .select("start_date, target_date")
    .eq("id", epicId)
    .maybeSingle();
  if (!current) return { ok: false, error: "Epic not found." };
  const start =
    clean.start_date === undefined ? current.start_date : clean.start_date;
  const target =
    clean.target_date === undefined ? current.target_date : clean.target_date;
  if (start && target && start > target)
    return { ok: false, error: "Start must be on or before the commitment." };
  const { error } = await db.from("epics").update(clean).eq("id", epicId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/p/[project]/b/[board]/cockpit", "page");
  return { ok: true };
}
