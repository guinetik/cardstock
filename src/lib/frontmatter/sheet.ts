/**
 * A card as a sheet: the values a tracker file states, in file form.
 *
 * Both halves of the round trip speak this shape. Import builds one from a
 * file and compares it with one built from the row; export builds one from
 * the row and writes only the keys that differ from the file it was given.
 */

import { valueToPriority } from "./mapping";
import { bodyWithoutH1, extractAsk } from "./parse";
import { type Frontmatter, isoOrNull } from "./schema";

export interface CardSheet {
  externalId: string;
  title: string;
  status: string;
  epic: string;
  area: string;
  tags: string[];
  raisedBy: string | null;
  raisedOn: string | null;
  shippedOn: string | null;
  needs: string | null;
  summary: string | null;
  relates: number[];
  lane: string | null;
  rank: number | null;
  priority: 1 | 2 | 3 | null;
  effort: "L" | "M" | "H" | null;
  plannedStart: string | null;
  target: string | null;
  archived: string | null;
  archivedBy: string | null;
  color: string | null;
  extra: Record<string, unknown>;
  bodyMd: string;
}

type Scalar = string | number | null;
type Value = Scalar | string[] | number[];

/**
 * Frontmatter key → how to read it off a sheet. The order here is the order
 * new files are written in and the order appended keys take.
 */
export const SHEET_KEYS = {
  title: { get: (s: CardSheet) => s.title },
  status: { get: (s: CardSheet) => s.status },
  epic: { get: (s: CardSheet) => s.epic },
  area: { get: (s: CardSheet) => s.area },
  raised_by: { get: (s: CardSheet) => s.raisedBy },
  raised: { get: (s: CardSheet) => s.raisedOn },
  shipped: { get: (s: CardSheet) => s.shippedOn },
  needs: { get: (s: CardSheet) => s.needs },
  summary: { get: (s: CardSheet) => s.summary },
  relates: { get: (s: CardSheet) => s.relates },
  tags: { get: (s: CardSheet) => s.tags },
  lane: { get: (s: CardSheet) => s.lane },
  rank: { get: (s: CardSheet) => s.rank },
  priority: { get: (s: CardSheet) => s.priority },
  effort: { get: (s: CardSheet) => s.effort },
  planned_start: { get: (s: CardSheet) => s.plannedStart },
  target: { get: (s: CardSheet) => s.target },
  archived: { get: (s: CardSheet) => s.archived },
  archived_by: { get: (s: CardSheet) => s.archivedBy },
  color: { get: (s: CardSheet) => s.color },
} as const satisfies Record<string, { get(s: CardSheet): Value }>;

export type SheetKey = keyof typeof SHEET_KEYS;
export const SHEET_KEY_ORDER = Object.keys(SHEET_KEYS) as SheetKey[];

export interface Change {
  key: SheetKey | "body";
  from: string | null;
  to: string | null;
}

/** Build a sheet from validated frontmatter. `tagRefs` are the file's tags already resolved to board refs. */
export function sheetFromFrontmatter(
  fm: Frontmatter,
  extra: Record<string, unknown>,
  body: string,
  tagRefs: string[],
): CardSheet {
  const iso = (v: string | null | undefined) =>
    v && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null;
  const bodyMd = bodyWithoutH1(body);
  return {
    externalId: String(fm.id),
    title: fm.title,
    status: fm.status,
    epic: fm.epic,
    area: fm.area,
    tags: tagRefs,
    raisedBy: fm.raised_by ?? null,
    raisedOn: isoOrNull(fm.raised),
    shippedOn: isoOrNull(fm.shipped),
    needs: fm.needs ?? null,
    summary: fm.summary ?? (extractAsk(body) || null),
    relates: fm.relates ?? [],
    lane: fm.lane ?? null,
    rank: fm.rank ?? null,
    priority:
      (fm.priority as 1 | 2 | 3 | undefined) ??
      valueToPriority(fm.value ?? null),
    effort: fm.effort ?? null,
    plannedStart: isoOrNull(fm.planned_start),
    target: fm.target ? (iso(fm.target) ?? fm.target) : null,
    archived: fm.archived ?? null,
    archivedBy: fm.archived ? (fm.archived_by ?? null) : null,
    color: fm.color ?? null,
    extra,
    bodyMd,
  };
}

/** Which sheet keys a raw frontmatter states. `value` states priority; the body is always stated. */
export function presentKeys(
  raw: Record<string, unknown>,
): Set<SheetKey | "body"> {
  const present = new Set<SheetKey | "body">(["body"]);
  for (const k of Object.keys(raw)) {
    if (k in SHEET_KEYS) present.add(k as SheetKey);
    if (k === "value") present.add("priority");
  }
  // summary is derived from the body when absent, so it is only "stated" when written
  if (!("summary" in raw)) present.delete("summary");
  return present;
}

function norm(v: Value): string | null {
  if (v == null) return null;
  if (Array.isArray(v))
    return [...(v as (string | number)[])].map(String).sort().join(",");
  return String(v).trim();
}

/** The changes the board would take from the file: keys the file states whose value differs. */
export function diffSheets(
  file: CardSheet,
  board: CardSheet,
  present: Set<SheetKey | "body">,
): Change[] {
  const changes: Change[] = [];
  for (const key of SHEET_KEY_ORDER) {
    if (!present.has(key)) continue;
    const from = norm(SHEET_KEYS[key].get(board));
    const to = norm(SHEET_KEYS[key].get(file));
    if (from !== to) changes.push({ key, from, to });
  }
  if (present.has("body") && file.bodyMd !== board.bodyMd)
    changes.push({ key: "body", from: null, to: null });
  return changes;
}
