/**
 * Board → markdown tracker. The other half of the round trip.
 *
 *   bun run etl:export --project <slug> --board <slug> --source <dir> [--dry-run]
 *
 * For every card whose file exists under --source, writes the app-owned keys into its frontmatter:
 *   lane      lane key (e.g. now, needs-input, gate-1)
 *   rank      position within the lane (1-based, dense)
 *   priority  1 | 2 | 3            (owner priority; absent when unset)
 *   effort    L | M | H            (difficulty; absent when unset)
 *   target    ISO date, else the rough-date label
 *   archived  ISO timestamp + archived_by
 * Nothing else in the file changes. Cards with no file are reported. Files whose block would not
 * change are left untouched (so mtimes and git stay quiet).
 *
 * Writing `lane` also moves the card's merge base (`lane_from_source`) to match:
 * the file and the board now agree, and the next import must not read the value
 * this export wrote as the file having moved the card.
 */
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { arg, flag, loadBoard, serviceClient } from "./db";
import { type Managed, writeBody, writeManaged } from "./frontmatter-write";

const projectSlug = arg("project");
const boardSlug = arg("board");
const source = arg("source");
const dryRun = flag("dry-run");

const db = serviceClient();
const ctx = await loadBoard(db, projectSlug, boardSlug);
const laneKey = new Map(ctx.lanes.map((l) => [l.id, l.key]));

const { data: cards, error } = await db
  .from("cards")
  .select(
    "id, external_id, lane_id, lane_from_source, rank, priority, effort, target_date, target_label, archived_at, archived_by, body_md, body_edited_at, title",
  )
  .eq("board_id", ctx.board.id)
  .order("rank");
if (error) throw new Error(error.message);

// Dense 1-based rank per lane, in rank order — what a human reads in a file.
const perLane = new Map<string, number>();
const dense = new Map<string, number>();
for (const c of cards ?? []) {
  const n = (perLane.get(c.lane_id ?? "") ?? 0) + 1;
  perLane.set(c.lane_id ?? "", n);
  dense.set(c.external_id, n);
}

let changed = 0,
  unchanged = 0;
const missing: string[] = [];
for (const c of cards ?? []) {
  const file = path.join(source, `${c.external_id}.md`);
  try {
    await stat(file);
  } catch {
    missing.push(c.external_id);
    continue;
  }
  const before = await readFile(file, "utf8");
  const managed: Managed = {
    lane: c.lane_id ? (laneKey.get(c.lane_id) ?? null) : null,
    rank: dense.get(c.external_id) ?? null,
    priority: c.priority ?? null,
    effort: c.effort ?? null,
    target: c.target_date ?? c.target_label ?? null,
    archived: c.archived_at
      ? c.archived_at.slice(0, 19).replace("T", " ")
      : null,
    archived_by: c.archived_at ? (c.archived_by ?? null) : null,
  };
  const after = writeManaged(before, managed);
  const rewritten =
    c.body_edited_at != null
      ? writeBody(after, c.external_id, c.title, c.body_md ?? "")
      : after;

  // After this export the file says what the board says, so that is the new
  // merge base — and that is true whether or not the file needed rewriting. A
  // file already agreeing with the board is exactly the case where the base
  // must be recorded: skip it and the card never gets one, and the file can
  // never move it. Without this the next import would also read the lane this
  // export wrote as the file having moved the card, undoing a later drag.
  if (!dryRun && managed.lane !== c.lane_from_source)
    await db
      .from("cards")
      .update({ lane_from_source: managed.lane })
      .eq("id", c.id);

  if (rewritten === before) {
    unchanged++;
    continue;
  }
  changed++;
  if (dryRun) {
    console.log(
      `would update ${c.external_id}.md → ${managed.lane}#${managed.rank}${managed.priority ? ` P${managed.priority}` : ""}${managed.effort ? ` ${managed.effort}` : ""}${managed.target ? ` ${managed.target}` : ""}${c.body_edited_at ? " body" : ""}`,
    );
    continue;
  }
  await writeFile(file, rewritten, "utf8");
}
console.log(
  `${dryRun ? "[dry-run] " : ""}${projectSlug}/${boardSlug} → ${source}: ${changed} files updated, ${unchanged} unchanged${missing.length ? `; no file for: ${missing.map((m) => `#${m}`).join(", ")}` : ""}`,
);
