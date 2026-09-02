import { describe, expect, test } from "bun:test";
import { assembleCalendarSlips } from "./project-calendar-data";

const board = {
  id: "b1",
  slug: "backlog",
  name: "Product backlog",
  settings: {} as Record<string, unknown>,
};

const lane = {
  id: "l1",
  board_id: "b1",
  key: "now",
  name: "Now",
  position: 0,
  kind: "work" as const,
  sla_days: null,
  wip_limit: null,
  color: null,
};

const card = {
  id: "c1",
  board_id: "b1",
  external_id: "7",
  title: "Auth",
  color: null,
  raised_on: "2026-08-01",
  target_date: "2026-09-15",
  target_label: null,
  status: "backlog",
  shipped_on: null,
  lane_id: "l1",
  archived_at: null,
};

describe("assembleCalendarSlips", () => {
  test("tags a live card with its board and skips archived", () => {
    const slips = assembleCalendarSlips(
      [board, { ...board, id: "b2", slug: "ops", name: "Ops" }],
      [lane],
      [
        card,
        { ...card, id: "c2", archived_at: "2026-09-01T00:00:00Z" },
        {
          ...card,
          id: "c3",
          board_id: "b2",
          external_id: "8",
          title: "Ops job",
        },
      ],
    );
    expect(slips.map((s) => s.card.id)).toEqual(["c1", "c3"]);
    expect(slips[0]?.boardSlug).toBe("backlog");
    expect(slips[1]?.boardName).toBe("Ops");
    expect(Array.isArray(slips[0]?.gates)).toBe(true);
  });
});
