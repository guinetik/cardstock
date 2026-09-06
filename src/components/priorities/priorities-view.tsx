"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type DragEvent,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { prioritizeCard } from "@/app/p/[project]/b/[board]/actions";
import {
  type PriorityCard,
  partitionBands,
  rankForDrop,
} from "@/lib/priorities";
import type { PrioritiesBoard } from "@/lib/priorities-data";
import { EFFORT_PEN, PRIORITY_PEN } from "@/lib/types";

const STONE_CAP = 6;
const BAND_LABEL: Record<1 | 2 | 3, string> = {
  1: "Stones",
  2: "Pebbles",
  3: "Sand",
};
const BAND_WIDTH: Record<1 | 2 | 3, string> = { 1: "100%", 2: "78%", 3: "56%" };
const BAND_PEN_COLOR: Record<1 | 2 | 3, string> = {
  1: "var(--pen-red)",
  2: "var(--pen-blue)",
  3: "var(--pen-violet)",
};
const TILTS = ["-1.6deg", "1.1deg", "-0.7deg", "1.8deg", "-1.2deg", "0.6deg"];

export interface PrioritiesViewProps {
  projectSlug: string;
  projectName: string;
  boardSlug: string | null;
  boards: PrioritiesBoard[];
  selectedBoards: string[] | null;
  cards: PriorityCard[];
  path: string;
}

/** A drop target: a band (1/2/3) or the unweighed desk. */
type DropTarget = 1 | 2 | 3 | "desk";

function boardsHref(
  path: string,
  selected: string[] | null,
  known: PrioritiesBoard[],
  toggle: string,
): string {
  const all = known.map((b) => b.slug);
  const current = selected ?? all;
  const next = current.includes(toggle)
    ? current.filter((slug) => slug !== toggle)
    : [...current, toggle];
  const params = new URLSearchParams();
  if (next.length > 0 && next.length < all.length) {
    params.set("boards", next.join(","));
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function PrioritiesView(props: PrioritiesViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cards, setCards] = useState(props.cards);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{
    target: DropTarget;
    index: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setCards(props.cards), [props.cards]);

  const { bands, unweighed } = useMemo(() => {
    const scoped =
      props.boardSlug === null && props.selectedBoards
        ? cards.filter((card) =>
            props.selectedBoards?.includes(card.board_slug),
          )
        : cards;
    return partitionBands(scoped);
  }, [cards, props.boardSlug, props.selectedBoards]);

  const p1 = bands[1];
  const p2 = bands[2];
  const p3 = bands[3];
  const p1Room = Math.max(0, STONE_CAP - p1.length);
  const showBoard = props.boardSlug === null;

  function href(card: PriorityCard): string {
    return `/p/${props.projectSlug}/b/${card.board_slug}/c/${card.external_id}`;
  }

  function onDragStart(event: DragEvent<HTMLElement>, cardId: string) {
    event.dataTransfer.effectAllowed = "move";
    try {
      event.dataTransfer.setData("text/plain", cardId);
    } catch {
      // some browsers refuse dataTransfer writes off-DOM; the id is tracked in state anyway
    }
    setError(null);
    setDragId(cardId);
  }

  function onDragEnd() {
    setDragId(null);
    setOver(null);
  }

  /** Skip the re-render when the hover position hasn't actually changed. */
  function setOverIfChanged(next: { target: DropTarget; index: number }) {
    setOver((prev) =>
      prev && prev.target === next.target && prev.index === next.index
        ? prev
        : next,
    );
  }

  function onRowDragOver(
    event: DragEvent<HTMLElement>,
    target: DropTarget,
    index: number,
  ) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setOverIfChanged({ target, index });
  }

  function onContainerDragOver(
    event: DragEvent<HTMLElement>,
    target: DropTarget,
  ) {
    event.preventDefault();
    const band = target === "desk" ? unweighed : bands[target];
    setOverIfChanged({ target, index: band.length });
  }

  /** Clear the hover state once the pointer truly leaves the container, ignoring moves onto its own children. */
  function onContainerDragLeave(
    event: DragEvent<HTMLElement>,
    target: DropTarget,
  ) {
    const related = event.relatedTarget as Node | null;
    if (related && event.currentTarget.contains(related)) return;
    setOver((prev) => (prev?.target === target ? null : prev));
  }

  function commit(cardId: string, priority: 1 | 2 | 3 | null, index: number) {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    const previousCards = cards;

    if (priority === null) {
      if (card.priority === null) return; // already unweighed — no-op
      setCards((prev) =>
        prev.map((c) =>
          c.id === cardId ? { ...c, priority: null, priority_rank: null } : c,
        ),
      );
      startTransition(async () => {
        const result = await prioritizeCard(cardId, null, null);
        if (!result.ok) {
          setCards(previousCards);
          setError(result.error);
        }
        router.refresh();
      });
      return;
    }

    // `index` is the drop position within the band as currently displayed —
    // which still includes the dragged card if it started in this band.
    // Removing it first shifts every later index down by one, so a
    // downward drag needs its target index decremented to land where the
    // indicator was shown (rather than one slot further).
    const band = bands[priority];
    const originIndex = band.findIndex((c) => c.id === cardId);
    const bandWithoutDragged = band.filter((c) => c.id !== cardId);
    const insertAt = Math.max(
      0,
      Math.min(
        originIndex !== -1 && originIndex < index ? index - 1 : index,
        bandWithoutDragged.length,
      ),
    );

    const rank = rankForDrop(bandWithoutDragged, insertAt);
    const updated = { ...card, priority, priority_rank: rank };
    const reordered = [...bandWithoutDragged];
    reordered.splice(insertAt, 0, updated);
    const orderedIds = reordered.map((c) => c.id);

    // The band can hold cards with a null priority_rank (never dragged
    // before), so patching only the dragged card's rank isn't enough to
    // sort it into place — rewrite every card in the new band order with
    // sequential local ranks so the optimistic render matches the drop,
    // regardless of what neighbours' ranks were. The server renormalises
    // the real ranks independently; router.refresh() replaces these once it
    // returns.
    const localRank = new Map(reordered.map((c, i) => [c.id, i]));
    setCards((prev) =>
      prev.map((c) => {
        if (c.id === cardId) return updated;
        const localPriorityRank = localRank.get(c.id);
        return localPriorityRank === undefined
          ? c
          : { ...c, priority_rank: localPriorityRank };
      }),
    );

    startTransition(async () => {
      const result = await prioritizeCard(cardId, priority, rank, orderedIds);
      if (!result.ok) {
        setCards(previousCards);
        setError(result.error);
      }
      router.refresh();
    });
  }

  function onDrop(
    event: DragEvent<HTMLElement>,
    target: DropTarget,
    index: number,
  ) {
    event.preventDefault();
    event.stopPropagation();
    const id = dragId;
    setDragId(null);
    setOver(null);
    if (!id) return;
    if (target === "desk") {
      commit(id, null, 0);
      return;
    }
    commit(id, target, index);
  }

  function bandRow(
    card: PriorityCard,
    band: 1 | 2 | 3,
    index: number,
    displayIndex: number,
  ) {
    const size =
      band === 1
        ? "text-[17px]"
        : band === 2
          ? "text-[14px]"
          : "text-[13px] whitespace-nowrap overflow-hidden text-ellipsis";
    const showDropLine =
      over?.target === band && over.index === index && dragId !== card.id;
    return (
      <div key={card.id} className="flex flex-col gap-1.5">
        {showDropLine && (
          <span
            className="block h-0.5 bg-[var(--pen-blue)]"
            style={{ width: BAND_WIDTH[band], margin: "0 auto" }}
          />
        )}
        <article
          className="paper-card flex items-center gap-3"
          style={{ width: BAND_WIDTH[band], margin: "0 auto" }}
          draggable
          onDragStart={(event) => onDragStart(event, card.id)}
          onDragEnd={onDragEnd}
          onDragOver={(event) => onRowDragOver(event, band, index)}
          onDrop={(event) => onDrop(event, band, index)}
        >
          <span className="w-6 flex-none text-right font-mono text-[var(--color-ink)]">
            {displayIndex}
          </span>
          <span className="flex-none font-mono text-[11px] text-[var(--color-grey-faint)]">
            #{card.external_id}
          </span>
          <Link
            href={href(card)}
            className={`min-w-0 flex-1 font-medium leading-tight ${size}`}
          >
            {card.title}
          </Link>
          <span className="ml-auto flex flex-none items-center gap-2">
            {band === 1 && card.epic && (
              <span className="epic-label">{card.epic}</span>
            )}
            <span className="stat stat--faint">{card.lane_name}</span>
            {showBoard && (
              <span className="stat stat--faint">{card.board_name}</span>
            )}
            {card.effort && (
              <span className={`sq sq--on ${EFFORT_PEN[card.effort]}`}>
                {card.effort}
              </span>
            )}
          </span>
        </article>
      </div>
    );
  }

  let displayCounter = 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      <header className="flex flex-col gap-2">
        <div>
          <p className="eyebrow">{props.projectName}</p>
          <h1 className="text-[27px] leading-none">The jar</h1>
          <p className="mt-1 text-sm text-[var(--color-grey)]">
            <b className="font-mono text-[var(--color-ink)]">{p1.length}</b>{" "}
            stones ·{" "}
            <b className="font-mono text-[var(--color-ink)]">{p2.length}</b>{" "}
            pebbles ·{" "}
            <b className="font-mono text-[var(--color-ink)]">{p3.length}</b>{" "}
            sand ·{" "}
            <b
              className="font-mono"
              style={{
                color:
                  unweighed.length > 0 ? "var(--pen-red)" : "var(--color-ink)",
              }}
            >
              {unweighed.length}
            </b>{" "}
            unweighed
          </p>
        </div>
      </header>

      {showBoard && props.boards.length > 1 && (
        <div className="calendar-chips">
          {props.boards.map((board) => {
            const on =
              props.selectedBoards === null ||
              props.selectedBoards.includes(board.slug);
            return (
              <Link
                key={board.slug}
                className="calendar-chip"
                data-on={on ? "true" : "false"}
                href={boardsHref(
                  props.path,
                  props.selectedBoards,
                  props.boards,
                  board.slug,
                )}
              >
                {board.name}
              </Link>
            );
          })}
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="basis-full border-l-2 border-[var(--pen-red)] bg-[var(--surface-card)] px-3 py-2 text-sm"
        >
          {error}
        </p>
      )}

      <p className="mt-1 max-w-[40rem] font-display text-[19px] italic leading-snug text-[var(--color-ink2)]">
        Stones first, then pebbles, then sand.
      </p>
      <p className="max-w-[40rem] text-[12.5px] leading-relaxed text-[var(--color-grey)]">
        The professor fills the jar with big stones and asks if it&rsquo;s full.
        Then the pebbles rattle into the gaps, then the sand, then the water.
        Start with the water and nothing else fits — so the big stuff goes in
        first, and the small stuff finds its room. Weigh what matters most: P1
        is red alert.
      </p>

      <section className="paper-well mt-3 flex flex-col p-4">
        {([1, 2, 3] as const).map((band) => {
          const rows = bands[band];
          const isOver = over?.target === band;
          return (
            // biome-ignore lint/a11y/noStaticElementInteractions: drop target mirrors the prototype's div pattern
            <div
              key={band}
              className={`flex flex-col gap-1.5 pb-4 ${isOver ? "paper-lane--over" : ""}`}
              onDragOver={(event) => onContainerDragOver(event, band)}
              onDragLeave={(event) => onContainerDragLeave(event, band)}
              onDrop={(event) => onDrop(event, band, rows.length)}
            >
              <div
                className="flex items-baseline gap-2.5 pb-1.5"
                style={{ borderBottom: `2px solid ${BAND_PEN_COLOR[band]}` }}
              >
                <span className={`sq sq--on ${PRIORITY_PEN[band]}`}>
                  P{band}
                </span>
                <h2
                  className="lane-name text-sm"
                  style={{ color: BAND_PEN_COLOR[band] }}
                >
                  {BAND_LABEL[band]}
                </h2>
                <span className="font-mono text-[10.5px] text-[var(--color-grey)]">
                  {band === 1
                    ? `${p1.length} · room for ${p1Room}`
                    : rows.length}
                </span>
              </div>
              {rows.map((card, index) => {
                displayCounter += 1;
                return bandRow(card, band, index, displayCounter);
              })}
              {band === 1 && rows.length === 0 && (
                <p className="px-0.5 py-2 text-xs text-[var(--color-grey)]">
                  No stones yet. Whatever goes in first sets the shape of
                  everything after it.
                </p>
              )}
            </div>
          );
        })}
      </section>

      {/* biome-ignore lint/a11y/noStaticElementInteractions: drop target mirrors the prototype's div pattern */}
      <div
        className={`mt-4 flex flex-col gap-2.5 px-1.5 pb-3.5 pt-1 ${
          over?.target === "desk" ? "paper-lane--over" : ""
        }`}
        onDragOver={(event) => onContainerDragOver(event, "desk")}
        onDragLeave={(event) => onContainerDragLeave(event, "desk")}
        onDrop={(event) => onDrop(event, "desk", unweighed.length)}
      >
        <div className="flex flex-wrap items-baseline gap-2.5 border-b border-dashed border-[var(--border-strong)] pb-1.5">
          <h2 className="lane-name text-xs text-[var(--color-grey)]">
            Unweighed
          </h2>
          <span className="font-mono text-[10.5px] text-[var(--color-grey)]">
            {unweighed.length}
          </span>
          <span className="text-[11.5px] text-[var(--color-ink2)]">
            Not in the jar, so the priority filter cannot find them. Drag one
            in; drag a sheet out here to unweigh it.
          </span>
        </div>
        <div className="flex flex-wrap gap-3.5 pt-2.5">
          {unweighed.map((card, index) => (
            // biome-ignore lint/a11y/noStaticElementInteractions: post-it mirrors the prototype's div pattern
            <div
              key={card.id}
              className="flex w-44 flex-col gap-1.5 p-2.5 shadow-[var(--shadow-card)]"
              style={{
                background: "var(--surface-postit)",
                rotate: TILTS[index % TILTS.length],
              }}
              draggable
              onDragStart={(event) => onDragStart(event, card.id)}
              onDragEnd={onDragEnd}
            >
              <span className="font-mono text-[10px] text-[var(--color-grey)]">
                #{card.external_id}
              </span>
              <Link
                href={href(card)}
                className="text-[12.5px] font-medium leading-tight"
              >
                {card.title}
              </Link>
              <span className="stat stat--faint pt-0.5">{card.lane_name}</span>
            </div>
          ))}
          {unweighed.length === 0 && (
            <p className="px-0.5 py-1.5 text-xs text-[var(--color-grey)]">
              Everything has a weight.
            </p>
          )}
        </div>
      </div>
      {isPending && <output className="sr-only">Saving…</output>}
    </div>
  );
}
