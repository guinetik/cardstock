import { expect, test } from "bun:test";
import { sortTableCards, type TableColumn } from "./card-table";
import type { Card, Lane } from "./types";

const cards = [
  {
    id: "a",
    external_id: "10",
    lane_id: "later",
    rank: 1,
    priority: null,
    effort: "H",
    target_date: null,
    assignee: "zoe@example.test",
  },
  {
    id: "b",
    external_id: "2",
    lane_id: "now",
    rank: 2,
    priority: 2,
    effort: "L",
    target_date: "2026-09-10",
    assignee: "amy@example.test",
  },
  {
    id: "c",
    external_id: "3",
    lane_id: "now",
    rank: 1,
    priority: 1,
    effort: "M",
    target_date: "2026-09-08",
    assignee: null,
  },
] as Card[];
const lanes = [
  { id: "now", position: 1 },
  { id: "later", position: 2 },
] as Lane[];
const people = [
  { memberId: "amy", email: "amy@example.test", displayName: "Zelda" },
  { memberId: "zoe", email: "zoe@example.test", displayName: "Amy" },
];
function ids(column: TableColumn, direction: "asc" | "desc" = "asc") {
  return sortTableCards(cards, lanes, people, { column, direction }).map(
    (c) => c.external_id,
  );
}
test("ids sort numerically; lane order follows board positions and shared rank", () => {
  expect(ids("external_id")).toEqual(["2", "3", "10"]);
  expect(ids("lane")).toEqual(["3", "2", "10"]);
  expect(ids("lane", "desc")).toEqual(["10", "3", "2"]);
});
test("effort uses low-to-high order; priority and dates keep missing values last both ways", () => {
  expect(ids("effort")).toEqual(["2", "3", "10"]);
  for (const column of ["priority", "target_date"] as const) {
    expect(ids(column)).toEqual(["3", "2", "10"]);
    expect(ids(column, "desc")).toEqual(["2", "3", "10"]);
  }
});
test("assignees sort by their visible roster names, with unassigned last", () => {
  expect(ids("assignee")).toEqual(["10", "2", "3"]);
  expect(ids("assignee", "desc")).toEqual(["2", "10", "3"]);
});
test("sorting never mutates source cards or their ranks", () => {
  const before = structuredClone(cards);
  ids("lane");
  ids("priority", "desc");
  expect(cards).toEqual(before);
});
