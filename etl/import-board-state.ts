/**
 * Apply a `designer-board/1` export (the file-based board's JSON) on top of imported cards.
 *
 *   bun run etl:import-board-state --file <path> [--project <slug> --board <slug>]
 *
 * Sets lane, rank, target (ISO → target_date, else target_label), effort, and value→priority.
 * Lane names resolve through the board's `lane_aliases`, then by key, then by name.
 */
import { readFile } from "node:fs/promises";
import { arg, loadBoard, serviceClient } from "./db";
import { valueToPriority } from "./mapping";

interface ExportDoc {
  schema: string;
  lanes: {
    name: string;
    items: {
      id: number;
      rank: number;
      target?: string;
      effort?: string;
      value?: string;
    }[];
  }[];
}

const file = arg("file");
const projectSlug = arg("project");
const boardSlug = arg("board");

const doc = JSON.parse(await readFile(file, "utf8")) as ExportDoc;
if (doc.schema !== "designer-board/1")
  throw new Error(`not a designer-board/1 file: ${doc.schema}`);

const db = serviceClient();
const ctx = await loadBoard(db, projectSlug, boardSlug);
const aliases =
  (ctx.settings as { lane_aliases?: Record<string, string> }).lane_aliases ??
  {};
const laneByName = new Map(ctx.lanes.map((l) => [l.name.toLowerCase(), l]));

export function resolveLane(name: string) {
  const key = aliases[name] ?? name.toLowerCase().replace(/\s+/g, "-");
  return ctx.laneByKey.get(key) ?? laneByName.get(name.toLowerCase()) ?? null;
}

const { data: cards } = await db
  .from("cards")
  .select("id, external_id")
  .eq("board_id", ctx.board.id);
const idByExternal = new Map((cards ?? []).map((c) => [c.external_id, c.id]));

let applied = 0,
  missing: number[] = [];
for (const lane of doc.lanes) {
  const target = resolveLane(lane.name);
  if (!target) {
    console.warn(
      `no lane for '${lane.name}' — skipped ${lane.items.length} items`,
    );
    continue;
  }
  for (const it of lane.items) {
    const id = idByExternal.get(String(it.id));
    if (!id) {
      missing.push(it.id);
      continue;
    }
    const isoDate =
      it.target && /^\d{4}-\d{2}-\d{2}$/.test(it.target) ? it.target : null;
    const patch: Record<string, unknown> = {
      lane_id: target.id,
      rank: it.rank,
    };
    if (it.target) {
      patch.target_date = isoDate;
      patch.target_label = isoDate ? null : it.target;
    }
    if (it.effort) patch.effort = it.effort;
    if (it.value) patch.priority = valueToPriority(it.value as "L" | "M" | "H");
    const { error } = await db.from("cards").update(patch).eq("id", id);
    if (error) throw new Error(`#${it.id}: ${error.message}`);
    await db.from("card_events").insert({
      card_id: id,
      actor: "etl",
      kind: "moved",
      payload: { source: "board-state", lane: target.key, rank: it.rank },
    });
    applied++;
  }
}
console.log(
  `${projectSlug}/${boardSlug}: applied ${applied} cards from ${file}${missing.length ? `; not on board: ${missing.map((m) => `#${m}`).join(", ")}` : ""}`,
);
