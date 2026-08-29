/**
 * Board → markdown tracker, from the command line.
 *
 *   bun run etl:export --project <slug> --board <slug> --source <dir> [--dry-run]
 *
 * The same writer the download uses: a file that exists under --source and has a
 * stored sheet is line-edited; a card with no file is written from scratch.
 */
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildVocabulary, tagRef } from "../src/lib/frontmatter/mapping";
import { cardToMarkdown, writeSheet } from "../src/lib/frontmatter/write";
import { loadBoardState } from "../src/lib/import/board-state";
import { sheetFromCard } from "../src/lib/import/plan";
import { arg, flag, loadBoard, serviceClient } from "./db";

const projectSlug = arg("project");
const boardSlug = arg("board");
const source = arg("source");
const dryRun = flag("dry-run");

const db = serviceClient();
const ctx = await loadBoard(db, projectSlug, boardSlug);
const state = await loadBoardState(db, ctx.board.id);
const { data: sources } = await db
  .from("cards")
  .select("id, source_text")
  .eq("board_id", ctx.board.id);
const sourceOf = new Map(
  (sources ?? []).map((s) => [s.id as string, s.source_text as string | null]),
);
const vocab = buildVocabulary(
  state.groups.flatMap((g) => g.tags.map((t) => `${g.key}:${t.key}`)),
);
const resolve = (t: string) => {
  const r = tagRef(t, vocab);
  return r && "ref" in r ? r.ref : null;
};

let changed = 0;
let unchanged = 0;
for (const card of state.cards.values()) {
  const file = path.join(source, `${card.external_id}.md`);
  const sheet = sheetFromCard(card, state);
  let before: string | null = null;
  try {
    await stat(file);
    before = await readFile(file, "utf8");
  } catch {
    before = null;
  }
  // The file on disk is the base when it exists; the stored sheet otherwise; nothing for an app-born card.
  const base = before ?? sourceOf.get(card.id) ?? null;
  const after = base
    ? writeSheet(base, sheet, { tagRef: resolve })
    : cardToMarkdown(sheet);
  if (after === before) {
    unchanged++;
    continue;
  }
  changed++;
  if (dryRun) {
    console.log(
      `would ${before ? "update" : "create"} ${card.external_id}.md → ${sheet.lane}#${sheet.rank ?? ""}`,
    );
    continue;
  }
  await writeFile(file, after, "utf8");
  await db
    .from("cards")
    .update({ source_text: after, lane_from_source: sheet.lane })
    .eq("id", card.id);
}
console.log(
  `${dryRun ? "[dry-run] " : ""}${projectSlug}/${boardSlug} → ${source}: ${changed} files created or updated, ${unchanged} unchanged`,
);
