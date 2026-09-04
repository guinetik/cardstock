"use client";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  ArrowRight,
  GripVertical,
  Maximize2,
  Minus,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Trash2,
} from "lucide-react";
import { createContext, type ReactNode, useContext, useMemo } from "react";
import type { CardPatch } from "@/app/p/[project]/b/[board]/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { laneColorModifier } from "@/lib/card-color";
import type { BoardGate } from "@/lib/gates";
import type { Card, Lane, TagGroup } from "@/lib/types";
import { CardItem, SortableCard } from "./card-item";

/**
 * The rule under a lane name says what kind of lane it is: ink for work,
 * a hairline for the quiet ones, the amber pen for anything waiting.
 */
const KIND_RULE: Record<Lane["kind"], string> = {
  inbox: "lane-head--soft",
  work: "",
  waiting: "lane-head--waiting",
  built: "lane-head--soft",
  done: "lane-head--soft",
  archive: "lane-head--soft",
};

export const KIND_INK: Record<Lane["kind"], string> = {
  inbox: "text-[var(--color-grey)]",
  work: "text-[var(--color-ink)]",
  waiting: "text-[var(--pen-amber)]",
  built: "text-[var(--pen-blue)]",
  done: "text-[var(--pen-green)]",
  archive: "text-[var(--color-grey)]",
};

const TOOL =
  "rounded-[var(--radius-btn)] p-0.5 text-[var(--color-grey-faint)] hover:bg-[var(--fill-subtle)] hover:text-[var(--color-ink)]";

/**
 * The grip's drag handlers, handed down from the lane's <section> to the one
 * button in the header that is allowed to start a lane drag.
 *
 * They travel by context rather than by prop because the hook that makes them
 * has to live *above* the cards, in a component whose `children` are handed to
 * it already rendered. That is not a style choice: calling `useSortable` in
 * the component that also builds the card list re-renders every card under it
 * on dnd-kit's clock, which was enough to make an in-flight edit to a card
 * field vanish before React saw the change event.
 *
 * A context provider is exactly the kind of thing a parent bailout does not
 * stop: consumers re-render straight through it. So nothing below the grip
 * — in particular nothing in the card subtree — may read `LaneDragContext`;
 * doing so would silently defeat the protection this comment describes.
 */
type LaneDragHandle = Pick<
  ReturnType<typeof useSortable>,
  "attributes" | "listeners" | "setActivatorNodeRef"
>;
const LaneDragContext = createContext<LaneDragHandle | null>(null);

/**
 * One lane's <section>: the board's horizontal sortable item, and the drop
 * target its cards land in. `children` arrive already built, so dnd-kit's
 * re-renders stop at this boundary.
 */
function SortableLane(props: {
  lane: Lane;
  className: string;
  overClassName: string;
  pinned: boolean;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    isOver,
    isDragging,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
  } = useSortable({
    id: props.lane.id,
    data: { type: "lane" },
    // A pinned lane always draws first, so dragging it would be a gesture
    // with nowhere to land. It stays a droppable, though — cards still go
    // into it, and that is the point of keeping it in front of you.
    disabled: { draggable: props.pinned, droppable: false },
  });
  const handle = useMemo(
    () => ({ attributes, listeners, setActivatorNodeRef }),
    [attributes, listeners, setActivatorNodeRef],
  );
  return (
    <section
      data-lane={props.lane.key}
      ref={setNodeRef}
      // transform *and* transition, exactly as SortableCard does: a lane that
      // snapped into place while a card glided would be the same broken
      // metaphor from the other side.
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : undefined,
      }}
      data-pinned={props.pinned ? "true" : undefined}
      className={`${props.className} ${isOver ? props.overClassName : ""} ${
        props.pinned ? "paper-lane--pinned" : ""
      }`}
    >
      <LaneDragContext.Provider value={handle}>
        {props.children}
      </LaneDragContext.Provider>
    </section>
  );
}

/**
 * The one control in the lane header that starts a lane drag.
 *
 * The header also carries add-card, collapse, maximise and menu buttons, and
 * the pointer sensor arms after 6px — nowhere near enough to keep a click on
 * one of those from becoming a drag. So the grip is the only thing that
 * listens.
 */
function LaneGrip({ lane, pinned }: { lane: Lane; pinned: boolean }) {
  const handle = useContext(LaneDragContext);
  if (!handle || pinned) return null;
  return (
    <button
      type="button"
      className={`${TOOL} cursor-grab touch-none active:cursor-grabbing`}
      data-testid="lane-drag-handle"
      title={`Reorder ${lane.name} lane`}
      aria-label={`Reorder ${lane.name} lane`}
      ref={handle.setActivatorNodeRef}
      {...handle.attributes}
      {...handle.listeners}
    >
      <GripVertical size={13} />
    </button>
  );
}

/**
 * Renders one kanban column and its droppable card list.
 * The list keeps a tall min-height so empty work lanes remain valid drop targets.
 */
export function LaneColumn(props: {
  lane: Lane;
  cards: Card[];
  visible: (c: Card) => boolean;
  groups: TagGroup[];
  view: "max" | "min" | "";
  onView: (v: "max" | "min" | "") => void;
  onPatch: (id: string, p: CardPatch) => void;
  onArchive: (id: string, on: boolean) => void;
  pinned: ReadonlySet<string>;
  onPin: (id: string, on: boolean) => void;
  projectSlug: string;
  boardSlug: string;
  today: string;
  watchDays: number;
  gates: readonly BoardGate[];
  hiddenByDefault: boolean;
  onAddCard: () => void;
  lanePinned: boolean;
  onPinLane: (on: boolean) => void;
  manage?: {
    disabled: boolean;
    canDelete: boolean;
    canMoveCardsLeft: boolean;
    canMoveCardsRight: boolean;
    canSortCards: boolean;
    onRename: () => void;
    onMoveCards: (delta: -1 | 1) => void;
    onSortCards: (direction: "asc" | "desc") => void;
    onDelete: () => void;
  };
}) {
  const { lane, cards, visible, view } = props;
  const shown = cards.filter(visible);
  const count =
    shown.length === cards.length
      ? String(cards.length)
      : `${shown.length}/${cards.length}`;
  if (props.hiddenByDefault) return null;
  const drawer = lane.kind === "inbox";
  const colorClass = laneColorModifier(lane.color) ?? "";

  // Collapsed, a lane is its own tab edge — and still a drop target. Both
  // states are the same <section> so the width can animate between them:
  // swapping elements would make the board snap open and shut.
  const min = view === "min";
  const width = min
    ? "w-7"
    : view === "max"
      ? "lane-column-width--max"
      : "lane-column-width";

  if (min) {
    return (
      <SortableLane
        lane={lane}
        pinned={props.lanePinned}
        overClassName="paper-lane--over"
        className={`paper-lane lane-spine flex h-full shrink-0 flex-col items-center gap-2 self-stretch py-2 ${width} ${colorClass}`}
      >
        <h2 className={`lane-name ${KIND_INK[lane.kind]}`}>{lane.name}</h2>
        <span
          className="font-mono text-[10px] text-[var(--color-grey-faint)]"
          data-testid="lane-count"
        >
          {count}
        </span>
        <button
          type="button"
          className="flex-1 self-stretch"
          aria-label={`Expand ${lane.name}`}
          onClick={() => props.onView("")}
        />
      </SortableLane>
    );
  }

  return (
    <SortableLane
      lane={lane}
      pinned={props.lanePinned}
      overClassName="paper-lane--over"
      className={`paper-lane flex h-full shrink-0 flex-col gap-2 self-stretch p-2 ${width} ${colorClass} ${drawer ? "paper-lane--drawer" : ""}`}
    >
      <div className={`lane-head ${KIND_RULE[lane.kind]}`}>
        <LaneGrip lane={lane} pinned={props.lanePinned} />
        <h2 className={`lane-name ${KIND_INK[lane.kind]}`}>{lane.name}</h2>
        <span
          className="font-mono text-[11px] text-[var(--color-grey-faint)]"
          data-testid="lane-count"
        >
          {count}
        </span>
        {lane.kind === "waiting" && lane.sla_days && (
          <span className="text-[10px] text-[var(--color-grey)]">
            SLA {lane.sla_days}d
          </span>
        )}
        <span className="ml-auto flex items-center gap-0.5">
          {lane.kind !== "archive" && (
            <button
              type="button"
              className={TOOL}
              title={`Add card to ${lane.name}`}
              aria-label={`Add card to ${lane.name}`}
              onClick={props.onAddCard}
            >
              <Plus size={14} />
            </button>
          )}
          {props.manage && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className={TOOL}
                    aria-label={`Manage ${lane.name} lane`}
                    disabled={props.manage.disabled}
                  />
                }
              >
                <MoreHorizontal size={13} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={props.manage.onRename}>
                  <Pencil /> Edit
                </DropdownMenuItem>
                {/* Pin is the only item here that changes nothing for anyone
                    else: order is shared, this is one person's view of it. */}
                <DropdownMenuItem
                  onClick={() => props.onPinLane(!props.lanePinned)}
                >
                  {props.lanePinned ? <PinOff /> : <Pin />}
                  {props.lanePinned ? "Unpin lane" : "Pin lane"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={
                    !props.manage.canMoveCardsLeft || cards.length === 0
                  }
                  onClick={() => props.manage?.onMoveCards(-1)}
                >
                  <ArrowLeft /> Move all cards left
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={
                    !props.manage.canMoveCardsRight || cards.length === 0
                  }
                  onClick={() => props.manage?.onMoveCards(1)}
                >
                  <ArrowRight /> Move all cards right
                </DropdownMenuItem>
                {props.manage.canSortCards && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={cards.length < 2}
                      onClick={() => props.manage?.onSortCards("asc")}
                    >
                      # Order ascending
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={cards.length < 2}
                      onClick={() => props.manage?.onSortCards("desc")}
                    >
                      # Order descending
                    </DropdownMenuItem>
                  </>
                )}
                {props.manage.canDelete && <DropdownMenuSeparator />}
                {props.manage.canDelete && (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={props.manage.onDelete}
                  >
                    <Trash2 /> Remove
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <button
            type="button"
            className={TOOL}
            title={view === "max" ? "Restore" : "Maximize"}
            onClick={(e) => {
              e.stopPropagation();
              props.onView(view === "max" ? "" : "max");
            }}
            aria-label="Maximize lane"
          >
            <Maximize2 size={13} />
          </button>
          <button
            type="button"
            className={TOOL}
            title="Minimize"
            onClick={(e) => {
              e.stopPropagation();
              props.onView("min");
            }}
            aria-label="Minimize lane"
          >
            <Minus size={13} />
          </button>
        </span>
      </div>
      <SortableContext
        items={cards.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          className={`flex min-h-[160px] flex-1 flex-col overflow-y-auto ${drawer ? "gap-0" : "gap-2"} ${view === "max" ? "grid grid-cols-2 content-start gap-2" : ""}`}
        >
          {cards.map((c) => (
            <SortableCard key={c.id} card={c} hidden={!visible(c)}>
              <CardItem
                card={c}
                groups={props.groups}
                lane={lane}
                flat={drawer}
                onPatch={props.onPatch}
                onArchive={props.onArchive}
                pinned={props.pinned.has(c.id)}
                onPin={props.onPin}
                projectSlug={props.projectSlug}
                boardSlug={props.boardSlug}
                today={props.today}
                watchDays={props.watchDays}
                gates={props.gates}
              />
            </SortableCard>
          ))}
        </div>
      </SortableContext>
    </SortableLane>
  );
}
