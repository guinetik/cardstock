import { describe, expect, test } from "bun:test";
import { cleanName, keyFromName } from "../src/lib/keys";

describe("display names and permanent keys", () => {
  test("normalises a UI name into a markdown-safe key", () => {
    expect(keyFromName("  Design Réview / Next  ")).toBe("design-review-next");
  });

  test("rejects blank, overlong, and non-keyable names", () => {
    expect(cleanName("   ")).toBeNull();
    expect(cleanName("x".repeat(81))).toBeNull();
    expect(keyFromName("🎯")).toBe("");
  });

  test("cleans whitespace without changing meaningful display text", () => {
    expect(cleanName("  Ready   for review ")).toBe("Ready for review");
  });
});
