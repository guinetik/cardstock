/**
 * Markdown tracker → board.
 *
 *   bun run etl:import --project <slug> --board <slug> --source <dir> [--dry-run]
 *
 * Markdown owns: title, status, body, epic, area, raised_by/raised/shipped, needs, relates, tags, extra keys.
 * DB owns: lane, rank, priority, effort, planned_start, target, audience (after first import), summary (once edited in the app), body_md (once body_edited_at is set), archive.
 * Lane is board state. A new card takes the lane its file names, or the inbox;
 * an existing card moves only when the file's `lane:` differs from what it said
 * at the last sync, so a drag survives a file that has not changed its mind.
 * Status never decides a lane. effort/value seed the DB fields only while those
 * are null. Unchanged files are skipped by hash.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { arg, flag, loadBoard, serviceClient } from "./db";
import {
  bodyOnImport,
  buildVocabulary,
  cardColorOnImport,
  laneForNewCard,
  laneMoveFromSource,
  type Mapping,
  mapAudience,
  mapTags,
  resolveTags,
  summaryOnImport,
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
// The board's inbox is where a file with no `lane:` lands. Nothing else about
// a card decides its lane any more — not its status, not its `needs`.
const inboxKey = ctx.lanes.find((l) => l.kind === "inbox")?.key ?? "unsorted";
// The board's own tags are the taxonomy: a bare `bug` in a file is whatever
// group declares a tag with that key.
const vocab = buildVocabulary(ctx.tagByRef.keys());

const files = (await readdir(source))
  .filter((f) => /^\d+\.md$/.test(f))
  .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));
if (!files.length) throw new Error(`no <id>.md files in ${source}`);

const { data: existingRows } = await db
  .from("cards")
  .select(
    "id, external_id, lane_id, lane_from_source, epic_id, planned_start_date, rank, priority, effort, source_hash, summary, summary_edited_at, audience, body_md, body_edited_at, color",
  )
  .eq("board_id", ctx.board.id);
const existing = new Map((existingRows ?? []).map((c) => [c.external_id, c]));

const { data: epicRows } = await db
  .from("epics")
  .select("id, source_name")
  .eq("board_id", ctx.board.id);
const epicByName = new Map((epicRows ?? []).map((e) => [e.source_name, e.id]));

async function epicId(sourceName: string): Promise<string | null> {
  const name = sourceName.trim();
  const known = epicByName.get(name);
  if (known) return known;
  if (dryRun) return null;
  const { data, error } = await db
    .from("epics")
    .upsert(
      { board_id: ctx.board.id, source_name: name },
      { onConflict: "board_id,source_name" },
    )
    .select("id")
    .single();
  if (error || !data) throw new Error(`epic '${name}': ${error?.message}`);
  epicByName.set(name, data.id);
  return data.id;
}

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
/** Tag refs the board's seed never declared → the cards that wanted them. */
const unmappedTags = new Map<string, string[]>();
/** Bare tags more than one group claims → the cards that used them. */
const ambiguousTags = new Map<string, string[]>();
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
  const resolvedEpicId = await epicId(fm.epic);
  if (prev && prev.source_hash === parsed.hash) {
    // An unchanged file still needs a merge base the first time we see it, or
    // a card whose file never changes again could never be moved by that file.
    // Recording the file's own claim — not the board's lane — is what makes
    // this safe: the two may already disagree, and the board's lane wins until
    // the file says something new.
    if (!dryRun) {
      const calibration: Record<string, unknown> = {};
      if (prev.lane_from_source == null && fm.lane)
        calibration.lane_from_source = fm.lane;
      if (prev.epic_id !== resolvedEpicId) calibration.epic_id = resolvedEpicId;
      if (Object.keys(calibration).length)
        await db.from("cards").update(calibration).eq("id", prev.id);
    }
    skipped++;
    idByExternal.set(externalId, prev.id);
    continue;
  }

  const laneKey = laneForNewCard(fm.lane, ctx.laneByKey.keys(), inboxKey);
  const lane = ctx.laneByKey.get(laneKey) ?? ctx.laneByKey.get("unsorted");
  if (!lane)
    throw new Error(
      `board has no lane '${laneKey}' and no 'unsorted' fallback`,
    );

  const row: Record<string, unknown> = {
    board_id: ctx.board.id,
    external_id: externalId,
    title: fm.title,
    status: fm.status,
    epic: fm.epic,
    epic_id: resolvedEpicId,
    area: fm.area,
    raised_by: fm.raised_by ?? null,
    raised_on: isoOrNull(fm.raised),
    shipped_on: isoOrNull(fm.shipped),
    needs: fm.needs ?? null,
    color: cardColorOnImport(fm.color),
    source_path: full,
    source_hash: parsed.hash,
    source_text: text,
    frontmatter_extra: extra,
  };
  const mapped = mapTags(fm, mapping, vocab);
  for (const t of mapped.ambiguous) {
    const seen = ambiguousTags.get(t);
    if (seen) seen.push(externalId);
    else ambiguousTags.set(t, [externalId]);
  }
  const resolved = resolveTags(mapped.refs, ctx.tagByRef);
  const tagIds = resolved.ids;
  for (const ref of resolved.unresolved) {
    const seen = unmappedTags.get(ref);
    if (seen) seen.push(externalId);
    else unmappedTags.set(ref, [externalId]);
  }

  // The lane the file claims, recorded either way: it is the base the next
  // import compares against, and it only means "what the file said", not
  // "where the card is".
  row.lane_from_source = fm.lane ?? null;

  if (!prev) {
    // Round trip: a file the export wrote carries lane/rank/priority — honour them for a new card.
    const laneFinal = lane;
    // The file's rank only means something in the lane the file names.
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
      planned_start_date: isoOrNull(fm.planned_start),
      archived_at: fm.archived
        ? new Date(`${fm.archived.replace(" ", "T")}Z`).toISOString()
        : null,
      archived_by: fm.archived ? (fm.archived_by ?? null) : null,
      audience: mapAudience(fm, mapping),
    });
  } else {
    // The board owns lane. The file only moves a card when it has changed its
    // mind since the last sync — otherwise a stale `lane:` would undo a drag.
    const moveTo = laneMoveFromSource(fm.lane, prev.lane_from_source);
    const target = moveTo ? ctx.laneByKey.get(moveTo) : undefined;
    if (moveTo && !target)
      throw new Error(
        `#${externalId} names lane '${moveTo}', which this board does not have`,
      );
    if (target && prev.lane_id !== target.id) {
      const rank = (maxRank.get(target.id) ?? 0) + 1;
      maxRank.set(target.id, rank);
      Object.assign(row, { lane_id: target.id, rank });
    }
    if (prev.priority == null && fm.value)
      row.priority = valueToPriority(fm.value);
    if (prev.effort == null && fm.effort) row.effort = fm.effort;
    if (prev.planned_start_date == null && isoOrNull(fm.planned_start))
      row.planned_start_date = isoOrNull(fm.planned_start);
    const nextSummary = summaryOnImport(
      prev,
      fm.summary,
      extractAsk(parsed.body) || null,
    );
    if (nextSummary !== undefined) row.summary = nextSummary;
  }

  const fileBody = bodyWithoutH1(parsed.body);
  const nextBody = bodyOnImport(
    prev
      ? {
          body_md: prev.body_md as string,
          body_edited_at: prev.body_edited_at as string | null,
        }
      : null,
    fileBody,
  );
  if (nextBody !== undefined) row.body_md = nextBody;

  if (dryRun) {
    // Report the lane only when this run actually sets one: an existing card
    // the file has not moved keeps the lane the board gave it.
    const laneNote = row.lane_id
      ? ` → ${ctx.lanes.find((l) => l.id === row.lane_id)?.key ?? lane.key}`
      : "";
    console.log(
      `${prev ? "update" : "create"} #${externalId}${laneNote} [${mapped.refs.join(", ")}]`,
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

// A tag the board never declared is dropped on the floor. Say so loudly —
// otherwise a seed missing half its vocabulary reads as a clean import.
if (unmappedTags.size) {
  console.warn(
    `\n${unmappedTags.size} tag ref(s) are not declared by this board's seed and were NOT applied:`,
  );
  for (const [ref, ids] of [...unmappedTags].sort())
    console.warn(
      `  ${ref} — ${ids.length} card(s): ${ids.slice(0, 8).join(", ")}${ids.length > 8 ? ", …" : ""}`,
    );
  console.warn("Add them to the board's seed and re-run the import.\n");
}
