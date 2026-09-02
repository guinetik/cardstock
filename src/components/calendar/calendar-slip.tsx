"use client";

import Link from "next/link";
import type { HTMLAttributes } from "react";
import { CardAge } from "@/components/board/card-age";
import type { CalendarSlip as CalendarSlipData } from "@/lib/calendar";
import { cardColorModifier, parseCardColor } from "@/lib/card-color";

/**
 * Mini post-it for a calendar day or the unscheduled tray.
 *
 * @param props.slip - Card plus board identity and gates.
 * @param props.projectSlug - Project URL slug.
 * @param props.showBoard - Print the board name (project calendar).
 * @param props.today - UTC day key.
 * @param props.watchDays - Forgotten watch window.
 * @param props.drag - Optional dnd-kit listeners/attributes from Task 4.
 * @param props.dragging - Dim while this slip is the overlay source.
 */
export function CalendarSlip(props: {
  slip: CalendarSlipData;
  projectSlug: string;
  showBoard: boolean;
  today: string;
  watchDays: number;
  drag?: {
    attributes: HTMLAttributes<HTMLElement>;
    listeners: Record<string, (...args: unknown[]) => unknown> | undefined;
    setNodeRef: (node: HTMLElement | null) => void;
  };
  dragging?: boolean;
}) {
  const { card } = props.slip;
  const href = `/p/${props.projectSlug}/b/${props.slip.boardSlug}/c/${card.external_id}`;
  const color = parseCardColor(card.color);
  const colorClass = cardColorModifier(color) ?? "";
  return (
    <article
      ref={props.drag?.setNodeRef}
      {...props.drag?.attributes}
      {...props.drag?.listeners}
      data-id={card.external_id}
      className={`paper-card calendar-slip ${colorClass} ${props.dragging ? "opacity-40" : ""}`}
    >
      <span className="calendar-slip-id">#{card.external_id}</span>
      <Link
        href={href}
        className="calendar-slip-title hover:underline"
        onPointerDown={(event) => event.stopPropagation()}
      >
        {card.title}
      </Link>
      {props.showBoard && (
        <p className="calendar-slip-board">{props.slip.boardName}</p>
      )}
      <CardAge
        card={card}
        today={props.today}
        watchDays={props.watchDays}
        gates={props.slip.gates}
      />
    </article>
  );
}
