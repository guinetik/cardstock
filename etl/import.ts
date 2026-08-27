/**
 * Markdown tracker → board.
 *
 *   bun run etl:import --project <slug> --board <slug> --source <dir> [--dry-run]
 *
 * Markdown owns: title, status, body, epic, area, raised_by/raised/shipped, needs, relates, tags, extra keys.
 * DB owns: lane, rank, priority, effort, target, audience (after first import), summary (once edited), archive.
 * Exceptions: new cards take their lane from status/needs; built/closed statuses re-pin every import;
 * effort/value seed the DB fields only while those are null. Unchanged files are skipped by hash.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { arg, flag, loadBoard, serviceClient } from "./db";
import {
  isPinnedStatus,
  laneForStatus,
  type Mapping,
  mapAudience,
  mapTags,
  valueToPriority,
} from "./mapping";
import { bodyWithoutH1, extractAsk, parseFile } from "./parse";
import { isoOrNull, validateFrontmatter } from "./schema";

const projectSlug = arg("project");
const boardSlug = arg("board");
const source = arg("source");
const dryRun = flag("dry-run");
const mappingPath = arg(
  "mapping",
  path.join(import.meta.dir, "mappings", "default.json"),
);

const db = serviceClient();
const ctx = await loadBoard(db, projectSlug, boardSlug);
const mapping = JSON.parse(await readFile(mappingPath, "utf8")) as Mapping;
const settings = ctx.settings as {
  status_to_lane?: Record<string, string>;
  needs_lane?: string;
};

const files = (await readdir(source))
  .filter((f) => /^\d+\.md$/.test(f))
  .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));
if (!files.length) throw new Error(`no <id>.md files in ${source}`);

const { data: existingRows } = await db
  .from("cards")
  .select(
    "id, external_id, lane_id, rank, priority, effort, source_hash, summary, audience",
  )
  .eq("board_id", ctx.board.id);
const existing = new Map((existingRows ?? []).map((c) => [c.external_id, c]));

const { data: maxRankRows } = await db
  .from("cards")
  .select("lane_id, rank")
  .eq("board_id", ctx.board.id);
const maxRank = new Map<string, number>();
for (const r of maxRankRows ?? [])
  if (r.lane_id)
    maxRank.set(r.lane_id, Math.max(maxRank.get(r.lane_id) ?? 0, r.rank));

let created = 0,
  updated = 0,
  skipped = 0;
const relatesByExternal = new Map<string, number[]>();
const idByExternal = new Map<string, string>();

for (const file of files) {
  const full = path.join(source, file);
  const text = await readFile(full, "utf8");
  const parsed = parseFile(text);
  const { data: fm, extra } = validateFrontmatter(parsed.frontmatter, file);
  const externalId = String(fm.id);
  if (externalId !== path.basename(file, ".md"))
    throw new Error(`${file}: id ${fm.id} does not match the filename`);
  relatesByExternal.set(externalId, fm.relates ?? []);

  const prev = existing.get(externalId);
  if (prev && prev.source_hash === parsed.hash) {
    skipped++;
    idByExternal.set(externalId, prev.id);
    continue;
  }

  const pin = isPinnedStatus(fm.status);
  const laneKey = pin
    ? (settings.status_to_lane?.[fm.status] ?? pin)
    : laneForStatus(fm.status, fm.needs, settings);
  const lane = ctx.laneByKey.get(laneKey) ?? ctx.laneByKey.get("unsorted");
  if (!lane)
    throw new Error(
      `board has no lane '${laneKey}' and no 'unsorted' fallback`,
    );

  const row: Record<string, unknown> = {
    board_id: ctx.board.id,
    external_id: externalId,
    title: fm.title,
    body_md: bodyWithoutH1(parsed.body),
    status: fm.status,
    epic: fm.epic,
    area: fm.area,
    raised_by: fm.raised_by ?? null,
    raised_on: isoOrNull(fm.raised),
    shipped_on: isoOrNull(fm.shipped),
    needs: fm.needs ?? null,
    source_path: full,
    source_hash: parsed.hash,
    frontmatter_extra: extra,
  };
  const tagIds = mapTags(fm, mapping)
    .map((ref) => ctx.tagByRef.get(ref))
    .filter((x): x is string => !!x);

  if (!prev) {
    // Round trip: a file the export wrote carries lane/rank/priority — honour them for a new card.
    const rtLane = fm.lane && !pin ? ctx.laneByKey.get(fm.lane) : undefined;
    const laneFinal = rtLane ?? lane;
    // The file's rank only means something in the lane the file names — a pin may have overridden it.
    const rank =
      fm.rank != null && fm.lane === laneFinal.key
        ? Number(fm.rank)
        : (maxRank.get(laneFinal.id) ?? 0) + 1;
    maxRank.set(laneFinal.id, Math.max(maxRank.get(laneFinal.id) ?? 0, rank));
    const iso = (v: string | null | undefined) =>
      v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
    Object.assign(row, {
      lane_id: laneFinal.id,
      rank,
      summary: fm.summary ?? (extractAsk(parsed.body) || null),
      priority: fm.priority ?? valueToPriority(fm.value ?? null),
      effort: fm.effort ?? null,
      target_date: iso(fm.target),
      target_label: fm.target && !iso(fm.target) ? fm.target : null,
      archived_at: fm.archived
        ? new Date(`${fm.archived.replace(" ", "T")}Z`).toISOString()
        : null,
      archived_by: fm.archived ? (fm.archived_by ?? null) : null,
      audience: mapAudience(fm, mapping),
    });
  } else {
    // DB owns board fields; pins re-apply; effort/priority seed only into null.
    if (pin && prev.lane_id !== lane.id) {
      const rank = (maxRank.get(lane.id) ?? 0) + 1;
      maxRank.set(lane.id, rank);
      Object.assign(row, { lane_id: lane.id, rank });
    }
    if (prev.priority == null && fm.value)
      row.priority = valueToPriority(fm.value);
    if (prev.effort == null && fm.effort) row.effort = fm.effort;
    if (fm.summary) row.summary = fm.summary;
    else if (!prev.summary) row.summary = extractAsk(parsed.body) || null;
  }

  if (dryRun) {
    console.log(
      `${prev ? "update" : "create"} #${externalId} → ${lane.key} [${mapTags(fm, mapping).join(", ")}]`,
    );
    prev ? updated++ : created++;
    continue;
  }

  const { data: saved, error } = await db
    .from("cards")
    .upsert(row, { onConflict: "board_id,external_id" })
    .select("id")
    .single();
  if (error || !saved) throw new Error(`${file}: ${error?.message}`);
  idByExternal.set(externalId, saved.id);

  await db.from("card_tags").delete().eq("card_id", saved.id);
  if (tagIds.length)
    await db
      .from("card_tags")
      .insert(tagIds.map((tag_id) => ({ card_id: saved.id, tag_id })));
  await db.from("card_events").insert({
    card_id: saved.id,
    actor: "etl",
    kind: prev ? "imported" : "created",
    payload: {
      source: file,
      hash: parsed.hash,
      status: fm.status,
      lane: row.lane_id ? lane.key : undefined,
    },
  });
  prev ? updated++ : created++;
}

// Links: relates → card_links, after every card has an id.
if (!dryRun) {
  for (const [ext, rel] of relatesByExternal) {
    const from = idByExternal.get(ext);
    if (!from) continue;
    await db
      .from("card_links")
      .delete()
      .eq("from_card", from)
      .eq("kind", "relates");
    const rows = rel
      .map((r) => idByExternal.get(String(r)))
      .filter((x): x is string => !!x)
      .map((to_card) => ({ from_card: from, to_card, kind: "relates" }));
    if (rows.length) await db.from("card_links").insert(rows);
  }
}

console.log(
  `${dryRun ? "[dry-run] " : ""}${projectSlug}/${boardSlug}: ${created} created, ${updated} updated, ${skipped} unchanged (${files.length} files)`,
);
