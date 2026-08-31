import { describe, expect, test } from "bun:test";
import { type BoardGate, resolveBoardGates } from "./gates";
import {
  addTimelineDays,
  DEFAULT_BUILT_STATUSES,
  DEFAULT_FORGOTTEN_AFTER_DAYS,
  DEFAULT_SHIPPED_STATUSES,
  DEFAULT_TIMELINE_WINDOW_DAYS,
  daysSince,
  forgottenAfterDays,
  isInTimelineWindow,
  timelineDiagnosticLine,
  timelineMilestones,
  timelineOutcomeStatuses,
  timelineSignal,
  timelineWindowDays,
} from "./timeline";

const card = (
  patch: Partial<{
    raised_on: string | null;
    shipped_on: string | null;
    status: string;
    target_date: string | null;
    target_label: string | null;
  }> = {},
) => ({
  raised_on: "2026-08-01",
  shipped_on: null,
  status: "backlog",
  target_date: null,
  target_label: null,
  ...patch,
});

describe("forgottenAfterDays", () => {
  test("defaults to two weeks and accepts a valid project override", () => {
    expect(forgottenAfterDays({})).toBe(DEFAULT_FORGOTTEN_AFTER_DAYS);
    expect(forgottenAfterDays({ timeline_forgotten_after_days: 21 })).toBe(21);
  });

  test("rejects invalid settings", () => {
    expect(forgottenAfterDays({ timeline_forgotten_after_days: "14" })).toBe(
      DEFAULT_FORGOTTEN_AFTER_DAYS,
    );
    expect(forgottenAfterDays({ timeline_forgotten_after_days: 0 })).toBe(
      DEFAULT_FORGOTTEN_AFTER_DAYS,
    );
    expect(forgottenAfterDays({ timeline_forgotten_after_days: 366 })).toBe(
      DEFAULT_FORGOTTEN_AFTER_DAYS,
    );
  });
});

describe("timelineSignal", () => {
  const today = "2026-08-31";

  test("marks unplanned work at the watch boundary as forgotten", () => {
    expect(
      timelineSignal(card({ raised_on: "2026-08-17" }), today, 14, null),
    ).toBe("forgotten");
    expect(
      timelineSignal(card({ raised_on: "2026-08-18" }), today, 14, null),
    ).toBe("active");
  });

  test("does not call rough or calendar-planned work forgotten", () => {
    expect(
      timelineSignal(card({ target_label: "September" }), today, 14, null),
    ).toBe("planned");
    expect(
      timelineSignal(card({ target_date: "2026-09-15" }), today, 14, null),
    ).toBe("planned");
  });

  test("uses delivered and overdue before the forgotten rule", () => {
    expect(
      timelineSignal(card({ target_date: "2026-08-20" }), today, 14, null),
    ).toBe("overdue");
    const shippedGate: BoardGate = {
      id: "g-ship",
      name: "Done",
      statuses: ["done"],
      lane_ids: [],
      outcome: "shipped",
    };
    expect(
      timelineSignal(
        card({ target_date: "2026-08-20" }),
        today,
        14,
        shippedGate,
      ),
    ).toBe("delivered");
  });

  test("delivered is shipped_on or a shipped-outcome gate, not raw done status", () => {
    const today = "2026-08-31";
    expect(timelineSignal(card({ status: "done" }), today, 14, null)).not.toBe(
      "delivered",
    );
    expect(
      timelineSignal(card({ shipped_on: "2026-08-20" }), today, 14, null),
    ).toBe("delivered");
    const shippedGate: BoardGate = {
      id: "g-ship",
      name: "Done",
      statuses: ["done"],
      lane_ids: [],
      outcome: "shipped",
    };
    expect(
      timelineSignal(card({ status: "done" }), today, 14, shippedGate),
    ).toBe("delivered");
  });

  test("planned / forgotten / overdue still follow the date rules", () => {
    const today = "2026-08-31";
    expect(
      timelineSignal(card({ target_date: "2026-09-15" }), today, 14, null),
    ).toBe("planned");
    expect(
      timelineSignal(card({ target_date: "2026-08-20" }), today, 14, null),
    ).toBe("overdue");
    expect(
      timelineSignal(card({ raised_on: "2026-08-17" }), today, 14, null),
    ).toBe("forgotten");
  });
});

describe("timeline date helpers", () => {
  test("calculates UTC calendar gaps and threshold dates", () => {
    expect(daysSince("2026-08-17", "2026-08-31")).toBe(14);
    expect(addTimelineDays("2026-08-17", 14)).toBe("2026-08-31");
  });

  test("uses an inclusive trailing window and rejects future dates", () => {
    expect(isInTimelineWindow("2026-08-18", "2026-08-31", 14)).toBe(true);
    expect(isInTimelineWindow("2026-08-17", "2026-08-31", 14)).toBe(false);
    expect(isInTimelineWindow("2026-08-31T23:00:00Z", "2026-08-31", 14)).toBe(
      true,
    );
    expect(isInTimelineWindow("2026-09-01", "2026-08-31", 14)).toBe(false);
  });
});

describe("timelineMilestones", () => {
  const lanes = [
    { id: "work-id", key: "now", kind: "work" as const },
    { id: "built-id", key: "built", kind: "built" as const },
    { id: "done-id", key: "done", kind: "done" as const },
  ];
  const cards = [
    {
      id: "ui",
      lane_id: "done-id",
      created_at: "2026-08-01T00:00:00Z",
      status: "backlog",
    },
    {
      id: "etl",
      lane_id: "built-id",
      created_at: "2026-08-02T00:00:00Z",
      status: "backlog",
    },
    {
      id: "import",
      lane_id: "built-id",
      created_at: "2026-08-03T00:00:00Z",
      status: "backlog",
    },
    {
      id: "direct",
      lane_id: "built-id",
      created_at: "2026-08-04T00:00:00Z",
      status: "backlog",
    },
  ];

  test("reads UI ids, ETL keys, and imported lane changes", () => {
    const milestones = timelineMilestones(cards, lanes, [
      {
        card_id: "ui",
        kind: "moved",
        at: "2026-08-20T09:00:00Z",
        payload: { to_lane: "done-id" },
      },
      {
        card_id: "ui",
        kind: "moved",
        at: "2026-08-19T09:00:00Z",
        payload: { to_lane: "built-id" },
      },
      {
        card_id: "etl",
        kind: "created",
        at: "2026-08-18T09:00:00Z",
        payload: { lane: "built" },
      },
      {
        card_id: "import",
        kind: "imported",
        at: "2026-08-17T09:00:00Z",
        payload: { changes: [{ key: "lane", from: "now", to: "built" }] },
      },
      {
        card_id: "direct",
        kind: "created",
        at: "2026-08-16T09:00:00Z",
        payload: { source: "direct.md" },
      },
    ]);

    expect(milestones.builtAt.get("ui")).toBe("2026-08-19T09:00:00Z");
    expect(milestones.deliveredAt.get("ui")).toBe("2026-08-20T09:00:00Z");
    expect(milestones.builtAt.get("etl")).toBe("2026-08-18T09:00:00Z");
    expect(milestones.builtAt.get("import")).toBe("2026-08-17T09:00:00Z");
    expect(milestones.builtAt.get("direct")).toBe("2026-08-16T09:00:00Z");
    expect(milestones.enteredAt.get("ui")).toBe("2026-08-20T09:00:00Z");
  });

  test("milestones follow saved gate lanes, not raw lane kinds", () => {
    const lanes = [
      { id: "gate-2", key: "gate-2", kind: "work" as const },
      { id: "built-id", key: "built", kind: "built" as const },
    ];
    const gates: BoardGate[] = [
      {
        id: "g-await",
        name: "Awaiting delivery",
        statuses: ["built"],
        lane_ids: ["gate-2"],
        outcome: "built",
      },
    ];
    const cards = [
      {
        id: "in-gate",
        lane_id: "gate-2",
        created_at: "2026-08-01T00:00:00Z",
        status: "backlog",
      },
      {
        id: "kind-built",
        lane_id: "built-id",
        created_at: "2026-08-02T00:00:00Z",
        status: "backlog",
      },
    ];
    const milestones = timelineMilestones(
      cards,
      lanes,
      [
        {
          card_id: "in-gate",
          kind: "moved",
          at: "2026-08-20T09:00:00Z",
          payload: { to_lane: "gate-2" },
        },
      ],
      gates,
    );
    expect(milestones.builtAt.get("in-gate")).toBe("2026-08-20T09:00:00Z");
    expect(milestones.builtAt.has("kind-built")).toBe(false);
  });
});

describe("timelineWindowDays", () => {
  test("accepts the offered windows from a query param", () => {
    expect(timelineWindowDays("7")).toBe(7);
    expect(timelineWindowDays("14")).toBe(14);
    expect(timelineWindowDays("30")).toBe(30);
  });

  test("anything else falls back to the default", () => {
    expect(DEFAULT_TIMELINE_WINDOW_DAYS).toBe(14);
    expect(timelineWindowDays(undefined)).toBe(14);
    expect(timelineWindowDays("21")).toBe(14);
    expect(timelineWindowDays(["7", "30"])).toBe(14);
    expect(timelineWindowDays("banana")).toBe(14);
  });
});

describe("timelineOutcomeStatuses", () => {
  test("defaults built and shipped, accepts a valid override", () => {
    const defaults = timelineOutcomeStatuses({});
    expect([...defaults.built].sort()).toEqual([...DEFAULT_BUILT_STATUSES]);
    expect([...defaults.shipped].sort()).toEqual(
      [...DEFAULT_SHIPPED_STATUSES].sort(),
    );
    const custom = timelineOutcomeStatuses({
      timeline_built_statuses: ["built"],
      timeline_shipped_statuses: ["shipped"],
    });
    expect([...custom.built]).toEqual(["built"]);
    expect([...custom.shipped]).toEqual(["shipped"]);
  });

  test("rejects unknown statuses, empty lists, and non-arrays", () => {
    expect([
      ...timelineOutcomeStatuses({ timeline_built_statuses: ["gate-1"] }).built,
    ]).toEqual([...DEFAULT_BUILT_STATUSES]);
    expect([
      ...timelineOutcomeStatuses({ timeline_built_statuses: [] }).built,
    ]).toEqual([...DEFAULT_BUILT_STATUSES]);
    expect(
      [
        ...timelineOutcomeStatuses({ timeline_shipped_statuses: "shipped" })
          .shipped,
      ].sort(),
    ).toEqual([...DEFAULT_SHIPPED_STATUSES].sort());
  });
});

describe("timelineMilestones from status evidence", () => {
  // A board with no outcome-kind lanes at all: gates are plain work lanes,
  // and "built" lives on the card as a status written by the markdown sync.
  const lanes = [
    { id: "gate-1", key: "built", kind: "work" as const },
    { id: "gate-2", key: "gate-2", kind: "work" as const },
  ];
  const cards = [
    {
      id: "synced",
      lane_id: "gate-2",
      created_at: "2026-08-01T00:00:00Z",
      status: "built",
    },
    {
      id: "quiet",
      lane_id: "gate-1",
      created_at: "2026-08-05T00:00:00Z",
      status: "built",
    },
    {
      id: "queued",
      lane_id: "gate-1",
      created_at: "2026-08-06T00:00:00Z",
      status: "backlog",
    },
  ];

  test("stamps the entry into a built status, not later re-imports", () => {
    const milestones = timelineMilestones(cards, lanes, [
      {
        card_id: "synced",
        kind: "imported",
        at: "2026-08-30T09:00:00Z",
        payload: { source: "1.md", status: "built" },
      },
      {
        card_id: "synced",
        kind: "imported",
        at: "2026-08-22T09:00:00Z",
        payload: { source: "1.md", status: "built" },
      },
      {
        card_id: "synced",
        kind: "imported",
        at: "2026-08-15T09:00:00Z",
        payload: { source: "1.md", status: "wip" },
      },
    ]);
    expect(milestones.builtAt.get("synced")).toBe("2026-08-22T09:00:00Z");
  });

  test("reads the changes payload shape and shipped statuses", () => {
    const milestones = timelineMilestones(cards, lanes, [
      {
        card_id: "synced",
        kind: "imported",
        at: "2026-08-25T09:00:00Z",
        payload: { changes: [{ key: "status", from: "built", to: "shipped" }] },
      },
      {
        card_id: "synced",
        kind: "edited",
        at: "2026-08-20T09:00:00Z",
        payload: { status: "built" },
      },
    ]);
    expect(milestones.builtAt.get("synced")).toBe("2026-08-20T09:00:00Z");
    expect(milestones.deliveredAt.get("synced")).toBe("2026-08-25T09:00:00Z");
  });

  test("falls back to creation when a built-status card has no dated evidence", () => {
    const milestones = timelineMilestones(cards, lanes, []);
    expect(milestones.builtAt.get("quiet")).toBe("2026-08-05T00:00:00Z");
    expect(milestones.builtAt.has("queued")).toBe(false);
  });

  test("a configured status set replaces the defaults", () => {
    const milestones = timelineMilestones(
      cards,
      lanes,
      [],
      resolveBoardGates({ timeline_built_statuses: ["handed"] }, lanes),
    );
    expect(milestones.builtAt.has("quiet")).toBe(false);
  });
});

describe("timelineDiagnosticLine", () => {
  test("diagnostic line prefixes the date word", () => {
    const today = "2026-08-31";
    const base = {
      raisedOn: "2026-08-27",
      targetDate: null as string | null,
      targetLabel: null as string | null,
      deliveredAt: null as string | null,
    };
    expect(
      timelineDiagnosticLine(
        { ...base, signal: "planned", targetDate: "2026-08-31" },
        today,
        14,
      ),
    ).toBe("Planned · Target Aug 31, 2026 · today");
    expect(
      timelineDiagnosticLine(
        { ...base, signal: "overdue", targetDate: "2026-08-20" },
        today,
        14,
      ),
    ).toBe("Overdue · Target was Aug 20, 2026");
    expect(
      timelineDiagnosticLine(
        { ...base, signal: "delivered", deliveredAt: "2026-08-27" },
        today,
        14,
      ),
    ).toBe("Delivered · Shipped Aug 27, 2026");
    expect(
      timelineDiagnosticLine({ ...base, signal: "active" }, today, 14),
    ).toBe("Open · No target yet");
    expect(
      timelineDiagnosticLine(
        { ...base, signal: "planned", targetLabel: "September" },
        today,
        14,
      ),
    ).toBe("Planned · Rough target · September");
  });
});
