/**
 * File the plan. Creates what is new first (lanes, groups, tags), then
 * writes cards in file order, then links. Never deletes anything.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BoardState, Plan } from "./types";

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`${what}: ${error?.message ?? "unknown error"}`);
}

export async function applyPlan(
  db: SupabaseClient,
  state: BoardState,
  plan: Plan,
  actor: string,
): Promise<{ created: number; updated: number }> {
  if (!plan.ok)
    throw new Error("The plan has errors; fix the files and try again.");
  const boardId = state.id;

  // Lanes: `create_work_lane` positions a new work lane before the first done/archive lane in one transaction.
  const laneId = new Map(state.lanes.map((l) => [l.key, l.id]));
  for (const l of plan.newLanes) {
    const { data, error } = await db.rpc("create_work_lane", {
      p_board_id: boardId,
      p_key: l.key,
      p_name: l.name,
    });
    if (error || !data) fail(`lane ${l.key}`, error);
    laneId.set(l.key, (data as { id: string }).id);
  }

  // Groups and tags.
  const groupId = new Map(state.groups.map((g) => [g.key, g.id]));
  let nextGroupPos = state.groups.reduce(
    (m, g) => Math.max(m, g.position + 1),
    0,
  );
  for (const g of plan.newGroups) {
    const { data, error } = await db
      .from("tag_groups")
      .insert({
        board_id: boardId,
        key: g.key,
        name: g.name,
        position: nextGroupPos++,
      })
      .select("id")
      .single();
    if (error || !data) fail(`tag group ${g.key}`, error);
    groupId.set(g.key, data.id);
  }
  const tagId = new Map<string, string>();
  for (const g of state.groups)
    for (const t of g.tags) tagId.set(`${g.key}:${t.key}`, t.id);
  for (const t of plan.newTags) {
    const gid = groupId.get(t.groupKey);
    if (!gid) throw new Error(`tag group ${t.groupKey} was not created`);
    const { data, error } = await db
      .from("tags")
      .insert({ group_id: gid, key: t.key, name: t.name })
      .select("id")
      .single();
    if (error || !data) fail(`tag ${t.groupKey}:${t.key}`, error);
    tagId.set(`${t.groupKey}:${t.key}`, data.id);
  }

  // Epics are upserted by source name as they appear.
  const epicId = new Map(state.epics);
  async function epic(name: string): Promise<string> {
    const known = epicId.get(name);
    if (known) return known;
    const { data, error } = await db
      .from("epics")
      .upsert(
        { board_id: boardId, source_name: name },
        { onConflict: "board_id,source_name" },
      )
      .select("id")
      .single();
    if (error || !data) fail(`epic ${name}`, error);
    epicId.set(name, data.id);
    return data.id;
  }

  // Rank: append after the last card in the lane when the file gives none.
  const maxRank = new Map<string, number>();
  for (const c of state.cards.values())
    if (c.lane_id)
      maxRank.set(c.lane_id, Math.max(maxRank.get(c.lane_id) ?? 0, c.rank));
  const nextRank = (lane: string) => {
    const r = (maxRank.get(lane) ?? 0) + 1;
    maxRank.set(lane, r);
    return r;
  };

  let created = 0;
  let updated = 0;
  const idByExternal = new Map<string, string>();
  for (const c of state.cards.values()) idByExternal.set(c.external_id, c.id);
  const pendingLinks: { from: string; relates: number[] }[] = [];

  for (const row of plan.rows) {
    if (row.verdict === "unchanged" || row.verdict === "error") continue;
    const prev = state.cards.get(row.id);
    const columns: Record<string, unknown> = {
      board_id: boardId,
      ...row.patch.columns,
    };
    if (row.patch.epic !== undefined)
      columns.epic_id = await epic(row.patch.epic);
    if (row.patch.laneKey) {
      const lid = laneId.get(row.patch.laneKey);
      if (!lid) throw new Error(`lane ${row.patch.laneKey} was not created`);
      columns.lane_id = lid;
      columns.rank = row.patch.rank ?? nextRank(lid);
    } else if (row.patch.rank !== undefined && prev?.lane_id)
      columns.rank = row.patch.rank;

    // A partial patch only carries the changed columns, so an existing card
    // is updated by id rather than upserted: an insert-shaped upsert must
    // satisfy every NOT NULL column (e.g. title) before Postgres even looks
    // at the conflict, which a changed-priority-only patch would violate.
    const { data, error } = prev
      ? await db
          .from("cards")
          .update(columns)
          .eq("id", prev.id)
          .select("id")
          .single()
      : await db
          .from("cards")
          .upsert(columns, { onConflict: "board_id,external_id" })
          .select("id")
          .single();
    if (error || !data) fail(`#${row.id}`, error);
    idByExternal.set(row.id, data.id);

    if (row.patch.tagRefs !== undefined) {
      const { error: de } = await db
        .from("card_tags")
        .delete()
        .eq("card_id", data.id);
      if (de) fail(`#${row.id} tags`, de);
      const ids = row.patch.tagRefs
        .map((r) => tagId.get(r))
        .filter((x): x is string => !!x);
      if (ids.length) {
        const { error: ie } = await db
          .from("card_tags")
          .insert(ids.map((tag_id) => ({ card_id: data.id, tag_id })));
        if (ie) fail(`#${row.id} tags`, ie);
      }
    }
    if (row.patch.relates !== undefined)
      pendingLinks.push({ from: data.id, relates: row.patch.relates });

    const { error: ee } = await db.from("card_events").insert({
      card_id: data.id,
      actor,
      kind: prev ? "imported" : "created",
      payload: { source: `${row.id}.md`, hash: row.hash, changes: row.changes },
    });
    if (ee) fail(`#${row.id} event`, ee);
    prev ? updated++ : created++;
  }

  for (const { from, relates } of pendingLinks) {
    const { error: de } = await db
      .from("card_links")
      .delete()
      .eq("from_card", from)
      .eq("kind", "relates");
    if (de) fail("links", de);
    const rows = relates
      .map((n) => idByExternal.get(String(n)))
      .filter((x): x is string => !!x)
      .map((to_card) => ({ from_card: from, to_card, kind: "relates" }));
    if (rows.length) {
      const { error: ie } = await db.from("card_links").insert(rows);
      if (ie) fail("links", ie);
    }
  }
  return { created, updated };
}
