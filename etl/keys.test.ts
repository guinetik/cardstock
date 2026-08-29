import { describe, expect, test } from "bun:test";
import {
  cleanName,
  displayNameProblem,
  keyFromName,
  memberLabel,
} from "../src/lib/keys";

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

describe("displayNameProblem", () => {
  test("accepts a real name", () => {
    expect(displayNameProblem("João Silva")).toBeNull();
  });

  test("rejects a blank or overlong name", () => {
    expect(displayNameProblem("")).toContain("Enter a name");
    expect(displayNameProblem("   ")).toContain("Enter a name");
    expect(displayNameProblem("x".repeat(81))).toContain("Enter a name");
  });
});

describe("memberLabel", () => {
  test("uses the stored name and never the email local-part", () => {
    expect(memberLabel("João")).toBe("João");
    expect(memberLabel(null)).toBe("No name yet");
    expect(memberLabel("")).toBe("No name yet");
  });
});
