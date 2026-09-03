"use client";

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  assignCardEpic,
  createEpic,
} from "@/app/p/[project]/b/[board]/cockpit/actions";
import { PaperTooltip, PaperTooltipLines } from "@/components/paper-tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TooltipProvider } from "@/components/ui/tooltip";
import { snapCenterToCursor } from "@/lib/dnd";
import type { Card } from "@/lib/types";

type SeedEpic = { id: string; source_name: string };
type Task = Pick<Card, "id" | "external_id" | "title">;

function TaskSlip({
  task,
  overlay = false,
}: {
  task: Task;
  overlay?: boolean;
}) {
  return (
    <span
      className={`inline-flex max-w-full items-baseline gap-1.5 border border-[var(--border-input)] bg-[var(--surface-raised)] px-2 py-1 text-xs ${
        overlay ? "shadow-md" : "cursor-grab"
      }`}
    >
      <span className="font-mono text-[10px] text-[var(--color-grey-faint)]">
        #{task.external_id}
      </span>
      <span className="truncate">{task.title}</span>
    </span>
  );
}

function DraggableTaskSlip({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  });
  return (
    <li
      ref={setNodeRef}
      className={isDragging ? "opacity-40" : undefined}
      {...attributes}
      {...listeners}
    >
      <TaskSlip task={task} />
    </li>
  );
}

/**
 * One inked battery cell per filed task: hover names the card, and the cell
 * itself is a drag handle so a misfiled task can leave for the pool or
 * another epic.
 */
function BatteryCell({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  });
  return (
    <PaperTooltip
      content={
        <PaperTooltipLines
          lines={[task.title, `#${task.external_id}`, "Drag to move or unfile"]}
        />
      }
      triggerClassName="min-w-1 flex-1 cursor-grab"
    >
      <span
        ref={setNodeRef}
        className={`block h-3 w-full animate-in zoom-in-75 bg-[var(--color-ink)] ${
          isDragging ? "opacity-40" : ""
        }`}
        {...attributes}
        {...listeners}
      />
    </PaperTooltip>
  );
}

function EpicDropTarget({
  epic,
  tasks,
  capacity,
}: {
  epic: SeedEpic;
  tasks: Task[];
  capacity: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `epic:${epic.id}` });
  const vacant = Math.max(0, capacity - tasks.length);
  return (
    <div
      ref={setNodeRef}
      className={`epic-tome flex min-h-20 flex-col justify-center gap-1 ${
        isOver ? "epic-tome--over" : ""
      }`}
    >
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--color-grey-faint)]">
        Epic
      </p>
      <p className="truncate text-sm font-medium">{epic.source_name}</p>
      <p className="text-xs text-[var(--color-grey)]">
        {tasks.length
          ? `${tasks.length} task${tasks.length === 1 ? "" : "s"} filed`
          : "Drop tasks here"}
      </p>
      {capacity > 0 && (
        <div className="mt-1 flex gap-[3px] overflow-hidden">
          {tasks.map((task) => (
            <BatteryCell key={task.id} task={task} />
          ))}
          {Array.from({ length: vacant }, (_, index) => (
            <span
              // Vacant charge slots are interchangeable; the index is the identity.
              // biome-ignore lint/suspicious/noArrayIndexKey: see above
              key={index}
              aria-hidden="true"
              className="h-3 min-w-1 flex-1 border border-[var(--border-hairline)] bg-[var(--surface-raised)]"
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** The unfiled pile: draggable slips, and a drop target to unfile a task. */
function TaskPool({ pool }: { pool: Task[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: "pool" });
  return (
    <div
      ref={setNodeRef}
      className={`mt-4 border-t border-[var(--border-hairline)] pt-3 ${
        isOver ? "outline-2 outline-dashed outline-[var(--pen-amber)]" : ""
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.11em] text-[var(--color-grey)]">
        {pool.length
          ? "Drag existing tasks onto an epic"
          : "All tasks filed — drop one back here to unfile it"}
      </p>
      {pool.length > 0 && (
        <ul className="mt-2 flex max-h-48 flex-wrap gap-2 overflow-y-auto">
          {pool.map((task) => (
            <DraggableTaskSlip key={task.id} task={task} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * First-run flow for a cockpit with no epics: name a few epics, then — when
 * the board already has tasks — drag them onto the new epics, which charge up
 * like batteries. A misfiled cell drags back to the pool or another epic.
 * Every step persists immediately; Done hands back the refreshed cockpit.
 */
export function EpicOnboarding({
  boardId,
  unassigned,
  onDoneAction,
}: {
  boardId: string;
  unassigned: Task[];
  onDoneAction: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [epics, setEpics] = useState<SeedEpic[]>([]);
  const [assigned, setAssigned] = useState<ReadonlyMap<string, string>>(
    new Map(),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  // Snapshot of the unfiled pile taken on mount. Each drop revalidates the
  // page and the just-filed card leaves the live `unassigned` prop, which
  // would erase its battery cell and shrink every battery; the flow instead
  // works this fixed roster until Done.
  const [roster] = useState(unassigned);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(KeyboardSensor),
  );

  const pool = roster.filter((task) => !assigned.has(task.id));
  const overlayTask = roster.find((task) => task.id === activeId);

  async function add() {
    setBusy(true);
    setError(null);
    const result = await createEpic(boardId, { name });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEpics((list) =>
      list.some((item) => item.id === result.epic.id)
        ? list
        : [...list, result.epic],
    );
    setName("");
  }

  async function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    if (!event.over) return;
    const overId = String(event.over.id);
    const epicId = overId === "pool" ? null : overId.replace(/^epic:/, "");
    const cardId = String(event.active.id);
    const previous = assigned.get(cardId);
    if ((previous ?? null) === epicId) return;
    setAssigned((map) => {
      const next = new Map(map);
      if (epicId) next.set(cardId, epicId);
      else next.delete(cardId);
      return next;
    });
    const result = await assignCardEpic(cardId, epicId);
    if (!result.ok) {
      setAssigned((map) => {
        const next = new Map(map);
        if (previous) next.set(cardId, previous);
        else next.delete(cardId);
        return next;
      });
      setError(result.error);
    }
  }

  return (
    <section className="mt-8" aria-label="Set up epics">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-grey)]">
        Epics
      </h2>
      <div className="paper-lane p-4">
        <p className="max-w-2xl text-sm text-[var(--color-grey)]">
          This board has no epics yet. Name the big deliveries first — each one
          becomes a signal on this cockpit.
        </p>

        <form
          className="mt-3 flex max-w-xl gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void add();
          }}
        >
          <Input
            required
            maxLength={200}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Epic name — what is being delivered?"
            aria-label="Epic name"
            disabled={busy}
            autoFocus
          />
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? "Adding…" : "Add epic"}
          </Button>
        </form>

        {error && (
          <p
            className="mt-3 border-l-2 border-[var(--pen-red)] px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}

        {epics.length > 0 && (
          <TooltipProvider>
            <DndContext
              id="epic-onboarding-dnd"
              sensors={sensors}
              collisionDetection={pointerWithin}
              onDragStart={(event) => {
                setActiveId(String(event.active.id));
                setError(null);
              }}
              onDragEnd={onDragEnd}
              onDragCancel={() => setActiveId(null)}
            >
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {epics.map((epic) => (
                  <EpicDropTarget
                    key={epic.id}
                    epic={epic}
                    tasks={roster.filter(
                      (task) => assigned.get(task.id) === epic.id,
                    )}
                    capacity={roster.length}
                  />
                ))}
              </div>
              {roster.length > 0 && <TaskPool pool={pool} />}
              <DragOverlay modifiers={[snapCenterToCursor]}>
                {overlayTask ? <TaskSlip task={overlayTask} overlay /> : null}
              </DragOverlay>
            </DndContext>
          </TooltipProvider>
        )}

        {epics.length > 0 && (
          <div className="mt-4 border-t border-[var(--border-hairline)] pt-3">
            <Button
              type="button"
              onClick={() => {
                onDoneAction();
                router.refresh();
              }}
            >
              Done — open the cockpit
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
