import type { Card, Lane, TagGroup } from "./types";

/** Filter value for cards with no epic assigned. */
export const EPIC_FILTER_NONE = "__none__";

/** Filter value for cards nobody is assigned to. */
export const ASSIGNEE_FILTER_NONE = "__none__";

export interface Filters {
  query: string;
  tags: Set<string>; // tag ids; OR within a group, AND across groups
  priority: Set<1 | 2 | 3>;
  effort: Set<"L" | "M" | "H">;
  /** One tracker status, or null for every status. */
  status: string | null;
  /** One epic id, {@link EPIC_FILTER_NONE} for unassigned, or null for every epic. */
  epic: string | null;
  /** One member id, {@link ASSIGNEE_FILTER_NONE} for nobody, or null for everyone. */
  assignee: string | null;
  showInternal: boolean;
  showArchived: boolean;
}

/** Default filter state with nothing selected. */
export function emptyFilters(showInternal = true): Filters {
  return {
    query: "",
    tags: new Set(),
    priority: new Set(),
    effort: new Set(),
    status: null,
    epic: null,
    assignee: null,
    showInternal,
    showArchived: false,
  };
}

/** True when any filter criterion is active. */
export function isFiltering(f: Filters): boolean {
  return (
    !!f.query.trim() ||
    f.tags.size > 0 ||
    f.priority.size > 0 ||
    f.effort.size > 0 ||
    f.status != null ||
    f.epic != null ||
    f.assignee != null ||
    f.showArchived
  );
}

/**
 * Distinct tracker statuses present on this board, for the filter bar.
 * Blanks are dropped; order is sorted so the menu is stable across reloads.
 */
export function boardStatuses(
  cards: ReadonlyArray<{ status?: string | null }>,
): string[] {
  const seen = new Set<string>();
  for (const card of cards) {
    const status = card.status?.trim();
    if (status) seen.add(status);
  }
  return [...seen].sort();
}

/** Group the selected tag ids by their group so we can OR within and AND across. */
function selectedByGroup(
  f: Filters,
  groups: TagGroup[],
): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const g of groups)
    for (const t of g.tags)
      if (f.tags.has(t.id)) {
        const s = out.get(g.id) ?? new Set<string>();
        s.add(t.id);
        out.set(g.id, s);
      }
  return out;
}

/** True when a card satisfies every active filter criterion. */
export function matches(
  card: Card,
  f: Filters,
  groups: TagGroup[],
  lanes: Lane[],
): boolean {
  const lane = lanes.find((l) => l.id === card.lane_id);
  if (!f.showArchived && (card.archived_at || lane?.kind === "archive"))
    return false;
  if (!f.showInternal && card.audience === "internal") return false;
  const q = f.query.trim().toLowerCase();
  if (
    q &&
    !(
      `#${card.external_id}`.includes(q) ||
      card.external_id === q ||
      card.title.toLowerCase().includes(q) ||
      (card.summary ?? "").toLowerCase().includes(q)
    )
  )
    return false;
  if (f.priority.size && !(card.priority && f.priority.has(card.priority)))
    return false;
  if (f.effort.size && !(card.effort && f.effort.has(card.effort)))
    return false;
  if (f.status && card.status !== f.status) return false;
  if (f.epic === EPIC_FILTER_NONE) {
    if (card.epic_id || card.epic?.trim()) return false;
  } else if (f.epic && card.epic_id !== f.epic) return false;
  if (f.assignee === ASSIGNEE_FILTER_NONE) {
    // An off-roster email is still somebody's name on the card, so a card with
    // text but no FK is assigned — it is just assigned to a stranger.
    if (card.assignee_id || card.assignee?.trim()) return false;
  } else if (f.assignee && card.assignee_id !== f.assignee) return false;
  for (const [, wanted] of selectedByGroup(f, groups))
    if (!card.tag_ids.some((id) => wanted.has(id))) return false;
  return true;
}

export type InboxSort = "newest" | "oldest" | "id-asc" | "id-desc";

/**
 * Order the inbox lane for triage.
 *
 * By date: newest or oldest first, with a card that has no raised date sorting
 * last either way, and ties broken by id so the order is stable.
 * By id: the card number alone, compared numerically — `#33` after `#7`, not
 * before it — and the raised date is ignored.
 */
export function sortInbox(cards: Card[], how: InboxSort): Card[] {
  const num = (c: Card) => Number(c.external_id);
  if (how === "id-asc" || how === "id-desc") {
    const dir = how === "id-asc" ? 1 : -1;
    return cards.slice().sort((a, b) => (num(a) - num(b)) * dir);
  }
  const key = (c: Card) => c.raised_on ?? "";
  return cards.slice().sort((a, b) => {
    const ka = key(a),
      kb = key(b);
    if (!ka && kb) return 1;
    if (ka && !kb) return -1;
    if (ka !== kb)
      return how === "newest" ? (ka < kb ? 1 : -1) : ka < kb ? -1 : 1;
    return how === "newest" ? num(b) - num(a) : num(a) - num(b);
  });
}

/** Days a card has sat in its lane (from the last move event), or null when unknown. */
export function daysInLane(card: Card, now = new Date()): number | null {
  if (!card.lane_entered_at) return null;
  return Math.floor(
    (now.getTime() - new Date(card.lane_entered_at).getTime()) / 86_400_000,
  );
}

export function toCsv(
  cards: Card[],
  lanes: Lane[],
  groups: TagGroup[],
): string {
  const laneName = new Map(lanes.map((l) => [l.id, l.name]));
  const tagName = new Map<string, string>();
  for (const g of groups)
    for (const t of g.tags) tagName.set(t.id, `${g.name}: ${t.name}`);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = [
    "id",
    "title",
    "lane",
    "status",
    "priority",
    "effort",
    "target_date",
    "target_label",
    "epic",
    "assignee",
    "area",
    "raised_by",
    "raised_on",
    "needs",
    "audience",
    "tags",
    "summary",
  ];
  const rows = cards.map((c) =>
    [
      c.external_id,
      c.title,
      laneName.get(c.lane_id ?? "") ?? "",
      c.status,
      c.priority ? `P${c.priority}` : "",
      c.effort ?? "",
      c.target_date ?? "",
      c.target_label ?? "",
      c.epic ?? "",
      c.assignee ?? "",
      c.area ?? "",
      c.raised_by ?? "",
      c.raised_on ?? "",
      c.needs ?? "",
      c.audience,
      c.tag_ids
        .map((id) => tagName.get(id) ?? "")
        .filter(Boolean)
        .join("; "),
      c.summary ?? "",
    ]
      .map(esc)
      .join(","),
  );
  return [head.join(","), ...rows].join("\n");
}
