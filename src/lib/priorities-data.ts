import { notFound } from "next/navigation";
import { gateOutcomeSets, resolveBoardGates } from "./gates";
import type { PriorityCard } from "./priorities";
import { supabaseServer } from "./supabase/server";
import type { Lane } from "./types";

/** Board identity for the project-level board chips. */
export interface PrioritiesBoard {
  slug: string;
  name: string;
}

/** Priorities page payload, board- or project-scoped. */
export interface ProjectPrioritiesData {
  project: {
    id: string;
    slug: string;
    name: string;
    settings: Record<string, unknown>;
  };
  boards: PrioritiesBoard[];
  cards: PriorityCard[];
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

type CardRow = {
  id: string;
  board_id: string;
  external_id: string;
  title: string;
  status: string;
  epic: string | null;
  effort: "L" | "M" | "H" | null;
  priority: 1 | 2 | 3 | null;
  priority_rank: number | null;
  lane_id: string | null;
  rank: number;
  archived_at: string | null;
};

/**
 * Live planning cards with lane and board fields attached. Finished work is
 * out: archived cards, archive-kind lanes, and anything a board's "shipped"
 * gate claims (the `shipped` lane is kind `work`, so gates are the
 * authority, exactly as the calendar and timeline treat delivery).
 */
export function assemblePriorityCards(
  boards: readonly BoardRow[],
  lanes: readonly LaneRow[],
  cards: readonly CardRow[],
): PriorityCard[] {
  const boardById = new Map(boards.map((board) => [board.id, board]));
  const laneById = new Map(lanes.map((lane) => [lane.id, lane]));
  const lanesByBoard = new Map<string, LaneRow[]>();
  for (const lane of lanes) {
    const list = lanesByBoard.get(lane.board_id) ?? [];
    list.push(lane);
    lanesByBoard.set(lane.board_id, list);
  }
  const shippedByBoard = new Map(
    boards.map((board) => [
      board.id,
      gateOutcomeSets(
        resolveBoardGates(
          board.settings ?? {},
          lanesByBoard.get(board.id) ?? [],
        ),
      ).shipped,
    ]),
  );
  const out: PriorityCard[] = [];
  for (const card of cards) {
    if (card.archived_at) continue;
    const board = boardById.get(card.board_id);
    const lane = card.lane_id ? laneById.get(card.lane_id) : undefined;
    if (!board || !lane) continue;
    if (lane.kind === "archive") continue;
    const shipped = shippedByBoard.get(card.board_id);
    if (shipped?.laneIds.has(lane.id) || shipped?.statuses.has(card.status))
      continue;
    out.push({
      id: card.id,
      external_id: card.external_id,
      title: card.title,
      epic: card.epic,
      status: card.status,
      effort: card.effort,
      priority: card.priority,
      priority_rank: card.priority_rank,
      lane_name: lane.name,
      lane_position: lane.position,
      lane_rank: card.rank,
      board_slug: board.slug,
      board_name: board.name,
    });
  }
  return out;
}

/**
 * Planning cards for a project, or one board of it. RLS scopes the read.
 *
 * @param projectSlug - Project URL slug.
 * @param boardSlug - When set, cards come from this board only; the boards
 *   list still spans the project so the page can link across.
 */
export async function loadProjectPriorities(
  projectSlug: string,
  boardSlug?: string,
): Promise<ProjectPrioritiesData> {
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
  const scope = boardSlug
    ? boardRows.filter((board) => board.slug === boardSlug)
    : boardRows;
  if (boardSlug && scope.length === 0) notFound();
  const ids = scope.map((board) => board.id);

  const projectShape = {
    ...project,
    settings: (project.settings ?? {}) as Record<string, unknown>,
  };
  const boardsShape = boardRows.map((board) => ({
    slug: board.slug,
    name: board.name,
  }));
  if (ids.length === 0)
    return { project: projectShape, boards: boardsShape, cards: [] };

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
        "id, board_id, external_id, title, status, epic, effort, priority, priority_rank, lane_id, rank, archived_at",
      )
      .in("board_id", ids),
  ]);

  return {
    project: projectShape,
    boards: boardsShape,
    cards: assemblePriorityCards(
      scope,
      (lanes ?? []) as LaneRow[],
      (cards ?? []) as CardRow[],
    ),
  };
}
