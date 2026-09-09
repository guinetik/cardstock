import { notFound } from "next/navigation";
import { findPerson, type Person, personLabel } from "./assignee";
import { loadProjectRoster } from "./board-data";
import { parseCardColor } from "./card-color";
import { daysInLane, isLateInLane } from "./filters";
import { cardGate, resolveBoardGates } from "./gates";
import type { PriorityCard } from "./priorities";
import { supabaseServer } from "./supabase/server";
import {
  daysSince,
  forgottenAfterDays,
  timelineSignal,
  timelineToday,
} from "./timeline";
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
  raised_on: string | null;
  shipped_on: string | null;
  target_date: string | null;
  target_label: string | null;
  assignee_id: string | null;
  assignee: string | null;
  color: string | null;
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
  context: {
    settings?: Record<string, unknown>;
    people?: readonly Person[];
    enteredAt?: ReadonlyMap<string, string>;
    now?: Date;
  } = {},
): PriorityCard[] {
  const now = context.now ?? new Date();
  const today = timelineToday(now);
  const watchDays = forgottenAfterDays(context.settings);
  const boardById = new Map(boards.map((board) => [board.id, board]));
  const laneById = new Map(lanes.map((lane) => [lane.id, lane]));
  const lanesByBoard = new Map<string, LaneRow[]>();
  for (const lane of lanes) {
    const list = lanesByBoard.get(lane.board_id) ?? [];
    list.push(lane);
    lanesByBoard.set(lane.board_id, list);
  }
  const gatesByBoard = new Map(
    boards.map((board) => [
      board.id,
      resolveBoardGates(board.settings ?? {}, lanesByBoard.get(board.id) ?? []),
    ]),
  );
  const out: PriorityCard[] = [];
  for (const card of cards) {
    if (card.archived_at) continue;
    const board = boardById.get(card.board_id);
    const lane = card.lane_id ? laneById.get(card.lane_id) : undefined;
    if (!board || !lane) continue;
    if (lane.kind === "archive") continue;
    const signal = timelineSignal(
      card,
      today,
      watchDays,
      cardGate(card, gatesByBoard.get(card.board_id) ?? []),
    );
    if (signal === "delivered") continue;
    const person =
      context.people?.find((p) => p.memberId === card.assignee_id) ??
      findPerson(context.people ?? [], card.assignee);
    const timing = { lane_entered_at: context.enteredAt?.get(card.id) ?? null };
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
      raised_on: card.raised_on,
      target_date: card.target_date,
      target_label: card.target_label,
      assignee_label: person
        ? personLabel(person)
        : card.assignee?.trim() || null,
      color: parseCardColor(card.color),
      signal,
      overdue_days:
        signal === "overdue" && card.target_date
          ? daysSince(card.target_date, today)
          : null,
      late_days: isLateInLane(timing, lane, now)
        ? daysInLane(timing, now)
        : null,
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

  const [{ data: lanes }, { data: cards }, people, { data: moves }] =
    await Promise.all([
      db
        .from("lanes")
        .select(
          "id, board_id, key, name, position, kind, sla_days, wip_limit, color",
        )
        .in("board_id", ids),
      db
        .from("cards")
        .select(
          "id, board_id, external_id, title, status, epic, effort, priority, priority_rank, lane_id, rank, archived_at, raised_on, shipped_on, target_date, target_label, assignee_id, assignee, color",
        )
        .in("board_id", ids),
      loadProjectRoster(db, project.id),
      db
        .from("card_events")
        .select("card_id, at, cards!inner(board_id)")
        .in("cards.board_id", ids)
        .eq("kind", "moved")
        .order("at", { ascending: false }),
    ]);

  const enteredAt = new Map<string, string>();
  for (const move of moves ?? []) {
    if (!enteredAt.has(move.card_id)) enteredAt.set(move.card_id, move.at);
  }

  return {
    project: projectShape,
    boards: boardsShape,
    cards: assemblePriorityCards(
      scope,
      (lanes ?? []) as LaneRow[],
      (cards ?? []) as CardRow[],
      { settings: projectShape.settings, people, enteredAt },
    ),
  };
}
