"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentAccess } from "@/lib/access-server";
import { cleanName, keyFromName } from "@/lib/keys";
import { currentMember, supabaseServer } from "@/lib/supabase/server";
import {
  MAX_FORGOTTEN_AFTER_DAYS,
  MIN_FORGOTTEN_AFTER_DAYS,
  TIMELINE_FORGOTTEN_SETTING,
} from "@/lib/timeline";

export type CreateBoardResult = { error?: string } | null;

export async function createBoard(
  _previous: CreateBoardResult,
  form: FormData,
): Promise<CreateBoardResult> {
  const member = await currentMember();
  if (!member) return { error: "Not signed in." };
  const projectId = String(form.get("projectId") ?? "");
  const projectSlug = String(form.get("projectSlug") ?? "");
  const name = cleanName(String(form.get("name") ?? ""));
  if (!projectId || !projectSlug) return { error: "Project not found." };
  if (!name) return { error: "Enter a board name (80 characters or fewer)." };
  const slug = keyFromName(name);
  if (!slug) return { error: "The board name needs a letter or number." };
  const access = await currentAccess(projectId);
  if (!access?.canManage)
    return { error: "Only an owner or project admin can create a board." };

  const db = await supabaseServer();
  const { error } = await db.rpc("create_board", {
    p_project_id: projectId,
    p_slug: slug,
    p_name: name,
  });
  if (error) {
    if (error.code === "23505")
      return { error: `This project already has a board using “${slug}”.` };
    return { error: error.message };
  }
  redirect(`/p/${projectSlug}/b/${slug}`);
}

/* ------------------------------------------------------------------ taxonomy
 * Tag groups are the concepts a board sorts by — Integration, Step, Kind — and
 * the tags in them are the vocabulary. Both are ordinary rows, and the importer
 * resolves a bare tag in a file by looking it up here, so editing this changes
 * what the tracker can say.
 *
 * Keys are permanent for the same reason lane keys are: card frontmatter names
 * a tag by its key. Names are free to change.
 */

export type TaxonomyResult = { error?: string } | null;

/** RLS restricts these to project members; this returns a reason instead of a policy error. */
async function requireMember(): Promise<string | null> {
  const me = await currentMember();
  return me ? null : "Not signed in.";
}

export async function createTagGroup(
  _prev: TaxonomyResult,
  form: FormData,
): Promise<TaxonomyResult> {
  const denied = await requireMember();
  if (denied) return { error: denied };
  const boardId = String(form.get("boardId") ?? "");
  const clean = cleanName(String(form.get("name") ?? ""));
  if (!boardId || !clean) return { error: "A name is required." };
  const key = keyFromName(clean);
  if (!key)
    return { error: "That name has no letters or digits to make an ID from." };

  const db = await supabaseServer();
  const { data: taken } = await db
    .from("tag_groups")
    .select("id")
    .eq("board_id", boardId)
    .eq("key", key)
    .maybeSingle();
  if (taken)
    return { error: `This board already has a group with the ID “${key}”.` };

  const { data: last } = await db
    .from("tag_groups")
    .select("position")
    .eq("board_id", boardId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await db.from("tag_groups").insert({
    board_id: boardId,
    key,
    name: clean,
    position: (last?.position ?? -1) + 1,
  });
  if (error) return { error: error.message };
  revalidatePath("/p/[project]", "page");
  return null;
}

export async function renameTagGroup(
  _prev: TaxonomyResult,
  form: FormData,
): Promise<TaxonomyResult> {
  const denied = await requireMember();
  if (denied) return { error: denied };
  const id = String(form.get("groupId") ?? "");
  const clean = cleanName(String(form.get("name") ?? ""));
  if (!id || !clean) return { error: "A name is required." };
  const db = await supabaseServer();
  const { error } = await db
    .from("tag_groups")
    .update({ name: clean })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/p/[project]", "page");
  return null;
}

/**
 * Remove a group and everything in it.
 *
 * Refused while any card still carries one of its tags: `card_tags` cascades,
 * so this would quietly strip tags off cards, and the tracker files would put
 * them straight back on the next import — a change that undoes itself.
 */
export async function deleteTagGroup(
  _prev: TaxonomyResult,
  form: FormData,
): Promise<TaxonomyResult> {
  const denied = await requireMember();
  if (denied) return { error: denied };
  const id = String(form.get("groupId") ?? "");
  if (!id) return { error: "Which group?" };
  const db = await supabaseServer();
  const { data: tags } = await db.from("tags").select("id").eq("group_id", id);
  const ids = (tags ?? []).map((t) => t.id);
  if (ids.length) {
    const { count } = await db
      .from("card_tags")
      .select("card_id", { count: "exact", head: true })
      .in("tag_id", ids);
    if (count)
      return {
        error: `${count} card${count === 1 ? " still uses" : "s still use"} a tag in this group. Remove the tag from those cards first.`,
      };
  }
  const { error } = await db.from("tag_groups").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/p/[project]", "page");
  return null;
}

export async function createTag(
  _prev: TaxonomyResult,
  form: FormData,
): Promise<TaxonomyResult> {
  const denied = await requireMember();
  if (denied) return { error: denied };
  const groupId = String(form.get("groupId") ?? "");
  const boardId = String(form.get("boardId") ?? "");
  const clean = cleanName(String(form.get("name") ?? ""));
  if (!groupId || !clean) return { error: "A name is required." };
  const key = keyFromName(clean);
  if (!key)
    return { error: "That name has no letters or digits to make an ID from." };

  const db = await supabaseServer();
  // Unique across the board, not just the group: a file writes a bare `bug`,
  // and the importer resolves it by finding the one group that declares it.
  // Two groups claiming an ID would make that tag ambiguous everywhere.
  const { data: groups } = await db
    .from("tag_groups")
    .select("id, name")
    .eq("board_id", boardId);
  const groupIds = (groups ?? []).map((g) => g.id);
  const { data: existing } = await db
    .from("tags")
    .select("group_id")
    .eq("key", key)
    .in("group_id", groupIds);
  if (existing?.length) {
    const owner = (groups ?? []).find((g) => g.id === existing[0].group_id);
    return {
      error: `“${owner?.name ?? "Another group"}” already uses the ID “${key}”. IDs are unique across the board so markdown can name a tag without saying which group it is in.`,
    };
  }

  const { error } = await db
    .from("tags")
    .insert({ group_id: groupId, key, name: clean });
  if (error) return { error: error.message };
  revalidatePath("/p/[project]", "page");
  return null;
}

export async function renameTag(
  _prev: TaxonomyResult,
  form: FormData,
): Promise<TaxonomyResult> {
  const denied = await requireMember();
  if (denied) return { error: denied };
  const id = String(form.get("tagId") ?? "");
  const clean = cleanName(String(form.get("name") ?? ""));
  if (!id || !clean) return { error: "A name is required." };
  const db = await supabaseServer();
  const { error } = await db.from("tags").update({ name: clean }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/p/[project]", "page");
  return null;
}

/** Refused while cards still carry it, for the same reason as a group. */
export async function deleteTag(
  _prev: TaxonomyResult,
  form: FormData,
): Promise<TaxonomyResult> {
  const denied = await requireMember();
  if (denied) return { error: denied };
  const id = String(form.get("tagId") ?? "");
  if (!id) return { error: "Which tag?" };
  const db = await supabaseServer();
  const { count } = await db
    .from("card_tags")
    .select("card_id", { count: "exact", head: true })
    .eq("tag_id", id);
  if (count)
    return {
      error: `${count} card${count === 1 ? " still uses" : "s still use"} this tag. Remove it from those cards first.`,
    };
  const { error } = await db.from("tags").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/p/[project]", "page");
  return null;
}

/* --------------------------------------------------------- project timeline */

export type TimelineSettingsResult = {
  error?: string;
  message?: string;
} | null;

export async function updateTimelineSettings(
  _previous: TimelineSettingsResult,
  form: FormData,
): Promise<TimelineSettingsResult> {
  const projectId = String(form.get("projectId") ?? "");
  const projectSlug = String(form.get("projectSlug") ?? "");
  const days = Number(form.get("forgottenAfterDays"));
  if (!projectId || !projectSlug) return { error: "Project not found." };
  if (
    !Number.isInteger(days) ||
    days < MIN_FORGOTTEN_AFTER_DAYS ||
    days > MAX_FORGOTTEN_AFTER_DAYS
  )
    return {
      error: `Choose a whole number from ${MIN_FORGOTTEN_AFTER_DAYS} to ${MAX_FORGOTTEN_AFTER_DAYS} days.`,
    };

  const access = await currentAccess(projectId);
  if (!access?.canManage)
    return {
      error: "Only an owner or project admin can change timeline settings.",
    };

  const db = await supabaseServer();
  const { data: project, error: readError } = await db
    .from("projects")
    .select("settings")
    .eq("id", projectId)
    .maybeSingle();
  if (readError || !project)
    return { error: readError?.message ?? "Project not found." };

  const settings = (project.settings ?? {}) as Record<string, unknown>;
  const { error } = await db
    .from("projects")
    .update({
      settings: { ...settings, [TIMELINE_FORGOTTEN_SETTING]: days },
    })
    .eq("id", projectId);
  if (error) return { error: error.message };

  revalidatePath(`/p/${projectSlug}`);
  return { message: `Timeline will flag unplanned work after ${days} days.` };
}
