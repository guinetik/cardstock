import type { CardColor } from "@/lib/card-color";
import type { Frontmatter } from "./schema";

export interface Mapping {
  by_tag?: Record<string, string[]>;
  /** Group key a tracker writes → the group key this board uses (`int` → `area`). */
  group_aliases?: Record<string, string>;
  by_epic?: Record<string, string[]>;
  by_area?: Record<string, string[]>;
  audience_internal_when?: {
    tags?: string[];
    areas?: string[];
    epics?: string[];
  };
}

const lc = (s: unknown) =>
  String(s ?? "")
    .trim()
    .toLowerCase();

/**
 * What tag keys this board actually has, and which group each belongs to.
 *
 * Built from the board's own rows, because that is where the taxonomy lives.
 * The importer used to carry three literal word lists deciding that `bug` was a
 * Kind and `login` was a Step, which meant a board could add a group in the
 * database and the importer would still drop every tag in it.
 */
export interface Vocabulary {
  /** tag key → the group keys declaring it; more than one means ambiguous. */
  byTagKey: Map<string, string[]>;
  groupKeys: Set<string>;
}

/** Build the vocabulary from the board's `group:tag` refs. */
export function buildVocabulary(refs: Iterable<string>): Vocabulary {
  const byTagKey = new Map<string, string[]>();
  const groupKeys = new Set<string>();
  for (const ref of refs) {
    const i = ref.indexOf(":");
    if (i < 0) continue;
    const group = ref.slice(0, i);
    const tag = ref.slice(i + 1);
    groupKeys.add(group);
    byTagKey.set(tag, [...(byTagKey.get(tag) ?? []), group]);
  }
  return { byTagKey, groupKeys };
}

export type TagRef = { ref: string } | { ambiguous: string } | null;

/**
 * Turn one frontmatter tag into a board ref.
 *
 * `group:tag` is explicit and wins, after group aliases — a tracker that writes
 * `int:` for the group a board calls `area` says so in its mapping file, rather
 * than the product knowing that "int" means anything.
 *
 * A bare tag resolves by looking itself up: `bug` is whatever group declares a
 * tag with that key. If two groups declare it the tag is ambiguous and is left
 * alone, because guessing would silently file cards under the wrong concept.
 */
export function tagRef(
  tag: string,
  vocab: Vocabulary,
  aliases: Record<string, string> = {},
): TagRef {
  const t = lc(tag);
  if (!t) return null;
  const i = t.indexOf(":");
  if (i >= 0) {
    const raw = t.slice(0, i);
    const group = lc(aliases[raw] ?? raw);
    // An unknown group is reported as unresolved, like an unknown tag: the
    // board is missing something the tracker expects, and that is worth saying.
    return { ref: `${group}:${t.slice(i + 1)}` };
  }
  const groups = vocab.byTagKey.get(t);
  if (!groups?.length) return null;
  if (groups.length > 1) return { ambiguous: t };
  return { ref: `${groups[0]}:${t}` };
}

/** Board tag refs (`group:tag`) for a tracker item, deduplicated, in first-seen order. */
export function mapTags(
  fm: Frontmatter,
  mapping: Mapping,
  vocab: Vocabulary,
): { refs: string[]; ambiguous: string[] } {
  const refs: string[] = [];
  const ambiguous: string[] = [];
  const add = (list?: (string | null)[]) => {
    for (const r of list ?? []) if (r && !refs.includes(r)) refs.push(r);
  };
  for (const t of fm.tags) {
    const r = tagRef(t, vocab, mapping.group_aliases);
    if (r && "ref" in r) add([r.ref]);
    else if (r && !ambiguous.includes(r.ambiguous)) ambiguous.push(r.ambiguous);
  }
  for (const t of fm.tags) add(mapping.by_tag?.[lc(t)]);
  add(mapping.by_epic?.[lc(fm.epic)]);
  add(mapping.by_area?.[lc(fm.area)]);
  return { refs, ambiguous };
}

export function mapAudience(
  fm: Frontmatter,
  mapping: Mapping,
): "all" | "internal" {
  if (
    fm.tags.some((t) => lc(t) === "internal") ||
    lc(fm.epic) === "engineering (internal)"
  )
    return "internal";
  const w = mapping.audience_internal_when;
  if (!w) return "all";
  if (fm.tags.some((t) => (w.tags ?? []).map(lc).includes(lc(t))))
    return "internal";
  if ((w.areas ?? []).map(lc).includes(lc(fm.area))) return "internal";
  if ((w.epics ?? []).map(lc).includes(lc(fm.epic))) return "internal";
  return "all";
}

/** `value` H/M/L → priority 1/2/3 — the product owner counts in numbers. */
export function valueToPriority(
  v: "L" | "M" | "H" | null | undefined,
): 1 | 2 | 3 | null {
  return v === "H" ? 1 : v === "M" ? 2 : v === "L" ? 3 : null;
}

/**
 * Where a card goes when a file is seen for the first time.
 *
 * Only two things decide a lane: what the file says, and — when it says nothing
 * — the board's inbox. Status deliberately has no say. Status is what state the
 * work is in; lane is where a person filed it, and no file can know that. A
 * board that derives one from the other can never disagree with its tracker,
 * which makes a human's decision the thing that gets overwritten.
 */
export function laneForNewCard(
  fmLane: string | null | undefined,
  laneKeys: Iterable<string>,
  inboxKey: string | null,
  fallback = "unsorted",
): string {
  const known = new Set(laneKeys);
  if (fmLane && known.has(fmLane)) return fmLane;
  if (inboxKey && known.has(inboxKey)) return inboxKey;
  return fallback;
}

/**
 * Whether an import should move an existing card, given the lane its file
 * claims now and the lane it claimed at the last sync.
 *
 * The comparison is against the merge base, never against where the card
 * actually sits. A file that has not changed its mind says nothing about the
 * board, so a drag survives; a file that has says so deliberately, so it wins.
 *
 * A null base means the card predates lane tracking: record the file's lane,
 * move nothing. Otherwise the first import after the change would treat every
 * file as having just moved its card.
 */
export function laneMoveFromSource(
  fmLane: string | null | undefined,
  base: string | null | undefined,
): string | null {
  if (base == null) return null;
  if (!fmLane || fmLane === base) return null;
  return fmLane;
}

/**
 * Turn board tag refs (`group:tag`) into tag ids, reporting the ones the board
 * does not declare.
 *
 * A ref only resolves if the board's seed created that tag. Silently dropping
 * a miss makes a seed that is missing half its vocabulary look like a clean
 * import, so callers are handed the misses to report.
 */
export function resolveTags(
  refs: string[],
  tagByRef: Map<string, string>,
): { ids: string[]; unresolved: string[] } {
  const ids: string[] = [];
  const unresolved: string[] = [];
  for (const ref of refs) {
    const id = tagByRef.get(ref);
    if (id) ids.push(id);
    else unresolved.push(ref);
  }
  return { ids, unresolved };
}

/**
 * What an import should write to `summary`, or `undefined` to leave it alone.
 *
 * The summary is seeded from markdown but editable on the card page, so once a
 * person has typed one the database owns it — an import must not quietly
 * replace their words with the frontmatter's.
 *
 * The export deliberately does not write it back: `summary` sits near the top
 * of the tracker's frontmatter, and the exporter re-appends everything it owns
 * as a block at the end, so exporting it would reorder all 99 files. An edited
 * summary therefore lives only in the app, and the file's `summary:` becomes a
 * historical note for that card.
 */
export function summaryOnImport(
  prev: { summary: string | null; summary_edited_at: string | null },
  fmSummary: string | null | undefined,
  askSummary: string | null,
): string | null | undefined {
  if (prev.summary_edited_at) return undefined;
  if (fmSummary) return fmSummary;
  return prev.summary ? undefined : askSummary;
}

/**
 * What an import should write to `body_md`, or `undefined` to leave it alone.
 *
 * Once someone edits the body or posts a comment in the app, the database owns
 * `body_md`. The exporter writes it back; an import must not replace it.
 *
 * @param prev - Existing card, or `null` for a create.
 * @param fileBody - `bodyWithoutH1` of the tracker file.
 */
export function bodyOnImport(
  prev: { body_md: string; body_edited_at: string | null } | null,
  fileBody: string,
): string | undefined {
  if (!prev) return fileBody;
  if (prev.body_edited_at) return undefined;
  return fileBody;
}

/** Map canonical frontmatter color to its nullable database mirror. */
export function cardColorOnImport(
  color: CardColor | null | undefined,
): CardColor | null {
  return color ?? null;
}
