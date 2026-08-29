import { zipSync } from "fflate";
import { currentAccess } from "@/lib/access-server";
import { exportBoardEntries } from "@/lib/import/export-board";
import { currentMember, supabaseServer } from "@/lib/supabase/server";

/**
 * The whole project taken home: one folder per board, its sheets inside.
 * Same rebase as the board export — every board is written back so the next
 * diff shows only what changed after this download.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/p/[project]/export.zip">,
) {
  const me = await currentMember();
  if (!me) return new Response("unauthorized", { status: 401 });
  const { project } = await ctx.params;
  const db = await supabaseServer();
  const { data: p } = await db
    .from("projects")
    .select("id")
    .eq("slug", project)
    .maybeSingle();
  if (!p) return new Response("not found", { status: 404 });
  const access = await currentAccess(p.id as string);
  if (!access?.canManage) return new Response("forbidden", { status: 403 });

  const { data: boards } = await db
    .from("boards")
    .select("id, slug")
    .eq("project_id", p.id);

  const entries: Record<string, Uint8Array> = {};
  for (const board of boards ?? []) {
    Object.assign(
      entries,
      await exportBoardEntries(db, board.id as string, `${board.slug}/`),
    );
  }

  const zip = zipSync(entries, { level: 6 });
  return new Response(zip, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${project}-${new Date().toISOString().slice(0, 10)}.zip"`,
    },
  });
}
