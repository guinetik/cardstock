import { zipSync } from "fflate";
import { currentAccess } from "@/lib/access-server";
import { buildVocabulary, tagRef } from "@/lib/frontmatter/mapping";
import { cardToMarkdown, writeSheet } from "@/lib/frontmatter/write";
import { loadBoardState } from "@/lib/import/board-state";
import { sheetFromCard } from "@/lib/import/plan";
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

  const state = await loadBoardState(db, b.id as string);
  const { data: sources } = await db
    .from("cards")
    .select("id, source_text")
    .eq("board_id", b.id);
  const sourceOf = new Map(
    (sources ?? []).map((s) => [
      s.id as string,
      s.source_text as string | null,
    ]),
  );
  const vocab = buildVocabulary(
    state.groups.flatMap((g) => g.tags.map((t) => `${g.key}:${t.key}`)),
  );
  const resolve = (t: string) => {
    const r = tagRef(t, vocab);
    return r && "ref" in r ? r.ref : null;
  };

  const entries: Record<string, Uint8Array> = {};
  const enc = new TextEncoder();
  const rebase: {
    id: string;
    source_text: string;
    lane_from_source: string | null;
  }[] = [];
  for (const card of state.cards.values()) {
    const sheet = sheetFromCard(card, state);
    const src = sourceOf.get(card.id);
    const text = src
      ? writeSheet(src, sheet, { tagRef: resolve })
      : cardToMarkdown(sheet);
    entries[`${card.external_id}.md`] = enc.encode(text);
    if (text !== src)
      rebase.push({
        id: card.id,
        source_text: text,
        lane_from_source: sheet.lane,
      });
  }
  for (const r of rebase)
    await db
      .from("cards")
      .update({
        source_text: r.source_text,
        lane_from_source: r.lane_from_source,
      })
      .eq("id", r.id);

  const zip = zipSync(entries, { level: 6 });
  return new Response(zip, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${project}-${board}-${new Date().toISOString().slice(0, 10)}.zip"`,
    },
  });
}
