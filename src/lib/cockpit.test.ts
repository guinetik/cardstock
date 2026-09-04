import { describe, expect, test } from "bun:test";
import { buildCockpitModel, taskSignal } from "./cockpit";
import type { Card, Epic, Lane } from "./types";

const lane = (kind: Lane["kind"], id = kind): Lane => ({
  id,
  key: id,
  name: id,
  kind,
  position: 0,
  sla_days: null,
  wip_limit: null,
  color: null,
});
const card = (patch: Partial<Card> = {}): Card => ({
  id: "c1",
  external_id: "1",
  title: "Task",
  summary: null,
  status: "backlog",
  epic: "Launch",
  epic_id: "e1",
  area: null,
  raised_by: null,
  assignee_id: null,
  assignee: null,
  raised_on: "2026-01-01",
  shipped_on: null,
  needs: null,
  lane_id: "work",
  rank: 1,
  priority: null,
  effort: "M",
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
const epic = (patch: Partial<Epic> = {}): Epic => ({
  id: "e1",
  board_id: "b1",
  source_name: "Launch",
  outcome: "Ship it",
  owner_label: "Alex",
  start_date: "2026-01-01",
  target_date: "2026-03-31",
  priority: 1,
  confidence: "unknown",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...patch,
});
const lanes = [lane("work"), lane("waiting"), lane("built"), lane("done")];

describe("taskSignal", () => {
  test("uses delivered, blocked, late, moving, queued precedence", () => {
    const now = new Date("2026-03-01T12:00:00Z");
    expect(
      taskSignal(card({ status: "done", needs: "review" }), lane("done"), now),
    ).toBe("delivered");
    expect(
      taskSignal(
        card({ status: "blocked", target_date: "2026-01-01" }),
        lane("work"),
        now,
      ),
    ).toBe("blocked");
    expect(
      taskSignal(card({ target_date: "2026-01-01" }), lane("work"), now),
    ).toBe("late");
    expect(taskSignal(card({ status: "wip" }), lane("work"), now)).toBe(
      "moving",
    );
    expect(taskSignal(card(), lane("work"), now)).toBe("queued");
  });

  test("a blocker note blocks the card; clearing it returns the status signal", () => {
    const now = new Date("2026-03-01T12:00:00Z");
    expect(
      taskSignal(card({ status: "wip", needs: "hap" }), lane("work"), now),
    ).toBe("blocked");
    expect(
      taskSignal(card({ status: "wip", needs: null }), lane("work"), now),
    ).toBe("moving");
    expect(
      taskSignal(card({ status: "wip", needs: "   " }), lane("work"), now),
    ).toBe("moving");
  });
});

describe("buildCockpitModel", () => {
  test("calculates an explainable late forecast and confidence mismatch", () => {
    const cards = [
      card({
        id: "a",
        external_id: "1",
        status: "done",
        lane_id: "done",
        effort: "L",
        shipped_on: "2026-02-10",
      }),
      card({
        id: "b",
        external_id: "2",
        status: "done",
        lane_id: "done",
        effort: "L",
        shipped_on: "2026-02-20",
      }),
      card({
        id: "c",
        external_id: "3",
        effort: "H",
        target_date: "2026-03-10",
      }),
    ];
    const model = buildCockpitModel({
      cards,
      lanes,
      epics: [epic({ target_date: "2026-03-05", confidence: "confident" })],
      snapshots: [],
      moves: [],
      now: new Date("2026-03-01T12:00:00Z"),
    });
    expect(model.active[0]?.outlook).toBe("at-risk");
    expect(model.active[0]?.metrics.likelyLanding).toBeTruthy();
    expect(model.active[0]?.confidenceMismatch).toContain("disagree");
  });

  test("does not guess a forecast with sparse estimates or history", () => {
    const model = buildCockpitModel({
      cards: [card({ effort: null })],
      lanes,
      epics: [epic()],
      snapshots: [],
      moves: [],
      now: new Date("2026-03-01T12:00:00Z"),
    });
    expect(model.active[0]?.metrics.likelyLanding).toBeNull();
    expect(model.active[0]?.outlook).toBe("planning");
  });

  test("keeps an epic with zero tasks visible as an active planning epic", () => {
    const model = buildCockpitModel({
      cards: [],
      lanes,
      epics: [epic()],
      snapshots: [],
      moves: [],
      now: new Date("2026-03-01T12:00:00Z"),
    });
    expect(model.active).toHaveLength(1);
    expect(model.completed).toHaveLength(0);
    expect(model.active[0]?.metrics.taskCount).toBe(0);
    expect(model.active[0]?.outlook).toBe("planning");
    expect(model.active[0]?.reasons).toContain(
      "No tasks are attached to this epic yet.",
    );
  });

  test("separates completed and unassigned work", () => {
    const model = buildCockpitModel({
      cards: [
        card({ lane_id: "done", status: "done" }),
        card({ id: "u", external_id: "2", epic: null, epic_id: null }),
      ],
      lanes,
      epics: [epic()],
      snapshots: [],
      moves: [],
      now: new Date("2026-03-01T12:00:00Z"),
    });
    expect(model.completed).toHaveLength(1);
    expect(model.unassigned).toHaveLength(1);
  });
});
