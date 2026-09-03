import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import type { LaneKind } from "@/lib/types";

/** A lane the gates editor can tick, in board order. */
export interface BoardManageLane {
  id: string;
  name: string;
  kind: LaneKind;
  position: number;
}

/** A concept (tag group) and the tags a card can carry. */
export interface BoardManageGroup {
  id: string;
  key: string;
  name: string;
  position: number;
  tags: { id: string; key: string; name: string }[] | null;
}

/** One board's identity, lanes, and taxonomy for the manage page. */
export interface BoardManageData {
  project: { id: string; slug: string; name: string };
  board: {
    id: string;
    slug: string;
    name: string;
    settings: Record<string, unknown> | null;
  };
  lanes: BoardManageLane[];
  groups: BoardManageGroup[];
}

interface BoardRow {
  id: string;
  slug: string;
  name: string;
  settings: Record<string, unknown> | null;
  lanes: BoardManageLane[] | null;
}

/**
 * Project, board, lanes, and tag groups for `/p/[project]/b/[board]/manage`.
 * Cards stay off this round-trip — vocabulary does not need the tracker.
 */
export async function loadBoardManage(
  projectSlug: string,
  boardSlug: string,
): Promise<BoardManageData> {
  const db = await supabaseServer();
  const { data: project } = await db
    .from("projects")
    .select("id, slug, name")
    .eq("slug", projectSlug)
    .maybeSingle();
  if (!project) notFound();

  const { data } = await db
    .from("boards")
    .select("id, slug, name, settings, lanes(id, name, kind, position)")
    .eq("project_id", project.id)
    .eq("slug", boardSlug)
    .maybeSingle();
  const board = data as BoardRow | null;
  if (!board) notFound();

  const { data: groups } = await db
    .from("tag_groups")
    .select("id, key, name, position, tags(id, key, name)")
    .eq("board_id", board.id)
    .order("position");

  return {
    project,
    board: {
      id: board.id,
      slug: board.slug,
      name: board.name,
      settings: board.settings,
    },
    lanes: [...(board.lanes ?? [])].sort((a, b) => a.position - b.position),
    groups: (groups ?? []) as BoardManageGroup[],
  };
}
