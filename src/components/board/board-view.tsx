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
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
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
  moveAllLaneCards,
  moveCard,
  refreshBoard,
  reorderLanes,
  savePrefs,
  sortLaneCards,
  updateCard,
  updateLane,
} from "@/app/p/[project]/b/[board]/actions";
import { CardReferenceScope } from "@/components/card-reference-scope";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { CardColor } from "@/lib/card-color";
import { laneColorModifier } from "@/lib/card-color";
import { cardTemplate } from "@/lib/card-template";
import {
  boardStatuses,
  emptyFilters,
  type Filters,
  type InboxSort,
  isFiltering,
  matches,
  sortInbox,
} from "@/lib/filters";
import { resolveBoardGates } from "@/lib/gates";
import {
  pinnedLaneId,
  readBoardPins,
  setBoardPin,
  writeBoardPins,
} from "@/lib/lane-pin";
import {
  compactLaneView,
  type LaneViewMode,
  mergeBoardLaneViews,
  parseLaneView,
  type StoredBoardLaneViews,
} from "@/lib/lane-view";
import { notificationPrefs } from "@/lib/notify";
import { rankBetween } from "@/lib/rank";
import { forgottenAfterDays, timelineToday } from "@/lib/timeline";
import type { BoardData, Card, Lane } from "@/lib/types";
import { CardCreateDialog } from "./card-create-dialog";
import { CardItem } from "./card-item";
import { FilterBar } from "./filter-bar";
import { LaneActionDialog, type LaneActionMode } from "./lane-action-dialog";
import { KIND_INK, LaneColumn } from "./lane-column";
import { LaneCrudDialog, type LaneDialogMode } from "./lane-crud-dialog";
import { useBoardRealtime } from "./use-board-realtime";
import { useCardEventNotifications } from "./use-card-event-notifications";

/**
 * Prefer the droppable under the pointer so an empty work lane wins over
 * closestCorners matching the dragged card's own sortable rect.
 */
const boardCollisionDetection: CollisionDetection = (args) => {
  // A lane in hand only ever lands on another lane, so the cards drop out of
  // the running entirely. Without this the pointer sits over a card most of
  // the time and `over` comes back as a card id, which leaves the sortable
  // with no index to shift towards — the lane would follow the cursor and
  // then snap back.
  const scoped =
    args.active.data.current?.type === "lane"
      ? {
          ...args,
          droppableContainers: args.droppableContainers.filter(
            (container) => container.data.current?.type === "lane",
          ),
        }
      : args;
  const pointerHits = pointerWithin(scoped);
  if (pointerHits.length > 0) {
    return pointerHits;
  }
  return closestCorners(scoped);
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

// Mirrors delete_work_lane's guard. These three are resolved by `kind`
// lookup at runtime (archiveCard finds the archive lane, and the inbox on
// restore), so removing one breaks a feature rather than raising.
const PROTECTED_KINDS = new Set<Lane["kind"]>(["inbox", "done", "archive"]);

export interface Me {
  email: string;
  prefs: {
    inboxSort?: InboxSort;
    showInternal?: boolean;
    laneViews?: StoredBoardLaneViews;
    /** Parsed by {@link notificationPrefs}; shape is its business. */
    notifications?: unknown;
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
  /** The lane in hand, when the drag is a lane rather than a card. */
  const [activeLane, setActiveLane] = useState<Lane | null>(null);
  // The lane the card was picked up from, and the one currently sprung open.
  const [dragFrom, setDragFrom] = useState<string | null>(null);
  const [sprung, setSprung] = useState<string | null>(null);
  const springTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverLane = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [laneBusy, setLaneBusy] = useState<string | null>(null);
  // Read after mount, never during render: the server has no localStorage, so
  // seeding this from storage initially would hydrate to a different tree.
  const [pinnedLane, setPinnedLane] = useState<string | null>(null);
  const [laneDialog, setLaneDialog] = useState<LaneDialogMode>(null);
  const [laneAction, setLaneAction] = useState<LaneActionMode>(null);
  const [cardLane, setCardLane] = useState<Lane | null>(null);
  // Cards left open on the desk. Per tab, on purpose: a pin is a reading aid.
  const [pinned, setPinned] = useState<ReadonlySet<string>>(() => new Set());
  const watchDays = useMemo(
    () => forgottenAfterDays(data.project.settings),
    [data.project.settings],
  );
  const gates = useMemo(
    () => resolveBoardGates(data.board.settings, lanes),
    [data.board.settings, lanes],
  );
  const today = useMemo(() => timelineToday(), []);
  const pin = useCallback((id: string, on: boolean) => {
    setPinned((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const [pending, startTransition] = useTransition();
  const notifyPrefs = useMemo(
    () => notificationPrefs(me.prefs.notifications),
    [me.prefs.notifications],
  );

  useBoardRealtime({
    boardId: data.board.id,
    busy: pending || laneBusy !== null,
    fetch: () => refreshBoard(data.project.slug, data.board.slug),
    apply: (s) => {
      setCards(s.cards);
      setLanes(s.lanes);
    },
  });

  useCardEventNotifications({
    boardId: data.board.id,
    selfEmail: me.email,
    prefs: notifyPrefs,
    cardTitle: (id) => cards.find((c) => c.id === id)?.title,
    laneName: (id) => lanes.find((l) => l.id === id)?.name,
    knownCard: (id) => cards.some((c) => c.id === id),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // A pin is a local view of a shared order: the pinned lane is drawn first
  // and sticks to the left edge, while `lanes` keeps the order the whole team
  // sees. Sticky alone would not do it — it only engages once a lane would
  // scroll off to the left, so a lane pinned from eight columns out would
  // still be off-screen right, which is the exact case this is for.
  const displayLanes = useMemo(() => {
    if (!pinnedLane) return lanes;
    const pin = lanes.find((l) => l.id === pinnedLane);
    return pin ? [pin, ...lanes.filter((l) => l.id !== pinnedLane)] : lanes;
  }, [lanes, pinnedLane]);

  // Neighbour checks must read the SHARED order, never the displayed one:
  // move_all_lane_cards compares database positions and refuses anything but
  // an adjacent lane, so a pinned lane drawn first must not make lane two
  // look like lane one's neighbour.
  const globalIndex = useMemo(
    () => new Map(lanes.map((l, i) => [l.id, i])),
    [lanes],
  );

  // Stable identity: SortableContext rebuilds its whole context value when
  // this array changes, which re-renders every lane.
  const laneIds = useMemo(() => displayLanes.map((l) => l.id), [displayLanes]);

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

  // A pin outlives the lane it names — someone else can delete that lane, and
  // storage happily keeps pointing at it. pinnedLaneId resolves that to null
  // rather than leaving a stuck empty column behind.
  useEffect(() => {
    setPinnedLane(
      pinnedLaneId(
        readBoardPins(),
        data.board.id,
        lanes.map((l) => l.id),
      ),
    );
  }, [data.board.id, lanes]);

  function pinLane(laneId: string, on: boolean) {
    const next = on ? laneId : null;
    setPinnedLane(next);
    writeBoardPins(setBoardPin(readBoardPins(), data.board.id, next));
  }

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
    setActiveLane(null);
    setActive(null);
    setDragFrom(null);
    setSprung(null);
  }

  function onDragStart(e: DragStartEvent) {
    if (e.active.data.current?.type === "lane") {
      setActiveLane(lanes.find((l) => l.id === e.active.id) ?? null);
      return;
    }
    const card = cards.find((c) => c.id === e.active.id) ?? null;
    setActive(card);
    setDragFrom(card?.lane_id ?? null);
    setSprung(null);
    hoverLane.current = card?.lane_id ?? null;
  }

  function onDragOver(e: DragOverEvent) {
    // Lanes have no cross-container case, and the spring-open would fight a
    // lane drag: it collapses every lane but one.
    if (e.active.data.current?.type === "lane") return;
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
    if (active.data.current?.type === "lane") {
      // endDrag, not setActiveLane: a lane drag sets none of the card fields
      // today, and nothing should have to keep remembering that.
      endDrag();
      if (!over) return;
      const overLaneId = findLane(String(over.id));
      if (!overLaneId || overLaneId === active.id) return;
      const ids = displayLanes.map((l) => l.id);
      const from = ids.indexOf(String(active.id));
      const to = ids.indexOf(overLaneId);
      if (from < 0 || to < 0 || from === to) return;
      // The drag happened in display order, which may lead with a pinned
      // lane. The board's order is everyone's, so the pin must not travel
      // into it: drop the pinned lane out of the result and put it back in
      // the slot it holds for the team. The RPC insists on the whole board,
      // so the array is every lane — including the archive lane the filter
      // may be hiding.
      const moved = arrayMove(ids, from, to);
      const pinIndex = pinnedLane ? globalIndex.get(pinnedLane) : undefined;
      const next =
        pinnedLane && pinIndex !== undefined
          ? (() => {
              const rest = moved.filter((id) => id !== pinnedLane);
              rest.splice(pinIndex, 0, pinnedLane);
              return rest;
            })()
          : moved;
      void reorderLanesTo(next);
      return;
    }
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

  async function addLane(
    name: string,
    color: CardColor | null,
  ): Promise<string | null> {
    setLaneBusy("create");
    setError(null);
    const result = await createLane(data.board.id, name, color);
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
    color: CardColor | null,
  ): Promise<string | null> {
    setLaneBusy(laneId);
    setError(null);
    const result = await updateLane(laneId, { name, color });
    setLaneBusy(null);
    if (!result.ok) return result.error;
    setLanes(result.lanes);
    return null;
  }

  async function reorderLanesTo(orderedIds: string[]) {
    setError(null);
    const previous = lanes;
    // Optimistic, exactly as moveCard is: the drag already showed the
    // result, so re-rendering from the server would flicker.
    setLanes((prev) => {
      const by = new Map(prev.map((l) => [l.id, l]));
      return orderedIds.flatMap((id, index) => {
        const lane = by.get(id);
        return lane ? [{ ...lane, position: index }] : [];
      });
    });
    setLaneBusy(data.board.id);
    const result = await reorderLanes(data.board.id, orderedIds);
    setLaneBusy(null);
    if (!result.ok) {
      setLanes(previous);
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

  async function confirmLaneAction(
    mode: Exclude<LaneActionMode, null>,
  ): Promise<string | null> {
    setLaneBusy(mode.lane.id);
    setError(null);
    if (mode.type === "move-cards") {
      const result = await moveAllLaneCards(mode.lane.id, mode.destination.id);
      setLaneBusy(null);
      if (!result.ok) return result.error;
      const ranks = new Map(result.cards.map((card) => [card.id, card.rank]));
      const enteredAt = new Date().toISOString();
      setCards((current) =>
        current.map((card) =>
          ranks.has(card.id)
            ? {
                ...card,
                lane_id: mode.destination.id,
                rank: ranks.get(card.id)!,
                lane_entered_at: enteredAt,
              }
            : card,
        ),
      );
      return null;
    }

    const result = await sortLaneCards(mode.lane.id, mode.direction);
    setLaneBusy(null);
    if (!result.ok) return result.error;
    const ranks = new Map(result.cards.map((card) => [card.id, card.rank]));
    setCards((current) =>
      current.map((card) =>
        ranks.has(card.id) ? { ...card, rank: ranks.get(card.id)! } : card,
      ),
    );
    return null;
  }

  const unsorted = lanes
    .filter((l) => l.kind === "inbox")
    .reduce((n, l) => n + (byLane.get(l.id)?.length ?? 0), 0);
  const open = cards.filter((c) => !c.archived_at).length;
  const hasUnassignedEpics = useMemo(
    () => cards.some((c) => !c.epic_id && !c.epic?.trim()),
    [cards],
  );
  const boardEpics = useMemo(
    () =>
      [...data.epics].sort((a, b) =>
        a.source_name.localeCompare(b.source_name),
      ),
    [data.epics],
  );

  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col"
      data-card-reference-scope="board"
    >
      <header className="flex flex-wrap items-end gap-x-5 gap-y-2 px-4 pt-5 pb-3 sm:px-6">
        <div>
          <a
            href={`/p/${data.project.slug}`}
            className="mb-1 inline-block font-mono text-[10px] uppercase tracking-[0.11em] text-[var(--color-grey-faint)] hover:text-[var(--color-ink)]"
          >
            {data.project.name}
          </a>
          <h1 className="text-[27px] leading-none">{data.board.name}</h1>
        </div>
        <span className="pb-0.5 font-mono text-xs text-[var(--color-grey)]">
          <b className="font-medium text-[var(--color-ink)]">{open}</b> open ·{" "}
          <b className="font-medium text-[var(--color-ink)]">{unsorted}</b>{" "}
          unsorted
        </span>
        <nav
          className="flex items-center gap-4 pb-0.5 text-[12.5px]"
          aria-label="Board views"
        >
          <a
            className="paper-link"
            href={`/p/${data.project.slug}/b/${data.board.slug}/cockpit`}
          >
            Epic Cockpit
          </a>
          <a
            className="paper-link"
            href={`/p/${data.project.slug}/b/${data.board.slug}/calendar`}
          >
            Calendar
          </a>
          <a
            className="paper-link"
            href={`/p/${data.project.slug}/b/${data.board.slug}/timeline`}
          >
            Timeline
          </a>
          <a
            className="paper-link"
            href={`/p/${data.project.slug}/b/${data.board.slug}/manage`}
          >
            Manage
          </a>
        </nav>
        <fieldset className="m-0 ml-auto flex items-center gap-2 border-0 p-0 pb-0.5">
          <legend className="sr-only">Board actions</legend>
          <button
            type="button"
            className="inline-flex h-7 items-center rounded-[var(--radius-btn)] border border-[var(--color-ink)] bg-[var(--color-ink)] px-3 text-[12.5px] font-medium text-[var(--surface-card)] hover:opacity-90 disabled:opacity-50"
            onClick={() => setLaneDialog({ type: "add" })}
            disabled={laneBusy !== null}
          >
            Add lane
          </button>
          <a
            className="inline-flex h-7 items-center rounded-[var(--radius-btn)] border border-[var(--color-ink)] bg-[var(--color-ink)] px-3 text-[12.5px] font-medium text-[var(--surface-card)] hover:opacity-90"
            href={`/p/${data.project.slug}/b/${data.board.slug}/export?internal=${filters.showInternal ? 1 : 0}${filters.showArchived ? "&archived=1" : ""}${filters.tags.size ? `&tags=${[...filters.tags].join(",")}` : ""}${filters.query ? `&q=${encodeURIComponent(filters.query)}` : ""}`}
          >
            Export CSV
          </a>
        </fieldset>
        {error && (
          <p className="basis-full border-l-2 border-[var(--pen-red)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--color-ink)]">
            {error}
          </p>
        )}
      </header>
      <FilterBar
        groups={data.groups}
        statuses={boardStatuses(cards)}
        epics={boardEpics}
        hasUnassignedEpics={hasUnassignedEpics}
        people={data.people}
        meMemberId={
          data.people.find(
            (p) => p.email.toLowerCase() === me.email.toLowerCase(),
          )?.memberId ?? null
        }
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
      <LaneActionDialog
        key={
          laneAction
            ? `${laneAction.type}-${laneAction.lane.id}-${"direction" in laneAction ? laneAction.direction : laneAction.destination.id}`
            : "closed"
        }
        mode={laneAction}
        onClose={() => setLaneAction(null)}
        onConfirm={confirmLaneAction}
      />
      <CardCreateDialog
        lane={cardLane}
        boardId={data.board.id}
        groups={data.groups}
        epics={data.epics}
        people={data.people}
        bodyTemplate={cardTemplate(data.board.settings)}
        onClose={() => setCardLane(null)}
        onCreate={addCard}
      />
      <CardReferenceScope cards={cards} scope="board" />
      <TooltipProvider delay={300}>
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
            <SortableContext
              items={laneIds}
              strategy={horizontalListSortingStrategy}
            >
              {displayLanes.map((lane) => {
                const laneIndex = globalIndex.get(lane.id) ?? 0;
                return (
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
                    pinned={pinned}
                    onPin={pin}
                    projectSlug={data.project.slug}
                    boardSlug={data.board.slug}
                    today={today}
                    watchDays={watchDays}
                    gates={gates}
                    hiddenByDefault={
                      lane.kind === "archive" && !filters.showArchived
                    }
                    onAddCard={() => setCardLane(lane)}
                    lanePinned={pinnedLane === lane.id}
                    onPinLane={(on) => pinLane(lane.id, on)}
                    manage={{
                      disabled: laneBusy !== null,
                      canDelete: !PROTECTED_KINDS.has(lane.kind),
                      canMoveCardsLeft:
                        lane.kind !== "archive" &&
                        laneIndex > 0 &&
                        lanes[laneIndex - 1]?.kind !== "archive",
                      canMoveCardsRight:
                        lane.kind !== "archive" &&
                        laneIndex < lanes.length - 1 &&
                        lanes[laneIndex + 1]?.kind !== "archive",
                      canSortCards:
                        lane.kind !== "archive" && lane.kind !== "inbox",
                      onRename: () => setLaneDialog({ type: "rename", lane }),
                      onMoveCards: (delta) => {
                        const destination = lanes[laneIndex + delta];
                        if (!destination || destination.kind === "archive")
                          return;
                        setLaneAction({
                          type: "move-cards",
                          lane,
                          destination,
                          cardCount: byLane.get(lane.id)?.length ?? 0,
                        });
                      },
                      onSortCards: (direction) =>
                        setLaneAction({
                          type: "sort-cards",
                          lane,
                          direction,
                          cardCount: byLane.get(lane.id)?.length ?? 0,
                        }),
                      onDelete: () => setLaneDialog({ type: "delete", lane }),
                    }}
                  />
                );
              })}
            </SortableContext>
            {/* Outside the SortableContext on purpose: it is not a sortable
                item, and listing it would corrupt the index math. */}
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
            {activeLane ? (
              <div
                className={`paper-lane lane-column-width p-2 opacity-90 ${laneColorModifier(activeLane.color) ?? ""}`}
              >
                <div className="lane-head">
                  <h2 className={`lane-name ${KIND_INK[activeLane.kind]}`}>
                    {activeLane.name}
                  </h2>
                </div>
              </div>
            ) : active ? (
              <CardItem
                card={active}
                groups={data.groups}
                lane={lanes.find((l) => l.id === active.lane_id)}
                today={today}
                watchDays={watchDays}
                gates={gates}
                overlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </TooltipProvider>
    </div>
  );
}
