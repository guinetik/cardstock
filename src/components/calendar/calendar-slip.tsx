"use client";

import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from "@dnd-kit/core";
import Link from "next/link";
import { CardAge } from "@/components/board/card-age";
import type { CalendarSlip as CalendarSlipData } from "@/lib/calendar";
import { cardColorModifier, parseCardColor } from "@/lib/card-color";

const FLOAT_MIN_WIDTH = 12.5 * 16;

/**
 * Pin the expanded copy in viewport coordinates on the slip element.
 *
 * @param el - Compact article still in the pack or tray.
 */
function pinFloat(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const width = Math.max(r.width, FLOAT_MIN_WIDTH);
  const margin = 8;
  let left = r.left;
  if (left + width > window.innerWidth - margin) {
    left = Math.max(margin, r.right - width);
  }
  el.style.setProperty("--calendar-float-top", `${r.top}px`);
  el.style.setProperty("--calendar-float-left", `${left}px`);
  el.style.setProperty("--calendar-float-width", `${width}px`);
  el.style.setProperty("--calendar-float-min-height", `${r.height}px`);
  el.dataset.float = "";
}

/**
 * Stable per-card tilt so a day's stubs sit like hand-placed post-its.
 *
 * @param externalId - Card `external_id`, usually numeric.
 */
function stubTilt(externalId: string): string {
  let seed = 0;
  for (const ch of externalId) seed = (seed * 31 + ch.charCodeAt(0)) % 997;
  return `${(((seed % 5) - 2) * 0.9).toFixed(1)}deg`;
}

/**
 * Compact `#id` + title that holds the grid slot, plus the full title, board,
 * and {@link CardAge} painted in an out-of-flow float on hover or focus.
 *
 * @param props.compact - Truncated title for the resting slot.
 * @param props.stub - Compact face is the bare `#id`, no title.
 * @param props.linked - Title is a card link. The float copy is `tabIndex={-1}`
 *   so keyboard users tab the compact link once.
 */
function SlipFace(props: {
  compact: boolean;
  stub?: boolean;
  linked: boolean;
  href: string;
  card: CalendarSlipData["card"];
  showBoard: boolean;
  boardName: string;
  today: string;
  watchDays: number;
  gates: CalendarSlipData["gates"];
}) {
  if (props.compact && props.stub) {
    const id = (
      <span className="calendar-slip-id">#{props.card.external_id}</span>
    );
    return (
      <div className="calendar-slip-slot">
        {props.linked ? (
          <Link href={props.href} className="calendar-slip-id-link">
            {id}
          </Link>
        ) : (
          id
        )}
      </div>
    );
  }
  const title = props.linked ? (
    <Link
      href={props.href}
      className={`calendar-slip-title${props.compact ? "" : " calendar-slip-title--full"} hover:underline`}
      tabIndex={props.compact ? undefined : -1}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {props.card.title}
    </Link>
  ) : (
    <p
      className={`calendar-slip-title${props.compact ? "" : " calendar-slip-title--full"}`}
    >
      {props.card.title}
    </p>
  );
  return (
    <>
      <div
        className={props.compact ? "calendar-slip-slot" : "calendar-slip-open"}
      >
        <span className="calendar-slip-id">#{props.card.external_id}</span>
        {title}
      </div>
      {!props.compact && props.showBoard && (
        <p className="calendar-slip-board">{props.boardName}</p>
      )}
      {!props.compact && (
        <CardAge
          card={props.card}
          today={props.today}
          watchDays={props.watchDays}
          gates={props.gates}
        />
      )}
    </>
  );
}

/**
 * Mini post-it for a calendar day or the unscheduled tray.
 *
 * The article keeps a compact in-flow size. Hover or focus pins a larger copy
 * in the viewport so the day cell does not grow.
 *
 * @param props.slip - Card plus board identity and gates.
 * @param props.projectSlug - Project URL slug.
 * @param props.showBoard - Print the board name on the floating copy.
 * @param props.today - UTC day key.
 * @param props.watchDays - Forgotten watch window.
 * @param props.stub - Day-grid post-it: bare `#id` with a stable tilt.
 * @param props.drag - Optional dnd-kit listeners from the day/tray.
 * @param props.dragging - Dim while this slip is the overlay source.
 * @param props.overlay - Drag ghost; skip the float so collision stays compact.
 */
export function CalendarSlip(props: {
  slip: CalendarSlipData;
  projectSlug: string;
  showBoard: boolean;
  today: string;
  watchDays: number;
  stub?: boolean;
  drag?: {
    attributes: DraggableAttributes;
    listeners: DraggableSyntheticListeners;
    setNodeRef: (node: HTMLElement | null) => void;
  };
  dragging?: boolean;
  overlay?: boolean;
}) {
  const { card } = props.slip;
  const href = `/p/${props.projectSlug}/b/${props.slip.boardSlug}/c/${card.external_id}`;
  const color = parseCardColor(card.color);
  const colorClass = cardColorModifier(color) ?? "";
  const face = {
    href,
    card,
    showBoard: props.showBoard,
    boardName: props.slip.boardName,
    today: props.today,
    watchDays: props.watchDays,
    gates: props.slip.gates,
  };
  const feel = `${props.stub ? "calendar-slip--stub " : ""}${props.overlay ? "calendar-slip--lift" : ""}`;
  return (
    <article
      ref={props.drag?.setNodeRef}
      {...props.drag?.attributes}
      {...props.drag?.listeners}
      data-id={card.external_id}
      className={`paper-card paper-card--static calendar-slip ${feel} ${colorClass} ${props.dragging ? "opacity-40" : ""}`}
      style={
        props.stub
          ? ({
              "--slip-tilt": stubTilt(card.external_id),
            } as React.CSSProperties)
          : undefined
      }
      onMouseEnter={(event) => {
        if (event.buttons !== 0 || props.overlay || props.dragging) return;
        pinFloat(event.currentTarget);
      }}
      onMouseLeave={(event) => {
        delete event.currentTarget.dataset.float;
      }}
      onFocus={(event) => {
        if (props.overlay || props.dragging) return;
        pinFloat(event.currentTarget);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          delete event.currentTarget.dataset.float;
        }
      }}
    >
      <div className="calendar-slip-anchor">
        <SlipFace compact stub={props.stub} linked {...face} />
      </div>
      {!props.overlay && (
        <div className="calendar-slip-float">
          <SlipFace compact={false} linked {...face} />
        </div>
      )}
    </article>
  );
}
