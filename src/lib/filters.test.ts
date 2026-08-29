import { describe, expect, test } from "bun:test";
import {
  boardStatuses,
  emptyFilters,
  isFiltering,
  matches,
  sortInbox,
} from "./filters";
import type { Card, Lane, TagGroup } from "./types";

/** Only the fields sortInbox reads. */
const card = (external_id: string, raised_on: string | null) =>
  ({ external_id, raised_on }) as Card;

describe("sortInbox", () => {
  const cards = [
    card("10", "2026-08-01"),
    card("2", "2026-08-20"),
    card("33", "2026-08-01"),
    card("7", null),
  ];
  const ids = (list: Card[]) => list.map((c) => c.external_id);

  test("newest first, ties broken by descending id", () => {
    expect(ids(sortInbox(cards, "newest"))).toEqual(["2", "33", "10", "7"]);
  });

  test("oldest first, ties broken by ascending id", () => {
    expect(ids(sortInbox(cards, "oldest"))).toEqual(["10", "33", "2", "7"]);
  });

  test("cards with no raised date sort last either way", () => {
    expect(ids(sortInbox(cards, "newest")).at(-1)).toBe("7");
    expect(ids(sortInbox(cards, "oldest")).at(-1)).toBe("7");
  });

  test("id ascending is numeric, not lexicographic", () => {
    expect(ids(sortInbox(cards, "id-asc"))).toEqual(["2", "7", "10", "33"]);
  });

  test("id descending is numeric, not lexicographic", () => {
    expect(ids(sortInbox(cards, "id-desc"))).toEqual(["33", "10", "7", "2"]);
  });

  test("id order ignores the raised date entirely", () => {
    // "7" has no raised date; it must still sort by its number, not sink.
    expect(ids(sortInbox(cards, "id-asc"))[1]).toBe("7");
  });

  test("does not mutate the array it is given", () => {
    const original = [...cards];
    sortInbox(cards, "id-desc");
    expect(cards).toEqual(original);
  });
});

const work: Lane = {
  id: "work",
  key: "work",
  name: "Now",
  kind: "work",
  position: 0,
  sla_days: null,
  wip_limit: null,
};

const task = (patch: Partial<Card> = {}): Card => ({
  id: "c1",
  external_id: "1",
  title: "Task",
  summary: null,
  status: "backlog",
  epic: null,
  epic_id: null,
  area: null,
  raised_by: null,
  raised_on: null,
  shipped_on: null,
  needs: null,
  lane_id: "work",
  rank: 1,
  priority: null,
  effort: null,
  planned_start_date: null,
  target_date: null,
  target_label: null,
  audience: "all",
  archived_at: null,
  archived_by: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  tag_ids: [],
  lane_entered_at: null,
  color: null,
  ...patch,
});

describe("boardStatuses", () => {
  test("unique, sorted, blanks dropped, order independent of input", () => {
    expect(
      boardStatuses([
        { status: "wip" },
        { status: "  " },
        { status: "backlog" },
        { status: "wip" },
        { status: null },
        { status: " blocked " },
        {},
      ]),
    ).toEqual(["backlog", "blocked", "wip"]);
  });
});

describe("status filter", () => {
  const lanes = [work];
  const groups: TagGroup[] = [];

  test("emptyFilters is not filtering and has no status", () => {
    const f = emptyFilters();
    expect(f.status).toBeNull();
    expect(isFiltering(f)).toBe(false);
  });

  test("a selected status counts as filtering", () => {
    const f = emptyFilters();
    f.status = "wip";
    expect(isFiltering(f)).toBe(true);
  });

  test("null keeps every status", () => {
    const f = emptyFilters();
    expect(matches(task({ status: "wip" }), f, groups, lanes)).toBe(true);
    expect(matches(task({ status: "backlog" }), f, groups, lanes)).toBe(true);
  });

  test("one status keeps only that value", () => {
    const f = { ...emptyFilters(), status: "wip" };
    expect(matches(task({ status: "wip" }), f, groups, lanes)).toBe(true);
    expect(matches(task({ status: "blocked" }), f, groups, lanes)).toBe(false);
  });

  test("picking a second status replaces the first", () => {
    const f = { ...emptyFilters(), status: "blocked" };
    expect(matches(task({ status: "wip" }), f, groups, lanes)).toBe(false);
    expect(matches(task({ status: "blocked" }), f, groups, lanes)).toBe(true);
  });

  test("status still combines with priority", () => {
    const f = { ...emptyFilters(), status: "wip" };
    f.priority.add(1);
    expect(
      matches(task({ status: "wip", priority: 1 }), f, groups, lanes),
    ).toBe(true);
    expect(
      matches(task({ status: "wip", priority: 2 }), f, groups, lanes),
    ).toBe(false);
    expect(
      matches(task({ status: "backlog", priority: 1 }), f, groups, lanes),
    ).toBe(false);
  });
});
