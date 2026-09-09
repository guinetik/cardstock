import { findPerson, type Person, personLabel } from "./assignee";
import type { Card, Lane } from "./types";

export const TABLE_COLUMNS = [
  ["external_id", "#"],
  ["title", "Title"],
  ["lane", "Lane"],
  ["status", "Status"],
  ["priority", "Priority"],
  ["effort", "Effort"],
  ["assignee", "Assignee"],
  ["epic", "Epic"],
  ["target_date", "Target"],
  ["raised_on", "Raised"],
] as const;

export type TableColumn = (typeof TABLE_COLUMNS)[number][0];
export type TableSort = { column: TableColumn; direction: "asc" | "desc" };

export function tableAssignee(
  card: Card,
  people: readonly Person[],
): string | null {
  const person =
    people.find((p) => p.memberId === card.assignee_id) ??
    findPerson(people, card.assignee);
  return person ? personLabel(person) : card.assignee;
}

/** Sorting is a personal view: never changes a card's shared lane rank. */
export function sortTableCards(
  cards: readonly Card[],
  lanes: readonly Lane[],
  people: readonly Person[],
  sort: TableSort,
): Card[] {
  const positions = new Map(lanes.map((lane) => [lane.id, lane.position]));
  const collator = new Intl.Collator("en", {
    numeric: true,
    sensitivity: "base",
  });
  const value = (card: Card): string | number | null => {
    switch (sort.column) {
      case "lane":
        return positions.get(card.lane_id ?? "") ?? null;
      case "assignee":
        return tableAssignee(card, people);
      case "effort":
        return card.effort ? { L: 1, M: 2, H: 3 }[card.effort] : null;
      default:
        return card[sort.column];
    }
  };
  return [...cards].sort((a, b) => {
    const av = value(a),
      bv = value(b);
    const absentA = av == null || av === "",
      absentB = bv == null || bv === "";
    // Missing dates and unset ratings stay last in either direction.
    if (absentA !== absentB) return absentA ? 1 : -1;
    const compared = absentA
      ? 0
      : typeof av === "number" && typeof bv === "number"
        ? av - bv
        : collator.compare(String(av), String(bv));
    return (
      compared * (sort.direction === "asc" ? 1 : -1) ||
      (sort.column === "lane" ? a.rank - b.rank : 0) ||
      collator.compare(a.external_id, b.external_id) ||
      a.id.localeCompare(b.id)
    );
  });
}
