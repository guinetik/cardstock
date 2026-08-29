import { describe, expect, test } from "bun:test";
import { oneRelated } from "./related";

describe("oneRelated", () => {
  test("returns a to-one object as-is", () => {
    expect(oneRelated({ id: "1" })).toEqual({ id: "1" });
  });

  test("unwraps a one-element array", () => {
    expect(oneRelated([{ id: "1" }])).toEqual({ id: "1" });
  });

  test("empty, null, and missing values are null", () => {
    expect(oneRelated([])).toBeNull();
    expect(oneRelated(null)).toBeNull();
    expect(oneRelated(undefined)).toBeNull();
  });
});
