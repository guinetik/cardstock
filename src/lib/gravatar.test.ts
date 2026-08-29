import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { gravatarHash, gravatarUrl } from "./gravatar";

describe("gravatarHash", () => {
  test("sha256 of the trimmed, lowercased address", () => {
    const want = createHash("sha256").update("joao@staffeto.com").digest("hex");
    expect(gravatarHash("  Joao@Staffeto.COM ")).toBe(want);
  });
});

describe("gravatarUrl", () => {
  test("asks Gravatar for a sized identicon, not a round mystery-person", () => {
    const hash = gravatarHash("joao@staffeto.com");
    expect(gravatarUrl("joao@staffeto.com", 80)).toBe(
      `https://www.gravatar.com/avatar/${hash}?s=80&d=identicon&r=g`,
    );
  });

  test("defaults the pixel size to 80", () => {
    expect(gravatarUrl("a@b.co")).toContain("s=80");
  });

  test("a bust token bypasses the CDN cache after Quick Editor saves", () => {
    expect(gravatarUrl("joao@staffeto.com", 80, 1700000000000)).toContain(
      "&t=1700000000000",
    );
    expect(gravatarUrl("joao@staffeto.com", 80)).not.toContain("&t=");
  });
});
