import { createHash } from "node:crypto";
import {
  mkdir,
  readdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  type Baseline,
  baselineSchema,
  parseConflictSelections,
  planSync,
  type RemoteMetadata,
  type RemoteSnapshot,
  remoteMetadataSchema,
  remoteSnapshotSchema,
  resolveSyncConflicts,
  stableJson,
  validateTracker,
} from "@cardstock/core";
import { loadConfig } from "./config";
import { credentialFor } from "./credentials";
import { readOptional } from "./sync-files";
import {
  loadSelectedCard,
  parseCard,
  requireSelectedCard,
  selectBaseline,
} from "./sync-selection";

export const PREVIEW_HELP = `Usage: cardstock status [--card <id>] [--config <file>] [--remote <url>] [--json]
       cardstock sync [--card <id>] [--dry-run] [--config <file>] [--remote <url>] [--json]
                               [--ours <id>[:<field>]] [--theirs <id>[:<field>]]
       cardstock baseline [--config <file>] [--remote <url>] [--json]

status and sync --dry-run read local files, the saved baseline and authenticated
board snapshots. They write no files and make no changes to the board.
--card limits reads, validation, changes and the reported clean state to one card.
Other cards and their baselines are preserved. Resume remembers the selected card;
do not pass --card with --resume, --abort or baseline.
baseline explicitly saves agreed state in .cardstock/ beside the configuration;
it refuses while local and remote cards differ. Missing baselines never pick a winner.
ours means local Markdown; theirs means the hosted board. Selections resolve only
conflicting fields, preserving unrelated edits on both sides. Repeat flags to select
cards or fields (for example --ours 17:body --theirs 18:frontmatter.priority).
An existence conflict is a whole-card delete-versus-edit choice: selecting the
deleted side deletes; selecting surviving local content restores the hosted card.
Explicit deletion: cardstock delete <id> --dry-run (see cardstock delete --help).
Without --dry-run, sync applies the resolved plan through transactional protocol 5.
sync --resume retries the recorded operation; --abort archives it without rollback.
--recover-lock reclaims a same-machine lock only when its process has exited.
--adopt-identities explicitly upgrades a legacy baseline to current immutable IDs.
No ownership flags select a winner. Dry-run never saves choices or changes files.`;

export function normalizeRemote(value: string) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash)
    throw new Error(
      "Remote URL must not contain credentials, a query or a fragment.",
    );
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
  )
    throw new Error(
      "Use HTTPS for remote boards, or HTTP on localhost for development.",
    );
  return url.href.replace(/\/$/, "");
}

export async function getJson(url: string, token: string) {
  // Never forward a stored credential through a redirect to another endpoint.
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    if (response.status === 401)
      throw new Error(
        "Cardstock sign-in is missing or expired. Run cardstock login --remote <url>.",
      );
    if (response.status === 403)
      throw new Error("This account cannot access the requested board.");
    if (response.status === 404)
      throw new Error(
        "Board or API not found. Check the remote, project and board configuration.",
      );
    throw new Error(
      `Cardstock snapshot request failed (HTTP ${response.status}).`,
    );
  }
  return response.json();
}

export async function preview(
  command: string,
  args: string[],
  cwd: string,
  deleteIds?: string[],
): Promise<number> {
  const { values } = parseArgs({
    args,
    options: {
      config: { type: "string" },
      card: { type: "string" },
      remote: { type: "string" },
      json: { type: "boolean" },
      "dry-run": { type: "boolean" },
      ours: { type: "string", multiple: true },
      theirs: { type: "string", multiple: true },
    },
  });
  const selectedCard = parseCard(values.card);
  if (selectedCard && (command === "baseline" || deleteIds))
    throw new Error("--card is only valid for status and sync");
  if (
    command !== "sync" &&
    (values["dry-run"] !== undefined || values.ours || values.theirs)
  )
    throw new Error("--dry-run, --ours and --theirs are only valid for sync");
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
  const directory = path.dirname(configPath);
  const tracker = path.resolve(directory, config.tracker);
  const scope = {
    remote,
    project: config.project,
    board: config.board,
    tracker: path.relative(directory, tracker).split(path.sep).join("/") || ".",
    mapping: stableJson(config.mapping ?? {}),
  };
  const stateKey = createHash("sha256").update(stableJson(scope)).digest("hex");
  const baselinePath = path.join(directory, ".cardstock", `${stateKey}.json`);
  if (
    command === "baseline" &&
    (await readOptional(`${baselinePath}.journal.json`)) !== null
  )
    throw new Error(
      "A sync is pending; use sync --resume or --abort before replacing its baseline",
    );
  let baseline: Baseline | undefined;
  let baselineText: string | undefined;
  try {
    baselineText = await readFile(baselinePath, "utf8");
    baseline = baselineSchema.parse(JSON.parse(baselineText));
    if (stableJson(baseline.scope) !== stableJson(scope))
      throw new Error("Baseline belongs to another board or tracker.");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
      throw new Error(
        `Cannot use baseline ${baselinePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
  }
  const loadLocal = async () => {
    if (selectedCard) return loadSelectedCard(tracker, selectedCard);
    const entries = await readdir(tracker, { withFileTypes: true });
    return Promise.all(
      entries
        .filter((entry) => entry.isFile() && /^\d+\.md$/.test(entry.name))
        .sort(
          (a, b) => Number(a.name.slice(0, -3)) - Number(b.name.slice(0, -3)),
        )
        .map(async (entry) => ({
          file: entry.name,
          markdown: await readFile(path.join(tracker, entry.name), "utf8"),
        })),
    );
  };
  const local = await loadLocal();
  const url = `${remote}/api/v1/boards/${encodeURIComponent(config.project)}/${encodeURIComponent(config.board)}`;
  let snapshot: RemoteSnapshot | undefined;
  let metadata: RemoteMetadata | undefined;
  if (selectedCard) {
    const raw = await getJson(
      `${url}/sync?card=${selectedCard}`,
      credential.token,
    );
    metadata = remoteMetadataSchema.parse(raw);
    snapshot = remoteSnapshotSchema.parse(raw);
    if (metadata.project !== config.project || metadata.board !== config.board)
      throw new Error("Snapshot identity does not match the configured board.");
  }
  for (let attempt = 0; !selectedCard && attempt < 3; attempt++) {
    metadata = remoteMetadataSchema.parse(await getJson(url, credential.token));
    if (
      metadata.syncProtocol === 2 ||
      metadata.syncProtocol === 3 ||
      metadata.syncProtocol === 4 ||
      metadata.syncProtocol === 5
    ) {
      const raw = await getJson(`${url}/sync`, credential.token);
      metadata = remoteMetadataSchema.parse(raw);
      snapshot = remoteSnapshotSchema.parse(raw);
      if (
        metadata.project !== config.project ||
        metadata.board !== config.board
      )
        throw new Error(
          "Snapshot identity does not match the configured board.",
        );
      break;
    }
    snapshot = remoteSnapshotSchema.parse(
      await getJson(`${url}/cards`, credential.token),
    );
    if (metadata.project !== config.project || metadata.board !== config.board)
      throw new Error("Snapshot identity does not match the configured board.");
    // ETags in older servers cover only counts and the newest card timestamp.
    // Re-read payloads too, so vocabulary edits and mixed card reads are detected.
    if (metadata.etag === snapshot.etag) {
      const nextMetadata = remoteMetadataSchema.parse(
        await getJson(url, credential.token),
      );
      const nextSnapshot = remoteSnapshotSchema.parse(
        await getJson(`${url}/cards`, credential.token),
      );
      if (
        stableJson(metadata) === stableJson(nextMetadata) &&
        stableJson(snapshot) === stableJson(nextSnapshot)
      )
        break;
    }
    if (attempt === 2)
      throw new Error(
        "Board changed while reading snapshots. Retry the preview.",
      );
  }
  if (!snapshot || !metadata)
    throw new Error("No board snapshot was returned.");
  if (selectedCard) {
    snapshot.cards = snapshot.cards.filter(
      (card) => card.externalId === selectedCard,
    );
    baseline = selectBaseline(baseline, selectedCard);
    requireSelectedCard(selectedCard, local, snapshot.cards, baseline);
  }
  if (deleteIds && metadata.syncProtocol !== 5)
    throw new Error(
      "Deletion requires sync protocol 5; deploy the deletion migration and server first",
    );
  if (stableJson(local) !== stableJson(await loadLocal()))
    throw new Error(
      "Tracker files changed while reading the board. Retry the preview.",
    );
  const diagnostics = validateTracker(
    local.map((card) => ({ name: card.file, text: card.markdown })),
    config.scheme,
  ).diagnostics;
  const plan = resolveSyncConflicts(
    planSync({
      local,
      remote: snapshot.cards,
      baseline,
      vocabulary: metadata,
      mapping: config.mapping,
      deleteIds,
    }),
    parseConflictSelections(values.ours, values.theirs),
  );
  const ok = !plan.counts.conflicts && !diagnostics.length;
  let saved = false;
  if (command === "baseline" && ok && plan.clean) {
    const state: Baseline = {
      version: 1,
      scope,
      etag: snapshot.etag,
      cards: snapshot.cards.map((card) => ({
        ...card,
        file: `${card.externalId}.md`,
      })),
    };
    await mkdir(path.dirname(baselinePath), { recursive: true });
    const lockPath = `${baselinePath}.lock`;
    // Exclusive lock and comparison prevent two CLI instances from replacing newer state.
    await writeFile(lockPath, "baseline\n", { flag: "wx", mode: 0o600 });
    const temporary = `${baselinePath}.${process.pid}.tmp`;
    let wroteTemporary = false;
    try {
      let current: string | undefined;
      try {
        current = await readFile(baselinePath, "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      if (current !== baselineText)
        throw new Error("Baseline changed during this operation; retry.");
      await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, {
        flag: "wx",
        mode: 0o600,
      });
      wroteTemporary = true;
      await rename(temporary, baselinePath);
      wroteTemporary = false;
      saved = true;
    } finally {
      if (wroteTemporary) await unlink(temporary);
      await unlink(lockPath);
    }
  }
  const result = {
    ok: ok && (command !== "baseline" || saved),
    dryRun: command !== "baseline",
    ...(selectedCard ? { card: selectedCard } : {}),
    remote,
    project: config.project,
    board: config.board,
    etag: snapshot.etag,
    baseline: { path: baselinePath, present: !!baseline, saved },
    ...plan,
    diagnostics,
  };
  if (values.json) console.log(JSON.stringify(result, null, 2));
  else {
    if (selectedCard) console.log(`Selected card: #${selectedCard}`);
    console.log(
      `${config.project}/${config.board}: ${plan.counts.uploads} upload, ${plan.counts.downloads} download, ${plan.counts.equal} equal changes, ${plan.counts.conflicts} conflicts.`,
    );
    if (!baseline)
      console.log(
        "No saved baseline; differences on existing cards require reconciliation.",
      );
    for (const card of plan.cards) {
      console.log(
        `#${card.externalId} ${card.action}${card.reason ? ` — ${card.reason}` : ""}`,
      );
      for (const change of card.changes)
        console.log(
          `  ${change.direction} ${change.field}${change.resolution ? ` (resolved: ${change.resolution})` : change.reason ? ` (${change.reason})` : ""}`,
        );
    }
    for (const diagnostic of diagnostics)
      console.error(`${diagnostic.file}: ${diagnostic.message}`);
    if (saved) console.log(`Saved agreed baseline: ${baselinePath}`);
    else if (command === "baseline")
      console.error(
        "Baseline was not saved. Both sides must agree and validation must pass first.",
      );
    else console.log("Preview only; no files or board data changed.");
  }
  return result.ok ? 0 : 1;
}
