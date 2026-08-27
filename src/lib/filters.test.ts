import { describe, expect, test } from "bun:test";
import { sortInbox } from "./filters";
import type { Card } from "./types";

/** Only the fields sortInbox reads. */
const card = (external_id: string, raised_on: string | null) =>
  ({ external_id, raised_on }) as Card;

describe("sortInbox", () => {
  const cards = [
    card("10", "2026-08-01"),
    card("2", "2026-08-20"),
    card("33", "2026-08-01"),
    card("7", null),
  ];
  const ids = (list: Card[]) => list.map((c) => c.external_id);

  test("newest first, ties broken by descending id", () => {
    expect(ids(sortInbox(cards, "newest"))).toEqual(["2", "33", "10", "7"]);
  });

  test("oldest first, ties broken by ascending id", () => {
    expect(ids(sortInbox(cards, "oldest"))).toEqual(["10", "33", "2", "7"]);
  });

  test("cards with no raised date sort last either way", () => {
    expect(ids(sortInbox(cards, "newest")).at(-1)).toBe("7");
    expect(ids(sortInbox(cards, "oldest")).at(-1)).toBe("7");
  });

  test("id ascending is numeric, not lexicographic", () => {
    expect(ids(sortInbox(cards, "id-asc"))).toEqual(["2", "7", "10", "33"]);
  });

  test("id descending is numeric, not lexicographic", () => {
    expect(ids(sortInbox(cards, "id-desc"))).toEqual(["33", "10", "7", "2"]);
  });

  test("id order ignores the raised date entirely", () => {
    // "7" has no raised date; it must still sort by its number, not sink.
    expect(ids(sortInbox(cards, "id-asc"))[1]).toBe("7");
  });

  test("does not mutate the array it is given", () => {
    const original = [...cards];
    sortInbox(cards, "id-desc");
    expect(cards).toEqual(original);
  });
});
