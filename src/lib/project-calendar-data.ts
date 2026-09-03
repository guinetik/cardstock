import { notFound } from "next/navigation";
import type { CalendarCard, CalendarSlip } from "./calendar";
import { resolveBoardGates } from "./gates";
import { supabaseServer } from "./supabase/server";
import type { Lane } from "./types";

/** Board identity shown on chips and slips. */
export interface ProjectCalendarBoard {
  slug: string;
  name: string;
}

/** Project calendar page payload. */
export interface ProjectCalendarData {
  project: {
    id: string;
    slug: string;
    name: string;
    settings: Record<string, unknown>;
  };
  boards: ProjectCalendarBoard[];
  slips: CalendarSlip[];
}

type BoardRow = {
  id: string;
  slug: string;
  name: string;
  settings: Record<string, unknown> | null;
};

type LaneRow = Pick<
  Lane,
  | "id"
  | "key"
  | "name"
  | "position"
  | "kind"
  | "sla_days"
  | "wip_limit"
  | "color"
> & { board_id: string };

type CardRow = CalendarCard & {
  board_id: string;
  archived_at: string | null;
};

/**
 * Attach each live card to its board name, slug, and resolved gates.
 *
 * @param boards - Project boards.
 * @param lanes - Lanes for those boards (gate matching).
 * @param cards - Cards including archived rows (those are dropped).
 */
export function assembleCalendarSlips(
  boards: readonly BoardRow[],
  lanes: readonly LaneRow[],
  cards: readonly CardRow[],
): CalendarSlip[] {
  const boardById = new Map(boards.map((board) => [board.id, board]));
  const lanesByBoard = new Map<string, LaneRow[]>();
  for (const lane of lanes) {
    const list = lanesByBoard.get(lane.board_id) ?? [];
    list.push(lane);
    lanesByBoard.set(lane.board_id, list);
  }
  const gatesByBoard = new Map(
    boards.map((board) => [
      board.id,
      resolveBoardGates(board.settings, lanesByBoard.get(board.id) ?? []),
    ]),
  );
  const slips: CalendarSlip[] = [];
  for (const card of cards) {
    if (card.archived_at) continue;
    const board = boardById.get(card.board_id);
    if (!board) continue;
    slips.push({
      card: {
        id: card.id,
        external_id: card.external_id,
        title: card.title,
        color: card.color,
        raised_on: card.raised_on,
        target_date: card.target_date,
        target_label: card.target_label,
        status: card.status,
        shipped_on: card.shipped_on,
        lane_id: card.lane_id,
        epic: card.epic,
      },
      boardSlug: board.slug,
      boardName: board.name,
      gates: gatesByBoard.get(board.id) ?? [],
    });
  }
  return slips;
}

/**
 * Every board's live cards for the project calendar. RLS scopes the read.
 *
 * @param projectSlug - Project URL slug.
 */
export async function loadProjectCalendar(
  projectSlug: string,
): Promise<ProjectCalendarData> {
  const db = await supabaseServer();
  const { data: project } = await db
    .from("projects")
    .select("id, slug, name, settings")
    .eq("slug", projectSlug)
    .maybeSingle();
  if (!project) notFound();

  const { data: boards } = await db
    .from("boards")
    .select("id, slug, name, settings")
    .eq("project_id", project.id)
    .order("name");
  const boardRows = (boards ?? []) as BoardRow[];
  const ids = boardRows.map((board) => board.id);
  if (ids.length === 0) {
    return {
      project: {
        ...project,
        settings: (project.settings ?? {}) as Record<string, unknown>,
      },
      boards: [],
      slips: [],
    };
  }

  const [{ data: lanes }, { data: cards }] = await Promise.all([
    db
      .from("lanes")
      .select(
        "id, board_id, key, name, position, kind, sla_days, wip_limit, color",
      )
      .in("board_id", ids),
    db
      .from("cards")
      .select(
        "id, board_id, external_id, title, color, raised_on, target_date, target_label, status, shipped_on, lane_id, epic, archived_at",
      )
      .in("board_id", ids),
  ]);

  return {
    project: {
      ...project,
      settings: (project.settings ?? {}) as Record<string, unknown>,
    },
    boards: boardRows.map((board) => ({ slug: board.slug, name: board.name })),
    slips: assembleCalendarSlips(
      boardRows,
      (lanes ?? []) as LaneRow[],
      (cards ?? []) as CardRow[],
    ),
  };
}
