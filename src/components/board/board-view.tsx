"use client";
import {
  type CollisionDetection,
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  archiveCard,
  createCard,
  createLane,
  deleteLane,
  moveCard,
  moveLane,
  renameLane,
  savePrefs,
  updateCard,
} from "@/app/p/[project]/b/[board]/actions";
import {
  emptyFilters,
  type Filters,
  type InboxSort,
  isFiltering,
  matches,
  sortInbox,
} from "@/lib/filters";
import {
  compactLaneView,
  type LaneViewMode,
  mergeBoardLaneViews,
  parseLaneView,
  type StoredBoardLaneViews,
} from "@/lib/lane-view";
import { rankBetween } from "@/lib/rank";
import type { BoardData, Card, Lane } from "@/lib/types";
import { CardCreateDialog } from "./card-create-dialog";
import { CardItem } from "./card-item";
import { FilterBar } from "./filter-bar";
import { LaneColumn } from "./lane-column";
import { LaneCrudDialog, type LaneDialogMode } from "./lane-crud-dialog";

/**
 * Prefer the droppable under the pointer so an empty work lane wins over
 * closestCorners matching the dragged card's own sortable rect.
 */
const boardCollisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) {
    return pointerHits;
  }
  return closestCorners(args);
};

/**
 * Spring-loaded lanes: on pickup every lane but the source collapses to a tab
 * edge, and dwelling over one springs it open, so a card can be filed and
 * ranked in a single drag. Built and working, but switched off — collapsing
 * the whole board the moment a card leaves the ground turned out to be more
 * disorienting than the sideways scrolling it saves. Flip this to bring it
 * back; everything below it is live.
 */
const COLLAPSE_LANES_ON_DRAG = false;

/** How long a dragged card must dwell over a collapsed lane before it opens. */
const SPRING_MS = 450;
/** Grace before a sprung lane closes once the card leaves the board. */
const SPRING_LEAVE_MS = 250;

export interface Me {
  email: string;
  prefs: {
    inboxSort?: InboxSort;
    showInternal?: boolean;
    laneViews?: StoredBoardLaneViews;
  };
}

export function BoardView({ data, me }: { data: BoardData; me: Me }) {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>(data.cards);
  const [lanes, setLanes] = useState<Lane[]>(data.lanes);
  const [filters, setFilters] = useState<Filters>(() =>
    emptyFilters(me.prefs.showInternal ?? true),
  );
  const [inboxSort, setInboxSort] = useState<InboxSort>(
    me.prefs.inboxSort ?? "newest",
  );
  const [laneView, setLaneView] = useState<Record<string, LaneViewMode>>(() =>
    parseLaneView(me.prefs.laneViews?.[data.board.id]),
  );
  const laneViewsAllRef = useRef<StoredBoardLaneViews>(
    mergeBoardLaneViews(
      me.prefs.laneViews,
      data.board.id,
      parseLaneView(me.prefs.laneViews?.[data.board.id]),
    ),
  );
  const [active, setActive] = useState<Card | null>(null);
  // The lane the card was picked up from, and the one currently sprung open.
  const [dragFrom, setDragFrom] = useState<string | null>(null);
  const [sprung, setSprung] = useState<string | null>(null);
  const springTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverLane = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [laneBusy, setLaneBusy] = useState<string | null>(null);
  const [laneDialog, setLaneDialog] = useState<LaneDialogMode>(null);
  const [cardLane, setCardLane] = useState<Lane | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const byLane = useMemo(() => {
    const m = new Map<string, Card[]>();
    for (const l of lanes) m.set(l.id, []);
    for (const c of cards)
      if (c.lane_id && m.has(c.lane_id)) m.get(c.lane_id)!.push(c);
    for (const [laneId, list] of m) {
      const lane = lanes.find((l) => l.id === laneId)!;
      m.set(
        laneId,
        // The inbox is triaged with the sort control, not dragged into rank
        // order, so it ignores rank. Every other lane is in the order someone
        // put it in. (This used to require every inbox card to be rank 0,
        // which the ETL made impossible — it always assigns a rank — so the
        // control silently did nothing.)
        lane.kind === "inbox"
          ? sortInbox(list, inboxSort)
          : list.sort((a, b) => a.rank - b.rank),
      );
    }
    return m;
  }, [cards, lanes, inboxSort]);

  const visible = useCallback(
    (c: Card) => matches(c, filters, data.groups, lanes),
    [filters, data.groups, lanes],
  );

  function findLane(id: string): string | null {
    if (lanes.some((l) => l.id === id)) return id;
    return cards.find((c) => c.id === id)?.lane_id ?? null;
  }

  /**
   * Spring-loaded lanes. Dwelling a dragged card over a collapsed lane opens
   * it, the way a Finder folder springs open, so the card can be filed *and*
   * ranked inside the lane in one drag instead of two. The dwell is what makes
   * it bearable: crossing lanes on the way somewhere does not open them.
   */
  const clearSpringTimer = useCallback(() => {
    if (springTimer.current) {
      clearTimeout(springTimer.current);
      springTimer.current = null;
    }
  }, []);
  useEffect(() => clearSpringTimer, [clearSpringTimer]);

  /**
   * While a card is in hand the binder is held open at one tab: the lane it
   * came from stays open and every other lane becomes a divider edge, so no
   * drop target is off-screen. A lane the card dwells over springs open.
   */
  const viewFor = (laneId: string): LaneViewMode => {
    const chosen = laneView[laneId] ?? "";
    if (!COLLAPSE_LANES_ON_DRAG || !active) return chosen;
    if (laneId === dragFrom || laneId === sprung)
      return chosen === "min" ? "" : chosen;
    return "min";
  };

  function springTowards(laneId: string | null) {
    if (!COLLAPSE_LANES_ON_DRAG) return;
    if (hoverLane.current === laneId) return;
    hoverLane.current = laneId;
    clearSpringTimer();
    if (laneId === null) {
      // Off the board entirely — close after a beat, so a wobble at the edge
      // of a lane does not slam it shut mid-aim.
      springTimer.current = setTimeout(() => setSprung(null), SPRING_LEAVE_MS);
      return;
    }
    if (laneId === sprung || laneId === dragFrom) return;
    springTimer.current = setTimeout(() => setSprung(laneId), SPRING_MS);
  }

  function endDrag() {
    clearSpringTimer();
    hoverLane.current = null;
    setActive(null);
    setDragFrom(null);
    setSprung(null);
  }

  function onDragStart(e: DragStartEvent) {
    const card = cards.find((c) => c.id === e.active.id) ?? null;
    setActive(card);
    setDragFrom(card?.lane_id ?? null);
    setSprung(null);
    hoverLane.current = card?.lane_id ?? null;
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    springTowards(over ? findLane(String(over.id)) : null);
    if (!over) return;
    const from = findLane(String(active.id)),
      to = findLane(String(over.id));
    if (!from || !to || from === to) return;
    // Cross-lane: move the card into the target lane at the hovered position, optimistic.
    setCards((prev) => {
      const card = prev.find((c) => c.id === active.id);
      if (!card) return prev;
      const target = (byLane.get(to) ?? []).filter((c) => c.id !== card.id);
      const overIdx = target.findIndex((c) => c.id === over.id);
      const idx = overIdx < 0 ? target.length : overIdx;
      const before = target[idx - 1]?.rank ?? null,
        after = target[idx]?.rank ?? null;
      return prev.map((c) =>
        c.id === card.id
          ? { ...c, lane_id: to, rank: rankBetween(before, after) }
          : c,
      );
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    endDrag();
    if (!over) return;
    const laneId = findLane(String(over.id));
    if (!laneId) return;
    const card = cards.find((c) => c.id === active.id);
    if (!card) return;
    const list = (byLane.get(laneId) ?? []).slice();
    const fromIdx = list.findIndex((c) => c.id === card.id);
    const overIdx = list.findIndex((c) => c.id === over.id);
    let ordered = list;
    if (fromIdx >= 0 && overIdx >= 0 && fromIdx !== overIdx)
      ordered = arrayMove(list, fromIdx, overIdx);
    const idx = ordered.findIndex((c) => c.id === card.id);
    const before = ordered[idx - 1]?.rank ?? null,
      after = ordered[idx + 1]?.rank ?? null;
    const rank = rankBetween(before, after);
    setCards((prev) =>
      prev.map((c) =>
        c.id === card.id
          ? {
              ...c,
              lane_id: laneId,
              rank,
              lane_entered_at:
                c.lane_id === laneId
                  ? c.lane_entered_at
                  : new Date().toISOString(),
            }
          : c,
      ),
    );
    startTransition(async () => {
      const r = await moveCard(
        card.id,
        laneId,
        rank,
        ordered.map((c) => c.id),
      );
      if (!r.ok) {
        setError(r.error);
        router.refresh();
      }
    });
  }

  function patch(cardId: string, p: Parameters<typeof updateCard>[1]) {
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? ({ ...c, ...p } as Card) : c)),
    );
    startTransition(async () => {
      const r = await updateCard(cardId, p);
      if (!r.ok) {
        setError(r.error);
        router.refresh();
      }
    });
  }

  function archive(cardId: string, on: boolean) {
    const archiveLane = lanes.find((l) => l.kind === "archive");
    const inboxLane = lanes.find((l) => l.kind === "inbox");
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? {
              ...c,
              archived_at: on ? new Date().toISOString() : null,
              archived_by: on ? me.email : null,
              lane_id:
                on && archiveLane
                  ? archiveLane.id
                  : !on && inboxLane
                    ? inboxLane.id
                    : c.lane_id,
            }
          : c,
      ),
    );
    startTransition(async () => {
      const r = await archiveCard(cardId, on);
      if (!r.ok) {
        setError(r.error);
      }
      router.refresh();
    });
  }

  /**
   * Write this board's lane widths into member prefs without clobbering
   * other boards. Default (`""`) views are omitted so a restore clears storage.
   */
  function persistLaneView(next: Record<string, LaneViewMode>) {
    const all = mergeBoardLaneViews(
      laneViewsAllRef.current,
      data.board.id,
      compactLaneView(next),
    );
    laneViewsAllRef.current = all;
    startTransition(() => {
      void savePrefs({ laneViews: all });
    });
  }

  /**
   * Collapse, maximize, or restore a lane and remember the choice across reloads.
   */
  function changeLaneView(laneId: string, view: LaneViewMode) {
    setLaneView((current) => {
      const next = { ...current, [laneId]: view };
      persistLaneView(next);
      return next;
    });
  }

  function changeInboxSort(s: InboxSort) {
    setInboxSort(s);
    startTransition(() => {
      void savePrefs({ inboxSort: s });
    });
  }
  function changeShowInternal(v: boolean) {
    setFilters((f) => ({ ...f, showInternal: v }));
    startTransition(() => {
      void savePrefs({ showInternal: v });
    });
  }

  async function addLane(name: string): Promise<string | null> {
    setLaneBusy("create");
    setError(null);
    const result = await createLane(data.board.id, name);
    setLaneBusy(null);
    if (!result.ok) return result.error;
    setLanes(result.lanes);
    return null;
  }

  async function addCard(input: Parameters<typeof createCard>[0]) {
    setError(null);
    const result = await createCard(input);
    if (!result.ok) {
      setError(result.error);
      return result;
    }
    setCards((current) => [result.card, ...current]);
    return result;
  }

  async function changeLaneName(
    laneId: string,
    name: string,
  ): Promise<string | null> {
    setLaneBusy(laneId);
    setError(null);
    const result = await renameLane(laneId, name);
    setLaneBusy(null);
    if (!result.ok) return result.error;
    setLanes(result.lanes);
    return null;
  }

  async function shiftLane(laneId: string, delta: -1 | 1) {
    setLaneBusy(laneId);
    setError(null);
    const result = await moveLane(laneId, delta);
    setLaneBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setLanes(result.lanes);
  }

  async function removeLane(
    laneId: string,
    destinationLaneId: string,
  ): Promise<string | null> {
    setLaneBusy(laneId);
    setError(null);
    const result = await deleteLane(laneId, destinationLaneId);
    setLaneBusy(null);
    if (!result.ok) return result.error;
    const moved = new Map(
      (result.movedCards ?? []).map((card) => [card.id, card.rank]),
    );
    setCards((current) =>
      current.map((card) =>
        moved.has(card.id)
          ? {
              ...card,
              lane_id: destinationLaneId,
              rank: moved.get(card.id)!,
              lane_entered_at: new Date().toISOString(),
            }
          : card,
      ),
    );
    setLanes(result.lanes);
    setLaneView((current) => {
      const next = { ...current };
      delete next[laneId];
      persistLaneView(next);
      return next;
    });
    return null;
  }

  const unsorted = lanes
    .filter((l) => l.kind === "inbox")
    .reduce((n, l) => n + (byLane.get(l.id)?.length ?? 0), 0);
  const open = cards.filter((c) => !c.archived_at).length;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-end gap-x-5 gap-y-2 px-4 pt-5 pb-3 sm:px-6">
        <div>
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.11em] text-[var(--color-grey-faint)]">
            {data.project.name}
          </p>
          <h1 className="text-[27px] leading-none">{data.board.name}</h1>
        </div>
        <span className="pb-0.5 font-mono text-xs text-[var(--color-grey)]">
          <b className="font-medium text-[var(--color-ink)]">{open}</b> open ·{" "}
          <b className="font-medium text-[var(--color-ink)]">{unsorted}</b>{" "}
          unsorted
        </span>
        <nav className="ml-auto flex items-center gap-2 pb-0.5 text-[12.5px]">
          <a
            className="paper-link"
            href={`/p/${data.project.slug}/b/${data.board.slug}/cockpit`}
          >
            Epic cockpit
          </a>
          <a
            className="paper-link ml-2"
            href={`/p/${data.project.slug}/b/${data.board.slug}/timeline`}
          >
            Timeline
          </a>
          <a
            className="paper-link ml-2"
            href={`/p/${data.project.slug}/b/${data.board.slug}/export?internal=${filters.showInternal ? 1 : 0}${filters.showArchived ? "&archived=1" : ""}${filters.tags.size ? `&tags=${[...filters.tags].join(",")}` : ""}${filters.query ? `&q=${encodeURIComponent(filters.query)}` : ""}`}
          >
            Export CSV
          </a>
          <a className="paper-link ml-2" href={`/p/${data.project.slug}`}>
            Project
          </a>
          <button
            type="button"
            className="ml-2 h-7 rounded-[var(--radius-btn)] border border-[var(--color-ink)] bg-[var(--color-ink)] px-3 font-medium text-[var(--surface-card)] hover:opacity-90 disabled:opacity-50"
            onClick={() => setLaneDialog({ type: "add" })}
            disabled={laneBusy !== null}
          >
            Add lane
          </button>
        </nav>
        {error && (
          <p className="basis-full border-l-2 border-[var(--pen-red)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--color-ink)]">
            {error}
          </p>
        )}
      </header>
      <FilterBar
        groups={data.groups}
        filters={filters}
        onChange={setFilters}
        filtering={isFiltering(filters)}
        inboxSort={inboxSort}
        onInboxSort={changeInboxSort}
        onShowInternal={changeShowInternal}
      />
      <LaneCrudDialog
        mode={laneDialog}
        lanes={lanes}
        cardCount={
          laneDialog?.type === "delete"
            ? (byLane.get(laneDialog.lane.id)?.length ?? 0)
            : 0
        }
        onClose={() => setLaneDialog(null)}
        onCreate={addLane}
        onRename={changeLaneName}
        onDelete={removeLane}
      />
      <CardCreateDialog
        lane={cardLane}
        boardId={data.board.id}
        groups={data.groups}
        epics={data.epics}
        onClose={() => setCardLane(null)}
        onCreate={addCard}
      />
      <DndContext
        id="board-dnd"
        sensors={sensors}
        collisionDetection={boardCollisionDetection}
        // Lanes collapse and spring open mid-drag, so the cached droppable
        // rects from drag start are wrong the moment a card is picked up.
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={endDrag}
      >
        <main
          className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-4 pb-4 sm:px-6"
          aria-label="Priority lanes"
        >
          {lanes.map((lane, laneIndex) => (
            <LaneColumn
              key={lane.id}
              lane={lane}
              cards={byLane.get(lane.id) ?? []}
              visible={visible}
              groups={data.groups}
              view={viewFor(lane.id)}
              onView={(v) => changeLaneView(lane.id, v)}
              onPatch={patch}
              onArchive={archive}
              projectSlug={data.project.slug}
              boardSlug={data.board.slug}
              hiddenByDefault={lane.kind === "archive" && !filters.showArchived}
              onAddCard={() => setCardLane(lane)}
              manage={
                lane.kind === "work"
                  ? {
                      disabled: laneBusy !== null,
                      canMoveLeft:
                        laneIndex > 0 &&
                        lanes[laneIndex - 1]?.kind !== "archive",
                      canMoveRight:
                        laneIndex < lanes.length - 1 &&
                        lanes[laneIndex + 1]?.kind !== "archive",
                      onRename: () => setLaneDialog({ type: "rename", lane }),
                      onMove: (delta) => void shiftLane(lane.id, delta),
                      onDelete: () => setLaneDialog({ type: "delete", lane }),
                    }
                  : undefined
              }
            />
          ))}
          <button
            type="button"
            className="flex min-h-28 w-40 shrink-0 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground hover:border-foreground/30 hover:bg-muted/30 hover:text-foreground disabled:opacity-50"
            onClick={() => setLaneDialog({ type: "add" })}
            disabled={laneBusy !== null}
          >
            + Add lane
          </button>
        </main>
        <DragOverlay>
          {active ? (
            <CardItem
              card={active}
              groups={data.groups}
              lane={lanes.find((l) => l.id === active.lane_id)}
              overlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
