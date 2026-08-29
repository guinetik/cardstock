import { describe, expect, test } from "bun:test";
import { LANE_MAP_SPAN, laneMicrocosm } from "./lane-map";

const lanes = [
  {
    id: "a",
    name: "Archive",
    kind: "archive" as const,
    position: 99,
    color: null,
  },
  {
    id: "u",
    name: "Unsorted",
    kind: "inbox" as const,
    position: 0,
    color: null,
  },
  { id: "n", name: "Now", kind: "work" as const, position: 1, color: "blue" },
  {
    id: "w",
    name: "Needs Hap",
    kind: "waiting" as const,
    position: 2,
    color: null,
  },
  { id: "d", name: "Done", kind: "done" as const, position: 3, color: null },
];

describe("laneMicrocosm", () => {
  test("occupancy wraps three cards to a row", () => {
    expect(LANE_MAP_SPAN).toBe(3);
  });

  test("orders live lanes by position and drops the archive kind", () => {
    const rows = laneMicrocosm(lanes, [
      { lane_id: "n", archived_at: null, color: null, rank: 1 },
      { lane_id: "n", archived_at: null, color: null, rank: 0 },
      { lane_id: "n", archived_at: null, color: null, rank: 2 },
      { lane_id: "n", archived_at: null, color: null, rank: 3 },
      { lane_id: "u", archived_at: null, color: null, rank: 0 },
      { lane_id: "u", archived_at: null, color: null, rank: 1 },
      { lane_id: "u", archived_at: null, color: null, rank: 2 },
      { lane_id: "u", archived_at: null, color: null, rank: 3 },
      { lane_id: "u", archived_at: null, color: null, rank: 4 },
      { lane_id: "u", archived_at: null, color: null, rank: 5 },
      { lane_id: "u", archived_at: null, color: null, rank: 6 },
    ]);
    expect(rows.map((r) => r.name)).toEqual([
      "Unsorted",
      "Now",
      "Needs Hap",
      "Done",
    ]);
    expect(rows.map((r) => r.count)).toEqual([7, 4, 0, 0]);
    expect(rows[2]?.vacant).toBe(true);
    expect(rows[0]?.vacant).toBe(false);
    expect(rows.find((r) => r.id === "n")?.color).toBe("blue");
  });

  test("untinted slips follow cockpit signals; a card tint is kept in board order", () => {
    const rows = laneMicrocosm(lanes, [
      { lane_id: "n", archived_at: null, color: null, rank: 0 },
      { lane_id: "n", archived_at: null, color: "rose", rank: 1 },
      {
        lane_id: "n",
        archived_at: null,
        color: "not-a-colour",
        rank: 2,
        status: "wip",
      },
      { lane_id: "w", archived_at: null, color: null, rank: 0 },
      { lane_id: "d", archived_at: null, color: null, rank: 0 },
    ]);
    expect(rows.find((r) => r.id === "n")?.slips).toEqual([
      { color: null, signal: "queued" },
      { color: "rose", signal: "queued" },
      { color: null, signal: "moving" },
    ]);
    expect(rows.find((r) => r.id === "w")?.slips).toEqual([
      { color: null, signal: "blocked" },
    ]);
    expect(rows.find((r) => r.id === "d")?.slips).toEqual([
      { color: null, signal: "delivered" },
    ]);
  });

  test("appends an archived column after the live lanes", () => {
    const rows = laneMicrocosm(lanes, [
      { lane_id: "u", archived_at: null, color: null, rank: 0 },
      { lane_id: "u", archived_at: "2026-01-01", color: "green", rank: 2 },
      { lane_id: "n", archived_at: "2026-01-02", color: null, rank: 1 },
      { lane_id: "d", archived_at: "2026-01-03", color: "blue", rank: 0 },
    ]);
    const filed = rows.at(-1);
    expect(filed?.id).toBe("archived");
    expect(filed?.kind).toBe("archive");
    expect(filed?.count).toBe(3);
    expect(filed?.vacant).toBe(false);
    expect(filed?.slips.map((s) => s.color)).toEqual(["blue", null, "green"]);
  });

  test("omits archived when nothing is filed away", () => {
    const rows = laneMicrocosm(lanes, []);
    expect(rows.some((r) => r.kind === "archive")).toBe(false);
  });
});
