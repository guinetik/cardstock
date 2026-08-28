"use server";
import { revalidatePath } from "next/cache";
import { cleanName, keyFromName } from "@/lib/keys";
import { currentMember, supabaseServer } from "@/lib/supabase/server";

/**
 * Add an email to the allowlist and to this project.
 *
 * Owner-only: RLS enforces it, but check here too so the caller gets a reason
 * rather than a policy violation.
 */
export async function addMember(
  _prev: { error?: string } | null,
  form: FormData,
) {
  const me = await currentMember();
  if (!me) return { error: "Not signed in." };
  if (me.role !== "owner")
    return { error: "Only the owner can invite people while in beta." };
  const projectId = String(form.get("projectId") ?? "");
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!projectId || !email.includes("@"))
    return { error: "A valid email is required." };
  const db = await supabaseServer();
  const { data: m, error } = await db
    .from("members")
    .upsert(
      { email, display_name: email.split("@")[0] },
      { onConflict: "email" },
    )
    .select("id")
    .single();
  if (error || !m) return { error: error?.message ?? "Could not add member." };
  const { error: e2 } = await db
    .from("project_members")
    .upsert(
      { project_id: projectId, member_id: m.id },
      { onConflict: "project_id,member_id" },
    );
  if (e2) return { error: e2.message };
  revalidatePath("/p/[project]", "page");
  return null;
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
