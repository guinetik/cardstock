import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  type RemoteSnapshot,
  remoteMetadataSchema,
  remoteSnapshotSchema,
  validateTracker,
} from "@cardstock/core";
import { loadConfig } from "./config";
import { credentialFor } from "./credentials";
import { getJson, normalizeRemote } from "./preview";

export const NEW_HELP = `Usage: cardstock new <title> [--summary <text>] [--epic <name>] [--area <name>]
                         [--tags <tag,tag>] [--status <status>] [--lane <lane>]
                         [--effort H|M|L] [--priority 1|2|3]
                         [--config <file>] [--remote <url>] [--json]

Allocate the next card ID and write <id>.md in the configured tracker.

The ID comes from the hosted board, not from the folder: the snapshot lists live
cards and the IDs of deleted ones, which stay reserved. Local files are counted
too, so an unsynced card cannot be handed out twice. This always asks the board —
a number picked offline can collide with a card someone made on the site.

The file is written and nothing else. It is not validated for you beyond the
scheme check below, not synced, and no card is created on the board: run
validate, then sync, when the Ask is written.

A new card never starts at a gate. --status and --lane default to backlog and
unsorted; filing is not a promotion. --summary defaults to the title, because an
open item needs one. The result is checked against cardstock.json's scheme and
nothing is written if it would not validate.`;

interface Fields {
  id: number;
  title: string;
  summary: string;
  status: string;
  epic?: string;
  area: string;
  tags: string[];
  lane: string;
  effort?: string;
  priority?: string;
}

/** A YAML double-quoted scalar; JSON's escapes are a subset of YAML 1.2's. */
const scalar = (value: string) => JSON.stringify(value);

function sheet(fields: Fields): string {
  const lines = [
    "---",
    `id: ${fields.id}`,
    `title: ${scalar(fields.title)}`,
    `summary: ${scalar(fields.summary)}`,
    `status: ${fields.status}`,
    ...(fields.epic ? [`epic: ${scalar(fields.epic)}`] : []),
    `area: ${scalar(fields.area)}`,
    "tags:",
    ...fields.tags.map((tag) => `  - ${tag}`),
    `lane: ${fields.lane}`,
    ...(fields.effort ? [`effort: ${fields.effort}`] : []),
    ...(fields.priority ? [`priority: ${fields.priority}`] : []),
    "---",
    `# #${fields.id} — ${fields.title}`,
    "",
    "## Ask",
    "",
    fields.summary,
    "",
    "## Status",
    "",
    `Filed ${new Date().toISOString().slice(0, 10)}. Not started.`,
    "",
  ];
  return lines.join("\n");
}

/**
 * Every ID the board has spoken for. Protocol 2 and up serve tombstones in the
 * same array flagged `deleted`, which is the whole reason to ask the board
 * rather than take the maximum of the folder.
 */
async function remoteIds(
  remote: string,
  token: string,
  project: string,
  board: string,
): Promise<number[]> {
  const url = `${remote}/api/v1/boards/${encodeURIComponent(project)}/${encodeURIComponent(board)}`;
  const metadata = remoteMetadataSchema.parse(await getJson(url, token));
  let snapshot: RemoteSnapshot;
  if (metadata.syncProtocol && metadata.syncProtocol >= 2) {
    snapshot = remoteSnapshotSchema.parse(await getJson(`${url}/sync`, token));
  } else {
    snapshot = remoteSnapshotSchema.parse(await getJson(`${url}/cards`, token));
    console.error(
      "warning: this board serves an older protocol whose card list omits deleted IDs; a reserved ID may be reused.",
    );
  }
  if (metadata.project !== project || metadata.board !== board)
    throw new Error("Snapshot identity does not match the configured board.");
  return snapshot.cards.map((card) => Number(card.externalId));
}

export async function newCard(args: string[], cwd: string): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      summary: { type: "string" },
      epic: { type: "string" },
      area: { type: "string" },
      tags: { type: "string" },
      status: { type: "string" },
      lane: { type: "string" },
      effort: { type: "string" },
      priority: { type: "string" },
      config: { type: "string" },
      remote: { type: "string" },
      json: { type: "boolean" },
    },
  });
  if (positionals.length !== 1)
    throw new Error(
      'Give exactly one title, quoted: cardstock new "Cards do not show how old they are"',
    );
  const title = positionals[0].trim();
  if (!title) throw new Error("The title cannot be blank");

  const { file: configPath, config } = await loadConfig(cwd, values.config);
  const remoteValue = values.remote ?? config.remote;
  if (!remoteValue)
    throw new Error(
      "No remote configured. Pass --remote <url> or add remote to cardstock.json.",
    );
  const remote = normalizeRemote(remoteValue);
  const credential = await credentialFor(remote);
  if (!credential)
    throw new Error(
      `Not signed in to ${remote}. Run cardstock login --remote ${remote}.`,
    );

  const tracker = path.resolve(path.dirname(configPath), config.tracker);
  const entries = await readdir(tracker, { withFileTypes: true });
  const localIds = entries
    .filter((entry) => entry.isFile() && /^\d+\.md$/.test(entry.name))
    .map((entry) => Number(entry.name.slice(0, -3)));

  const taken = [
    ...localIds,
    ...(await remoteIds(
      remote,
      credential.token,
      config.project,
      config.board,
    )),
  ].filter((id) => Number.isSafeInteger(id) && id > 0);
  const id = Math.max(0, ...taken) + 1;

  const fields: Fields = {
    id,
    title,
    summary: values.summary?.trim() || title,
    status: values.status ?? "backlog",
    epic:
      values.epic === undefined ? "Board & cards" : values.epic || undefined,
    area: values.area ?? "UI",
    tags: (values.tags ?? "enhancement")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    lane: values.lane ?? "unsorted",
    effort: values.effort,
    priority: values.priority,
  };
  const name = `${id}.md`;
  const text = sheet(fields);

  // The scheme is the same gate `validate` applies; refuse to write a file that
  // would only fail it later.
  const report = validateTracker([{ name, text }], config.scheme);
  if (!report.ok) {
    if (values.json) console.log(JSON.stringify({ ...report, id }, null, 2));
    else
      for (const diagnostic of report.diagnostics)
        console.error(`${name}: ${diagnostic.message}`);
    return 1;
  }

  const file = path.join(tracker, name);
  try {
    await writeFile(file, text, { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      throw new Error(
        `${file} already exists; the board and this folder disagree about what is taken.`,
      );
    throw error;
  }

  const relative = path.relative(cwd, file).split(path.sep).join("/");
  if (values.json)
    console.log(JSON.stringify({ ok: true, id, file: relative }, null, 2));
  else
    console.log(
      `wrote ${relative}\nWrite the Ask, then: cardstock validate && cardstock sync --dry-run`,
    );
  return 0;
}
