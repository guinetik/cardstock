"use client";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  ArrowLeft,
  ArrowRight,
  MoreHorizontal,
  Pencil,
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
import type { Card, Lane, TagGroup } from "@/lib/types";
import { CardItem, SortableCard } from "./card-item";

const KIND_COLOR: Record<Lane["kind"], string> = {
  inbox: "text-[var(--color-grey)]",
  work: "text-[var(--color-ink)]",
  waiting: "text-[var(--color-orange)]",
  built: "text-[var(--color-brand)]",
  done: "text-[var(--color-ok)]",
  archive: "text-[var(--color-grey)]",
};

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
  projectSlug: string;
  boardSlug: string;
  hiddenByDefault: boolean;
  priorityLabel: string;
  manage?: {
    disabled: boolean;
    canMoveLeft: boolean;
    canMoveRight: boolean;
    onRename: () => void;
    onMove: (delta: -1 | 1) => void;
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
  const width =
    view === "max"
      ? "w-[min(880px,44vw)]"
      : view === "min"
        ? "w-10"
        : "w-[clamp(300px,22vw,420px)]";
  return (
    <section
      data-lane={lane.key}
      className={`glass-panel flex h-full shrink-0 flex-col self-stretch ${width} ${lane.kind === "inbox" ? "glass-panel--inbox" : ""} ${isOver ? "ring-2 ring-primary/60" : ""}`}
    >
      <div
        className={`flex items-center gap-1 px-3 pt-2 pb-1 ${view === "min" ? "flex-col" : ""}`}
      >
        <h2
          className={`text-xs font-bold uppercase tracking-wide ${KIND_COLOR[lane.kind]} ${view === "min" ? "[writing-mode:vertical-rl] rotate-180" : ""}`}
        >
          {lane.name}
        </h2>
        <span
          className="font-mono text-xs text-muted-foreground"
          data-testid="lane-count"
        >
          {count}
        </span>
        {lane.kind === "waiting" && lane.sla_days && view !== "min" && (
          <span className="text-[10px] text-muted-foreground">
            · SLA {lane.sla_days}d
          </span>
        )}
        {view !== "min" && (
          <span className="ml-auto flex gap-1">
            {props.manage && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      className="rounded px-1 text-xs text-muted-foreground hover:bg-background hover:text-foreground"
                      aria-label={`Manage ${lane.name} lane`}
                      disabled={props.manage.disabled}
                    />
                  }
                >
                  <MoreHorizontal />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={props.manage.onRename}>
                    <Pencil /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!props.manage.canMoveLeft}
                    onClick={() => props.manage?.onMove(-1)}
                  >
                    <ArrowLeft /> Move left
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!props.manage.canMoveRight}
                    onClick={() => props.manage?.onMove(1)}
                  >
                    <ArrowRight /> Move right
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={props.manage.onDelete}
                  >
                    <Trash2 /> Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <button
              type="button"
              className="rounded px-1 text-xs text-muted-foreground hover:bg-background hover:text-foreground"
              title={view === "max" ? "Restore" : "Maximize"}
              onClick={(e) => {
                e.stopPropagation();
                props.onView(view === "max" ? "" : "max");
              }}
              aria-label="Maximize lane"
            >
              ⤢
            </button>
            <button
              type="button"
              className="rounded px-1 text-xs text-muted-foreground hover:bg-background hover:text-foreground"
              title="Minimize"
              onClick={(e) => {
                e.stopPropagation();
                props.onView("min");
              }}
              aria-label="Minimize lane"
            >
              —
            </button>
          </span>
        )}
      </div>
      {view !== "min" && (
        <SortableContext
          items={cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <div
            ref={setNodeRef}
            className={`flex min-h-[160px] flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 ${view === "max" ? "grid grid-cols-2 content-start" : ""}`}
          >
            {cards.map((c) => (
              <SortableCard key={c.id} card={c} hidden={!visible(c)}>
                <CardItem
                  card={c}
                  groups={props.groups}
                  lane={lane}
                  onPatch={props.onPatch}
                  onArchive={props.onArchive}
                  projectSlug={props.projectSlug}
                  boardSlug={props.boardSlug}
                  priorityLabel={props.priorityLabel}
                />
              </SortableCard>
            ))}
          </div>
        </SortableContext>
      )}
      {view === "min" && (
        <button
          type="button"
          ref={setNodeRef}
          className="flex-1"
          aria-label={`Expand ${lane.name}`}
          onClick={() => props.onView("")}
        />
      )}
    </section>
  );
}
