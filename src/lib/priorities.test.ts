import { describe, expect, test } from "bun:test";
import { type PriorityCard, partitionBands, rankForDrop } from "./priorities";

function card(over: Partial<PriorityCard> & { id: string }): PriorityCard {
  return {
    external_id: over.id,
    title: `Card ${over.id}`,
    epic: null,
    status: "backlog",
    effort: null,
    priority: null,
    priority_rank: null,
    lane_name: "Now",
    lane_position: 1,
    lane_rank: 1,
    board_slug: "b",
    board_name: "B",
    raised_on: null,
    target_date: null,
    target_label: null,
    assignee_label: null,
    color: null,
    signal: "active",
    overdue_days: null,
    late_days: null,
    ...over,
  };
}

describe("partitionBands", () => {
  test("splits cards into bands by priority and the rest into unweighed", () => {
    const out = partitionBands([
      card({ id: "a", priority: 1, priority_rank: 2 }),
      card({ id: "b", priority: 3, priority_rank: 1 }),
      card({ id: "c" }),
    ]);
    expect(out.bands[1].map((c) => c.id)).toEqual(["a"]);
    expect(out.bands[2]).toEqual([]);
    expect(out.bands[3].map((c) => c.id)).toEqual(["b"]);
    expect(out.unweighed.map((c) => c.id)).toEqual(["c"]);
  });

  test("orders a band by priority_rank, nulls after, then lane position and lane rank", () => {
    const out = partitionBands([
      card({ id: "later", priority: 1, lane_position: 3, lane_rank: 1 }),
      card({ id: "ranked-2", priority: 1, priority_rank: 2 }),
      card({ id: "now", priority: 1, lane_position: 1, lane_rank: 2 }),
      card({ id: "ranked-1", priority: 1, priority_rank: 1 }),
    ]);
    expect(out.bands[1].map((c) => c.id)).toEqual([
      "ranked-1",
      "ranked-2",
      "now",
      "later",
    ]);
  });

  test("orders unweighed by lane position then lane rank", () => {
    const out = partitionBands([
      card({ id: "x", lane_position: 2, lane_rank: 1 }),
      card({ id: "y", lane_position: 1, lane_rank: 2 }),
      card({ id: "z", lane_position: 1, lane_rank: 1 }),
    ]);
    expect(out.unweighed.map((c) => c.id)).toEqual(["z", "y", "x"]);
  });
});

describe("rankForDrop", () => {
  const band = [
    card({ id: "a", priority: 2, priority_rank: 1 }),
    card({ id: "b", priority: 2, priority_rank: 2 }),
  ];
  test("midpoint between two ranked neighbours", () => {
    expect(rankForDrop(band, 1)).toBe(1.5);
  });
  test("before the first card", () => {
    expect(rankForDrop(band, 0)).toBe(0);
  });
  test("after the last card", () => {
    expect(rankForDrop(band, 2)).toBe(3);
  });
  test("empty band", () => {
    expect(rankForDrop([], 0)).toBe(1);
  });
  test("a null-ranked neighbour counts as an open end", () => {
    const mixed = [
      card({ id: "a", priority: 2, priority_rank: 5 }),
      card({ id: "b", priority: 2 }),
    ];
    // Insert between ranked `a` and unranked `b`: only `a` bounds the rank.
    expect(rankForDrop(mixed, 1)).toBe(6);
  });
});
