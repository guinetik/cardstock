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

/** Lane key for a card's tracker status, via the board's `status_to_lane`; `needs` wins for open items. */
export function laneForStatus(
  status: string,
  needs: string | null | undefined,
  settings: { status_to_lane?: Record<string, string>; needs_lane?: string },
  fallback = "unsorted",
): string {
  const pinned = ["built", "handed", "held", "shipped", "done"].includes(
    status,
  );
  if (!pinned && needs && settings.needs_lane) return settings.needs_lane;
  return settings.status_to_lane?.[status] ?? fallback;
}

export function isPinnedStatus(status: string): "built" | "done" | null {
  if (status === "shipped" || status === "done") return "done";
  if (status === "built" || status === "handed" || status === "held")
    return "built";
  return null;
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
