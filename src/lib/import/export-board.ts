import type { SupabaseClient } from "@supabase/supabase-js";
import { buildVocabulary, tagRef } from "@/lib/frontmatter/mapping";
import { cardToMarkdown, writeSheet } from "@/lib/frontmatter/write";
import { loadBoardState } from "@/lib/import/board-state";
import { sheetFromCard } from "@/lib/import/plan";

/**
 * One board's sheets, ready for a zip.
 *
 * Each file is the one that was handed to us with the board's marks written
 * in; a card that never had a source is written from scratch. Exporting also
 * rebases: `source_text`/`lane_from_source` are updated so the next diff shows
 * only what changed after this. A rebase that fails is logged, never thrown —
 * the sheet is already in the zip and the download must not die for it.
 *
 * `prefix` is prepended to every entry name, so a project export can put each
 * board in its own folder (`"<board-slug>/"`).
 */
export async function exportBoardEntries(
  db: SupabaseClient,
  boardId: string,
  prefix = "",
): Promise<Record<string, Uint8Array>> {
  const state = await loadBoardState(db, boardId);
  const { data: sources } = await db
    .from("cards")
    .select("id, source_text")
    .eq("board_id", boardId);
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
    external_id: string;
    source_text: string;
    lane_from_source: string | null;
  }[] = [];
  for (const card of state.cards.values()) {
    const sheet = sheetFromCard(card, state);
    const src = sourceOf.get(card.id);
    const text = src
      ? writeSheet(src, sheet, { tagRef: resolve })
      : cardToMarkdown(sheet);
    entries[`${prefix}${card.external_id}.md`] = enc.encode(text);
    if (text !== src)
      rebase.push({
        id: card.id,
        external_id: card.external_id,
        source_text: text,
        lane_from_source: sheet.lane,
      });
  }
  for (const r of rebase) {
    const { error } = await db
      .from("cards")
      .update({
        source_text: r.source_text,
        lane_from_source: r.lane_from_source,
      })
      .eq("id", r.id);
    if (error)
      console.error(`export rebase #${r.external_id}: ${error.message}`);
  }
  return entries;
}
