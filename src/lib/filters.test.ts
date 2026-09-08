import { describe, expect, test } from "bun:test";
import {
  ASSIGNEE_FILTER_NONE,
  boardStatuses,
  EPIC_FILTER_NONE,
  emptyFilters,
  isFiltering,
  matches,
  type SmartTag,
  sortInbox,
  toCsv,
} from "./filters";
import { resolveBoardGates } from "./gates";
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
  color: null,
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
  assignee_id: null,
  assignee: null,
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

describe("smart tag filters", () => {
  const waiting: Lane = {
    ...work,
    id: "waiting",
    kind: "waiting",
    sla_days: 3,
  };
  const lanes = [work, waiting];
  const context = {
    today: "2026-09-08",
    now: new Date("2026-09-08T12:00:00Z"),
    watchDays: 14,
    gates: resolveBoardGates(undefined, lanes),
  };
  const filter = (...tags: SmartTag[]) => ({
    ...emptyFilters(),
    smartTags: new Set(tags),
  });
  const accepts = (patch: Partial<Card>, ...tags: SmartTag[]) =>
    matches(task(patch), filter(...tags), [], lanes, context);

  test("smart tags start empty and count as active filters when selected", () => {
    expect(emptyFilters().smartTags.size).toBe(0);
    expect(isFiltering(filter())).toBe(false);
    expect(isFiltering(filter("late"))).toBe(true);
  });

  test("late matches the waiting-lane warning only after the SLA is exceeded", () => {
    const patch = {
      lane_id: "waiting",
      lane_entered_at: "2026-09-04T12:00:00Z",
    };
    expect(accepts(patch, "late")).toBe(true);
    expect(
      accepts({ ...patch, lane_entered_at: "2026-09-05T12:00:00Z" }, "late"),
    ).toBe(false);
    expect(accepts({ ...patch, lane_id: "work" }, "late")).toBe(false);
    expect(accepts({ lane_id: "waiting" }, "late")).toBe(false);
    expect(
      matches(
        task(patch),
        filter("late"),
        [],
        [{ ...waiting, sla_days: null }],
        context,
      ),
    ).toBe(false);
  });

  test("forgotten respects the project watch window and excludes planned work", () => {
    const patch = { raised_on: "2026-08-25" };
    expect(accepts(patch, "forgotten")).toBe(true);
    expect(accepts({ raised_on: "2026-08-26" }, "forgotten")).toBe(false);
    expect(
      accepts({ ...patch, target_label: "Next quarter" }, "forgotten"),
    ).toBe(false);
    expect(accepts({ ...patch, target_date: "2026-09-20" }, "forgotten")).toBe(
      false,
    );
    expect(accepts({}, "forgotten")).toBe(false);
    expect(
      matches(task(patch), filter("forgotten"), [], lanes, {
        ...context,
        watchDays: 21,
      }),
    ).toBe(false);
  });

  test("overdue uses calendar dates, including cards without a raised date", () => {
    expect(accepts({ target_date: "2026-09-07" }, "overdue")).toBe(true);
    expect(accepts({ target_date: "2026-09-08" }, "overdue")).toBe(false);
    expect(accepts({ target_date: "2026-09-09" }, "overdue")).toBe(false);
    expect(
      accepts(
        { target_date: "2026-09-07", raised_on: "2026-08-01" },
        "forgotten",
      ),
    ).toBe(false);
  });

  test("shipped cards and custom shipped gates suppress age warnings", () => {
    const patch = { target_date: "2026-09-01", raised_on: "2026-08-01" };
    expect(
      accepts({ ...patch, shipped_on: "2026-09-02" }, "overdue", "forgotten"),
    ).toBe(false);
    expect(accepts({ ...patch, status: "done" }, "overdue", "forgotten")).toBe(
      false,
    );
    expect(
      matches(task(patch), filter("overdue"), [], lanes, {
        ...context,
        gates: [
          {
            id: "delivered",
            name: "Delivered",
            statuses: [],
            lane_ids: ["work"],
            outcome: "shipped",
          },
        ],
      }),
    ).toBe(false);
  });

  test("multiple smart tags match any selected warning, including overlapping warnings", () => {
    expect(accepts({ target_date: "2026-09-01" }, "forgotten", "overdue")).toBe(
      true,
    );
    expect(accepts({ raised_on: "2026-08-01" }, "forgotten", "overdue")).toBe(
      true,
    );
    expect(accepts({}, "forgotten", "overdue")).toBe(false);
    const patch = {
      lane_id: "waiting",
      lane_entered_at: "2026-09-01T00:00:00Z",
      target_date: "2026-09-01",
    };
    expect(accepts(patch, "late")).toBe(true);
    expect(accepts(patch, "overdue")).toBe(true);
  });

  test("smart tags combine with priority, search, and visibility filters", () => {
    const f = filter("overdue");
    f.priority.add(1);
    f.query = "Task";
    f.showInternal = false;
    const patch = { priority: 1 as const, target_date: "2026-09-01" };
    expect(matches(task(patch), f, [], lanes, context)).toBe(true);
    for (const excluded of [
      { priority: 2 as const },
      { title: "Something else" },
      { audience: "internal" as const },
      { archived_at: "2026-09-01T00:00:00Z" },
    ]) {
      expect(
        matches(task({ ...patch, ...excluded }), f, [], lanes, context),
      ).toBe(false);
    }
  });
});

describe("boardStatuses", () => {
  test("internal filtering reads audience without requiring or interpreting tags", () => {
    expect(
      matches(
        task({ audience: "internal", tag_ids: [] }),
        emptyFilters(false),
        [],
        [work],
      ),
    ).toBe(false);
    expect(
      matches(
        task({ audience: "internal", tag_ids: [] }),
        emptyFilters(true),
        [],
        [work],
      ),
    ).toBe(true);
    expect(
      matches(
        task({ audience: "all", tag_ids: ["internal"] }),
        emptyFilters(false),
        [],
        [work],
      ),
    ).toBe(true);
  });
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

describe("epic filter", () => {
  const lanes = [work];
  const groups: TagGroup[] = [];

  test("emptyFilters is not filtering by epic", () => {
    const f = emptyFilters();
    expect(f.epic).toBeNull();
    expect(isFiltering(f)).toBe(false);
  });

  test("a selected epic counts as filtering", () => {
    const f = { ...emptyFilters(), epic: "epic-1" };
    expect(isFiltering(f)).toBe(true);
  });

  test("null keeps every epic", () => {
    const f = emptyFilters();
    expect(matches(task({ epic_id: "epic-1" }), f, groups, lanes)).toBe(true);
    expect(matches(task({ epic_id: null }), f, groups, lanes)).toBe(true);
  });

  test("one epic keeps only cards on that epic", () => {
    const f = { ...emptyFilters(), epic: "epic-1" };
    expect(
      matches(
        task({ epic_id: "epic-1", epic: "Onboarding" }),
        f,
        groups,
        lanes,
      ),
    ).toBe(true);
    expect(
      matches(task({ epic_id: "epic-2", epic: "Billing" }), f, groups, lanes),
    ).toBe(false);
  });

  test("unassigned keeps only cards without an epic", () => {
    const f = { ...emptyFilters(), epic: EPIC_FILTER_NONE };
    expect(matches(task({ epic_id: null, epic: null }), f, groups, lanes)).toBe(
      true,
    );
    expect(
      matches(
        task({ epic_id: "epic-1", epic: "Onboarding" }),
        f,
        groups,
        lanes,
      ),
    ).toBe(false);
    expect(
      matches(task({ epic_id: null, epic: "Legacy name" }), f, groups, lanes),
    ).toBe(false);
  });

  test("epic still combines with status", () => {
    const f = { ...emptyFilters(), epic: "epic-1", status: "wip" };
    expect(
      matches(task({ epic_id: "epic-1", status: "wip" }), f, groups, lanes),
    ).toBe(true);
    expect(
      matches(task({ epic_id: "epic-1", status: "backlog" }), f, groups, lanes),
    ).toBe(false);
  });
});

const MEMBER = "11111111-1111-4111-8111-111111111111";

test("filtering by a person keeps only their cards", () => {
  const mine = task({ assignee_id: MEMBER, assignee: "joao@example.test" });
  const theirs = task({ assignee_id: null, assignee: null });
  const f = { ...emptyFilters(), assignee: MEMBER };
  expect(matches(mine, f, [], [])).toBe(true);
  expect(matches(theirs, f, [], [])).toBe(false);
});

test("unassigned means no assignee at all", () => {
  const f = { ...emptyFilters(), assignee: ASSIGNEE_FILTER_NONE };
  expect(matches(task({ assignee_id: null, assignee: null }), f, [], [])).toBe(
    true,
  );
  expect(
    matches(
      task({ assignee_id: MEMBER, assignee: "joao@example.test" }),
      f,
      [],
      [],
    ),
  ).toBe(false);
});

test("a card whose file names an off-roster person is assigned, not unassigned", () => {
  // The FK is null because nobody matched, but somebody's name is on it.
  const stranger = task({
    assignee_id: null,
    assignee: "stranger@nowhere.test",
  });
  const none = { ...emptyFilters(), assignee: ASSIGNEE_FILTER_NONE };
  expect(matches(stranger, none, [], [])).toBe(false);
  expect(
    matches(stranger, { ...emptyFilters(), assignee: MEMBER }, [], []),
  ).toBe(false);
});

test("an assignee filter counts as filtering", () => {
  expect(isFiltering({ ...emptyFilters(), assignee: MEMBER })).toBe(true);
  expect(isFiltering(emptyFilters())).toBe(false);
});

describe("toCsv", () => {
  test("the header and the row carry assignee at the same position", () => {
    const csv = toCsv([task({ assignee: "joao@example.test" })], [work], []);
    const [head, row] = csv.split("\n");
    const headCols = head.split(",");
    const rowCols = row.split(",");
    const idx = headCols.indexOf("assignee");
    expect(idx).toBeGreaterThan(-1);
    expect(rowCols[idx]).toBe("joao@example.test");
  });
});
