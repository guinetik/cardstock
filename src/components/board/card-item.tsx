"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Maximize2, Pin, PinOff } from "lucide-react";
import Link from "next/link";
import type { CardPatch } from "@/app/p/[project]/b/[board]/actions";
import { cardColorModifier, parseCardColor } from "@/lib/card-color";
import { daysInLane } from "@/lib/filters";
import {
  type Card,
  EFFORT_PEN,
  type Lane,
  markHue,
  PRIORITY_PEN,
  type TagGroup,
} from "@/lib/types";
import { CardColorPicker } from "./card-color-picker";
import { Ratings } from "./ratings";

const STATUS_CHIP: Record<string, string> = {
  wip: "stat stat--wip",
  built: "stat stat--info",
  handed: "stat stat--info",
  held: "stat stat--muted",
  blocked: "stat stat--blocked",
  shipped: "stat stat--success",
  done: "stat stat--success",
  backlog: "stat stat--muted",
};

/**
 * DnD wrapper for a board card. `data-id` is the external id for e2e.
 *
 * @param props.card - Card being sorted.
 * @param props.hidden - Filter hide (keeps layout identity).
 * @param props.children - The `CardItem`.
 */
export function SortableCard({
  card,
  hidden,
  children,
}: {
  card: Card;
  hidden: boolean;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      // A 3px gutter so the hover swell has somewhere to grow: without it the
      // card outgrows the lane's scroll container and it scrolls sideways.
      className={`px-[3px] ${hidden ? "hidden" : ""} ${isDragging ? "opacity-40" : ""}`}
      data-id={card.external_id}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

/**
 * Board card. Resting chrome is `#id`, title, epic, and the decisions already
 * made. Status, tags, dates, and the editable ratings open on hover /
 * focus-within (`.card-peek`); the resting summary steps aside (`.card-rest`).
 *
 * @param props.overlay - Drag ghost; peek stays closed.
 */
export function CardItem(props: {
  card: Card;
  groups: TagGroup[];
  lane?: Lane;
  overlay?: boolean;
  /** Loose in the drawer: flat, hairline-separated, no lift at rest. */
  flat?: boolean;
  onPatch?: (id: string, p: CardPatch) => void;
  onArchive?: (id: string, on: boolean) => void;
  /** Left open on the desk: the peek stays out after the pointer leaves. */
  pinned?: boolean;
  onPin?: (id: string, on: boolean) => void;
  projectSlug?: string;
  boardSlug?: string;
}) {
  const { card, lane } = props;
  const color = parseCardColor(card.color);
  const colorClass = cardColorModifier(color) ?? "";
  const pinned = !!props.pinned;
  const days = lane?.kind === "waiting" ? daysInLane(card) : null;
  const overSla =
    days != null && lane?.sla_days != null && days > lane.sla_days;
  // A tag wears its group's highlighter, so the same word is the same colour
  // in the filter bar, on the card, and on the card page.
  const tagName = new Map<
    string,
    { name: string; group: string; hue: number }
  >();
  props.groups.forEach((g, i) => {
    for (const t of g.tags)
      tagName.set(t.id, { name: t.name, group: g.name, hue: markHue(i) });
  });
  const detail = props.projectSlug
    ? `/p/${props.projectSlug}/b/${props.boardSlug}/c/${card.external_id}`
    : "#";

  return (
    <article
      className={`group relative paper-card p-2.5 ${props.overlay ? "paper-card--overlay" : ""} ${props.flat && !props.overlay ? "paper-card--flat" : ""} ${card.archived_at ? "opacity-60" : ""} ${colorClass}`}
      data-pinned={pinned ? "true" : undefined}
    >
      {/* The rail sits opposite the card number: pin, then maximize. */}
      {!props.overlay && (props.onPin || props.projectSlug) && (
        <div className="card-rail" onPointerDown={(e) => e.stopPropagation()}>
          {props.onPin && (
            <button
              type="button"
              aria-label={pinned ? "Unpin card" : "Pin card"}
              title={pinned ? "Unpin" : "Keep open"}
              data-on={pinned ? "true" : undefined}
              onClick={(e) => {
                props.onPin?.(card.id, !pinned);
                // A mouse click should not leave focus on the button, or
                // :focus-within holds the card open after an unpin. Keyboard
                // users keep their place.
                if (e.detail > 0) e.currentTarget.blur();
              }}
            >
              {pinned ? <PinOff size={13} /> : <Pin size={13} />}
            </button>
          )}
          {props.projectSlug && (
            <Link
              href={detail}
              aria-label="Open in place"
              title="Open over the board"
              onKeyDown={(e) => e.stopPropagation()}
            >
              <Maximize2 size={13} />
            </Link>
          )}
        </div>
      )}
      <div className="flex items-baseline gap-2 pr-6">
        <span className="shrink-0 font-mono text-[11.5px] text-[var(--color-grey-faint)]">
          #{card.external_id}
        </span>
        <p className="min-w-0 text-[18px] font-medium leading-snug">
          {props.projectSlug ? (
            // A plain anchor: the issue *page*. Only the rail's maximize is
            // meant to be intercepted into the in-place dialog.
            <a href={detail} className="hover:underline">
              {card.title}
            </a>
          ) : (
            card.title
          )}
        </p>
      </div>

      <div className="card-rest">
        <div className="card-rest-inner">
          <div className="mt-1 flex items-center gap-2">
            {card.epic && (
              <p className="truncate text-[11px] text-[var(--color-grey)]">
                {card.epic}
              </p>
            )}
            {card.status !== "backlog" && (
              <span className={STATUS_CHIP[card.status] ?? "stat stat--muted"}>
                {card.status}
              </span>
            )}
            {(card.priority || card.effort) && (
              <span className="ml-auto flex shrink-0 gap-1">
                {card.priority && (
                  <span
                    className={`sq sq--on ${PRIORITY_PEN[card.priority]}`}
                    title={`Priority ${card.priority}`}
                  >
                    P{card.priority}
                  </span>
                )}
                {card.effort && (
                  <span
                    className={`sq sq--on ${EFFORT_PEN[card.effort]}`}
                    title="Effort"
                  >
                    {card.effort}
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="card-peek">
        <div className="card-peek-inner">
          {/* Epic, state and the two actions share one line above the form. */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {card.epic && (
              <span className="truncate text-[11px] text-[var(--color-grey)]">
                {card.epic}
              </span>
            )}
            <span className={STATUS_CHIP[card.status] ?? "stat stat--muted"}>
              {card.status}
            </span>
            {card.needs && (
              <span
                className="stat stat--attention"
                title={`Waiting on ${card.needs}`}
              >
                needs {card.needs}
              </span>
            )}
            {card.audience === "internal" && (
              <span className="stat stat--flat">internal</span>
            )}
            {days != null && (
              <span
                className={`stat ${overSla ? "stat--blocked" : "stat--muted"}`}
                title="Days in this lane"
              >
                {days}d
              </span>
            )}
            {props.projectSlug && !props.overlay && (
              <a
                href={detail}
                className="paper-link ml-auto text-[11.5px]"
                onPointerDown={(e) => e.stopPropagation()}
                data-testid="open-issue"
              >
                Open issue
              </a>
            )}
            {props.onArchive && (
              <button
                type="button"
                className="paper-link text-[11.5px]"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => props.onArchive?.(card.id, !card.archived_at)}
              >
                {card.archived_at ? "Restore" : "Archive"}
              </button>
            )}
          </div>

          {/* The back of the card: a filled-in form, one labelled row each. */}
          <section
            className="card-form mt-2.5 border-t border-[var(--border-hairline)] pt-2.5"
            aria-label="Card fields"
            // The form is most of an open card, so it is a handle too. Only
            // the text fields keep the pointer to themselves: a press-and-move
            // there is selecting text, not picking the card up. Buttons need
            // nothing — the sensor's distance threshold keeps a click a click.
            onKeyDown={(e) => e.stopPropagation()}
          >
            {card.tag_ids.length > 0 && (
              <>
                <span className="field-label">Tags</span>
                <div className="flex flex-wrap gap-x-1.5 gap-y-1">
                  {card.tag_ids.map((id) => {
                    const t = tagName.get(id);
                    return t ? (
                      <span
                        key={id}
                        className={`mark mark--${t.hue}`}
                        title={t.group}
                      >
                        {t.name}
                      </span>
                    ) : null;
                  })}
                </div>
              </>
            )}

            {!props.overlay && props.onPatch && (
              <>
                <span className="field-label">Target</span>
                <div className="flex flex-col gap-1">
                  <input
                    type="date"
                    onPointerDown={(e) => e.stopPropagation()}
                    className="paper-field h-6 w-full font-mono text-[11.5px]"
                    value={card.target_date ?? ""}
                    onChange={(e) =>
                      props.onPatch?.(card.id, {
                        target_date: e.target.value || null,
                      })
                    }
                    aria-label="Target date"
                    title="A day this is promised for"
                  />
                  <input
                    type="text"
                    onPointerDown={(e) => e.stopPropagation()}
                    className="paper-field h-6 w-full text-[11.5px] italic placeholder:not-italic"
                    placeholder="or a rough date — end of Q3"
                    value={card.target_label ?? ""}
                    onChange={(e) =>
                      props.onPatch?.(card.id, {
                        target_label: e.target.value || null,
                      })
                    }
                    aria-label="Rough date"
                    title="When there is no day yet — what was agreed out loud"
                  />
                </div>

                <Ratings card={card} onPatch={props.onPatch} />

                <span className="field-label">Color</span>
                <CardColorPicker
                  value={color}
                  onChange={(next) => props.onPatch?.(card.id, { color: next })}
                  label={`Color for card #${card.external_id}`}
                />
              </>
            )}

            {card.summary && (
              <>
                <span className="field-label">Note</span>
                <p className="line-clamp-3 text-[13px] leading-snug text-[var(--color-ink2)]">
                  {card.summary}
                </p>
              </>
            )}
          </section>
        </div>
      </div>
    </article>
  );
}
