import { currentAccess } from "@/lib/access-server";
import { loadBoard } from "@/lib/board-data";
import { emptyFilters, matches, toCsv } from "@/lib/filters";
import { currentMember, supabaseServer } from "@/lib/supabase/server";

/** CSV of the board — "as long as I can slice it and dice it". Query: ?internal=1&archived=1&tags=id,id&q=text */
export async function GET(
  request: Request,
  ctx: RouteContext<"/p/[project]/b/[board]/export">,
) {
  const me = await currentMember();
  if (!me) return new Response("unauthorized", { status: 401 });
  const { project, board } = await ctx.params;
  const db = await supabaseServer();
  const { data: folder } = await db
    .from("projects")
    .select("id")
    .eq("slug", project)
    .maybeSingle();
  if (!folder) return new Response("not found", { status: 404 });
  const access = await currentAccess(folder.id);
  if (!access?.canManage) return new Response("forbidden", { status: 403 });
  const data = await loadBoard(project, board);
  const url = new URL(request.url);
  const f = emptyFilters(url.searchParams.get("internal") === "1");
  f.showArchived = url.searchParams.get("archived") === "1";
  f.query = url.searchParams.get("q") ?? "";
  for (const id of (url.searchParams.get("tags") ?? "")
    .split(",")
    .filter(Boolean))
    f.tags.add(id);
  const cards = data.cards.filter((c) =>
    matches(c, f, data.groups, data.lanes),
  );
  const csv = toCsv(cards, data.lanes, data.groups);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${project}-${board}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
