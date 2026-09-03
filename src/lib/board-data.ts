import { notFound } from "next/navigation";
import { type Person, personLabel } from "@/lib/assignee";
import { resolveBoardGates } from "@/lib/gates";
import { supabaseServer } from "@/lib/supabase/server";
import { timelineMilestones } from "@/lib/timeline";
import type { BoardData, Card, Epic, Lane, TagGroup } from "@/lib/types";

/** Everything the board page needs, in one round-trip set. RLS scopes it to the member's projects. */
export async function loadBoard(
  projectSlug: string,
  boardSlug: string,
): Promise<BoardData> {
  const db = await supabaseServer();
  const { data: project } = await db
    .from("projects")
    .select("id, slug, name, settings")
    .eq("slug", projectSlug)
    .maybeSingle();
  if (!project) notFound();
  const { data: board } = await db
    .from("boards")
    .select("id, slug, name, settings")
    .eq("project_id", project.id)
    .eq("slug", boardSlug)
    .maybeSingle();
  if (!board) notFound();

  const [
    { data: lanes },
    { data: groups },
    { data: cards },
    { data: cardTags },
    { data: moves },
    { data: epics },
    { data: memberships },
  ] = await Promise.all([
    db
      .from("lanes")
      .select("id, key, name, position, kind, sla_days, wip_limit, color")
      .eq("board_id", board.id)
      .order("position"),
    db
      .from("tag_groups")
      .select(
        "id, key, name, position, color, tags(id, key, name, color, group_id)",
      )
      .eq("board_id", board.id)
      .order("position"),
    db
      .from("cards")
      .select(
        "id, external_id, title, summary, status, epic, epic_id, area, assignee_id, assignee, raised_by, raised_on, shipped_on, needs, lane_id, rank, priority, effort, planned_start_date, target_date, target_label, audience, archived_at, archived_by, created_at, updated_at, color",
      )
      .eq("board_id", board.id)
      .order("rank"),
    db
      .from("card_tags")
      .select("card_id, tag_id, cards!inner(board_id)")
      .eq("cards.board_id", board.id),
    // Lifecycle events use several payload shapes across UI and import paths.
    db
      .from("card_events")
      .select("card_id, at, kind, payload, cards!inner(board_id)")
      .eq("cards.board_id", board.id)
      .in("kind", ["moved", "created", "imported"])
      .order("at", { ascending: false }),
    db
      .from("epics")
      .select("id, source_name, outcome")
      .eq("board_id", board.id)
      .order("source_name"),
    db
      .from("project_members")
      .select("members(id, email, display_name)")
      .eq("project_id", project.id),
  ]);

  const tagsByCard = new Map<string, string[]>();
  for (const ct of cardTags ?? []) {
    const list = tagsByCard.get(ct.card_id) ?? [];
    list.push(ct.tag_id);
    tagsByCard.set(ct.card_id, list);
  }
  const gates = resolveBoardGates(
    (board.settings ?? {}) as Record<string, unknown>,
    (lanes ?? []) as Lane[],
  );
  const { enteredAt, builtAt, deliveredAt } = timelineMilestones(
    (cards ?? []) as Pick<Card, "id" | "lane_id" | "created_at" | "status">[],
    (lanes ?? []) as Lane[],
    (moves ?? []) as unknown as Parameters<typeof timelineMilestones>[2],
    gates,
  );

  const people: Person[] = (
    (memberships ?? []) as unknown as {
      members: {
        id: string;
        email: string;
        display_name: string | null;
      } | null;
    }[]
  )
    .map((row) => row.members)
    .filter(
      (m): m is { id: string; email: string; display_name: string | null } =>
        m != null,
    )
    .map((m) => ({
      memberId: m.id,
      email: m.email,
      displayName: m.display_name,
    }))
    .sort((a, b) => personLabel(a).localeCompare(personLabel(b)));

  return {
    project: {
      ...project,
      settings: (project.settings ?? {}) as Record<string, unknown>,
    },
    board: {
      ...board,
      settings: (board.settings ?? {}) as Record<string, unknown>,
    },
    lanes: (lanes ?? []) as Lane[],
    groups: (groups ?? []) as unknown as TagGroup[],
    epics: (epics ?? []) as Pick<Epic, "id" | "source_name" | "outcome">[],
    cards: (cards ?? []).map((c) => ({
      ...c,
      tag_ids: tagsByCard.get(c.id) ?? [],
      lane_entered_at: enteredAt.get(c.id) ?? null,
      built_at: builtAt.get(c.id) ?? null,
      delivered_at: c.shipped_on ?? deliveredAt.get(c.id) ?? null,
    })) as Card[],
    people,
  };
}
