import { describe, expect, test } from "bun:test";
import { statusChipClass } from "./card-status";

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
