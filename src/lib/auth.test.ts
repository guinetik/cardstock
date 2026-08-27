import { describe, expect, test } from "bun:test";
import { MIN_PASSWORD, normalizeEmail, passwordProblem } from "./auth";

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

describe("passwordProblem", () => {
  test("accepts a long enough password that matches its confirmation", () => {
    expect(passwordProblem("correct horse", "correct horse")).toBeNull();
  });

  test("rejects a password shorter than the minimum", () => {
    expect(passwordProblem("short", "short")).toContain(String(MIN_PASSWORD));
    expect(passwordProblem("", "")).toContain(String(MIN_PASSWORD));
  });

  test("rejects a mismatched confirmation", () => {
    expect(passwordProblem("correct horse", "correct horst")).toBe(
      "The two passwords do not match.",
    );
  });

  test("reports the length problem before the mismatch", () => {
    // Otherwise someone typing a short password twice is told only that they
    // match, which is not the useful half.
    expect(passwordProblem("abc", "xyz")).toContain(String(MIN_PASSWORD));
  });

  test("treats missing input as empty rather than throwing", () => {
    expect(passwordProblem(undefined, undefined)).toContain(
      String(MIN_PASSWORD),
    );
    expect(passwordProblem(null, null)).toContain(String(MIN_PASSWORD));
  });

  test("does not accept whitespace padding as a match", () => {
    expect(passwordProblem("correct horse", "correct horse ")).toBe(
      "The two passwords do not match.",
    );
  });
});
