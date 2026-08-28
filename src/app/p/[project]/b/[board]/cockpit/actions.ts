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
