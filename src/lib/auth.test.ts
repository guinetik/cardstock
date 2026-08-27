import { describe, expect, test } from "bun:test";
import { isLocalSupabase, normalizeEmail } from "./auth";

describe("isLocalSupabase", () => {
  test("accepts the CLI's local URLs", () => {
    expect(isLocalSupabase("http://127.0.0.1:54321")).toBe(true);
    expect(isLocalSupabase("http://localhost:54321")).toBe(true);
    expect(isLocalSupabase("http://[::1]:54321")).toBe(true);
  });

  test("rejects hosted projects", () => {
    expect(isLocalSupabase("https://abcdefg.supabase.co")).toBe(false);
    expect(isLocalSupabase(undefined)).toBe(false);
    expect(isLocalSupabase("")).toBe(false);
  });

  test("rejects hosts that merely mention localhost", () => {
    expect(isLocalSupabase("https://localhost.evil.example")).toBe(false);
    expect(isLocalSupabase("https://not-127.0.0.1.example.com")).toBe(false);
    expect(isLocalSupabase("https://example.com/?h=127.0.0.1")).toBe(false);
  });

  test("rejects anything unparseable", () => {
    expect(isLocalSupabase("127.0.0.1:54321")).toBe(false);
    expect(isLocalSupabase("not a url")).toBe(false);
  });
});

describe("normalizeEmail", () => {
  test("lowercases and trims", () => {
    expect(normalizeEmail("  Joao@Example.COM ")).toBe("joao@example.com");
  });

  test("returns null for anything that is not an address", () => {
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail("   ")).toBeNull();
    expect(normalizeEmail("nope")).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });
});
