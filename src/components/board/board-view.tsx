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
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import {
  archiveCard,
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
import { rankBetween } from "@/lib/rank";
import type { BoardData, Card, Lane } from "@/lib/types";
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

export interface Me {
  email: string;
  prefs: { inboxSort?: InboxSort; showInternal?: boolean };
}

export function BoardView({ data, me }: { data: BoardData; me: Me }) {
  const router = useRouter();
  const priorityLabel =
    (data.board.settings as { priority_label?: string }).priority_label ??
    "Priority";
  const [cards, setCards] = useState<Card[]>(data.cards);
  const [lanes, setLanes] = useState<Lane[]>(data.lanes);
  const [filters, setFilters] = useState<Filters>(() =>
    emptyFilters(me.prefs.showInternal ?? true),
  );
  const [inboxSort, setInboxSort] = useState<InboxSort>(
    me.prefs.inboxSort ?? "newest",
  );
  const [laneView, setLaneView] = useState<Record<string, "max" | "min" | "">>(
    {},
  );
  const [active, setActive] = useState<Card | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [laneBusy, setLaneBusy] = useState<string | null>(null);
  const [laneDialog, setLaneDialog] = useState<LaneDialogMode>(null);
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
        lane.kind === "inbox" && !list.some((c) => c.rank !== 0)
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

  function onDragStart(e: DragStartEvent) {
    setActive(cards.find((c) => c.id === e.active.id) ?? null);
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
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
    setActive(null);
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
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 pt-4 pb-2 sm:px-6">
        <h1 className="text-lg font-bold tracking-tight">
          {data.project.name} · {data.board.name}
        </h1>
        <span className="font-mono text-xs text-muted-foreground">
          <b className="text-foreground">{open}</b> open ·{" "}
          <b className="text-foreground">{unsorted}</b> unsorted
        </span>
        <nav className="ml-auto flex items-center gap-3 text-xs">
          <button
            type="button"
            className="rounded-md bg-primary px-2 py-1 font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
            onClick={() => setLaneDialog({ type: "add" })}
            disabled={laneBusy !== null}
          >
            + Add lane
          </button>
          <a
            className="hover:underline"
            href={`/p/${data.project.slug}/b/${data.board.slug}/timeline`}
          >
            Timeline
          </a>
          <a
            className="hover:underline"
            href={`/p/${data.project.slug}/b/${data.board.slug}/export?internal=${filters.showInternal ? 1 : 0}${filters.showArchived ? "&archived=1" : ""}${filters.tags.size ? `&tags=${[...filters.tags].join(",")}` : ""}${filters.query ? `&q=${encodeURIComponent(filters.query)}` : ""}`}
          >
            Export CSV
          </a>
          <a className="hover:underline" href={`/p/${data.project.slug}`}>
            Project
          </a>
        </nav>
        {error && (
          <p className="basis-full text-sm text-destructive">{error}</p>
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
      <DndContext
        id="board-dnd"
        sensors={sensors}
        collisionDetection={boardCollisionDetection}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActive(null)}
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
              view={laneView[lane.id] ?? ""}
              onView={(v) => setLaneView((s) => ({ ...s, [lane.id]: v }))}
              onPatch={patch}
              onArchive={archive}
              projectSlug={data.project.slug}
              boardSlug={data.board.slug}
              hiddenByDefault={lane.kind === "archive" && !filters.showArchived}
              priorityLabel={priorityLabel}
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
