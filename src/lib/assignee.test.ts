import { describe, expect, test } from "bun:test";
import {
  findPerson,
  normaliseEmail,
  type Person,
  personLabel,
} from "./assignee";

const JOAO: Person = {
  memberId: "11111111-1111-4111-8111-111111111111",
  email: "joao@example.test",
  displayName: "Joao",
};
const SAM: Person = {
  memberId: "22222222-2222-4222-8222-222222222222",
  email: "sam@example.test",
  displayName: null,
};

describe("normaliseEmail", () => {
  test("trims and lowercases", () => {
    expect(normaliseEmail("  Joao@Example.Test ")).toBe("joao@example.test");
  });
  test("blank and nullish become null", () => {
    expect(normaliseEmail("   ")).toBeNull();
    expect(normaliseEmail(null)).toBeNull();
    expect(normaliseEmail(undefined)).toBeNull();
  });
});

describe("personLabel", () => {
  test("prefers the display name", () => {
    expect(personLabel(JOAO)).toBe("Joao");
  });
  test("falls back to the email when there is no name", () => {
    expect(personLabel(SAM)).toBe("sam@example.test");
  });
  test("a blank display name is not a name", () => {
    expect(personLabel({ ...SAM, displayName: "  " })).toBe("sam@example.test");
  });
});

describe("findPerson", () => {
  test("matches regardless of case, like citext", () => {
    expect(findPerson([JOAO, SAM], "JOAO@example.test")).toBe(JOAO);
  });
  test("an unknown or blank email finds nobody", () => {
    expect(findPerson([JOAO, SAM], "nobody@example.test")).toBeNull();
    expect(findPerson([JOAO, SAM], null)).toBeNull();
  });
});
