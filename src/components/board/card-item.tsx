"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Maximize2, Pin, PinOff } from "lucide-react";
import Link from "next/link";
import type { CardPatch } from "@/app/p/[project]/b/[board]/actions";
import { cardColorModifier, parseCardColor } from "@/lib/card-color";
import { statusChipClass } from "@/lib/card-status";
import { daysInLane } from "@/lib/filters";
import type { BoardGate } from "@/lib/gates";
import {
  type Card,
  EFFORT_PEN,
  type Lane,
  markHue,
  PRIORITY_PEN,
  type TagGroup,
} from "@/lib/types";
import { CardAge, cardAgeState } from "./card-age";
import { CardColorMenu } from "./card-color-menu";
import { EpicLabel } from "@/components/epic-label";
import { Ratings } from "./ratings";

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
  /** UTC day key for timeline age; defaults to today in the browser. */
  today?: string;
  /** Project watch window before unplanned work reads as forgotten. */
  watchDays?: number;
  gates?: readonly BoardGate[];
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
  const age =
    props.watchDays != null && props.gates
      ? cardAgeState(
          card,
          props.today ?? new Date().toISOString().slice(0, 10),
          props.watchDays,
          props.gates,
        )
      : null;
  const ageProps =
    props.watchDays != null && props.gates
      ? {
          card,
          today: props.today ?? new Date().toISOString().slice(0, 10),
          watchDays: props.watchDays,
          gates: props.gates,
        }
      : null;

  return (
    <article
      className={`group relative paper-card p-2.5 ${props.overlay ? "paper-card--overlay" : ""} ${props.flat && !props.overlay ? "paper-card--flat" : ""} ${card.archived_at ? "opacity-60" : ""} ${colorClass}`}
      data-pinned={pinned ? "true" : undefined}
      data-timeline-signal={age?.signal}
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
          {props.onPatch && (
            <CardColorMenu
              value={color}
              onChange={(next) => props.onPatch?.(card.id, { color: next })}
              externalId={card.external_id}
            />
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
          <div className="card-meta mt-1 flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {card.epic && <EpicLabel name={card.epic} />}
              {card.status !== "backlog" && (
                <span className={statusChipClass(card.status)}>
                  {card.status}
                </span>
              )}
              {age?.signal === "forgotten" && (
                <span
                  className="stat stat--blocked"
                  title="No target past the watch window"
                >
                  forgotten
                </span>
              )}
              {age?.signal === "overdue" && (
                <span
                  className="stat stat--blocked"
                  title="Target date has passed"
                >
                  overdue
                </span>
              )}
            </div>
            <span className="ml-auto flex shrink-0 items-center gap-2">
              {ageProps && <CardAge {...ageProps} />}
              {(card.priority || card.effort) && (
                <span className="flex gap-1">
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
            </span>
          </div>
        </div>
      </div>

      <div className="card-peek">
        <div className="card-peek-inner">
          {/* Epic, state and the two actions share one line above the form. */}
          <div className="card-peek-actions card-meta mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {card.epic && <EpicLabel name={card.epic} />}
            <span className={statusChipClass(card.status)}>{card.status}</span>
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
            {age?.signal === "forgotten" && (
              <span
                className="stat stat--blocked"
                title="No target past the watch window"
              >
                forgotten
              </span>
            )}
            {age?.signal === "overdue" && (
              <span
                className="stat stat--blocked"
                title="Target date has passed"
              >
                overdue
              </span>
            )}
            <span className="ml-auto flex shrink-0 items-center gap-x-3">
              {ageProps && <CardAge {...ageProps} />}
              {props.projectSlug && !props.overlay && (
                <a
                  href={detail}
                  className="paper-link text-[11.5px]"
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
            </span>
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
                <span className="field-label">Dates</span>
                <div className="card-dates">
                  <div className="card-dates-grid">
                    <span className="card-date-col-label">started</span>
                    <span className="card-date-col-label">target</span>
                    <input
                      type="date"
                      onPointerDown={(e) => e.stopPropagation()}
                      className="paper-field h-6 w-full font-mono text-[11.5px]"
                      value={card.planned_start_date ?? ""}
                      onChange={(e) =>
                        props.onPatch?.(card.id, {
                          planned_start_date: e.target.value || null,
                        })
                      }
                      aria-label="Planned start"
                      title="The day work is meant to begin"
                    />
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
                  </div>
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

                <span className="field-label">Waiting</span>
                <input
                  type="text"
                  onPointerDown={(e) => e.stopPropagation()}
                  className="paper-field h-6 w-full text-[11.5px]"
                  placeholder="a person, a decision, another team"
                  value={card.needs ?? ""}
                  onChange={(e) =>
                    props.onPatch?.(card.id, { needs: e.target.value })
                  }
                  aria-label="Waiting on"
                  title="Anything here marks the card blocked"
                />

                <Ratings card={card} onPatch={props.onPatch} />
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
