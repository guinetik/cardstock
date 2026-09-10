import { parseDocument } from "yaml";
import { z } from "zod";
import { checklistSection, parseChecklist } from "./checklist";
import type { Config } from "./config";
import { bodyWithoutH1, parseFile } from "./parse";
import { validateFrontmatter } from "./schema";

export type Value =
  | null
  | boolean
  | number
  | string
  | Value[]
  | { [key: string]: Value };
export type Fields = Record<string, Value>;
export interface LocalCard {
  file: string;
  markdown: string;
}
export interface RemoteCard {
  /** A retained snapshot, not a live card. Identity remains reserved. */
  deleted?: boolean;
  cardId?: string;
  externalId: string;
  revision: string;
  markdown: string;
}
export interface Vocabulary {
  tagGroups: { key: string; tags: { key: string }[] }[];
}
export const remoteMetadataSchema = z.object({
  syncProtocol: z.number().optional(),
  project: z.string(),
  board: z.string(),
  etag: z.string().min(1),
  tagGroups: z.array(
    z.object({ key: z.string(), tags: z.array(z.object({ key: z.string() })) }),
  ),
});
export const remoteSnapshotSchema = z.object({
  etag: z.string().min(1),
  cards: z.array(
    z.object({
      externalId: z.string().regex(/^[1-9]\d*$/),
      cardId: z.string().uuid().optional(),
      revision: z.string().min(1),
      markdown: z.string(),
      deleted: z.boolean().optional(),
    }),
  ),
});
export type RemoteMetadata = z.infer<typeof remoteMetadataSchema>;
export type RemoteSnapshot = z.infer<typeof remoteSnapshotSchema>;
export interface BaselineCard extends RemoteCard {
  file: string;
}
export interface Baseline {
  version: 1;
  scope: {
    remote: string;
    project: string;
    board: string;
    tracker: string;
    mapping: string;
  };
  etag: string;
  cards: BaselineCard[];
}
export const baselineSchema = z.strictObject({
  version: z.literal(1),
  scope: z.strictObject({
    remote: z.string(),
    project: z.string(),
    board: z.string(),
    tracker: z.string(),
    mapping: z.string(),
  }),
  etag: z.string().min(1),
  cards: z.array(
    z.strictObject({
      file: z.string().regex(/^[1-9]\d*\.md$/),
      cardId: z.string().uuid().optional(),
      externalId: z.string().regex(/^[1-9]\d*$/),
      revision: z.string().min(1),
      markdown: z.string(),
      deleted: z.boolean().optional(),
    }),
  ),
});
export interface FieldValue {
  present: boolean;
  value?: Value;
}
export interface FieldChange {
  field: string;
  direction: "upload" | "download" | "equal" | "conflict";
  base: FieldValue;
  local: FieldValue;
  remote: FieldValue;
  reason?: string;
  resolution?: "ours" | "theirs";
}
export interface CardPlan {
  externalId: string;
  file: string;
  revision?: string;
  action:
    | "create_remote"
    | "create_local"
    | "update"
    | "equal"
    | "conflict"
    | "delete_remote"
    | "delete_local"
    | "restore_remote";
  changes: FieldChange[];
  reason?: string;
}

/** Stable JSON preserves object semantics and array order without delimiter collisions. */
export function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.entries(value)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
    .join(",")}}`;
}

function jsonValue(value: unknown): Value {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(jsonValue);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, jsonValue(entry)]),
    );
  throw new Error("Unsupported frontmatter value in sync comparison");
}

function canonicalTag(
  tag: string,
  vocabulary: Vocabulary,
  mapping?: Config["mapping"],
): string {
  const normalized = tag.trim().toLowerCase();
  const colon = normalized.indexOf(":");
  if (colon >= 0) {
    const group = normalized.slice(0, colon);
    return `${mapping?.group_aliases?.[group] ?? group}:${normalized.slice(colon + 1)}`;
  }
  const groups = vocabulary.tagGroups.filter((group) =>
    group.tags.some((entry) => entry.key === normalized),
  );
  return groups.length === 1 ? `${groups[0].key}:${normalized}` : normalized;
}

/** Same known-field normalization as the importer; unknown YAML values remain visible. */
export function comparisonFields(
  markdown: string,
  vocabulary: Vocabulary,
  mapping?: Config["mapping"],
): { id: string; fields: Fields } {
  const parsed = parseFile(markdown);
  const raw = readSyncFrontmatter(markdown);
  const { data } = validateFrontmatter(raw);
  const fields: Fields = Object.create(null);
  for (const [key, value] of Object.entries(raw)) {
    if (key === "id") continue;
    let normalized: Value = jsonValue(value);
    if (key === "tags")
      normalized = [
        ...new Set(
          data.tags.map((tag) => canonicalTag(tag, vocabulary, mapping)),
        ),
      ].sort();
    if (key === "relates")
      normalized = [...new Set(data.relates ?? [])].sort((a, b) => a - b);
    if (["rank", "priority", "value", "effort"].includes(key))
      normalized = jsonValue(data[key] ?? null);
    fields[`frontmatter.${key}`] = normalized;
  }
  const checklist = parseChecklist(bodyWithoutH1(parsed.body));
  fields.body = checklist.body.trim();
  fields.checklist = checklistSection(checklist) as unknown as Value;
  // Omission is the default classification, including pre-audience baselines.
  fields["frontmatter.audience"] = data.audience ?? "all";
  fields["frontmatter.epic"] = data.epic || null;
  return { id: String(data.id), fields };
}

export function readSyncFrontmatter(markdown: string): Record<string, unknown> {
  parseFile(markdown);
  const lines = markdown.split(/\r?\n/);
  const end = lines.findIndex((line, i) => i > 0 && line.trim() === "---");
  const document = parseDocument(lines.slice(1, end).join("\n"), {
    stringKeys: true,
  });
  if (
    document.errors.length ||
    document.warnings.some((warning) => warning.code === "TAG_RESOLVE_FAILED")
  ) {
    throw new Error(
      "Sync comparison requires unambiguous YAML frontmatter; fix syntax, duplicate keys or unsupported tags first.",
    );
  }
  const raw = document.toJS({ maxAliasCount: 100 });
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("Frontmatter must be an object");
  return raw;
}

const fieldValue = (fields: Fields | undefined, key: string): FieldValue =>
  fields && Object.hasOwn(fields, key)
    ? { present: true, value: fields[key] }
    : { present: false };
const same = (a: FieldValue, b: FieldValue) => stableJson(a) === stableJson(b);

export function planSync(input: {
  local: LocalCard[];
  remote: RemoteCard[];
  baseline?: Baseline;
  vocabulary: Vocabulary;
  mapping?: Config["mapping"];
  /** Explicit command targets; absence of a file never requests deletion. */
  deleteIds?: string[];
}) {
  const locals = new Map<string, { card: LocalCard; fields: Fields }>();
  const remotes = new Map<string, { card: RemoteCard; fields: Fields }>();
  const bases = new Map<string, { card: BaselineCard; fields: Fields }>();
  for (const card of input.local) {
    const { id, fields } = comparisonFields(
      card.markdown,
      input.vocabulary,
      input.mapping,
    );
    if (locals.has(id)) throw new Error(`Duplicate local identity #${id}`);
    if (card.file !== `${id}.md`)
      throw new Error(
        `Local identity #${id} does not match filename ${card.file}`,
      );
    locals.set(id, { card, fields });
  }
  for (const card of input.remote) {
    const { id, fields } = comparisonFields(
      card.markdown,
      input.vocabulary,
      input.mapping,
    );
    if (id !== card.externalId || remotes.has(id))
      throw new Error(
        `Invalid or duplicate remote identity #${card.externalId}`,
      );
    remotes.set(id, { card, fields });
  }
  for (const card of input.baseline?.cards ?? []) {
    const { id, fields } = comparisonFields(
      card.markdown,
      input.vocabulary,
      input.mapping,
    );
    if (id !== card.externalId || card.file !== `${id}.md` || bases.has(id))
      throw new Error(
        `Invalid or duplicate baseline identity #${card.externalId}`,
      );
    bases.set(id, { card, fields });
  }
  const cards: CardPlan[] = [];
  const deletions = new Set(input.deleteIds ?? []);
  for (const id of deletions) {
    if (!remotes.has(id))
      throw new Error(
        `Cannot delete #${id}: no remote identity. Sync new cards before deleting them.`,
      );
    if (!remotes.get(id)!.card.deleted && !bases.get(id)?.card.cardId)
      throw new Error(
        `Cannot delete #${id} without an identity baseline. Sync or baseline the card first.`,
      );
  }
  const ids = [
    ...new Set([...locals.keys(), ...remotes.keys(), ...bases.keys()]),
  ].sort((a, b) => Number(a) - Number(b));
  for (const externalId of ids) {
    if (input.deleteIds && !deletions.has(externalId)) continue;
    const local = locals.get(externalId);
    const remote = remotes.get(externalId);
    const base = bases.get(externalId);
    const file = local?.card.file ?? base?.card.file ?? `${externalId}.md`;
    if (
      base?.card.cardId &&
      remote &&
      base.card.cardId !== remote.card.cardId
    ) {
      cards.push({
        externalId,
        file,
        action: "conflict",
        changes: [],
        reason:
          "identity_changed: card was replaced; reconcile identity explicitly",
      });
      continue;
    }
    if (base && !remote) {
      cards.push({
        externalId,
        file,
        action: "conflict",
        changes: [],
        reason:
          "remote_missing: previously tracked card is absent; no deletion or recreation is inferred",
      });
      continue;
    }
    if (remote && (remote.card.deleted || deletions.has(externalId))) {
      const deleting = deletions.has(externalId);
      if (remote.card.deleted && !local) continue;
      const conflict = remote.card.deleted
        ? !deleting &&
          !!local &&
          (!base ||
            base.card.deleted ||
            stableJson(local.fields) !== stableJson(base.fields))
        : !base ||
          base.card.deleted ||
          stableJson(remote.fields) !== stableJson(base.fields);
      const change: FieldChange = {
        field: "existence",
        direction: conflict
          ? "conflict"
          : remote.card.deleted
            ? "download"
            : "upload",
        base: {
          present: !!base,
          ...(base ? { value: !base.card.deleted } : {}),
        },
        local: { present: true, value: !deleting },
        remote: { present: true, value: !remote.card.deleted },
        ...(conflict
          ? {
              reason:
                "delete_vs_edit: choose deletion or the surviving content explicitly",
            }
          : {}),
      };
      cards.push({
        externalId,
        file,
        revision: remote.card.revision,
        action: conflict
          ? "conflict"
          : remote.card.deleted
            ? "delete_local"
            : "delete_remote",
        changes: [change],
        reason: deleting ? "explicit_delete" : "remote_deleted",
      });
      continue;
    }
    if (!local) {
      cards.push({
        externalId,
        file,
        revision: remote?.card.revision,
        action: "create_local",
        changes: [],
        reason: base
          ? "local_missing: restore the remote card; a missing file is not a deletion"
          : "remote_only",
      });
      continue;
    }
    if (!remote) {
      cards.push({
        externalId,
        file,
        action: "create_remote",
        changes: [],
        reason: "local_only",
      });
      continue;
    }
    const changes: FieldChange[] = [];
    const keys = [
      ...new Set([
        ...Object.keys(local.fields),
        ...Object.keys(remote.fields),
        ...Object.keys(base?.fields ?? {}),
      ]),
    ].sort();
    for (const field of keys) {
      const l = fieldValue(local.fields, field);
      const r = fieldValue(remote.fields, field);
      const b = fieldValue(base?.fields, field);
      if (same(l, r)) {
        if (base && !same(l, b))
          changes.push({
            field,
            direction: "equal",
            base: b,
            local: l,
            remote: r,
          });
        continue;
      }
      let direction: FieldChange["direction"] = "conflict";
      if (
        !base &&
        field === "checklist" &&
        !(l.value as { present?: boolean })?.present
      )
        direction = "download";
      if (base) {
        if (same(l, b)) direction = "download";
        else if (same(r, b)) direction = "upload";
      }
      const reason =
        direction === "conflict"
          ? !base
            ? field === "frontmatter.title"
              ? "identity_collision: same id with different titles and no baseline"
              : "no_baseline: cannot determine which side changed"
            : "both_changed"
          : undefined;
      changes.push({
        field,
        direction,
        base: b,
        local: l,
        remote: r,
        ...(reason ? { reason } : {}),
      });
    }
    if (changes.length)
      cards.push({
        externalId,
        file,
        revision: remote.card.revision,
        action: changes.some((change) => change.direction === "conflict")
          ? "conflict"
          : changes.every((change) => change.direction === "equal")
            ? "equal"
            : "update",
        changes,
      });
  }
  return summarizeSyncPlan(cards);
}

export function summarizeSyncPlan(cards: CardPlan[]) {
  const counts = {
    uploads: cards.filter(
      (card) =>
        card.action === "create_remote" ||
        card.action === "delete_remote" ||
        card.action === "restore_remote" ||
        card.changes.some((change) => change.direction === "upload"),
    ).length,
    downloads: cards.filter(
      (card) =>
        card.action === "create_local" ||
        card.action === "delete_local" ||
        card.changes.some((change) => change.direction === "download"),
    ).length,
    equal: cards.filter((card) =>
      card.changes.some((change) => change.direction === "equal"),
    ).length,
    conflicts: cards.filter((card) => card.action === "conflict").length,
  };
  return {
    clean:
      counts.uploads === 0 && counts.downloads === 0 && counts.conflicts === 0,
    counts,
    cards,
  };
}
