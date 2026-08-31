import { describe, expect, test } from "bun:test";
import {
  cardGate,
  DEFAULT_BUILT_GATE_ID,
  DEFAULT_SHIPPED_GATE_ID,
  gateOutcomeSets,
  pulseHeading,
  resolveBoardGates,
  validateGatesForSave,
  type BoardGate,
} from "./gates";

const lanes = [
  { id: "now", kind: "work" as const },
  { id: "built-lane", kind: "built" as const },
  { id: "done-lane", kind: "done" as const },
];

const awaiting: BoardGate = {
  id: "g-await",
  name: "Awaiting delivery",
  statuses: ["built", "handed"],
  lane_ids: ["now"],
  outcome: "built",
};
const shipped: BoardGate = {
  id: "g-ship",
  name: "Done",
  statuses: ["shipped", "done"],
  lane_ids: ["done-lane"],
  outcome: "shipped",
};

describe("cardGate", () => {
  test("first match wins; no match is null", () => {
    const gates = [shipped, awaiting];
    expect(cardGate({ status: "done", lane_id: "now" }, gates)?.id).toBe(
      "g-ship",
    );
    expect(cardGate({ status: "built", lane_id: "now" }, gates)?.id).toBe(
      "g-await",
    );
    expect(cardGate({ status: "wip", lane_id: "built-lane" }, gates)).toBeNull();
  });

  test("status-only and lane-only both match; both-empty matches nothing", () => {
    expect(
      cardGate({ status: "built", lane_id: null }, [
        { ...awaiting, lane_ids: [] },
      ])?.id,
    ).toBe("g-await");
    expect(
      cardGate({ status: "backlog", lane_id: "now" }, [
        { ...awaiting, statuses: [] },
      ])?.id,
    ).toBe("g-await");
    expect(
      cardGate({ status: "built", lane_id: "now" }, [
        { ...awaiting, statuses: [], lane_ids: [] },
      ]),
    ).toBeNull();
  });
});

describe("resolveBoardGates", () => {
  test("missing or malformed synthesizes Shipped then Built", () => {
    const resolved = resolveBoardGates({}, lanes);
    expect(resolved.map((g) => g.id)).toEqual([
      DEFAULT_SHIPPED_GATE_ID,
      DEFAULT_BUILT_GATE_ID,
    ]);
    expect(resolved[0]?.statuses.sort()).toEqual(["done", "shipped"]);
    expect(resolved[0]?.lane_ids).toEqual(["done-lane"]);
    expect(resolved[0]?.outcome).toBe("shipped");
    expect(resolved[1]?.statuses.sort()).toEqual(["built", "handed"]);
    expect(resolved[1]?.lane_ids).toEqual(["built-lane"]);
    expect(resolved[1]?.outcome).toBe("built");
    expect(resolveBoardGates({ gates: "nope" }, lanes)[0]?.id).toBe(
      DEFAULT_SHIPPED_GATE_ID,
    );
  });

  test("timeline_built_statuses override seeds default Built statuses", () => {
    const resolved = resolveBoardGates(
      { timeline_built_statuses: ["handed"] },
      lanes,
    );
    expect(resolved.find((g) => g.id === DEFAULT_BUILT_GATE_ID)?.statuses).toEqual(
      ["handed"],
    );
  });

  test("saved [] is no gates; saved list ignores old status keys", () => {
    expect(resolveBoardGates({ gates: [] }, lanes)).toEqual([]);
    const resolved = resolveBoardGates(
      {
        timeline_built_statuses: ["handed"],
        gates: [awaiting],
      },
      lanes,
    );
    expect(resolved).toEqual([awaiting]);
  });

  test("drops unknown lane ids; a gate that then has nothing is invalid (whole fallback)", () => {
    expect(
      resolveBoardGates(
        {
          gates: [
            {
              id: "g1",
              name: "X",
              statuses: ["built"],
              lane_ids: ["gone"],
              outcome: null,
            },
          ],
        },
        lanes,
      )[0]?.lane_ids,
    ).toEqual([]);
    expect(
      resolveBoardGates(
        {
          gates: [
            {
              id: "g1",
              name: "X",
              statuses: [],
              lane_ids: ["gone"],
              outcome: null,
            },
          ],
        },
        lanes,
      )[0]?.id,
    ).toBe(DEFAULT_SHIPPED_GATE_ID);
  });
});

describe("gateOutcomeSets and pulseHeading", () => {
  test("unions outcome statuses and lanes; heading uses the sole name", () => {
    const sets = gateOutcomeSets([shipped, awaiting]);
    expect([...sets.built.statuses].sort()).toEqual(["built", "handed"]);
    expect([...sets.built.laneIds]).toEqual(["now"]);
    expect(pulseHeading([shipped, awaiting], "built")).toBe(
      "Awaiting delivery",
    );
    expect(pulseHeading([awaiting, { ...awaiting, id: "g2" }], "built")).toBe(
      "Built",
    );
    expect(pulseHeading([], "shipped")).toBe("Shipped");
  });
});

describe("validateGatesForSave", () => {
  const ids = new Set(lanes.map((l) => l.id));

  test("accepts a clean list and rejects the spec's failure cases", () => {
    expect(validateGatesForSave([awaiting, shipped], ids).ok).toBe(true);
    expect(validateGatesForSave([{ ...awaiting, name: "" }], ids).ok).toBe(
      false,
    );
    expect(
      validateGatesForSave(
        [awaiting, { ...shipped, name: "awaiting delivery" }],
        ids,
      ).ok,
    ).toBe(false);
    expect(
      validateGatesForSave([awaiting, { ...shipped, id: awaiting.id }], ids)
        .ok,
    ).toBe(false);
    expect(
      validateGatesForSave([{ ...awaiting, statuses: ["nope"] }], ids).ok,
    ).toBe(false);
    expect(
      validateGatesForSave([{ ...awaiting, lane_ids: ["gone"] }], ids).ok,
    ).toBe(false);
    expect(
      validateGatesForSave([{ ...awaiting, outcome: "qa" }], ids).ok,
    ).toBe(false);
    expect(
      validateGatesForSave(
        [{ ...awaiting, statuses: [], lane_ids: [] }],
        ids,
      ).ok,
    ).toBe(false);
    expect(
      validateGatesForSave([{ ...awaiting, id: "" }], ids).ok,
    ).toBe(false);
  });
});
