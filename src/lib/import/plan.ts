/**
 * Dry run: what filing these sheets on this board would do. Pure — the same
 * files and board state always give the same plan, which is why the applier
 * can re-plan and trust its own result instead of the browser's.
 */
import {
  buildVocabulary,
  laneForNewCard,
  type Mapping,
  mapAudience,
  mapTags,
} from "@/lib/frontmatter/mapping";
import { parseFile } from "@/lib/frontmatter/parse";
import { validateFrontmatter } from "@/lib/frontmatter/schema";
import {
  type CardSheet,
  type Change,
  diffSheets,
  presentKeys,
  sheetFromFrontmatter,
} from "@/lib/frontmatter/sheet";
import type {
  BoardState,
  CardPatch,
  ExistingCard,
  Plan,
  PlanRow,
  SheetFile,
} from "./types";

export const DEFAULT_MAPPING: Mapping = {
  audience_internal_when: { tags: ["internal"] },
};

/** `gate-1` → `Gate 1`. */
export function laneNameFromKey(key: string): string {
  return key
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

/** The board's view of a card, in file form, for the diff. */
export function sheetFromCard(
  card: ExistingCard,
  state: BoardState,
): CardSheet {
  const lane = state.lanes.find((l) => l.id === card.lane_id);
  const refs: string[] = [];
  for (const g of state.groups)
    for (const t of g.tags)
      if (card.tag_ids.includes(t.id)) refs.push(`${g.key}:${t.key}`);
  return {
    externalId: card.external_id,
    title: card.title,
    status: card.status,
    epic: card.epic ?? "",
    area: card.area ?? "",
    tags: refs,
    raisedBy: card.raised_by,
    raisedOn: card.raised_on,
    shippedOn: card.shipped_on,
    needs: card.needs,
    summary: card.summary,
    relates: card.relates,
    lane: lane?.key ?? null,
    rank: card.rank,
    priority: card.priority,
    effort: card.effort,
    plannedStart: card.planned_start_date,
    target: card.target_date ?? card.target_label,
    archived: card.archived_at
      ? card.archived_at.slice(0, 19).replace("T", " ")
      : null,
    archivedBy: card.archived_at ? card.archived_by : null,
    color: card.color,
    extra: card.frontmatter_extra ?? {},
    bodyMd: card.body_md ?? "",
  };
}

/** DB columns for the sheet keys in `changes` (plus the ones every write carries). */
function columnsFor(
  sheet: CardSheet,
  changes: Change[],
  isNew: boolean,
  audience: "all" | "internal",
) {
  const keys = new Set(changes.map((c) => c.key));
  const cols: Record<string, unknown> = {};
  const set = (k: Change["key"], v: () => Record<string, unknown>) => {
    if (isNew || keys.has(k)) Object.assign(cols, v());
  };
  set("title", () => ({ title: sheet.title }));
  set("status", () => ({ status: sheet.status }));
  set("area", () => ({ area: sheet.area }));
  set("raised_by", () => ({ raised_by: sheet.raisedBy }));
  set("raised", () => ({ raised_on: sheet.raisedOn }));
  set("shipped", () => ({ shipped_on: sheet.shippedOn }));
  set("needs", () => ({ needs: sheet.needs }));
  set("summary", () => ({ summary: sheet.summary }));
  set("priority", () => ({ priority: sheet.priority }));
  set("effort", () => ({ effort: sheet.effort }));
  set("planned_start", () => ({ planned_start_date: sheet.plannedStart }));
  set("target", () => {
    const iso = sheet.target && /^\d{4}-\d{2}-\d{2}$/.test(sheet.target);
    return {
      target_date: iso ? sheet.target : null,
      target_label: sheet.target && !iso ? sheet.target : null,
    };
  });
  set("archived", () => ({
    archived_at: sheet.archived
      ? new Date(`${sheet.archived.replace(" ", "T")}Z`).toISOString()
      : null,
    archived_by: sheet.archived ? sheet.archivedBy : null,
  }));
  set("color", () => ({ color: sheet.color }));
  set("body", () => ({ body_md: sheet.bodyMd, body_edited_at: null }));
  if (isNew) cols.audience = audience;
  return cols;
}

export function planImport(
  files: SheetFile[],
  state: BoardState,
  mapping: Mapping = DEFAULT_MAPPING,
): Plan {
  const laneKeys = new Set(state.lanes.map((l) => l.key));
  const inboxKey = state.lanes.find((l) => l.kind === "inbox")?.key ?? null;
  const groupByKey = new Map(state.groups.map((g) => [g.key, g]));
  const vocab = buildVocabulary(
    state.groups.flatMap((g) => g.tags.map((t) => `${g.key}:${t.key}`)),
  );

  const rows: PlanRow[] = [];
  const newLanes = new Map<string, { key: string; name: string }>();
  const newGroups = new Map<string, { key: string; name: string }>();
  const newTags = new Map<
    string,
    { groupKey: string; key: string; name: string }
  >();
  const unapplied = new Map<string, string[]>();
  const ambiguous = new Map<string, string[]>();
  const counts = { new: 0, changed: 0, unchanged: 0, error: 0 };

  for (const file of files) {
    const id = file.name.replace(/\.md$/, "");
    try {
      const parsed = parseFile(file.text);
      const { data: fm, extra } = validateFrontmatter(
        parsed.frontmatter,
        file.name,
      );
      if (String(fm.id) !== id)
        throw new Error(`id ${fm.id} does not match the filename ${file.name}`);

      const prev = state.cards.get(id);
      if (prev && prev.source_hash === parsed.hash) {
        rows.push({ id, title: fm.title, verdict: "unchanged" });
        counts.unchanged++;
        continue;
      }

      // Tags: refs resolve or are created; bare unknowns are reported, never guessed.
      const mapped = mapTags(fm, mapping, vocab);
      for (const t of mapped.ambiguous)
        ambiguous.set(t, [...(ambiguous.get(t) ?? []), id]);
      for (const t of fm.tags)
        if (!t.includes(":") && !vocab.byTagKey.has(t.trim().toLowerCase()))
          unapplied.set(t, [...(unapplied.get(t) ?? []), id]);
      for (const ref of mapped.refs) {
        const [g, t] = ref.split(":");
        const group = groupByKey.get(g);
        if (!group) newGroups.set(g, { key: g, name: laneNameFromKey(g) });
        if (!group?.tags.some((x) => x.key === t))
          newTags.set(ref, { groupKey: g, key: t, name: laneNameFromKey(t) });
      }

      const sheet = sheetFromFrontmatter(fm, extra, parsed.body, mapped.refs);
      const present = presentKeys(parsed.frontmatter);
      if (fm.lane && !laneKeys.has(fm.lane))
        newLanes.set(fm.lane, { key: fm.lane, name: laneNameFromKey(fm.lane) });

      const audience = mapAudience(fm, mapping);
      const shared = {
        external_id: id,
        epic: sheet.epic,
        source_path: file.name,
        source_hash: parsed.hash,
        source_text: file.text,
        frontmatter_extra: extra,
        lane_from_source: fm.lane ?? null,
      };

      if (!prev) {
        const laneKey =
          fm.lane && !laneKeys.has(fm.lane)
            ? fm.lane
            : laneForNewCard(fm.lane, laneKeys, inboxKey);
        const changes = diffSheets(
          sheet,
          { ...sheet, bodyMd: "" },
          present,
        ).filter((c) => c.key === "body");
        const patch: CardPatch = {
          columns: { ...shared, ...columnsFor(sheet, changes, true, audience) },
          laneKey,
          rank:
            fm.rank != null && fm.lane === laneKey
              ? Number(fm.rank)
              : undefined,
          tagRefs: mapped.refs,
          relates: fm.relates ?? [],
          epic: sheet.epic,
        };
        rows.push({
          id,
          title: fm.title,
          verdict: "new",
          lane: laneKey,
          changes: [],
          patch,
          hash: parsed.hash,
        });
        counts.new++;
        continue;
      }

      const board = sheetFromCard(prev, state);
      const changes = diffSheets(sheet, board, present);
      if (!changes.length) {
        // Same content, different bytes (whitespace, key order): record the new sheet, nothing else.
        rows.push({
          id,
          title: fm.title,
          verdict: "changed",
          changes,
          hash: parsed.hash,
          patch: {
            columns: shared,
            laneKey: null,
            rank: undefined,
            tagRefs: undefined,
            relates: undefined,
            epic: undefined,
          },
        });
        counts.changed++;
        continue;
      }
      const keys = new Set(changes.map((c) => c.key));
      const patch: CardPatch = {
        columns: { ...shared, ...columnsFor(sheet, changes, false, audience) },
        laneKey: keys.has("lane") ? sheet.lane : null,
        rank:
          keys.has("rank") || keys.has("lane")
            ? (sheet.rank ?? undefined)
            : undefined,
        tagRefs: keys.has("tags") ? mapped.refs : undefined,
        relates: keys.has("relates") ? (fm.relates ?? []) : undefined,
        epic: keys.has("epic") ? sheet.epic : undefined,
      };
      rows.push({
        id,
        title: fm.title,
        verdict: "changed",
        changes,
        patch,
        hash: parsed.hash,
      });
      counts.changed++;
    } catch (e) {
      rows.push({ id, verdict: "error", message: (e as Error).message });
      counts.error++;
    }
  }

  return {
    ok: counts.error === 0,
    rows,
    newLanes: [...newLanes.values()],
    newGroups: [...newGroups.values()],
    newTags: [...newTags.values()],
    unappliedTags: [...unapplied].map(([tag, cards]) => ({ tag, cards })),
    ambiguousTags: [...ambiguous].map(([tag, cards]) => ({ tag, cards })),
    counts,
  };
}
