import { beforeAll, describe, expect, test } from "bun:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { applyPlan } from "./apply";
import { loadBoardState } from "./board-state";
import { planImport } from "./plan";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const local = !!url && !!key && /127\.0\.0\.1|localhost/.test(url);

describe.skipIf(!local)("applyPlan against the local database", () => {
  // Built in `beforeAll`, not at collection time: a bare `bun test` without
  // `.env.local` must skip this file, not throw before a test has run.
  let db: SupabaseClient;
  beforeAll(() => {
    db = createClient(url!, key!, { auth: { persistSession: false } });
  });
  const sheet = (id: number, fm: string, body = "## Ask\n\nHi.") => ({
    name: `${id}.md`,
    text: `---\nid: ${id}\ntitle: Card ${id}\nstatus: backlog\nepic: Apply\narea: A\n${fm}\n---\n# #${id} — Card ${id}\n\n${body}\n`,
  });

  async function demoBoard() {
    const { data } = await db
      .from("boards")
      .select("id, projects!inner(slug)")
      .eq("slug", "backlog")
      .eq("projects.slug", "demo")
      .single();
    return data!.id as string;
  }

  test("creates lanes, groups, tags and cards; never deletes; second run is unchanged", async () => {
    const boardId = await demoBoard();
    await db
      .from("cards")
      .delete()
      .eq("board_id", boardId)
      .in("external_id", ["9001", "9002"]);
    const files = [
      sheet(
        9001,
        "lane: gate-9\ntags:\n  - kind:bug\n  - zone:north\npriority: 2",
      ),
      sheet(9002, ""),
    ];
    let state = await loadBoardState(db, boardId);
    let plan = planImport(files, state);
    expect(plan.ok).toBe(true);
    const r = await applyPlan(db, state, plan, "test@example.test");
    expect(r).toMatchObject({ created: 2, updated: 0 });

    state = await loadBoardState(db, boardId);
    expect(
      state.lanes.some((l) => l.key === "gate-9" && l.kind === "work"),
    ).toBe(true);
    const done = state.lanes.find((l) => l.kind === "done")!;
    const gate = state.lanes.find((l) => l.key === "gate-9")!;
    expect(gate.position).toBeLessThan(done.position);
    expect(
      state.groups.some(
        (g) => g.key === "zone" && g.tags.some((t) => t.key === "north"),
      ),
    ).toBe(true);
    const c = state.cards.get("9001")!;
    expect(c.lane_id).toBe(gate.id);
    expect(c.priority).toBe(2);
    expect(c.tag_ids).toHaveLength(2);

    plan = planImport(files, state);
    expect(plan.counts).toMatchObject({ unchanged: 2, changed: 0, new: 0 });

    // the sheet wins, and what it does not say stays
    await db.from("cards").update({ effort: "H" }).eq("id", c.id);
    state = await loadBoardState(db, boardId);
    plan = planImport(
      [
        sheet(
          9001,
          "lane: gate-9\ntags:\n  - kind:bug\n  - zone:north\npriority: 1",
        ),
      ],
      state,
    );
    await applyPlan(db, state, plan, "test@example.test");
    state = await loadBoardState(db, boardId);
    expect(state.cards.get("9001")).toMatchObject({ priority: 1, effort: "H" });
    expect(state.cards.get("9002")).toBeDefined();

    const { data: events } = await db
      .from("card_events")
      .select("kind, actor")
      .eq("card_id", c.id)
      .order("at");
    expect(events!.map((e) => e.kind)).toEqual(["created", "imported"]);
    expect(events![0].actor).toBe("test@example.test");
  });
});
