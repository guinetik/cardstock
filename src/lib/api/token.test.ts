import { describe, expect, test } from "bun:test";
import { hashSecret, newToken, parseToken, TOKEN_PREFIX } from "./token";

describe("newToken", () => {
  test("mints a cst_-prefixed token whose parts round-trip", () => {
    const token = newToken();
    expect(token.plaintext.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(token.id).toHaveLength(8);
    expect(token.secret).toHaveLength(43);
    expect(token.hash).toBe(hashSecret(token.secret));
    expect(parseToken(`Bearer ${token.plaintext}`)).toEqual({
      id: token.id,
      secret: token.secret,
    });
  });

  test("never repeats itself", () => {
    const seen = new Set(
      Array.from({ length: 200 }, () => newToken().plaintext),
    );
    expect(seen.size).toBe(200);
  });
});

describe("parseToken", () => {
  test.each([
    ["null header", null],
    ["empty", ""],
    ["no scheme", "cst_abcdefgh_secret"],
    ["wrong scheme", "Basic cst_abcdefgh_secret"],
    ["wrong prefix", "Bearer ghp_abcdefgh_secret"],
    ["no secret", "Bearer cst_abcdefgh"],
    ["short id", "Bearer cst_abc_secret"],
    ["illegal id", "Bearer cst_abcdef!!_secret"],
  ])("rejects %s", (_label, header) => {
    expect(parseToken(header)).toBeNull();
  });

  test("tolerates surrounding whitespace", () => {
    const token = newToken();
    expect(parseToken(`  Bearer   ${token.plaintext}  `)).toEqual({
      id: token.id,
      secret: token.secret,
    });
  });
});

test("hashSecret is stable and hexadecimal", () => {
  expect(hashSecret("abc")).toBe(hashSecret("abc"));
  expect(hashSecret("abc")).toMatch(/^[0-9a-f]{64}$/);
  expect(hashSecret("abc")).not.toBe(hashSecret("abd"));
});
