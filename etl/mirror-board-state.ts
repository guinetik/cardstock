/**
 * Copy one board's *board-owned* fields from one database to another.
 *
 * The importer carries everything markdown owns, but lane, rank, priority,
 * effort, target and archive live only in the database — a card dragged into
 * Next, or given a priority, records that nowhere else until an export runs.
 * Importing markdown into a second database therefore reproduces the cards but
 * not the curation. This carries the curation across.
 *
 * Both databases must already hold the same cards, by `external_id`, and the
 * same lane keys. Cards present in one and not the other are reported, never
 * created or deleted — this moves decisions, not content.
 *
 *   bun run etl/mirror-board-state.ts --project staffeto --board designer \
 *     --from .env.local --to .env.hosted [--dry-run]
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { arg, flag } from "./db";

const projectSlug = arg("project");
const boardSlug = arg("board");
const fromEnv = arg("from", ".env.local");
const toEnv = arg("to", ".env.hosted");
const dryRun = flag("dry-run");

/** The fields the database owns outright. Everything else comes from markdown. */
const OWNED = [
  "rank",
  "priority",
  "effort",
  "target_date",
  "target_label",
  "archived_at",
] as const;

async function envFile(path: string) {
  const text = await Bun.file(path).text();
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    // No `$`: on a CRLF file the line ends with a \r, which `.` does not match,
    // so anchoring the end fails every line but the last and the file reads as
    // empty. Without the anchor the value simply stops before the \r.
    const m = line.match(/^([A-Z0-9_]+)=(.*)/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

async function connect(path: string) {
  const env = await envFile(path);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error(`${path} needs NEXT_PUBLIC_SUPABASE_URL and a service key`);
  return {
    url,
    db: createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

async function board(db: SupabaseClient) {
  const { data, error } = await db
    .from("boards")
    .select("id, projects!inner(slug)")
    .eq("slug", boardSlug)
    .eq("projects.slug", projectSlug)
    .single();
  if (error || !data)
    throw new Error(`${projectSlug}/${boardSlug} not found: ${error?.message}`);
  return data.id as string;
}

async function read(db: SupabaseClient, boardId: string) {
  const { data: lanes } = await db
    .from("lanes")
    .select("id, key")
    .eq("board_id", boardId);
  const laneKey = new Map((lanes ?? []).map((l) => [l.id, l.key as string]));
  const laneId = new Map((lanes ?? []).map((l) => [l.key as string, l.id]));
  const { data: cards } = await db
    .from("cards")
    .select(`id, external_id, lane_id, ${OWNED.join(", ")}`)
    .eq("board_id", boardId);
  return { laneKey, laneId, cards: cards ?? [] };
}

const from = await connect(fromEnv);
const to = await connect(toEnv);
if (from.url === to.url)
  throw new Error(`--from and --to are the same database (${from.url})`);

const src = await read(from.db, await board(from.db));
const dstBoard = await board(to.db);
const dst = await read(to.db, dstBoard);

const byId = new Map(
  // biome-ignore lint/suspicious/noExplicitAny: rows are shaped by the select above
  dst.cards.map((c: any) => [String(c.external_id), c]),
);
let changed = 0;
let same = 0;
const missing: string[] = [];

for (const s of src.cards) {
  // biome-ignore lint/suspicious/noExplicitAny: rows are shaped by the select above
  const row = s as any;
  const id = String(row.external_id);
  const target = byId.get(id);
  if (!target) {
    missing.push(id);
    continue;
  }
  const key = src.laneKey.get(row.lane_id);
  const wantLane = key ? dst.laneId.get(key) : null;
  if (key && !wantLane)
    throw new Error(
      `lane '${key}' does not exist in ${to.url} — seed it first`,
    );

  const patch: Record<string, unknown> = {};
  if (wantLane && target.lane_id !== wantLane) patch.lane_id = wantLane;
  for (const f of OWNED)
    if (String(target[f]) !== String(row[f])) patch[f] = row[f];

  if (!Object.keys(patch).length) {
    same++;
    continue;
  }
  changed++;
  if (dryRun) {
    console.log(`#${id}: ${Object.keys(patch).join(", ")}`);
    continue;
  }
  const { error } = await to.db.from("cards").update(patch).eq("id", target.id);
  if (error) throw new Error(`#${id}: ${error.message}`);
}

console.log(
  `${dryRun ? "[dry-run] " : ""}${projectSlug}/${boardSlug}: ${changed} updated, ${same} already matching${
    missing.length
      ? `; no card in the target for: ${missing.map((m) => `#${m}`).join(", ")}`
      : ""
  }`,
);
