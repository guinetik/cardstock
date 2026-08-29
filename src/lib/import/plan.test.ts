import { describe, expect, test } from "bun:test";
import { planImport } from "./plan";
import type { BoardState, ExistingCard } from "./types";

const sheet = (id: number, fm: string, body = "## Ask\n\nHi.") => ({
  name: `${id}.md`,
  text: `---\nid: ${id}\ntitle: Card ${id}\nstatus: backlog\nepic: E\narea: A\n${fm}\n---\n# #${id} — Card ${id}\n\n${body}\n`,
});

function state(cards: Partial<ExistingCard>[] = []): BoardState {
  const base: ExistingCard = {
    id: "c",
    external_id: "1",
    title: "Card 1",
    status: "backlog",
    epic: "E",
    area: "A",
    raised_by: null,
    raised_on: null,
    shipped_on: null,
    needs: null,
    summary: "Hi.",
    body_md: "## Ask\n\nHi.",
    lane_id: "L-unsorted",
    rank: 1,
    priority: null,
    effort: null,
    planned_start_date: null,
    target_date: null,
    target_label: null,
    archived_at: null,
    archived_by: null,
    color: null,
    source_hash: null,
    frontmatter_extra: {},
    tag_ids: [],
    relates: [],
  };
  return {
    id: "b",
    lanes: [
      {
        id: "L-unsorted",
        key: "unsorted",
        name: "Unsorted",
        kind: "inbox",
        position: 0,
      },
      { id: "L-now", key: "now", name: "Now", kind: "work", position: 1 },
      { id: "L-done", key: "done", name: "Done", kind: "done", position: 2 },
    ],
    groups: [
      {
        id: "G-kind",
        key: "kind",
        name: "Kind",
        position: 0,
        color: null,
        tags: [{ id: "T-bug", key: "bug", name: "Bug" }],
      },
    ],
    cards: new Map(
      cards.map((c) => [
        String(c.external_id ?? base.external_id),
        { ...base, ...c },
      ]),
    ),
    epics: new Map([["E", "epic-1"]]),
  };
}

describe("planImport", () => {
  test("a new card lands in the lane it names, or the inbox", () => {
    const plan = planImport(
      [sheet(5, "lane: now\nrank: 3"), sheet(6, "")],
      state(),
    );
    expect(plan.rows.map((r) => r.verdict)).toEqual(["new", "new"]);
    expect(plan.rows[0]).toMatchObject({
      lane: "now",
      patch: { laneKey: "now", rank: 3 },
    });
    expect(plan.rows[1]).toMatchObject({
      lane: "unsorted",
      patch: { rank: undefined },
    });
    expect(plan.counts).toEqual({ new: 2, changed: 0, unchanged: 0, error: 0 });
  });
  test("an existing card with the same hash is unchanged", () => {
    const f = sheet(1, "");
    const hash = new Bun.CryptoHasher("sha256").update(f.text).digest("hex");
    const plan = planImport([f], state([{ source_hash: hash }]));
    expect(plan.rows[0].verdict).toBe("unchanged");
  });
  test("the sheet wins; a key it does not state is left alone", () => {
    const plan = planImport(
      [sheet(1, "priority: 1")],
      state([{ effort: "M" }]),
    );
    const row = plan.rows[0];
    expect(row.verdict).toBe("changed");
    if (row.verdict !== "changed") throw new Error();
    expect(row.changes).toEqual([{ key: "priority", from: null, to: "1" }]);
    expect(row.patch.columns).toMatchObject({ priority: 1 });
    expect("effort" in row.patch.columns).toBe(false);
  });
  test("a changed body clears body_edited_at", () => {
    const plan = planImport([sheet(1, "", "## Ask\n\nChanged.")], state([{}]));
    const row = plan.rows[0];
    if (row.verdict !== "changed") throw new Error(row.verdict);
    expect(row.patch.columns).toMatchObject({
      body_md: "## Ask\n\nChanged.",
      body_edited_at: null,
    });
  });
  test("unknown lanes, groups and tags are listed to create; bare unknown tags are not applied", () => {
    const plan = planImport(
      [
        sheet(
          9,
          "lane: gate-1\ntags:\n  - kind:bug\n  - step:filter\n  - mystery",
        ),
      ],
      state(),
    );
    expect(plan.newLanes).toEqual([{ key: "gate-1", name: "Gate 1" }]);
    expect(plan.newGroups).toEqual([{ key: "step", name: "Step" }]);
    expect(plan.newTags).toEqual([
      { groupKey: "step", key: "filter", name: "Filter" },
    ]);
    expect(plan.unappliedTags).toEqual([{ tag: "mystery", cards: ["9"] }]);
  });
  test("one bad file blocks the plan", () => {
    const bad = { name: "4.md", text: "---\nid: 4\ntitle: x\n---\n" };
    const plan = planImport([bad, sheet(5, "")], state());
    expect(plan.ok).toBe(false);
    expect(plan.rows[0]).toMatchObject({ verdict: "error", id: "4" });
    expect(
      plan.rows[0].verdict === "error" && /status/.test(plan.rows[0].message),
    ).toBe(true);
  });
  test("an id that does not match its filename is an error", () => {
    const plan = planImport(
      [{ name: "4.md", text: sheet(5, "").text }],
      state(),
    );
    expect(plan.rows[0]).toMatchObject({
      verdict: "error",
      message: expect.stringMatching(/filename/),
    });
  });
});
