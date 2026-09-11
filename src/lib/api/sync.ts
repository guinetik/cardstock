import { createHash } from "node:crypto";
import {
  checklistSection,
  type Fields,
  markdownFromFields,
  parseChecklist,
  readSyncFrontmatter,
  rebaseMarkdown,
  stableJson,
} from "@cardstock/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { valueToPriority } from "@/lib/frontmatter/mapping";
import { bodyWithoutH1, parseFile } from "@/lib/frontmatter/parse";
import { isoOrNull, validateFrontmatter } from "@/lib/frontmatter/schema";
import type { CardSheet } from "@/lib/frontmatter/sheet";
import { writeSheet } from "@/lib/frontmatter/write";

export const syncRequestSchema = z.strictObject({
  protocol: z.literal(5),
  operationId: z.string().uuid(),
  cards: z
    .array(
      z
        .strictObject({
          externalId: z.string().regex(/^[1-9]\d*$/),
          markdown: z.string().max(2_000_000),
          cardId: z.string().uuid().nullable(),
          revision: z.string().min(1).max(200).nullable(),
          deleted: z.boolean().optional(),
        })
        .refine(
          (card) =>
            (card.cardId === null) === (card.revision === null) &&
            (!card.deleted || card.cardId !== null),
          "Quote both identity and revision",
        ),
    )
    .max(1000)
    .refine(
      (cards) =>
        new Set(cards.map((card) => card.externalId)).size === cards.length,
      "Duplicate identity",
    ),
  groupAliases: z.record(z.string(), z.string()).default({}),
});

/** Strict full-sheet semantics: absence clears optional database fields. */
export function syncColumns(
  card: z.infer<typeof syncRequestSchema>["cards"][number],
  aliases: Record<string, string>,
) {
  if (card.deleted)
    return {
      externalId: card.externalId,
      cardId: card.cardId,
      revision: card.revision,
      deleted: true,
    };
  const parsed = parseFile(card.markdown);
  const { data: fm, extra } = validateFrontmatter(
    readSyncFrontmatter(card.markdown),
  );
  if (String(fm.id) !== card.externalId)
    throw new Error("Markdown identity does not match request");
  const checklist = parseChecklist(bodyWithoutH1(parsed.body));
  return {
    externalId: card.externalId,
    cardId: card.cardId,
    revision: card.revision,
    lane: fm.lane ?? null,
    rank: fm.rank ?? null,
    tags: [
      ...new Set(
        fm.tags.map((tag) => {
          const normalized = tag.trim().toLowerCase(),
            colon = normalized.indexOf(":");
          return colon < 0
            ? normalized
            : `${aliases[normalized.slice(0, colon)] ?? normalized.slice(0, colon)}:${normalized.slice(colon + 1)}`;
        }),
      ),
    ],
    relates: fm.relates ?? [],
    columns: {
      title: fm.title,
      status: fm.status,
      epic: fm.epic || null,
      area: fm.area,
      assignee: fm.assignee ?? null,
      raised_by: fm.raised_by ?? null,
      raised_on: isoOrNull(fm.raised),
      shipped_on: isoOrNull(fm.shipped),
      needs: fm.needs ?? null,
      summary: fm.summary ?? null,
      body_md: checklist.body.trim(),
      checklist_input: checklistSection(checklist),
      priority: fm.priority ?? valueToPriority(fm.value ?? null),
      effort: fm.effort ?? null,
      planned_start_date: isoOrNull(fm.planned_start),
      target_date: isoOrNull(fm.target),
      target_label: isoOrNull(fm.target) ? null : (fm.target ?? null),
      archived_at: fm.archived
        ? new Date(`${fm.archived.replace(" ", "T")}Z`).toISOString()
        : null,
      archived_by: fm.archived_by ?? null,
      color: fm.color ?? null,
      source_text: card.markdown,
      source_hash: parsed.hash,
      frontmatter_extra: extra,
      audience: fm.audience ?? "all",
    },
  };
}

function legacySheet(id: string, p: Fields): CardSheet {
  const get = (key: string) => p[`frontmatter.${key}`];
  return {
    externalId: id,
    title: get("title"),
    status: get("status"),
    epic: get("epic") ?? "",
    area: get("area") ?? "",
    audience: get("audience") as "all" | "internal",
    assignee: get("assignee"),
    tags: get("tags"),
    raisedBy: get("raised_by"),
    raisedOn: get("raised"),
    shippedOn: get("shipped"),
    needs: get("needs"),
    summary: get("summary"),
    relates: get("relates"),
    lane: get("lane"),
    rank: get("rank"),
    priority: get("priority"),
    effort: get("effort"),
    plannedStart: get("planned_start"),
    target: get("target"),
    archived: get("archived"),
    archivedBy: get("archived_by"),
    color: get("color"),
    extra: {},
    bodyMd: p.body,
    checklist: p.checklist,
  } as unknown as CardSheet;
}

export async function syncSnapshot(
  db: SupabaseClient,
  boardId: string,
  project: string,
  board: string,
  card?: string,
) {
  const { data, error } = await db.rpc(
    card ? "cli_sync_card_snapshot" : "cli_sync_snapshot_v4",
    {
      p_board: boardId,
      ...(card ? { p_external_id: card } : {}),
    },
  );
  if (error) throw new Error(`Sync snapshot unavailable: ${error.message}`);
  const raw = data as {
    tagGroups: { key: string; tags: { key: string }[] }[];
    cards: {
      externalId: string;
      cardId: string;
      revision: string;
      source: string | null;
      savedProjection: Fields | null;
      projection: Fields;
      deleted?: boolean;
    }[];
  };
  const cards = raw.cards.map((card) => {
    // Retained deletion snapshots created before checklist still embed the list.
    if (!("checklist" in card.projection)) {
      const parsed = parseChecklist(String(card.projection.body ?? ""));
      card.projection = {
        ...card.projection,
        body: parsed.body.trim(),
        checklist: checklistSection(parsed) as unknown as Fields[string],
      };
    }
    if (
      !["all", "internal"].includes(
        String(card.projection["frontmatter.audience"]),
      )
    )
      throw new Error("Explicit-audience migration is not installed");
    const markdown = card.source
      ? card.savedProjection
        ? rebaseMarkdown(
            card.source,
            card.externalId,
            card.savedProjection,
            card.projection,
          )
        : writeSheet(
            card.source,
            legacySheet(card.externalId, card.projection),
            {
              tagRef: (tag) => {
                if (tag.includes(":")) return tag;
                const groups = raw.tagGroups.filter((group) =>
                  group.tags.some((item) => item.key === tag),
                );
                return groups.length === 1 ? `${groups[0].key}:${tag}` : null;
              },
            },
          )
      : markdownFromFields(
          card.externalId,
          Object.fromEntries(
            Object.entries(card.projection).filter(
              ([, value]) => value !== null,
            ),
          ),
        );
    return {
      externalId: card.externalId,
      cardId: card.cardId,
      revision: card.revision,
      markdown,
      ...(card.deleted ? { deleted: true } : {}),
    };
  });
  const etag = createHash("sha256")
    .update(stableJson({ cards, tagGroups: raw.tagGroups }))
    .digest("hex");
  return {
    syncProtocol: 5,
    project,
    board,
    etag,
    tagGroups: raw.tagGroups,
    cards,
  };
}
