import { apiError, apiJson } from "@/lib/api/errors";
import { withToken } from "@/lib/api/route";
import { syncColumns, syncRequestSchema } from "@/lib/api/sync";

export const POST = withToken(
  async ({ db, board, member, canManage }, request) => {
    if (!canManage)
      return apiError(
        "forbidden",
        "Board admin access is required for sync writes.",
      );
    let cards: ReturnType<typeof syncColumns>[];
    let operationId: string;
    try {
      const body = syncRequestSchema.parse(await request.json());
      operationId = body.operationId;
      cards = body.cards.map((card) => syncColumns(card, body.groupAliases));
    } catch (error) {
      return apiError(
        "invalid_request",
        error instanceof Error ? error.message : "Invalid sync request",
      );
    }
    const { data, error } = await db.rpc("cli_apply_sync_v3", {
      p_board: board.id,
      p_member: member.id,
      p_operation: operationId,
      p_cards: cards,
    });
    if (error) {
      if (["23514", "23505", "40001", "40P01"].includes(error.code))
        return apiError("conflict", error.message);
      if (error.code === "42501")
        return apiError("forbidden", "Board admin access is required.");
      if (error.code === "22023")
        return apiError("invalid_request", error.message);
      throw new Error(error.message);
    }
    return apiJson({ protocol: 3, operationId, ...data });
  },
);
