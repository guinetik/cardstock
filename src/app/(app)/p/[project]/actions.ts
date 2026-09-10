"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentAccess } from "@/lib/access-server";
import { CARD_TEMPLATE_MAX, CARD_TEMPLATE_SETTING } from "@/lib/card-template";
import { GATES_SETTING, validateGatesForSave } from "@/lib/gates";
import { cleanName, keyFromName } from "@/lib/keys";
import { STENCIL_NAME_MAX, stencilInputSchema } from "@/lib/stencils";
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

/** The project page and each board's manage page both show this vocabulary. */
function revalidateVocabulary() {
  revalidatePath("/p/[project]", "page");
  revalidatePath("/p/[project]/b/[board]/manage", "page");
}

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
  revalidateVocabulary();
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
  revalidateVocabulary();
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
  revalidateVocabulary();
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
  revalidateVocabulary();
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
  revalidateVocabulary();
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
  revalidateVocabulary();
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

/* -------------------------------------------------------------- board gates */

export type GatesResult = { error?: string; message?: string } | null;

/**
 * Save a board's ordered gates. Owners and project admins only.
 */
export async function updateBoardGates(
  _previous: GatesResult,
  form: FormData,
): Promise<GatesResult> {
  const boardId = String(form.get("boardId") ?? "");
  const projectSlug = String(form.get("projectSlug") ?? "");
  const boardSlug = String(form.get("boardSlug") ?? "");
  if (!boardId || !projectSlug || !boardSlug)
    return { error: "Board not found." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(String(form.get("gates") ?? ""));
  } catch {
    return { error: "Gates could not be saved." };
  }

  const db = await supabaseServer();
  const { data: project } = await db
    .from("projects")
    .select("id")
    .eq("slug", projectSlug)
    .maybeSingle();
  if (!project) return { error: "Project not found." };

  const access = await currentAccess(project.id);
  if (!access?.canManage)
    return { error: "Only an owner or project admin can change gates." };

  const { data, error: readError } = await db
    .from("boards")
    .select("id, project_id, settings, slug, lanes(id)")
    .eq("id", boardId)
    .maybeSingle();
  if (readError || !data)
    return { error: readError?.message ?? "Board not found." };

  const board = data as {
    id: string;
    project_id: string;
    settings: Record<string, unknown> | null;
    slug: string;
    lanes: { id: string }[] | null;
  };
  if (board.project_id !== project.id) return { error: "Board not found." };

  const result = validateGatesForSave(
    parsed,
    new Set((board.lanes ?? []).map((lane) => lane.id)),
  );
  if (!result.ok) return { error: result.error };

  const settings = (board.settings ?? {}) as Record<string, unknown>;
  const { error } = await db
    .from("boards")
    .update({
      settings: { ...settings, [GATES_SETTING]: result.gates },
    })
    .eq("id", board.id);
  if (error) return { error: error.message };

  revalidatePath(`/p/${projectSlug}`);
  revalidatePath(`/p/${projectSlug}/b/${boardSlug}/timeline`);
  revalidatePath(`/p/${projectSlug}/b/${boardSlug}/manage`);
  return { message: "Gates saved." };
}

export type CardTemplateResult = { error?: string; message?: string } | null;

/**
 * Save a board's new-card markdown template. Owners and project admins only.
 * An empty save clears the template; new cards then start blank again.
 */
export async function updateCardTemplate(
  _previous: CardTemplateResult,
  form: FormData,
): Promise<CardTemplateResult> {
  const boardId = String(form.get("boardId") ?? "");
  const projectSlug = String(form.get("projectSlug") ?? "");
  const boardSlug = String(form.get("boardSlug") ?? "");
  if (!boardId || !projectSlug || !boardSlug)
    return { error: "Board not found." };

  const template = String(form.get("template") ?? "").trim();
  if (template.length > CARD_TEMPLATE_MAX)
    return { error: "The template is too long to be a skeleton." };

  const db = await supabaseServer();
  const { data: project } = await db
    .from("projects")
    .select("id")
    .eq("slug", projectSlug)
    .maybeSingle();
  if (!project) return { error: "Project not found." };

  const access = await currentAccess(project.id);
  if (!access?.canManage)
    return { error: "Only an owner or project admin can change the template." };

  const { data: board } = await db
    .from("boards")
    .select("id, project_id, settings")
    .eq("id", boardId)
    .maybeSingle();
  if (!board || board.project_id !== project.id)
    return { error: "Board not found." };

  const settings = (board.settings ?? {}) as Record<string, unknown>;
  const { error } = await db
    .from("boards")
    .update({ settings: { ...settings, [CARD_TEMPLATE_SETTING]: template } })
    .eq("id", board.id);
  if (error) return { error: error.message };

  revalidatePath(`/p/${projectSlug}/b/${boardSlug}`);
  revalidatePath(`/p/${projectSlug}/b/${boardSlug}/manage`);
  return { message: "Template saved." };
}

/* ------------------------------------------------------------------ stencils
 * A stencil is a reusable card shape. Editing one never touches a card already
 * stamped from it — the same promise the card template makes.
 */

export type StencilResult = { error?: string } | null;

function revalidateStencils() {
  revalidatePath("/p/[project]/b/[board]/manage", "page");
  revalidatePath("/p/[project]/b/[board]", "page");
}

/**
 * Board-scoped writes need project admin, exactly as the card template does.
 * Returns the project id so callers can bind the target board to it — the
 * slug names who must hold canManage; the board decides where the write lands.
 */
async function requireBoardManager(
  projectSlug: string,
): Promise<{ error: string } | { projectId: string }> {
  const denied = await requireMember();
  if (denied) return { error: denied };
  const db = await supabaseServer();
  const { data: project } = await db
    .from("projects")
    .select("id")
    .eq("slug", projectSlug)
    .maybeSingle();
  if (!project) return { error: "Project not found." };
  const access = await currentAccess(project.id);
  return access?.canManage
    ? { projectId: project.id }
    : { error: "Only an owner or project admin can change stencils." };
}

/** The board must belong to the project whose canManage was just checked. */
async function boardInProject(
  boardId: string,
  projectId: string,
): Promise<boolean> {
  const db = await supabaseServer();
  const { data: board } = await db
    .from("boards")
    .select("project_id")
    .eq("id", boardId)
    .maybeSingle();
  return board?.project_id === projectId;
}

/** Same binding for a stencil, resolved through its board. */
async function stencilInProject(
  stencilId: string,
  projectId: string,
): Promise<boolean> {
  const db = await supabaseServer();
  const { data: stencil } = await db
    .from("card_stencils")
    .select("board_id")
    .eq("id", stencilId)
    .maybeSingle();
  return !!stencil && boardInProject(stencil.board_id, projectId);
}

export async function createStencil(
  _prev: StencilResult,
  form: FormData,
): Promise<StencilResult> {
  const projectSlug = String(form.get("projectSlug") ?? "");
  const gate = await requireBoardManager(projectSlug);
  if ("error" in gate) return { error: gate.error };
  const boardId = String(form.get("boardId") ?? "");
  const name = cleanName(String(form.get("name") ?? ""));
  if (!boardId || !(await boardInProject(boardId, gate.projectId)))
    return { error: "Board not found." };
  if (!name) return { error: "A stencil needs a name." };
  if (name.length > STENCIL_NAME_MAX)
    return { error: "That name is too long for a menu." };

  const db = await supabaseServer();
  const { error } = await db
    .from("card_stencils")
    .insert({ board_id: boardId, name });
  if (error)
    return {
      error:
        error.code === "23505"
          ? `This board already has a stencil called “${name}”.`
          : error.message,
    };
  revalidateStencils();
  return null;
}

/** Copy a board's stencil, including its tag links, under a fresh name. */
export async function duplicateStencil(
  _prev: StencilResult,
  form: FormData,
): Promise<StencilResult> {
  const gate = await requireBoardManager(String(form.get("projectSlug") ?? ""));
  if ("error" in gate) return { error: gate.error };
  const stencilId = String(form.get("stencilId") ?? "");
  if (!stencilId || !(await stencilInProject(stencilId, gate.projectId)))
    return { error: "Stencil not found." };
  const db = await supabaseServer();
  const { data: source, error: sourceError } = await db
    .from("card_stencils")
    .select(
      "board_id, name, title, summary, body_md, area, effort, card_stencil_tags(tag_id)",
    )
    .eq("id", stencilId)
    .single();
  if (sourceError) return { error: "Could not load the stencil to duplicate." };
  const { card_stencil_tags: tags, ...fields } = source;

  // The unique constraint settles concurrent copies; retry with a fresh name.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: existing, error: namesError } = await db
      .from("card_stencils")
      .select("name")
      .eq("board_id", source.board_id);
    if (namesError) return { error: "Could not name the duplicate stencil." };
    const names = new Set(existing.map((row) => row.name));
    let name: string;
    let number = 1;
    do {
      const suffix = number === 1 ? " (copy)" : ` (copy ${number})`;
      name =
        source.name.slice(0, STENCIL_NAME_MAX - suffix.length).trimEnd() +
        suffix;
      number++;
    } while (names.has(name));
    const { data: copy, error: copyError } = await db
      .from("card_stencils")
      .insert({ ...fields, name })
      .select("id")
      .single();
    if (copyError?.code === "23505") continue;
    if (copyError) return { error: "Could not duplicate the stencil." };
    if (tags.length) {
      const { error: tagError } = await db
        .from("card_stencil_tags")
        .insert(tags.map(({ tag_id }) => ({ stencil_id: copy.id, tag_id })));
      if (tagError) {
        // Remove only this new copy if its tag links could not be copied.
        const { error: cleanupError } = await db
          .from("card_stencils")
          .delete()
          .eq("id", copy.id);
        revalidateStencils();
        return {
          error: cleanupError
            ? `“${name}” was created without its tags. Edit it to restore them, or delete it and try again.`
            : "Could not copy the stencil's tags. Please try again.",
        };
      }
    }
    revalidateStencils();
    return null;
  }
  return {
    error: "Another copy was created at the same time. Please try again.",
  };
}

export async function saveStencil(
  _prev: StencilResult,
  form: FormData,
): Promise<StencilResult> {
  const projectSlug = String(form.get("projectSlug") ?? "");
  const gate = await requireBoardManager(projectSlug);
  if ("error" in gate) return { error: gate.error };
  const stencilId = String(form.get("stencilId") ?? "");
  if (!stencilId || !(await stencilInProject(stencilId, gate.projectId)))
    return { error: "Stencil not found." };
  const parsed = stencilInputSchema.safeParse({
    name: form.get("name") ?? "",
    title: form.get("title") ?? "",
    summary: form.get("summary") ?? "",
    body: form.get("body") ?? "",
    area: form.get("area") ?? "",
    effort: form.get("effort") ?? "",
    tagIds: form.getAll("tagIds"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, title, summary, body, area, effort, tagIds } = parsed.data;

  const db = await supabaseServer();
  // Validate the complete selection before replacing existing tags.
  const { data: stencil } = await db
    .from("card_stencils")
    .select("board_id")
    .eq("id", stencilId)
    .single();
  if (!stencil) return { error: "Stencil not found." };
  if (tagIds.length) {
    const { data: tags, error } = await db
      .from("tags")
      .select("id, tag_groups!inner(board_id)")
      .in("id", tagIds)
      .eq("tag_groups.board_id", stencil.board_id);
    if (error || tags?.length !== tagIds.length)
      return { error: "Choose tags from this board." };
  }
  const { error } = await db
    .from("card_stencils")
    .update({
      name,
      title: title || null,
      summary: summary || null,
      body_md: body,
      area: area || null,
      effort: effort || null,
    })
    .eq("id", stencilId);
  if (error)
    return {
      error:
        error.code === "23505"
          ? `This board already has a stencil called “${name}”.`
          : error.message,
    };

  // Tags are replaced wholesale: the form carries the complete set. The two
  // writes are not atomic; a failure between them leaves the stencil tagless,
  // which the next save repairs. Accepted for board configuration.
  const { error: cleared } = await db
    .from("card_stencil_tags")
    .delete()
    .eq("stencil_id", stencilId);
  if (cleared) return { error: cleared.message };
  if (tagIds.length) {
    const { error: added } = await db
      .from("card_stencil_tags")
      .insert(tagIds.map((tag_id) => ({ stencil_id: stencilId, tag_id })));
    if (added) return { error: added.message };
  }
  revalidateStencils();
  return null;
}

/** Deleting a stencil never touches cards stamped from it. */
export async function deleteStencil(
  _prev: StencilResult,
  form: FormData,
): Promise<StencilResult> {
  const projectSlug = String(form.get("projectSlug") ?? "");
  const gate = await requireBoardManager(projectSlug);
  if ("error" in gate) return { error: gate.error };
  const stencilId = String(form.get("stencilId") ?? "");
  if (!stencilId || !(await stencilInProject(stencilId, gate.projectId)))
    return { error: "Which stencil?" };
  const db = await supabaseServer();
  const { error } = await db.from("card_stencils").delete().eq("id", stencilId);
  if (error) return { error: error.message };
  revalidateStencils();
  return null;
}
