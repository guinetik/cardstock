import { boardEtag } from "@/lib/api/board";
import { apiJson } from "@/lib/api/errors";
import { withToken } from "@/lib/api/route";
import { loadBoardState } from "@/lib/import/board-state";
import { boardCards } from "@/lib/import/export-board";

/** A pure markdown-card snapshot: reading it never rebases stored sources. */
export const GET = withToken(async ({ db, board }) => {
  const [state, { cards: markdownByPath }] = await Promise.all([
    loadBoardState(db, board.id),
    boardCards(db, board.id),
  ]);
  const decoder = new TextDecoder();
  const cards = [...state.cards.values()]
    .sort((a, b) => Number(a.external_id) - Number(b.external_id))
    .map((card) => ({
      externalId: card.external_id,
      revision: card.updated_at,
      markdown: decoder.decode(markdownByPath[`${card.external_id}.md`]),
    }));
  return apiJson({ etag: boardEtag(state), cards });
});
