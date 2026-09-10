import { createHash } from "node:crypto";
import { link, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  type Baseline,
  baselineSchema,
  comparisonFields,
  materializeSync,
  parseConflictSelections,
  planSync,
  remoteMetadataSchema,
  remoteSnapshotSchema,
  resolveSyncConflicts,
  type SyncIntent,
  stableJson,
  validateTracker,
} from "@cardstock/core";
import { z } from "zod";
import { loadConfig } from "./config";
import { credentialFor } from "./credentials";
import { getJson, normalizeRemote } from "./preview";
import {
  acquireSyncLock,
  publishLocal,
  readOptional,
  replaceState,
} from "./sync-files";
import {
  JournalStore,
  prepareJournal,
  type SyncJournal,
  verifyLocal,
  verifyRemote,
} from "./sync-journal";

export async function executeSync(
  args: string[],
  cwd: string,
  deleteIds?: string[],
): Promise<number> {
  const { values } = parseArgs({
    args,
    options: {
      config: { type: "string" },
      remote: { type: "string" },
      json: { type: "boolean" },
      ours: { type: "string", multiple: true },
      theirs: { type: "string", multiple: true },
      resume: { type: "boolean" },
      abort: { type: "boolean" },
      "recover-lock": { type: "boolean" },
      "adopt-identities": { type: "boolean" },
    },
  });
  if (values.resume && values.abort)
    throw new Error("Choose --resume or --abort, not both");
  if (
    (values.resume || values.abort) &&
    (values.ours || values.theirs || values["adopt-identities"])
  )
    throw new Error(
      "Recovery uses the recorded intent; do not supply new choices",
    );
  const { file: configPath, config } = await loadConfig(cwd, values.config);
  const remoteValue = values.remote ?? config.remote;
  if (!remoteValue)
    throw new Error("Pass --remote or configure remote in cardstock.json");
  const remote = normalizeRemote(remoteValue),
    directory = path.dirname(configPath),
    tracker = path.resolve(directory, config.tracker);
  const scope = {
    remote,
    project: config.project,
    board: config.board,
    tracker: path.relative(directory, tracker).split(path.sep).join("/") || ".",
    mapping: stableJson(config.mapping ?? {}),
  };
  const baselinePath = path.join(
    directory,
    ".cardstock",
    `${createHash("sha256").update(stableJson(scope)).digest("hex")}.json`,
  );
  const store = new JournalStore(baselinePath, scope);
  const release = await acquireSyncLock(
    `${baselinePath}.lock`,
    values["recover-lock"],
  );
  let journal: SyncJournal | null = null;
  const report = (data: unknown) =>
    console.log(
      values.json
        ? JSON.stringify(data, null, 2)
        : typeof data === "string"
          ? data
          : JSON.stringify(data, null, 2),
    );
  try {
    if (values["recover-lock"]) {
      const releaseJournal = await acquireSyncLock(`${store.file}.lock`, true);
      await releaseJournal();
    }
    journal = await store.read();
    const archive = async (label: string) => {
      if (!journal) throw new Error("No pending sync");
      const target = `${store.file}.${journal.id}.${label}`;
      const existing = await readOptional(target);
      if (existing === null) await link(store.file, target);
      else if (stableJson(JSON.parse(existing)) !== stableJson(journal))
        throw new Error("Archive already contains different state");
      await unlink(store.file);
      return target;
    };
    if (values.abort) {
      const archived = await archive("aborted");
      report({
        ok: true,
        aborted: true,
        archived,
        message:
          "No changes rolled back. Original files and applied results remain preserved; preview before a fresh sync.",
      });
      return 0;
    }
    if (journal && !values.resume)
      throw new Error(
        `Pending sync ${journal.id}; use sync --resume or --abort. Journal: ${store.file}`,
      );
    if (!journal && values.resume) throw new Error("No pending sync to resume");
    const credential = await credentialFor(remote);
    if (!credential)
      throw new Error(
        `Not signed in to ${remote}. Run cardstock login --remote ${remote}.`,
      );
    const url = `${remote}/api/v1/boards/${encodeURIComponent(config.project)}/${encodeURIComponent(config.board)}`;
    const snapshot = async () => {
      const raw = await getJson(`${url}/sync`, credential.token);
      const meta = remoteMetadataSchema.parse(raw);
      if (meta.syncProtocol !== 5)
        throw new Error(
          "Remote lacks sync protocol 5 (checklist); deploy the server and checklist migration first",
        );
      const snap = remoteSnapshotSchema.parse(raw);
      if (
        meta.project !== config.project ||
        meta.board !== config.board ||
        snap.cards.some((card) => !card.cardId)
      )
        throw new Error("Invalid sync identity snapshot");
      planSync({ local: [], remote: snap.cards, vocabulary: meta }); // validate duplicate IDs and all Markdown
      return { ...meta, cards: snap.cards };
    };
    const loadLocal = async () => {
      const entries = await readdir(tracker, { withFileTypes: true });
      const files = entries
        .filter((entry) => /^\d+\.md$/.test(entry.name))
        .sort(
          (a, b) => Number(a.name.slice(0, -3)) - Number(b.name.slice(0, -3)),
        );
      return Promise.all(
        files.map(async (entry) => {
          const markdown = await readOptional(path.join(tracker, entry.name));
          if (markdown === null)
            throw new Error("Tracker changed while reading");
          return { file: entry.name, markdown };
        }),
      );
    };
    let observed = await snapshot();
    if (!journal) {
      const before = await readOptional(baselinePath);
      const baseline =
        before === null ? undefined : baselineSchema.parse(JSON.parse(before));
      if (baseline && stableJson(baseline.scope) !== stableJson(scope))
        throw new Error("Baseline belongs to another board or tracker");
      const local = await loadLocal();
      const input = {
        local,
        remote: observed.cards,
        baseline,
        vocabulary: observed,
        mapping: config.mapping,
        deleteIds,
      };
      const selections = parseConflictSelections(values.ours, values.theirs);
      const plan = resolveSyncConflicts(planSync(input), selections);
      if (plan.counts.conflicts) {
        report({ ok: false, dryRun: false, applied: [], ...plan });
        return 1;
      }
      if (
        baseline?.cards.some((card) => !card.cardId) &&
        !values["adopt-identities"]
      )
        throw new Error(
          "Legacy baseline has no immutable identities. Use baseline when both sides agree, or explicitly trust the current identities with sync --adopt-identities.",
        );
      if (
        Object.keys(config.mapping?.by_tag ?? {}).length ||
        Object.keys(config.mapping?.by_epic ?? {}).length ||
        Object.keys(config.mapping?.by_area ?? {}).length
      )
        throw new Error(
          "Mapping overrides require #19 integration; no sync writes were made",
        );
      const intents = materializeSync(input, selections);
      const included = new Set(intents.map((intent) => intent.externalId));
      // Agreed cards also get fresh identity/revision baselines, including first contact.
      for (const card of observed.cards) {
        if (deleteIds && !deleteIds.includes(card.externalId)) continue;
        if (included.has(card.externalId)) continue;
        const mine = local.find(
          (item) => item.file === `${card.externalId}.md`,
        );
        if (!mine && !card.deleted) throw new Error("Missing local intent");
        intents.push({
          externalId: card.externalId,
          file: mine?.file ?? `${card.externalId}.md`,
          before: { local: mine?.markdown ?? null, remote: card },
          after: {
            local: mine?.markdown ?? null,
            remote: card.markdown,
            ...(card.deleted ? { deleted: true } : {}),
          },
          writeLocal: false,
          writeRemote: false,
          resolutions: [],
        });
      }
      const diagnostics = validateTracker(
        intents
          .filter((intent) => intent.after.local !== null)
          .map((intent) => ({
            name: intent.file,
            text: intent.after.local!,
          })),
        config.scheme,
      ).diagnostics;
      if (diagnostics.length) {
        report({ ok: false, diagnostics, applied: [] });
        return 1;
      }
      if (stableJson(local) !== stableJson(await loadLocal()))
        throw new Error("Local files changed during planning; retry");
      journal = prepareJournal(scope, before, intents);
      await store.create(journal);
    }
    const recoveryDiagnostics = validateTracker(
      journal.entries
        .filter(({ intent }) => intent.after.local !== null)
        .map(({ intent }) => ({
          name: intent.file,
          text: intent.after.local!,
        })),
      config.scheme,
    ).diagnostics;
    if (recoveryDiagnostics.length)
      throw new Error(
        "Recorded intent no longer passes tracker validation; inspect the journal and configuration",
      );
    const persist = async (next: SyncJournal) => {
      await store.replace(journal!, next);
      journal = next;
    };
    const writes = journal.entries
      .filter((entry) => entry.intent.writeRemote)
      .map(({ intent }) => ({
        externalId: intent.externalId,
        cardId: intent.before.remote?.cardId ?? null,
        revision: intent.before.remote?.revision ?? null,
        markdown: intent.after.remote,
        ...(intent.after.deleted ? { deleted: true } : {}),
      }));
    // Check before dispatch too, not merely after remote writes have already landed.
    for (const { intent } of journal.entries) {
      const current = await readOptional(path.join(tracker, intent.file));
      const backup = await readOptional(
        `${path.join(tracker, intent.file)}.cardstock-${journal.id}.before`,
      );
      if (
        current !== intent.before.local &&
        current !== intent.after.local &&
        !(current === null && backup === intent.before.local && backup !== null)
      )
        throw new Error(
          `Local #${intent.externalId} changed; journal retained for reconciliation`,
        );
    }
    let receipt:
      | { applied: { externalId: string; cardId: string; revision: string }[] }
      | undefined;
    if (writes.length) {
      const response = await fetch(`${url}/sync/apply`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${credential.token}`,
          "content-type": "application/json",
        },
        redirect: "error",
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          protocol: 5,
          operationId: journal.id,
          cards: writes,
          groupAliases: config.mapping?.group_aliases ?? {},
        }),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const failure = z
          .object({ error: z.object({ message: z.string() }) })
          .safeParse(body);
        throw new Error(
          `Sync request failed (HTTP ${response.status}): ${failure.success ? failure.data.error.message : "retry with --resume"}`,
        );
      }
      const result = z
        .object({
          protocol: z.literal(5),
          operationId: z.literal(journal.id),
          applied: z.array(
            z.object({
              externalId: z.string(),
              cardId: z.string().uuid(),
              revision: z.string(),
            }),
          ),
        })
        .parse(body);
      receipt = result;
    }
    observed = await snapshot();
    const same = (text: string, wanted: string) =>
      stableJson(comparisonFields(text, observed, config.mapping)) ===
      stableJson(comparisonFields(wanted, observed, config.mapping));
    const checkRemote = (intent: SyncIntent) => {
      const card = observed.cards.find(
        (item) => item.externalId === intent.externalId,
      );
      const expectedId =
        intent.before.remote?.cardId ??
        receipt?.applied.find((item) => item.externalId === intent.externalId)
          ?.cardId;
      if (
        !card ||
        !expectedId ||
        card.cardId !== expectedId ||
        !!card.deleted !== !!intent.after.deleted ||
        (!card.deleted && !same(card.markdown, intent.after.remote))
      )
        throw new Error(
          `Remote #${intent.externalId} differs from the recorded intent; no winner inferred`,
        );
      return card;
    };
    for (const entry of journal.entries) {
      const card =
        !entry.intent.writeLocal && !entry.intent.writeRemote
          ? entry.intent.before.remote!
          : checkRemote(entry.intent);
      if (entry.phase === "prepared")
        await persist(
          verifyRemote(journal, entry.intent.externalId, card, observed),
        );
    }
    // Per-card advancement accepts only the original or already-verified journal state.
    const advance = async () => {
      const current = await readOptional(baselinePath);
      const original =
        journal!.baselineBefore === null
          ? undefined
          : baselineSchema.parse(JSON.parse(journal!.baselineBefore));
      const prior =
        current === null
          ? undefined
          : baselineSchema.parse(JSON.parse(current));
      if (original && !prior)
        throw new Error(
          "Baseline disappeared during sync; restore it from the journal before continuing",
        );
      if (prior && stableJson(prior.scope) !== stableJson(scope))
        throw new Error("Baseline scope changed during sync");
      const cards = new Map(
        (original?.cards ?? []).map((card) => [card.externalId, card]),
      );
      const verified = new Map(
        journal!.entries
          .filter((entry) => entry.phase === "verified")
          .map((entry) => [
            entry.intent.externalId,
            { ...entry.remoteVerified!, file: entry.intent.file },
          ]),
      );
      for (const card of prior?.cards ?? []) {
        if (
          stableJson(card) !== stableJson(cards.get(card.externalId)) &&
          stableJson(card) !== stableJson(verified.get(card.externalId))
        )
          throw new Error("Baseline was changed by another operation");
      }
      for (const [id, card] of cards) {
        if (
          prior &&
          !prior.cards.some(
            (item) =>
              item.externalId === id && stableJson(item) === stableJson(card),
          ) &&
          !verified.has(id)
        )
          throw new Error("Baseline card was removed during sync");
      }
      for (const [id, card] of verified) cards.set(id, card);
      const next: Baseline = {
        version: 1,
        scope,
        etag: observed.etag,
        cards: [...cards.values()].sort(
          (a, b) => Number(a.externalId) - Number(b.externalId),
        ),
      };
      await replaceState(
        baselinePath,
        current,
        `${JSON.stringify(next, null, 2)}\n`,
      );
    };
    for (const entry of journal.entries) {
      const intent = entry.intent;
      // Re-observe before each local publication; later web changes stay conflicts/new work.
      observed = await snapshot();
      if (intent.writeLocal || intent.writeRemote) checkRemote(intent);
      await publishLocal(
        path.join(tracker, intent.file),
        intent.before.local,
        intent.after.local,
        journal.id,
      );
      if (entry.phase !== "verified")
        await persist(
          verifyLocal(
            journal,
            intent.externalId,
            await readOptional(path.join(tracker, intent.file)),
          ),
        );
      await advance();
    }
    if (!journal.entries.length) await advance();
    observed = await snapshot();
    const final = planSync({
      local: await loadLocal(),
      remote: observed.cards,
      baseline: baselineSchema.parse(
        JSON.parse((await readOptional(baselinePath))!),
      ),
      vocabulary: observed,
      mapping: config.mapping,
    });
    const archived = await archive("completed");
    report({
      ok: final.counts.conflicts === 0,
      dryRun: false,
      clean: final.clean,
      applied: writes.map((card) => card.externalId),
      journal: archived,
      baseline: { path: baselinePath, saved: true },
      remaining: final.counts,
    });
    return final.counts.conflicts ? 1 : 0;
  } catch (error) {
    report({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      ...(journal
        ? {
            journal: store.file,
            recovery:
              "Fix the reported issue, then sync --resume; or sync --abort to archive the intent without rolling back.",
          }
        : {}),
    });
    return 2;
  } finally {
    await release();
  }
}
