import { zipSync } from "fflate";
import { currentAccess } from "@/lib/access-server";
import { exportBoardEntries } from "@/lib/import/export-board";
import { currentMember, supabaseServer } from "@/lib/supabase/server";

/**
 * The board as a folder of sheets. Each file is the one that was handed to us
 * with the board's marks written in; a card that never had one is written
 * from scratch. Downloading rebases: the next diff shows only what changed
 * after this.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/p/[project]/b/[board]/export.zip">,
) {
  const me = await currentMember();
  if (!me) return new Response("unauthorized", { status: 401 });
  const { project, board } = await ctx.params;
  const db = await supabaseServer();
  const { data: b } = await db
    .from("boards")
    .select("id, project_id, projects!inner(slug)")
    .eq("slug", board)
    .eq("projects.slug", project)
    .maybeSingle();
  if (!b) return new Response("not found", { status: 404 });
  const access = await currentAccess(b.project_id as string);
  if (!access?.canManage) return new Response("forbidden", { status: 403 });

  let entries: Record<string, Uint8Array>;
  try {
    entries = await exportBoardEntries(db, b.id as string);
  } catch (e) {
    // A read that failed must not become a download built from rows alone.
    return new Response((e as Error).message, { status: 500 });
  }
  const zip = zipSync(entries, { level: 6 });
  return new Response(zip, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${project}-${board}-${new Date().toISOString().slice(0, 10)}.zip"`,
    },
  });
}
