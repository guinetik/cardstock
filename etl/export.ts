/**
 * Board → markdown tracker, from the command line.
 *
 *   bun run etl:export --project <slug> --board <slug> --source <dir> [--mapping <file>] [--dry-run]
 *
 * Pass the same --mapping the import uses: a tracker that writes `int:x` for
 * the group the board calls `area` needs the alias on the way down too, or
 * every `int:` line is dropped and rewritten as `area:`.
 *
 * The same writer the download uses: a file that exists under --source and has a
 * stored sheet is line-edited; a card with no file is written from scratch.
 */
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildVocabulary,
  type Mapping,
  tagRef,
} from "../src/lib/frontmatter/mapping";
import { cardToMarkdown, writeSheet } from "../src/lib/frontmatter/write";
import { loadBoardState } from "../src/lib/import/board-state";
import { sheetFromCard } from "../src/lib/import/plan";
import { arg, flag, loadBoard, serviceClient } from "./db";

const projectSlug = arg("project");
const boardSlug = arg("board");
const source = arg("source");
const dryRun = flag("dry-run");
const mappingPath = arg("mapping", "");
const mapping: Mapping = mappingPath
  ? JSON.parse(await readFile(mappingPath, "utf8"))
  : {};

const db = serviceClient();
const ctx = await loadBoard(db, projectSlug, boardSlug);
const state = await loadBoardState(db, ctx.board.id);
const { data: sources, error: sourcesError } = await db
  .from("cards")
  .select("id, source_text")
  .eq("board_id", ctx.board.id);
// A failed read would look like "no card has a stored sheet", and every file
// would be rewritten from the row alone. Never.
if (sourcesError)
  throw new Error(`export: source_text: ${sourcesError.message}`);
const sourceOf = new Map(
  (sources ?? []).map((s) => [s.id as string, s.source_text as string | null]),
);
const vocab = buildVocabulary(
  state.groups.flatMap((g) => g.tags.map((t) => `${g.key}:${t.key}`)),
);
const resolve = (t: string) => {
  const r = tagRef(t, vocab, mapping.group_aliases);
  return r && "ref" in r ? r.ref : null;
};

let changed = 0;
let unchanged = 0;
/** Unchanged files whose card had no stored sheet until now. */
let stored = 0;
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
    // A card imported before sheets were stored has no `source_text`, and the
    // download would then be built from the row alone. The file is already
    // right; store it so the next line edit has a base.
    if (!sourceOf.get(card.id)) {
      stored++;
      if (!dryRun)
        await db
          .from("cards")
          .update({ source_text: after, lane_from_source: sheet.lane })
          .eq("id", card.id);
    }
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
  `${dryRun ? "[dry-run] " : ""}${projectSlug}/${boardSlug} → ${source}: ${changed} files created or updated, ${unchanged} unchanged${stored ? ` (${stored} sheet(s) stored)` : ""}`,
);
