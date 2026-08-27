"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import type { CardPatch } from "@/app/p/[project]/b/[board]/actions";
import { daysInLane } from "@/lib/filters";
import type { Card, Lane, TagGroup } from "@/lib/types";
import { Ratings } from "./ratings";

const STATUS_CHIP: Record<string, string> = {
  wip: "chip-status chip-status--wip",
  built: "chip-status chip-status--info",
  handed: "chip-status chip-status--info",
  held: "chip-status chip-status--muted",
  blocked: "chip-status chip-status--blocked",
  shipped: "chip-status chip-status--success",
  done: "chip-status chip-status--success",
  backlog: "chip-status chip-status--muted",
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
      className={`${hidden ? "hidden" : ""} ${isDragging ? "opacity-40" : ""}`}
      data-id={card.external_id}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

/**
 * Board card. Resting chrome is `#id`, title, and epic. Status, tags,
 * dates, and ratings open on hover / focus-within (`.card-peek`).
 *
 * @param props.overlay - Drag ghost; peek stays closed.
 */
export function CardItem(props: {
  card: Card;
  groups: TagGroup[];
  lane?: Lane;
  overlay?: boolean;
  onPatch?: (id: string, p: CardPatch) => void;
  onArchive?: (id: string, on: boolean) => void;
  projectSlug?: string;
  boardSlug?: string;
  priorityLabel?: string;
}) {
  const { card, lane } = props;
  const days = lane?.kind === "waiting" ? daysInLane(card) : null;
  const overSla =
    days != null && lane?.sla_days != null && days > lane.sla_days;
  const tagName = new Map<string, { name: string; group: string }>();
  for (const g of props.groups)
    for (const t of g.tags) tagName.set(t.id, { name: t.name, group: g.name });
  const detail = props.projectSlug
    ? `/p/${props.projectSlug}/b/${props.boardSlug}/c/${card.external_id}`
    : "#";

  return (
    <article
      className={`group relative glass-card p-2.5 ${props.overlay ? "glass-card--overlay" : ""} ${card.archived_at ? "opacity-60" : ""}`}
    >
      <div className="flex items-baseline gap-2">
        <span className="shrink-0 font-mono text-xs text-[var(--color-grey)]">
          #{card.external_id}
        </span>
        <p className="min-w-0 text-[15px] font-semibold leading-snug">
          {props.projectSlug ? (
            <Link
              href={detail}
              className="hover:underline"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {card.title}
            </Link>
          ) : (
            card.title
          )}
        </p>
      </div>
      {card.epic && (
        <p className="mt-0.5 truncate text-[11px] text-[var(--color-grey)]">
          {card.epic}
        </p>
      )}

      <div className="card-peek">
        <div className="card-peek-inner">
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className={
                STATUS_CHIP[card.status] ?? "chip-status chip-status--muted"
              }
            >
              {card.status}
            </span>
            {card.needs && (
              <span
                className="chip-status chip-status--attention"
                title={`Waiting on ${card.needs}`}
              >
                needs {card.needs}
              </span>
            )}
            {card.audience === "internal" && (
              <span className="chip-status chip-status--muted">internal</span>
            )}
            {days != null && (
              <span
                className={`chip-status ${overSla ? "chip-status--attention" : "chip-status--muted"}`}
                title="Days in this lane"
              >
                {days}d
              </span>
            )}
            {props.projectSlug && !props.overlay && (
              <Link
                href={detail}
                className="ml-auto text-[11px] font-semibold text-[var(--color-brand)] hover:underline"
                onPointerDown={(e) => e.stopPropagation()}
                data-testid="open-issue"
              >
                Open issue ↗
              </Link>
            )}
          </div>
          {card.tag_ids.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {card.tag_ids.map((id) => {
                const t = tagName.get(id);
                return t ? (
                  <span key={id} className="chip-tag" title={t.group}>
                    {t.name}
                  </span>
                ) : null;
              })}
            </div>
          )}
          {!props.overlay && props.onPatch && (
            <div
              className="mt-2 space-y-1.5"
              role="toolbar"
              aria-label="Card fields"
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <div className="flex gap-1.5">
                <input
                  type="date"
                  className="h-7 flex-1 rounded-md border bg-[var(--surface-input)] px-2 font-mono text-xs"
                  value={card.target_date ?? ""}
                  onChange={(e) =>
                    props.onPatch?.(card.id, {
                      target_date: e.target.value || null,
                    })
                  }
                  aria-label="Target date"
                />
                <input
                  type="text"
                  className="h-7 flex-1 rounded-md border bg-[var(--surface-input)] px-2 text-xs italic placeholder:not-italic"
                  placeholder="rough date"
                  value={card.target_label ?? ""}
                  onChange={(e) =>
                    props.onPatch?.(card.id, {
                      target_label: e.target.value || null,
                    })
                  }
                  aria-label="Rough date"
                />
              </div>
              <Ratings
                card={card}
                onPatch={props.onPatch}
                priorityLabel={props.priorityLabel}
              />
            </div>
          )}
          {(card.summary || card.area || props.onArchive) && (
            <section
              className="mt-2 border-t border-dashed pt-2 text-xs text-[var(--color-grey)]"
              aria-label="Card details"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {card.summary && (
                <p className="mb-1 text-[var(--color-ink)]">{card.summary}</p>
              )}
              {card.area && (
                <p>
                  <span className="font-semibold text-[var(--color-ink2)]">
                    Area
                  </span>{" "}
                  {card.area}
                </p>
              )}
              {props.onArchive && (
                <button
                  type="button"
                  className="mt-2 rounded-full border px-3 py-1 text-xs"
                  onClick={() => props.onArchive?.(card.id, !card.archived_at)}
                >
                  {card.archived_at ? "Restore" : "Archive"}
                </button>
              )}
            </section>
          )}
        </div>
      </div>
    </article>
  );
}
