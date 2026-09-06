import { boardEtag } from "@/lib/api/board";
import { apiError, apiJson } from "@/lib/api/errors";
import { withToken } from "@/lib/api/route";
import { applyPlan } from "@/lib/import/apply";
import { loadBoardState } from "@/lib/import/board-state";
import { planImport } from "@/lib/import/plan";
import type { SheetFile } from "@/lib/import/types";

interface SyncCard {
  externalId: string;
  markdown: string;
  revision?: string;
}

function readBody(
  raw: unknown,
): { apply: boolean; cards: SyncCard[] } | string {
  if (!raw || typeof raw !== "object") return "Send a JSON object.";
  const body = raw as Record<string, unknown>;
  if (body.apply !== undefined && typeof body.apply !== "boolean")
    return "`apply` must be a boolean.";
  if (!Array.isArray(body.cards)) return "`cards` must be an array.";
  const cards: SyncCard[] = [];
  for (const [index, entry] of body.cards.entries()) {
    if (!entry || typeof entry !== "object")
      return `cards[${index}] must be an object.`;
    const card = entry as Record<string, unknown>;
    if (typeof card.externalId !== "string" || !/^\d+$/.test(card.externalId))
      return `cards[${index}].externalId must be a card id such as "16".`;
    if (typeof card.markdown !== "string")
      return `cards[${index}].markdown must be a string.`;
    if (card.revision !== undefined && typeof card.revision !== "string")
      return `cards[${index}].revision must be a string.`;
    cards.push({
      externalId: card.externalId,
      markdown: card.markdown,
      revision: card.revision as string | undefined,
    });
  }
  return { apply: body.apply === true, cards };
}

/** Plan cards, then apply only revisions that still match their card rows. */
export const POST = withToken(
  async ({ db, board, canManage, member }, request) => {
    if (!canManage)
      return apiError(
        "forbidden",
        "You need project admin rights to write to this board.",
      );

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return apiError("invalid_request", "The body is not valid JSON.");
    }
    const body = readBody(raw);
    if (typeof body === "string") return apiError("invalid_request", body);

    const state = await loadBoardState(db, board.id);
    const files: SheetFile[] = body.cards.map(({ externalId, markdown }) => ({
      name: `${externalId}.md`,
      text: markdown,
    }));
    const plan = planImport(files, state);
    const rows = plan.rows.map((row) => ({
      id: row.id,
      verdict: row.verdict,
      ...(row.verdict === "error" ? { message: row.message } : {}),
    }));
    if (!body.apply)
      return apiJson({
        etag: boardEtag(state),
        applied: [],
        conflicted: [],
        skipped: [],
        plan: { counts: plan.counts, rows },
      });
    if (!plan.ok)
      return apiError("invalid_request", "Some cards could not be read.", {
        rows,
      });

    const revisions = new Map(
      body.cards
        .filter((card) => card.revision)
        .map((card) => [card.externalId, card.revision as string]),
    );
    const missing = plan.rows
      .filter((row) => row.verdict === "changed" && !revisions.has(row.id))
      .map((row) => row.id);
    if (missing.length)
      return apiError(
        "conflict",
        "Quote the revision you last saw for every card you are changing.",
        { code: "revision_required", cards: missing },
      );

    const counts = await applyPlan(db, state, plan, member.email, revisions);
    const conflicted = new Set(counts.conflicted);
    const applied = plan.rows
      .filter(
        (row) =>
          (row.verdict === "new" || row.verdict === "changed") &&
          !conflicted.has(row.id),
      )
      .map((row) => row.id);
    const skipped = plan.rows
      .filter((row) => row.verdict === "unchanged")
      .map((row) => row.id);
    const after = await loadBoardState(db, board.id);
    return apiJson(
      {
        etag: boardEtag(after),
        applied,
        conflicted: counts.conflicted,
        skipped,
        plan: { counts: plan.counts, rows },
      },
      { status: counts.conflicted.length ? 409 : 200 },
    );
  },
);
