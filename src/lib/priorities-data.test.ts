import { describe, expect, test } from "bun:test";
import { assemblePriorityCards } from "./priorities-data";

const boards = [{ id: "b1", slug: "dev", name: "Dev", settings: null }];
const lanes = [
  {
    id: "l-now",
    board_id: "b1",
    key: "now",
    name: "Now",
    position: 1,
    kind: "work" as const,
    sla_days: null,
    wip_limit: null,
    color: null,
  },
  {
    id: "l-done",
    board_id: "b1",
    key: "done",
    name: "Done",
    position: 8,
    kind: "done" as const,
    sla_days: null,
    wip_limit: null,
    color: null,
  },
  {
    id: "l-arch",
    board_id: "b1",
    key: "archive",
    name: "Archive",
    position: 9,
    kind: "archive" as const,
    sla_days: null,
    wip_limit: null,
    color: null,
  },
];

function row(over: Record<string, unknown>) {
  return {
    id: "c1",
    board_id: "b1",
    external_id: "1",
    title: "A card",
    status: "backlog",
    epic: null,
    effort: null,
    priority: null,
    priority_rank: null,
    lane_id: "l-now",
    rank: 1,
    archived_at: null,
    ...over,
  };
}

describe("assemblePriorityCards", () => {
  test("keeps a live work-lane card and attaches lane and board fields", () => {
    const out = assemblePriorityCards(boards, lanes, [row({})]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      lane_name: "Now",
      lane_position: 1,
      lane_rank: 1,
      board_slug: "dev",
      board_name: "Dev",
    });
  });

  test("drops archived cards, archive-kind lanes, and shipped-gate hits", () => {
    const out = assemblePriorityCards(boards, lanes, [
      row({ id: "a", archived_at: "2026-09-01T00:00:00Z" }),
      row({ id: "b", lane_id: "l-arch" }),
      row({ id: "c", lane_id: "l-done" }), // default shipped gate: done-kind lane
      row({ id: "d", status: "shipped" }), // default shipped gate: status
      row({ id: "e", status: "done" }), // default shipped gate: status
      row({ id: "f" }),
    ]);
    expect(out.map((c) => c.id)).toEqual(["f"]);
  });

  test("drops a card whose board or lane is unknown", () => {
    const out = assemblePriorityCards(boards, lanes, [
      row({ id: "a", board_id: "nope" }),
      row({ id: "b", lane_id: null }),
    ]);
    expect(out).toEqual([]);
  });
});
