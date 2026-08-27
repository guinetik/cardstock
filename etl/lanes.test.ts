import { describe, expect, test } from "bun:test";
import { cleanLaneName, laneKeyFromName } from "../src/lib/lanes";

describe("lane names and permanent keys", () => {
  test("normalises a UI name into a markdown-safe key", () => {
    expect(laneKeyFromName("  Design Réview / Next  ")).toBe(
      "design-review-next",
    );
  });

  test("rejects blank, overlong, and non-keyable names", () => {
    expect(cleanLaneName("   ")).toBeNull();
    expect(cleanLaneName("x".repeat(81))).toBeNull();
    expect(laneKeyFromName("🎯")).toBe("");
  });

  test("cleans whitespace without changing meaningful display text", () => {
    expect(cleanLaneName("  Ready   for review ")).toBe("Ready for review");
  });
});
