/**
 * Markdown tracker → board, from the command line.
 *
 *   bun run etl:import --project <slug> --board <slug> --source <dir> [--dry-run]
 *
 * The same planner the projects page uses, with two differences the spec
 * keeps for a sync (the web import is deliberately sheet-wins):
 *   - a file moves an existing card between lanes only when its `lane:`
 *     differs from what it said at the last sync (`lane_from_source`);
 *   - a file never overwrites a summary or body a person has edited in the
 *     app (`summary_edited_at` / `body_edited_at`), since the DB owns those
 *     once that happens.
 *
 * Everything else the file states wins, on every sync: `priority`, `effort`,
 * `target`, `planned_start`, the archive keys and `color` are taken from the
 * file and overwrite whatever the board holds, however recently a person set
 * it there. That is safe because the round trip runs the other way first — an
 * export rebases every file onto the board's current values — so export, then
 * import. Importing a stale folder of sheets undoes the board's own edits.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  laneMoveFromSource,
  type Mapping,
} from "../src/lib/frontmatter/mapping";
import { applyPlan } from "../src/lib/import/apply";
import { loadBoardState } from "../src/lib/import/board-state";
import { DEFAULT_MAPPING, planImport } from "../src/lib/import/plan";
import type { SheetFile } from "../src/lib/import/types";
import { arg, flag, loadBoard, serviceClient } from "./db";

const projectSlug = arg("project");
const boardSlug = arg("board");
const source = arg("source");
const dryRun = flag("dry-run");
const mappingPath = arg("mapping", "");

const db = serviceClient();
const ctx = await loadBoard(db, projectSlug, boardSlug);
const mapping: Mapping = mappingPath
  ? JSON.parse(await readFile(mappingPath, "utf8"))
  : DEFAULT_MAPPING;

const names = (await readdir(source)).filter((f) => /^\d+\.md$/.test(f));
if (!names.length) throw new Error(`no <id>.md files in ${source}`);
const files: SheetFile[] = [];
for (const name of names)
  files.push({ name, text: await readFile(path.join(source, name), "utf8") });

const state = await loadBoardState(db, ctx.board.id);
const { data: bases } = await db
  .from("cards")
  .select("external_id, lane_from_source")
  .eq("board_id", ctx.board.id);
const baseOf = new Map(
  (bases ?? []).map((b) => [
    b.external_id as string,
    b.lane_from_source as string | null,
  ]),
);

const plan = planImport(files, state, mapping);
// Sync rule: an existing card only moves lane when the file changed its
// mind, and a file never overwrites a summary or body a person has edited
// in the app — the DB owns those once that happens, same as the old CLI.
let recalibrated = 0;
for (const row of plan.rows) {
  if (row.verdict !== "changed") continue;
  const prev = state.cards.get(row.id);
  if (
    row.patch.laneKey &&
    !laneMoveFromSource(row.patch.laneKey, baseOf.get(row.id))
  ) {
    row.patch.laneKey = null;
    row.patch.rank = undefined;
    row.changes = row.changes.filter(
      (c) => c.key !== "lane" && c.key !== "rank",
    );
  }
  if (prev?.summary_edited_at) {
    delete row.patch.columns.summary;
    row.changes = row.changes.filter((c) => c.key !== "summary");
  }
  if (prev?.body_edited_at) {
    delete row.patch.columns.body_md;
    delete row.patch.columns.body_edited_at;
    row.changes = row.changes.filter((c) => c.key !== "body");
  }
  if (row.changes.length === 0) {
    plan.counts.changed--;
    recalibrated++;
  }
}

for (const row of plan.rows)
  if (row.verdict === "error") console.error(`${row.id}.md: ${row.message}`);
if (!plan.ok) process.exit(1);

if (dryRun) {
  for (const row of plan.rows) {
    if (row.verdict === "unchanged") continue;
    const recal = row.verdict === "changed" && row.changes.length === 0;
    const label = recal ? "recalibrated" : row.verdict;
    console.log(
      `${label} #${row.id}${row.verdict === "new" ? ` → ${row.lane}` : ""}${row.verdict === "changed" && !recal ? ` [${row.changes.map((c) => c.key).join(", ")}]` : ""}`,
    );
  }
} else {
  await applyPlan(db, state, plan, "etl");
}
console.log(
  `${dryRun ? "[dry-run] " : ""}${projectSlug}/${boardSlug}: ${plan.counts.new} created, ${plan.counts.changed} updated, ${recalibrated} recalibrated, ${plan.counts.unchanged} unchanged (${files.length} files)`,
);
if (plan.unappliedTags.length) {
  console.warn(
    `\n${plan.unappliedTags.length} tag(s) no group declares were NOT applied:`,
  );
  for (const t of plan.unappliedTags)
    console.warn(
      `  ${t.tag} — ${t.cards.length} card(s): ${t.cards.slice(0, 8).join(", ")}`,
    );
}
