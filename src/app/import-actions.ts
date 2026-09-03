"use server";

import { revalidatePath } from "next/cache";
import { currentAccess } from "@/lib/access-server";
import { ApplyError, applyPlan } from "@/lib/import/apply";
import { loadBoardState } from "@/lib/import/board-state";
import { planImport } from "@/lib/import/plan";
import type { BoardState, Plan } from "@/lib/import/types";
import { filesFromZip } from "@/lib/import/zip";
import { cleanName, keyFromName } from "@/lib/keys";
import { currentMember, supabaseServer } from "@/lib/supabase/server";

export type ImportPlanResult =
  | { plan: Plan; boardName: string }
  | { error: string };
export type ImportApplyResult =
  | { ok: true; created: number; updated: number; href: string }
  | { error: string; href?: string };

/**
 * Filing is not one transaction: when it stops partway, what was written is
 * still there. The message says how far it got so the next run is informed.
 */
function applyMessage(e: unknown): string {
  const err = e as Error;
  return err instanceof ApplyError
    ? `Stopped after ${err.created} created, ${err.updated} changed: ${err.message}`
    : err.message;
}

async function sheets(form: FormData) {
  const file = form.get("file");
  if (!(file instanceof File) || !file.size)
    throw new Error("Choose a zip first.");
  return filesFromZip(new Uint8Array(await file.arrayBuffer()));
}

/** The board and its project, through RLS, for someone allowed to manage it (owner or project admin). */
async function board(boardId: string) {
  const db = await supabaseServer();
  const { data } = await db
    .from("boards")
    .select("id, slug, name, project_id, projects!inner(slug)")
    .eq("id", boardId)
    .maybeSingle();
  if (!data) throw new Error("Board not found.");
  const access = await currentAccess(data.project_id as string);
  if (!access?.canManage)
    throw new Error(
      "Only an owner or a project admin can import into this board.",
    );
  const project = data.projects as unknown as { slug: string };
  return {
    db,
    id: data.id as string,
    name: data.name as string,
    href: `/p/${project.slug}/b/${data.slug}`,
    email: access.member.email as string,
  };
}

export async function planBoardImport(
  form: FormData,
): Promise<ImportPlanResult> {
  try {
    const b = await board(String(form.get("boardId") ?? ""));
    const files = await sheets(form);
    const state = await loadBoardState(b.db, b.id);
    return { plan: planImport(files, state), boardName: b.name };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function applyBoardImport(
  form: FormData,
): Promise<ImportApplyResult> {
  try {
    const b = await board(String(form.get("boardId") ?? ""));
    const files = await sheets(form);
    const state = await loadBoardState(b.db, b.id);
    const plan = planImport(files, state);
    if (!plan.ok)
      return { error: "Some files did not validate; nothing was imported." };
    const r = await applyPlan(b.db, state, plan, b.email);
    revalidatePath("/");
    revalidatePath(b.href);
    return { ok: true, ...r, href: b.href };
  } catch (e) {
    return { error: applyMessage(e) };
  }
}

/** A board that does not exist yet, shaped like `create_board` will make it. */
function freshBoardState(): BoardState {
  const lane = (key: string, name: string, position: number, kind: string) => ({
    id: `new:${key}`,
    key,
    name,
    position,
    kind,
  });
  return {
    id: "new",
    lanes: [
      lane("unsorted", "Unsorted", 0, "inbox"),
      lane("now", "Now", 1, "work"),
      lane("next", "Next", 2, "work"),
      lane("done", "Done", 3, "done"),
      lane("archive", "Archive", 4, "archive"),
    ],
    groups: [],
    cards: new Map(),
    epics: new Map(),
    members: [],
  };
}

function names(form: FormData) {
  const name = cleanName(String(form.get("name") ?? ""));
  const boardName = cleanName(String(form.get("boardName") ?? ""));
  if (!name) throw new Error("Enter a project name (80 characters or fewer).");
  if (!boardName)
    throw new Error("Enter a board name (80 characters or fewer).");
  const slug = keyFromName(name);
  const boardSlug = keyFromName(boardName);
  if (!slug || !boardSlug) throw new Error("Names need a letter or number.");
  return {
    name,
    boardName,
    slug,
    boardSlug,
    description: String(form.get("description") ?? ""),
  };
}

export async function planProjectImport(
  form: FormData,
): Promise<ImportPlanResult> {
  try {
    const me = await currentMember();
    if (!me) return { error: "Not signed in." };
    if (me.role !== "owner")
      return { error: "Only an owner can import a project." };
    const n = names(form);
    const files = await sheets(form);
    return {
      plan: planImport(files, freshBoardState()),
      boardName: n.boardName,
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function applyProjectImport(
  form: FormData,
): Promise<ImportApplyResult> {
  let href: string | undefined;
  try {
    const me = await currentMember();
    if (!me) return { error: "Not signed in." };
    if (me.role !== "owner")
      return { error: "Only an owner can import a project." };
    const n = names(form);
    const files = await sheets(form);
    if (!planImport(files, freshBoardState()).ok)
      return { error: "Some files did not validate; nothing was created." };

    const db = await supabaseServer();
    const { data: projectId, error: pe } = await db.rpc("create_project", {
      p_slug: n.slug,
      p_name: n.name,
      p_description: n.description || null,
    });
    if (pe)
      return {
        error:
          pe.code === "23505"
            ? `A project is already filed as /p/${n.slug}.`
            : pe.message,
      };
    href = `/p/${n.slug}`;
    const { data: boardId, error: be } = await db.rpc("create_board", {
      p_project_id: projectId,
      p_slug: n.boardSlug,
      p_name: n.boardName,
    });
    if (be) return { error: be.message, href };
    href = `/p/${n.slug}/b/${n.boardSlug}`;

    const state = await loadBoardState(db, boardId as string);
    const plan = planImport(files, state);
    const r = await applyPlan(db, state, plan, me.email);
    revalidatePath("/");
    return { ok: true, ...r, href };
  } catch (e) {
    return { error: applyMessage(e), href };
  }
}
