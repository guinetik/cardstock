import "server-only";
import { loadBoard } from "./board-data";
import type { CardMove } from "./cockpit";
import { supabaseServer } from "./supabase/server";
import type { Epic, EpicSnapshot } from "./types";

/** Server-owned data for the epic cockpit; interactive charts receive only serialized rows. */
export async function loadCockpit(projectSlug: string, boardSlug: string) {
  const board = await loadBoard(projectSlug, boardSlug);
  const db = await supabaseServer();
  const [{ data: epics }, { data: snapshots }, { data: moves }] =
    await Promise.all([
      db
        .from("epics")
        .select(
          "id, board_id, source_name, outcome, owner_label, start_date, target_date, priority, confidence, created_at, updated_at",
        )
        .eq("board_id", board.board.id),
      db
        .from("epic_snapshots")
        .select(
          "epic_id, captured_on, task_count, delivered_count, total_effort, delivered_effort, remaining_effort, estimated_count",
        )
        .in(
          "epic_id",
          board.cards.flatMap((c) => (c.epic_id ? [c.epic_id] : [])),
        )
        .order("captured_on"),
      db
        .from("card_events")
        .select("card_id, at, payload, cards!inner(board_id)")
        .eq("cards.board_id", board.board.id)
        .eq("kind", "moved")
        .order("at"),
    ]);
  return {
    ...board,
    epics: (epics ?? []) as Epic[],
    snapshots: (snapshots ?? []) as EpicSnapshot[],
    moves: (moves ?? []) as unknown as CardMove[],
  };
}
