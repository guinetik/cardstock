"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Eye } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { CardWatchButton } from "@/components/card-watch-button";
import type { Person } from "@/lib/assignee";
import { statusChipClass } from "@/lib/card-status";
import {
  sortTableCards,
  TABLE_COLUMNS,
  type TableSort,
  tableAssignee,
} from "@/lib/card-table";
import { type Card, EFFORT_PEN, type Lane, PRIORITY_PEN } from "@/lib/types";
import styles from "./card-table.module.css";

export function CardTable({
  cards,
  lanes,
  people,
  boardPath,
  sort,
  onSort,
  onWatch,
}: {
  cards: Card[];
  lanes: Lane[];
  people: Person[];
  boardPath: string;
  sort: TableSort;
  onSort: (sort: TableSort) => void;
  onWatch: (id: string, watching: boolean) => void;
}) {
  const rows = useMemo(
    () => sortTableCards(cards, lanes, people, sort),
    [cards, lanes, people, sort],
  );
  const laneNames = new Map(lanes.map((lane) => [lane.id, lane.name]));
  return (
    <main className={styles.main} aria-label="Card table">
      <output className={styles.count}>
        {rows.length} {rows.length === 1 ? "card" : "cards"} shown
      </output>
      <section
        className={styles.scroll}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to scroll the table in both directions.
        tabIndex={0}
        aria-label="Scrollable card table"
      >
        <table className={styles.table}>
          <caption className="sr-only">
            Board cards. Select a column heading to sort; select a title to open
            the card.
          </caption>
          <thead>
            <tr>
              <th scope="col">
                <Eye size={14} aria-hidden="true" />
                <span className="sr-only">Watch</span>
              </th>
              {TABLE_COLUMNS.map(([column, label]) => {
                const active = sort.column === column;
                const Icon = active
                  ? sort.direction === "asc"
                    ? ArrowUp
                    : ArrowDown
                  : ArrowUpDown;
                return (
                  <th
                    key={column}
                    scope="col"
                    aria-sort={
                      active
                        ? sort.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      type="button"
                      onClick={() =>
                        onSort({
                          column,
                          direction:
                            active && sort.direction === "asc" ? "desc" : "asc",
                        })
                      }
                    >
                      {label}
                      <Icon size={12} aria-hidden="true" />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((card) => (
              <tr key={card.id} data-card-row={card.external_id}>
                <td>
                  <CardWatchButton
                    cardId={card.id}
                    externalId={card.external_id}
                    watching={card.watching ?? false}
                    onChange={(watching) => onWatch(card.id, watching)}
                  />
                </td>
                <td className={styles.mono}>#{card.external_id}</td>
                <td className={styles.title}>
                  <Link
                    href={`${boardPath}/c/${encodeURIComponent(card.external_id)}?view=table`}
                    scroll={false}
                  >
                    {card.title}
                  </Link>
                </td>
                <td>{laneNames.get(card.lane_id ?? "") ?? "Unfiled"}</td>
                <td>
                  <span className={statusChipClass(card.status)}>
                    {card.status || "—"}
                  </span>
                </td>
                <td>
                  {card.priority ? (
                    <span
                      className={`sq sq--on ${PRIORITY_PEN[card.priority]}`}
                    >
                      P{card.priority}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  {card.effort ? (
                    <span className={`sq sq--on ${EFFORT_PEN[card.effort]}`}>
                      {card.effort}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td>{tableAssignee(card, people) || "Unassigned"}</td>
                <td>{card.epic || "—"}</td>
                <td className={styles.mono}>
                  {card.target_date ? (
                    <time dateTime={card.target_date}>{card.target_date}</time>
                  ) : (
                    card.target_label || "—"
                  )}
                </td>
                <td className={styles.mono}>
                  {card.raised_on ? (
                    <time dateTime={card.raised_on}>{card.raised_on}</time>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className={styles.empty}>
            No cards to show. Try changing the filters or add a card to this
            board.
          </p>
        )}
      </section>
    </main>
  );
}
