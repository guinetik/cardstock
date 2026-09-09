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
    raised_on: null,
    shipped_on: null,
    target_date: null,
    target_label: null,
    assignee_id: null,
    assignee: null,
    color: null,
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
      row({ id: "shipped-date", shipped_on: "2026-09-01" }),
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

  test("carries dates, roster names, card colors, and overdue days into the planning card", () => {
    const out = assemblePriorityCards(
      boards,
      lanes,
      [
        row({
          raised_on: "2026-08-01",
          target_date: "2026-09-04",
          assignee_id: "m1",
          assignee: "ana@example.com",
          color: "blue",
        }),
      ],
      {
        now: new Date("2026-09-08T12:00:00Z"),
        people: [
          {
            memberId: "m1",
            email: "ana@example.com",
            displayName: "Ana Silva",
          },
        ],
      },
    );
    expect(out[0]).toMatchObject({
      raised_on: "2026-08-01",
      target_date: "2026-09-04",
      assignee_label: "Ana Silva",
      color: "blue",
      signal: "overdue",
      overdue_days: 4,
    });
  });

  test("respects the project's watch window, rough targets, and unknown assignees", () => {
    const out = assemblePriorityCards(
      boards,
      lanes,
      [
        row({ id: "old", raised_on: "2026-08-18" }),
        row({
          id: "recent",
          raised_on: "2026-08-25",
          assignee: "outsider@example.com",
        }),
        row({
          id: "planned",
          raised_on: "2026-08-01",
          target_label: "Next quarter",
        }),
      ],
      {
        now: new Date("2026-09-08T00:00:00Z"),
        settings: { timeline_forgotten_after_days: 21 },
      },
    );
    expect(out.map((c) => c.signal)).toEqual([
      "forgotten",
      "active",
      "planned",
    ]);
    expect(out[0].assignee_label).toBeNull();
    expect(out[1].assignee_label).toBe("outsider@example.com");
    expect(out[2].target_label).toBe("Next quarter");
  });

  test("late uses the waiting lane's limit and last move timestamp", () => {
    const waiting = { ...lanes[0], kind: "waiting" as const, sla_days: 3 };
    const out = assemblePriorityCards(boards, [waiting], [row({})], {
      now: new Date("2026-09-08T12:00:00Z"),
      enteredAt: new Map([["c1", "2026-09-04T12:00:00Z"]]),
    });
    expect(out[0].late_days).toBe(4);
    expect(
      assemblePriorityCards(boards, [waiting], [row({})])[0].late_days,
    ).toBeNull();
  });

  test("each board resolves its own shipped gates in the project view", () => {
    const customBoards = [
      {
        ...boards[0],
        settings: {
          gates: [
            {
              id: "release",
              name: "Release",
              statuses: ["built"],
              lane_ids: [],
              outcome: "shipped",
            },
          ],
        },
      },
      { id: "b2", slug: "other", name: "Other", settings: null },
    ];
    const out = assemblePriorityCards(
      customBoards,
      [...lanes, { ...lanes[0], id: "other-now", board_id: "b2" }],
      [
        row({ id: "delivered", status: "built" }),
        row({
          id: "active",
          status: "built",
          board_id: "b2",
          lane_id: "other-now",
          target_date: "2026-09-01",
        }),
      ],
      { now: new Date("2026-09-08T00:00:00Z") },
    );
    expect(out.map((c) => c.id)).toEqual(["active"]);
    expect(out[0].signal).toBe("overdue");
  });
});
