import { describe, expect, test } from "bun:test";
import {
  compactLaneView,
  mergeBoardLaneViews,
  parseLaneView,
} from "./lane-view";

describe("parseLaneView", () => {
  test("keeps only max and min entries", () => {
    expect(
      parseLaneView({
        a: "min",
        b: "max",
        c: "",
        d: "nope",
        e: 1,
      }),
    ).toEqual({ a: "min", b: "max" });
  });

  test("garbage and missing become an empty map", () => {
    expect(parseLaneView(undefined)).toEqual({});
    expect(parseLaneView(null)).toEqual({});
    expect(parseLaneView("min")).toEqual({});
    expect(parseLaneView(["min"])).toEqual({});
  });
});

describe("compactLaneView", () => {
  test("drops default (empty) views so they are not stored", () => {
    expect(compactLaneView({ a: "min", b: "", c: "max" })).toEqual({
      a: "min",
      c: "max",
    });
  });
});

describe("mergeBoardLaneViews", () => {
  test("replaces one board without clobbering others", () => {
    expect(
      mergeBoardLaneViews(
        { boardA: { lane1: "min" }, boardB: { lane2: "max" } },
        "boardA",
        { lane3: "min" },
      ),
    ).toEqual({
      boardA: { lane3: "min" },
      boardB: { lane2: "max" },
    });
  });

  test("removing the last collapsed lane drops the board key", () => {
    expect(
      mergeBoardLaneViews({ boardA: { lane1: "min" } }, "boardA", {}),
    ).toEqual({});
  });

  test("ignores invalid stored boards", () => {
    expect(
      mergeBoardLaneViews(
        { boardA: "nope", boardB: { lane1: "min" } },
        "boardC",
        {
          lane2: "max",
        },
      ),
    ).toEqual({
      boardB: { lane1: "min" },
      boardC: { lane2: "max" },
    });
  });
});
