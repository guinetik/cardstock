import { boardEtag, boardVocabulary } from "@/lib/api/board";
import { apiJson } from "@/lib/api/errors";
import { withToken } from "@/lib/api/route";
import { loadBoardState } from "@/lib/import/board-state";

/** Lanes, tags, roster, and other sheet-writing vocabulary. */
export const GET = withToken(async ({ db, project, board, canManage }) => {
  const state = await loadBoardState(db, board.id);
  return apiJson({
    project: project.slug,
    board: board.slug,
    canManage,
    syncProtocol: 5,
    settings: board.settings,
    etag: boardEtag(state),
    ...boardVocabulary(state),
  });
});
