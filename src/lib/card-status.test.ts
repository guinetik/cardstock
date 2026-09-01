import { describe, expect, test } from "bun:test";
import {
  CARD_STATUSES,
  isCardStatus,
  normalizeNeeds,
  statusChipClass,
} from "./card-status";

describe("statusChipClass", () => {
  test("maps the tracker vocabulary to paper pens", () => {
    expect(statusChipClass("wip")).toBe("stat stat--wip");
    expect(statusChipClass("blocked")).toBe("stat stat--blocked");
    expect(statusChipClass("built")).toBe("stat stat--info");
    expect(statusChipClass("handed")).toBe("stat stat--info");
    expect(statusChipClass("shipped")).toBe("stat stat--success");
    expect(statusChipClass("done")).toBe("stat stat--success");
    expect(statusChipClass("held")).toBe("stat stat--muted");
    expect(statusChipClass("backlog")).toBe("stat stat--muted");
  });

  test("unknown values stay muted", () => {
    expect(statusChipClass("mystery")).toBe("stat stat--muted");
  });
});

describe("CARD_STATUSES", () => {
  test("is the tracker vocabulary in create-dialog order", () => {
    expect(CARD_STATUSES).toEqual([
      "backlog",
      "blocked",
      "wip",
      "held",
      "built",
      "handed",
      "shipped",
      "done",
    ]);
  });
});

describe("isCardStatus", () => {
  test("accepts the vocabulary and rejects junk", () => {
    expect(isCardStatus("wip")).toBe(true);
    expect(isCardStatus("mystery")).toBe(false);
    expect(isCardStatus(null)).toBe(false);
    expect(isCardStatus("")).toBe(false);
  });
});

describe("normalizeNeeds", () => {
  test("keeps a trimmed blocker note", () => {
    expect(normalizeNeeds("hap")).toBe("hap");
    expect(normalizeNeeds("  legal review  ")).toBe("legal review");
  });

  test("treats empty and blank input as no blocker", () => {
    expect(normalizeNeeds("")).toBe(null);
    expect(normalizeNeeds("   ")).toBe(null);
    expect(normalizeNeeds(null)).toBe(null);
    expect(normalizeNeeds(undefined)).toBe(null);
  });
});
