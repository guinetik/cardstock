import type { Card, Lane, TagGroup } from "./types";

export interface Filters {
  query: string;
  tags: Set<string>; // tag ids; OR within a group, AND across groups
  priority: Set<1 | 2 | 3>;
  effort: Set<"L" | "M" | "H">;
  showInternal: boolean;
  showArchived: boolean;
}

export function emptyFilters(showInternal = true): Filters {
  return {
    query: "",
    tags: new Set(),
    priority: new Set(),
    effort: new Set(),
    showInternal,
    showArchived: false,
  };
}

export function isFiltering(f: Filters): boolean {
  return (
    !!f.query.trim() ||
    f.tags.size > 0 ||
    f.priority.size > 0 ||
    f.effort.size > 0 ||
    f.showArchived
  );
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
  for (const [, wanted] of selectedByGroup(f, groups))
    if (!card.tag_ids.some((id) => wanted.has(id))) return false;
  return true;
}

export type InboxSort = "newest" | "oldest";

export function sortInbox(cards: Card[], how: InboxSort): Card[] {
  const key = (c: Card) => c.raised_on ?? "";
  return cards.slice().sort((a, b) => {
    const ka = key(a),
      kb = key(b);
    if (!ka && kb) return 1;
    if (ka && !kb) return -1;
    if (ka !== kb)
      return how === "newest" ? (ka < kb ? 1 : -1) : ka < kb ? -1 : 1;
    return how === "newest"
      ? Number(b.external_id) - Number(a.external_id)
      : Number(a.external_id) - Number(b.external_id);
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
