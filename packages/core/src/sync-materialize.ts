import { isAlias, isMap, isScalar, parseDocument, visit } from "yaml";
import type { Config } from "./config";
import {
  comparisonFields,
  type Fields,
  type LocalCard,
  planSync,
  type RemoteCard,
  stableJson,
  type Vocabulary,
} from "./sync-plan";
import { type ConflictResolution, resolveSyncConflicts } from "./sync-resolve";

export interface SyncIntent {
  externalId: string;
  file: string;
  before: { local: string | null; remote: RemoteCard | null };
  after: { local: string; remote: string };
  writeLocal: boolean;
  writeRemote: boolean;
  resolutions: { field: string; side: "ours" | "theirs" }[];
}

function split(markdown: string) {
  const opening = /^---[^\S\r\n]*\r?\n/.exec(markdown);
  if (!opening) throw new Error("Expected a frontmatter opening fence");
  const start = opening[0].length;
  const closing = /^---[^\S\r\n]*(?:\r?\n|$)/m.exec(markdown.slice(start));
  if (!closing) throw new Error("Expected a frontmatter closing fence");
  const end = start + closing.index;
  return {
    start,
    end,
    bodyStart: end + closing[0].length,
    yaml: markdown.slice(start, end),
    nl: markdown.includes("\r\n") ? "\r\n" : "\n",
  };
}

/** Source ranges let unrelated YAML remain byte-for-byte intact. */
function blocks(text: string) {
  const document = parseDocument(text, {
    keepSourceTokens: true,
    stringKeys: true,
  });
  if (
    document.errors.length ||
    document.warnings.length ||
    !isMap(document.contents)
  )
    throw new Error(
      "Lossless sync requires unambiguous YAML mapping frontmatter",
    );
  if (document.contents.flow)
    throw new Error("Lossless sync cannot edit a top-level flow mapping");
  visit(document, (_key, node) => {
    if (
      isAlias(node) ||
      (node && typeof node === "object" && "anchor" in node && node.anchor)
    )
      throw new Error("Lossless sync cannot edit YAML anchors or aliases");
  });
  const result = new Map<
    string,
    { start: number; end: number; scalar?: [number, number] }
  >();
  for (const pair of document.contents.items) {
    if (
      !isScalar(pair.key) ||
      typeof pair.key.value !== "string" ||
      !pair.key.range
    )
      throw new Error("Lossless sync requires simple string keys");
    const start = pair.key.range[0];
    const value = pair.value;
    if (
      !value ||
      !("range" in value) ||
      !value.range ||
      (start !== 0 && text[start - 1] !== "\n")
    )
      throw new Error("Lossless sync cannot locate a complete YAML field");
    const end = Math.max(
      value.range[2],
      ...(pair.srcToken?.sep ?? []).map(
        (token) => token.offset + token.source.length,
      ),
    );
    const scalar =
      isScalar(value) &&
      value.range[0] < value.range[1] &&
      !/[\r\n]/.test(text.slice(start, value.range[1]))
        ? ([value.range[0], value.range[1]] as [number, number])
        : undefined;
    result.set(pair.key.value, { start, end, scalar });
  }
  return result;
}

/** Copy only selected fields from the other side, keeping this side's layout. */
function patchFields(
  target: string,
  donor: string,
  fields: string[],
  donorFields: Fields,
) {
  if (!fields.length) return target;
  const a = split(target),
    b = split(donor);
  const yamlFields = fields.filter((field) => field.startsWith("frontmatter."));
  let yaml = a.yaml;
  if (yamlFields.length) {
    const mine = blocks(a.yaml),
      theirs = blocks(b.yaml);
    const edits: { start: number; end: number; text: string }[] = [];
    let appended = "";
    for (const field of yamlFields) {
      const key = field.slice("frontmatter.".length);
      const old = mine.get(key),
        next = theirs.get(key);
      if (!next) {
        if (old) edits.push({ start: old.start, end: old.end, text: "" });
        continue;
      }
      // Scalar-only changes retain this side's key spelling and inline comment.
      if (old?.scalar && next.scalar) {
        edits.push({
          start: old.scalar[0],
          end: old.scalar[1],
          text: b.yaml.slice(...next.scalar),
        });
      } else {
        let text = b.yaml.slice(next.start, next.end).replace(/\r?\n/g, a.nl);
        if (!text.endsWith(a.nl)) text += a.nl;
        if (old) edits.push({ start: old.start, end: old.end, text });
        else appended += text;
      }
    }
    for (const edit of edits.sort((x, y) => y.start - x.start))
      yaml = yaml.slice(0, edit.start) + edit.text + yaml.slice(edit.end);
    yaml += appended;
  }
  let body = target.slice(a.bodyStart);
  if (fields.includes("body")) {
    const h1 = /^\s*# [^\r\n]*(?:\r?\n|$)/.exec(body)?.[0] ?? "";
    const rest = body.slice(h1.length);
    const leading = /^\s*/.exec(rest)?.[0] ?? "";
    const trailing = /\s*$/.exec(rest.slice(leading.length))?.[0] ?? "";
    const value = String(donorFields.body).replace(/\r?\n/g, a.nl);
    // A heading without a newline still needs separation from newly added body text.
    body =
      h1 + (h1 && !h1.endsWith("\n") ? a.nl : "") + leading + value + trailing;
  }
  return (
    target.slice(0, a.start) + yaml + target.slice(a.end, a.bodyStart) + body
  );
}

/** Pure preparation: no I/O, inferred deletions, or implicit conflict winners. */
export function materializeSync(
  input: Parameters<typeof planSync>[0],
  resolutions: ConflictResolution[] = [],
): SyncIntent[] {
  const plan = resolveSyncConflicts(planSync(input), resolutions);
  if (plan.counts.conflicts)
    throw new Error("Cannot materialize a sync plan with unresolved conflicts");
  const local = new Map(
    input.local.map((card) => [
      String(
        comparisonFields(card.markdown, input.vocabulary, input.mapping).id,
      ),
      card,
    ]),
  );
  const remote = new Map(input.remote.map((card) => [card.externalId, card]));
  return plan.cards.map((card) => {
    const mine = local.get(card.externalId),
      theirs = remote.get(card.externalId);
    const localText = mine?.markdown ?? theirs?.markdown;
    const remoteText = theirs?.markdown ?? mine?.markdown;
    if (localText === undefined || remoteText === undefined)
      throw new Error("Missing sync source");
    const left = comparisonFields(
      localText,
      input.vocabulary,
      input.mapping,
    ).fields;
    const right = comparisonFields(
      remoteText,
      input.vocabulary,
      input.mapping,
    ).fields;
    const downloads = card.changes
      .filter((change) => change.direction === "download")
      .map((change) => change.field);
    const uploads = card.changes
      .filter((change) => change.direction === "upload")
      .map((change) => change.field);
    const after = {
      local: patchFields(localText, remoteText, downloads, right),
      remote: patchFields(remoteText, localText, uploads, left),
    };
    const expected: Fields = { ...left };
    for (const field of downloads) {
      if (Object.hasOwn(right, field)) expected[field] = right[field];
      else delete expected[field];
    }
    for (const text of [after.local, after.remote]) {
      const actual = comparisonFields(text, input.vocabulary, input.mapping);
      if (
        actual.id !== card.externalId ||
        stableJson(actual.fields) !== stableJson(expected)
      )
        throw new Error(
          `Lossless merge verification failed for #${card.externalId}`,
        );
    }
    return {
      externalId: card.externalId,
      file: card.file,
      before: {
        local: mine?.markdown ?? null,
        remote: theirs ? { ...theirs } : null,
      },
      after,
      writeLocal: !mine || after.local !== mine.markdown,
      writeRemote: !theirs || uploads.length > 0,
      resolutions: card.changes.flatMap((change) =>
        change.resolution
          ? [{ field: change.field, side: change.resolution }]
          : [],
      ),
    };
  });
}

/** Verify semantic agreement without treating newline/alias spelling as edits. */
export function agreesWithIntent(
  intent: SyncIntent,
  local: LocalCard,
  remote: RemoteCard,
  vocabulary: Vocabulary,
  mapping?: Config["mapping"],
) {
  if (local.file !== intent.file || remote.externalId !== intent.externalId)
    return false;
  const wanted = comparisonFields(intent.after.local, vocabulary, mapping);
  return [local.markdown, remote.markdown].every((markdown) => {
    const actual = comparisonFields(markdown, vocabulary, mapping);
    return (
      actual.id === intent.externalId &&
      stableJson(actual.fields) === stableJson(wanted.fields)
    );
  });
}
