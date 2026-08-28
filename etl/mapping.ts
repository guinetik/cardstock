import type { Frontmatter } from "./schema";

export interface Mapping {
  by_tag?: Record<string, string[]>;
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

const KIND = new Set([
  "bug",
  "enhancement",
  "nice-to-have",
  "new-integration",
  "new-feature",
  "question",
  "internal",
]);
const OBJECTIVE = new Set([
  "self-serve",
  "internal-ui",
  "claude-marketplace",
  "website",
  "growth",
]);
const SURFACE = new Set([
  "home",
  "live-integrations",
  "login",
  "runtime",
  "logs",
  "email",
  "spec-doc",
  "settings",
  "docs",
]);

/** The scheme's tag vocabulary maps 1:1 onto the board's groups; the JSON mapping only adds overrides. */
export function schemeRef(tag: string): string | null {
  const t = lc(tag);
  if (t.startsWith("area:")) return `area:${t.slice(5)}`;
  if (t.startsWith("int:")) return `area:${t.slice(4)}`; // alias for trackers that say "integration"
  if (t === "cross-cutting") return "area:cross-cutting";
  if (/^step-[1-8]$/.test(t) || SURFACE.has(t)) return `step:${t}`;
  if (KIND.has(t)) return `kind:${t}`;
  if (OBJECTIVE.has(t)) return `objective:${t}`;
  return null;
}

/** Board tag refs (`group:tag`) for a tracker item, deduplicated, in first-seen order. */
export function mapTags(fm: Frontmatter, mapping: Mapping): string[] {
  const out: string[] = [];
  const add = (refs?: (string | null)[]) => {
    for (const r of refs ?? []) if (r && !out.includes(r)) out.push(r);
  };
  add(fm.tags.map(schemeRef));
  for (const t of fm.tags) add(mapping.by_tag?.[lc(t)]);
  add(mapping.by_epic?.[lc(fm.epic)]);
  add(mapping.by_area?.[lc(fm.area)]);
  return out;
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
