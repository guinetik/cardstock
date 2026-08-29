"use client";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  ArrowLeft,
  ArrowRight,
  Maximize2,
  Minus,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { CardPatch } from "@/app/p/[project]/b/[board]/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { laneColorModifier } from "@/lib/card-color";
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

const KIND_INK: Record<Lane["kind"], string> = {
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
  hiddenByDefault: boolean;
  onAddCard: () => void;
  manage?: {
    disabled: boolean;
    canEditName: boolean;
    canMoveLaneLeft: boolean;
    canMoveLaneRight: boolean;
    canMoveCardsLeft: boolean;
    canMoveCardsRight: boolean;
    canSortCards: boolean;
    onRename: () => void;
    onMoveLane: (delta: -1 | 1) => void;
    onMoveCards: (delta: -1 | 1) => void;
    onSortCards: (direction: "asc" | "desc") => void;
    onDelete: () => void;
  };
}) {
  const { lane, cards, visible, view } = props;
  const { setNodeRef, isOver } = useDroppable({ id: lane.id });
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
      ? "w-[min(880px,44vw)]"
      : "w-[clamp(280px,22vw,420px)]";

  if (min) {
    return (
      <section
        data-lane={lane.key}
        ref={setNodeRef}
        className={`paper-lane lane-spine flex h-full shrink-0 flex-col items-center gap-2 self-stretch py-2 ${width} ${colorClass} ${isOver ? "paper-lane--over" : ""}`}
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
      </section>
    );
  }

  return (
    <section
      data-lane={lane.key}
      className={`paper-lane flex h-full shrink-0 flex-col gap-2 self-stretch p-2 ${width} ${colorClass} ${drawer ? "paper-lane--drawer" : ""} ${isOver ? "paper-lane--over" : ""}`}
    >
      <div className={`lane-head ${KIND_RULE[lane.kind]}`}>
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
                  <Pencil /> {props.manage.canEditName ? "Edit" : "Edit color"}
                </DropdownMenuItem>
                {props.manage.canEditName && (
                  <>
                    <DropdownMenuItem
                      disabled={!props.manage.canMoveLaneLeft}
                      onClick={() => props.manage?.onMoveLane(-1)}
                    >
                      <ArrowLeft /> Move lane left
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!props.manage.canMoveLaneRight}
                      onClick={() => props.manage?.onMoveLane(1)}
                    >
                      <ArrowRight /> Move lane right
                    </DropdownMenuItem>
                  </>
                )}
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
                {props.manage.canEditName && <DropdownMenuSeparator />}
                {props.manage.canEditName && (
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
          ref={setNodeRef}
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
              />
            </SortableCard>
          ))}
        </div>
      </SortableContext>
    </section>
  );
}
