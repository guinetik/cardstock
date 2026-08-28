import { describe, expect, test } from "bun:test";
import { formatCardEvent, type CardHistoryLane } from "./card-history";

const lanes: CardHistoryLane[] = [
  { id: "id-now", key: "now", name: "Now" },
  { id: "id-next", key: "next", name: "Next" },
  { id: "id-unsorted", key: "unsorted", name: "Unsorted" },
];

const NOW = new Date("2026-08-28T12:00:00.000Z");
const opts = { timeZone: "UTC", now: NOW };

function ev(
  partial: Partial<{
    id: string;
    actor: string | null;
    kind: string;
    payload: unknown;
    at: string;
  }>,
) {
  return {
    id: "e1",
    actor: "etl",
    kind: "moved",
    payload: {},
    at: "2026-08-28T02:28:00.000Z",
    ...partial,
  };
}

describe("actor", () => {
  test("email local-part, etl, blank → someone", () => {
    expect(
      formatCardEvent(ev({ actor: "joao@staffeto.com" }), lanes, opts).actor,
    ).toBe("joao");
    expect(formatCardEvent(ev({ actor: "etl" }), lanes, opts).actor).toBe("etl");
    expect(formatCardEvent(ev({ actor: "  etl  " }), lanes, opts).actor).toBe(
      "etl",
    );
    expect(formatCardEvent(ev({ actor: null }), lanes, opts).actor).toBe(
      "someone",
    );
    expect(formatCardEvent(ev({ actor: "   " }), lanes, opts).actor).toBe(
      "someone",
    );
    expect(formatCardEvent(ev({ actor: "@x.com" }), lanes, opts).actor).toBe(
      "someone",
    );
  });
});

describe("clock", () => {
  test("this year is day month hour:minute", () => {
    expect(formatCardEvent(ev({}), lanes, opts).clock).toBe("28 Aug 02:28");
  });

  test("other year includes the year", () => {
    expect(
      formatCardEvent(ev({ at: "2025-01-02T03:04:00.000Z" }), lanes, opts)
        .clock,
    ).toBe("2 Jan 2025 03:04");
  });

  test("invalid at is an em dash", () => {
    expect(formatCardEvent(ev({ at: "nope" }), lanes, opts).clock).toBe("—");
  });
});

describe("kind pens", () => {
  test("maps known kinds and unknown to existing modifiers", () => {
    expect(formatCardEvent(ev({ kind: "moved" }), lanes, opts).stat).toBe(
      "stat--info",
    );
    expect(formatCardEvent(ev({ kind: "restored" }), lanes, opts).stat).toBe(
      "stat--info",
    );
    expect(formatCardEvent(ev({ kind: "commented" }), lanes, opts).stat).toBe(
      "stat--info",
    );
    expect(formatCardEvent(ev({ kind: "created" }), lanes, opts).stat).toBe(
      "stat--success",
    );
    expect(formatCardEvent(ev({ kind: "imported" }), lanes, opts).stat).toBe(
      "stat--muted",
    );
    expect(formatCardEvent(ev({ kind: "edited" }), lanes, opts).stat).toBe(
      "stat--muted",
    );
    expect(formatCardEvent(ev({ kind: "archived" }), lanes, opts).stat).toBe(
      "stat--muted",
    );
    expect(formatCardEvent(ev({ kind: "frobbed" }), lanes, opts).stat).toBe(
      "stat--muted",
    );
  });
});

describe("moved", () => {
  test("both lanes by id, rank omitted", () => {
    const row = formatCardEvent(
      ev({
        payload: { from_lane: "id-now", to_lane: "id-next", rank: 3.5 },
      }),
      lanes,
      opts,
    );
    expect(row.facts).toBe("Now → Next");
    expect(row.facts).not.toContain("3.5");
  });

  test("unknown ids become a lane; only-from and only-to", () => {
    expect(
      formatCardEvent(
        ev({ payload: { from_lane: "missing", to_lane: "id-next" } }),
        lanes,
        opts,
      ).facts,
    ).toBe("a lane → Next");
    expect(
      formatCardEvent(ev({ payload: { to_lane: "id-next" } }), lanes, opts)
        .facts,
    ).toBe("→ Next");
    expect(
      formatCardEvent(ev({ payload: { from_lane: "id-now" } }), lanes, opts)
        .facts,
    ).toBe("Now →");
    expect(formatCardEvent(ev({ payload: {} }), lanes, opts).facts).toBe("");
  });
});

describe("imported", () => {
  test("source basename, hash omitted", () => {
    expect(
      formatCardEvent(
        ev({
          kind: "imported",
          payload: {
            source: "foo/bar/156.md",
            hash: "abc",
            status: "wip",
            lane: "now",
          },
        }),
        lanes,
        opts,
      ).facts,
    ).toBe("156.md");
    expect(
      formatCardEvent(
        ev({
          kind: "imported",
          payload: { source: "foo\\bar\\156.md", hash: "abc" },
        }),
        lanes,
        opts,
      ).facts,
    ).toBe("156.md");
    expect(
      formatCardEvent(ev({ kind: "imported", payload: { hash: "abc" } }), lanes, opts)
        .facts,
    ).toBe("");
  });
});

describe("created", () => {
  test("lane key resolves to name, else the key, never a lane", () => {
    expect(
      formatCardEvent(
        ev({ kind: "created", payload: { lane: "unsorted", hash: "x" } }),
        lanes,
        opts,
      ).facts,
    ).toBe("Unsorted");
    expect(
      formatCardEvent(
        ev({ kind: "created", payload: { lane: "gone" } }),
        lanes,
        opts,
      ).facts,
    ).toBe("gone");
    expect(
      formatCardEvent(ev({ kind: "created", payload: {} }), lanes, opts).facts,
    ).toBe("");
  });
});

describe("edited", () => {
  test("known fields in order, values only where specified", () => {
    expect(
      formatCardEvent(
        ev({
          kind: "edited",
          payload: {
            summary: "hi",
            priority: 2,
            effort: "M",
            tags: ["t1"],
            body: true,
            extra_uuid: "nope",
          },
        }),
        lanes,
        opts,
      ).facts,
    ).toBe("priority P2 · effort M · summary · tags · body · extra_uuid");
  });

  test("bad values fall back to the field word", () => {
    expect(
      formatCardEvent(
        ev({
          kind: "edited",
          payload: { priority: 9, effort: "X", target_date: "", audience: "x" },
        }),
        lanes,
        opts,
      ).facts,
    ).toBe("priority · effort · target date · audience");
  });
});

describe("archived and restored", () => {
  test("lane it left or returned to", () => {
    expect(
      formatCardEvent(
        ev({ kind: "archived", payload: { from_lane: "id-now" } }),
        lanes,
        opts,
      ).facts,
    ).toBe("Now");
    expect(
      formatCardEvent(
        ev({ kind: "archived", payload: { from_lane: "missing" } }),
        lanes,
        opts,
      ).facts,
    ).toBe("a lane");
    expect(
      formatCardEvent(ev({ kind: "archived", payload: {} }), lanes, opts).facts,
    ).toBe("");
    expect(
      formatCardEvent(
        ev({ kind: "restored", payload: { to_lane: "id-next" } }),
        lanes,
        opts,
      ).facts,
    ).toBe("Next");
  });
});

describe("commented and unknown", () => {
  test("preview only; unknown kind has empty facts", () => {
    expect(
      formatCardEvent(
        ev({
          kind: "commented",
          payload: { author: "a@b.c", at: "x", preview: "Need a decision" },
        }),
        lanes,
        opts,
      ).facts,
    ).toBe("Need a decision");
    expect(
      formatCardEvent(ev({ kind: "frobbed", payload: { hash: "x" } }), lanes, opts)
        .facts,
    ).toBe("");
    expect(
      formatCardEvent(ev({ kind: "moved", payload: ["not", "an", "object"] }), lanes, opts)
        .facts,
    ).toBe("");
  });
});
