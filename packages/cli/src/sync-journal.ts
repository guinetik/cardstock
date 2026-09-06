import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { hostname } from "node:os";
import path from "node:path";
import {
  baselineSchema,
  comparisonFields,
  type RemoteCard,
  readSyncFrontmatter,
  remoteSnapshotSchema,
  type SyncIntent,
  stableJson,
  type Vocabulary,
} from "@cardstock/core";
import { z } from "zod";

const remoteCard = remoteSnapshotSchema.shape.cards.element;
const intentSchema = z.strictObject({
  externalId: z.string().regex(/^[1-9]\d*$/),
  file: z.string().regex(/^[1-9]\d*\.md$/),
  before: z.strictObject({
    local: z.string().nullable(),
    remote: remoteCard.nullable(),
  }),
  after: z.strictObject({ local: z.string(), remote: z.string() }),
  writeLocal: z.boolean(),
  writeRemote: z.boolean(),
  resolutions: z.array(
    z.strictObject({ field: z.string(), side: z.enum(["ours", "theirs"]) }),
  ),
});
const journalSchema = z.strictObject({
  version: z.literal(1),
  id: z.string().uuid(),
  generation: z.number().int().nonnegative(),
  scope: baselineSchema.shape.scope,
  // Compare the exact original baseline when the executor is ready to advance it.
  baselineBefore: z.string().nullable(),
  entries: z.array(
    z.strictObject({
      intent: intentSchema,
      phase: z.enum(["prepared", "remote_verified", "verified"]),
      remoteVerified: remoteCard.optional(),
    }),
  ),
});
export type SyncJournal = z.infer<typeof journalSchema>;

function validate(value: unknown): SyncJournal {
  const journal = journalSchema.parse(value);
  const seen = new Set<string>();
  for (const entry of journal.entries) {
    const { intent } = entry;
    if (
      seen.has(intent.externalId) ||
      intent.file !== `${intent.externalId}.md` ||
      (intent.before.remote &&
        intent.before.remote.externalId !== intent.externalId) ||
      (entry.remoteVerified &&
        entry.remoteVerified.externalId !== intent.externalId)
    )
      throw new Error("Invalid journal card identity");
    if ((entry.phase === "prepared") !== (entry.remoteVerified === undefined))
      throw new Error("Invalid journal verification state");
    if (
      (intent.before.local === null && !intent.writeLocal) ||
      (intent.before.remote === null && !intent.writeRemote)
    )
      throw new Error("Invalid journal creation intent");
    for (const markdown of [
      intent.before.local,
      intent.before.remote?.markdown,
      intent.after.local,
      intent.after.remote,
    ]) {
      if (
        markdown != null &&
        String(Number(readSyncFrontmatter(markdown).id)) !== intent.externalId
      )
        throw new Error("Journal Markdown identity does not match its file");
    }
    seen.add(intent.externalId);
  }
  return journal;
}

export function prepareJournal(
  scope: SyncJournal["scope"],
  baselineBefore: string | null,
  intents: SyncIntent[],
): SyncJournal {
  return validate({
    version: 1,
    id: randomUUID(),
    generation: 0,
    scope,
    baselineBefore,
    entries: intents.map((intent) => ({ intent, phase: "prepared" })),
  });
}

/** Acknowledgement alone is insufficient: supply a fresh snapshot of the result. */
export function verifyRemote(
  journal: SyncJournal,
  externalId: string,
  observed: RemoteCard,
  vocabulary: Vocabulary,
): SyncJournal {
  const next = validate(structuredClone(journal));
  const entry = next.entries.find(
    (item) => item.intent.externalId === externalId,
  );
  if (!entry || entry.phase !== "prepared")
    throw new Error("Remote verification is out of order");
  const mapping = JSON.parse(next.scope.mapping);
  const actual = comparisonFields(observed.markdown, vocabulary, mapping);
  const expected = comparisonFields(
    entry.intent.after.remote,
    vocabulary,
    mapping,
  );
  if (
    observed.externalId !== externalId ||
    (entry.intent.before.remote?.cardId !== undefined &&
      observed.cardId !== entry.intent.before.remote.cardId) ||
    !observed.revision ||
    actual.id !== externalId ||
    stableJson(actual.fields) !== stableJson(expected.fields)
  )
    throw new Error(
      `Remote outcome differs from the intent for #${externalId}`,
    );
  entry.remoteVerified = { ...observed };
  entry.phase = "remote_verified";
  next.generation++;
  return validate(next);
}

/** The executor must re-read the file after its atomic replacement. */
export function verifyLocal(
  journal: SyncJournal,
  externalId: string,
  observed: string,
): SyncJournal {
  const next = validate(structuredClone(journal));
  const entry = next.entries.find(
    (item) => item.intent.externalId === externalId,
  );
  if (!entry || entry.phase !== "remote_verified")
    throw new Error("Local verification is out of order");
  if (observed !== entry.intent.after.local)
    throw new Error(`Local outcome differs from the intent for #${externalId}`);
  entry.phase = "verified";
  next.generation++;
  return validate(next);
}

/**
 * One scoped journal beside the baseline. No credentials, inferred retries, or
 * baseline writes. Failed writes leave the last complete JSON readable; a crash
 * can leave a lock/temp file for operator inspection, never automatic deletion.
 */
export class JournalStore {
  readonly file: string;
  constructor(
    baselinePath: string,
    readonly scope: SyncJournal["scope"],
  ) {
    this.file = `${baselinePath}.journal.json`;
  }

  private check(value: unknown) {
    const journal = validate(value);
    if (stableJson(journal.scope) !== stableJson(this.scope))
      throw new Error("Journal belongs to another board or tracker");
    return journal;
  }

  async read(): Promise<SyncJournal | null> {
    let text: string;
    try {
      text = await readFile(this.file, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
    return this.check(JSON.parse(text));
  }

  async create(journal: SyncJournal): Promise<void> {
    const checked = this.check(journal);
    if (
      checked.generation !== 0 ||
      checked.entries.some((entry) => entry.phase !== "prepared")
    )
      throw new Error("New journal must contain only prepared intents");
    await this.write(null, checked);
  }

  async replace(previous: SyncJournal, next: SyncJournal): Promise<void> {
    const before = this.check(previous),
      after = this.check(next);
    if (
      before.id !== after.id ||
      after.generation !== before.generation + 1 ||
      before.baselineBefore !== after.baselineBefore ||
      stableJson(before.entries.map((entry) => entry.intent)) !==
        stableJson(after.entries.map((entry) => entry.intent))
    )
      throw new Error(
        "Journal replacement must preserve intent and advance one generation",
      );
    const changes = after.entries.filter(
      (entry, index) => stableJson(entry) !== stableJson(before.entries[index]),
    );
    if (changes.length !== 1)
      throw new Error("Journal replacement must advance one card");
    for (let i = 0; i < after.entries.length; i++) {
      const a = before.entries[i],
        b = after.entries[i];
      if (stableJson(a) === stableJson(b)) continue;
      if (
        !(a.phase === "prepared" && b.phase === "remote_verified") &&
        !(
          a.phase === "remote_verified" &&
          b.phase === "verified" &&
          stableJson(a.remoteVerified) === stableJson(b.remoteVerified)
        )
      )
        throw new Error(
          "Journal replacement cannot skip or reverse verification",
        );
    }
    await this.write(before, after);
  }

  private async write(previous: SyncJournal | null, next: SyncJournal) {
    await mkdir(path.dirname(this.file), { recursive: true });
    const lockPath = `${this.file}.lock`;
    // Never unlink a lock we did not acquire (including a crash-left lock).
    const lock = await open(lockPath, "wx", 0o600);
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    let createdTemporary = false;
    try {
      await lock.writeFile(
        JSON.stringify({
          pid: process.pid,
          hostname: hostname(),
          journal: next.id,
        }),
      );
      await lock.sync();
      if (stableJson(await this.read()) !== stableJson(previous))
        throw new Error(
          "Journal changed during this operation; reload before continuing",
        );
      const handle = await open(temporary, "wx", 0o600);
      createdTemporary = true;
      try {
        await handle.writeFile(`${JSON.stringify(next, null, 2)}\n`);
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temporary, this.file);
      createdTemporary = false;
      // Persist the rename on platforms that support directory fsync.
      if (process.platform !== "win32") {
        const directory = await open(path.dirname(this.file), "r");
        try {
          await directory.sync();
        } finally {
          await directory.close();
        }
      }
    } finally {
      try {
        if (createdTemporary) await unlink(temporary);
      } finally {
        await lock.close();
        await unlink(lockPath);
      }
    }
  }
}
