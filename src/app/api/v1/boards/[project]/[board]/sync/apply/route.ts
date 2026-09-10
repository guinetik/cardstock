import { apiError, apiJson } from "@/lib/api/errors";
import { withToken } from "@/lib/api/route";
import { syncColumns, syncRequestSchema } from "@/lib/api/sync";
import { scheduleWatchMail } from "@/lib/schedule-watch-mail";

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
      const raw = await request.json();
      if (raw.protocol !== 5)
        return apiError(
          "invalid_request",
          "Upgrade the Cardstock CLI: this server requires sync protocol 5 for checklist.",
        );
      const body = syncRequestSchema.parse(raw);
      operationId = body.operationId;
      cards = body.cards.map((card) => syncColumns(card, body.groupAliases));
    } catch (error) {
      return apiError(
        "invalid_request",
        error instanceof Error ? error.message : "Invalid sync request",
      );
    }
    const { data, error } = await db.rpc("cli_apply_sync_v5", {
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
    scheduleWatchMail();
    return apiJson({ protocol: 5, operationId, ...data });
  },
);
