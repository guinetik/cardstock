"use client";

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { updateCard } from "@/app/p/[project]/b/[board]/actions";
import { CalendarSlip } from "@/components/calendar/calendar-slip";
import { DraggableCalendarSlip } from "@/components/calendar/draggable-calendar-slip";
import { useCalendarRealtime } from "@/components/calendar/use-calendar-realtime";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  addCalendarMonths,
  CALENDAR_WEEKDAYS,
  type CalendarSlip as CalendarSlipData,
  calendarDayOverflow,
  calendarDropDate,
  calendarGroups,
  fuzzyMatch,
  monthMatrix,
} from "@/lib/calendar";
import { snapCenterToCursor } from "@/lib/dnd";

const MONTH_HEADING = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const POPOVER_DAY = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function boardsHref(
  path: string,
  month: string,
  selected: string[] | null,
  known: { slug: string }[],
  toggle: string,
): string {
  const all = known.map((b) => b.slug);
  const current = selected ?? all;
  const next = current.includes(toggle)
    ? current.filter((slug) => slug !== toggle)
    : [...current, toggle];
  const params = new URLSearchParams({ month });
  if (next.length > 0 && next.length < all.length) {
    params.set("boards", next.join(","));
  }
  return `${path}?${params.toString()}`;
}

function monthHref(
  path: string,
  month: string,
  selectedBoards: string[] | null,
): string {
  const params = new URLSearchParams({ month });
  if (selectedBoards && selectedBoards.length > 0) {
    params.set("boards", selectedBoards.join(","));
  }
  return `${path}?${params.toString()}`;
}

function slipKey(slip: CalendarSlipData): string {
  return `${slip.boardSlug}:${slip.card.id}`;
}

/**
 * Month grid of target-date slips plus the unscheduled tray.
 *
 * @param props.projectSlug - Project URL slug for card links.
 * @param props.today - UTC day key.
 * @param props.watchDays - Forgotten watch window for CardAge.
 * @param props.showBoard - Print board names on slips (project calendar).
 * @param props.days - Cells from {@link monthMatrix}.
 * @param props.byDate - Slips keyed by UTC day.
 * @param props.tray - Cards with no target date.
 */
export function CalendarDesk(props: {
  projectSlug: string;
  today: string;
  watchDays: number;
  showBoard: boolean;
  days: ReturnType<typeof monthMatrix>;
  byDate: Map<string, CalendarSlipData[]>;
  tray: CalendarSlipData[];
  /** Month stepping links, laid along the calendar's own edge. */
  nav?: React.ReactNode;
}) {
  return (
    <div className="calendar-page">
      <div className="calendar-main">
        {props.nav}
        <div className="calendar-grid">
          {CALENDAR_WEEKDAYS.map((label) => (
            <div key={label} className="calendar-dow">
              {label}
            </div>
          ))}
          {props.days.map((day) => (
            <CalendarDayCell
              key={day.date}
              date={day.date}
              inMonth={day.inMonth}
              isToday={day.isToday}
              slips={props.byDate.get(day.date) ?? []}
              projectSlug={props.projectSlug}
              showBoard={props.showBoard}
              today={props.today}
              watchDays={props.watchDays}
            />
          ))}
        </div>
      </div>
      <CalendarTray
        slips={props.tray}
        projectSlug={props.projectSlug}
        showBoard={props.showBoard}
        today={props.today}
        watchDays={props.watchDays}
      />
    </div>
  );
}

function CalendarTray(props: {
  slips: CalendarSlipData[];
  projectSlug: string;
  showBoard: boolean;
  today: string;
  watchDays: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "calendar-tray" });
  const [query, setQuery] = useState("");
  const [epic, setEpic] = useState("all");
  const epics = useMemo(
    () =>
      [
        ...new Set(
          props.slips.flatMap((slip) =>
            slip.card.epic?.trim() ? [slip.card.epic.trim()] : [],
          ),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [props.slips],
  );
  const shown = props.slips.filter(
    (slip) =>
      (epic === "all" || slip.card.epic?.trim() === epic) &&
      fuzzyMatch(
        query,
        `#${slip.card.external_id} ${slip.card.title} ${slip.card.epic ?? ""}`,
      ),
  );
  const filtering = query.trim() !== "" || epic !== "all";
  return (
    <aside
      ref={setNodeRef}
      className="calendar-tray"
      data-calendar-tray=""
      data-over={isOver ? "" : undefined}
    >
      <h2>
        Unscheduled{" "}
        <span className="font-mono text-[10px] text-[var(--color-grey)]">
          {filtering
            ? `${shown.length} of ${props.slips.length}`
            : shown.length}
        </span>
      </h2>
      {props.slips.length > 0 && (
        <div className="mb-2 grid gap-1.5">
          <input
            className="paper-field h-7 w-full bg-[var(--surface-raised)] text-xs"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a card"
            aria-label="Search unscheduled cards"
          />
          {epics.length > 0 && (
            <select
              className="paper-field h-7 w-full bg-[var(--surface-raised)] text-xs"
              value={epic}
              onChange={(event) => setEpic(event.target.value)}
              aria-label="Filter by epic"
            >
              <option value="all">All epics</option>
              {epics.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
      <div className="calendar-tray-list">
        {props.slips.length === 0 ? (
          <p className="text-xs text-[var(--color-grey)]">Nothing undated</p>
        ) : shown.length === 0 ? (
          <p className="text-xs text-[var(--color-grey)]">
            No cards match this search
          </p>
        ) : (
          shown.map((slip) => (
            <DraggableCalendarSlip
              key={slipKey(slip)}
              slip={slip}
              projectSlug={props.projectSlug}
              showBoard={props.showBoard}
              today={props.today}
              watchDays={props.watchDays}
            />
          ))
        )}
      </div>
    </aside>
  );
}

function CalendarDayCell(props: {
  date: string;
  inMonth: boolean;
  isToday: boolean;
  slips: CalendarSlipData[];
  projectSlug: string;
  showBoard: boolean;
  today: string;
  watchDays: number;
}) {
  const [open, setOpen] = useState(false);
  const { setNodeRef, isOver } = useDroppable({
    id: `calendar-day:${props.date}`,
  });
  const { setNodeRef: setPopoverRef, isOver: popoverOver } = useDroppable({
    id: `calendar-day:${props.date}:popover`,
  });
  const { visible, overflow } = calendarDayOverflow(props.slips);
  const dayNum = Number(props.date.slice(8));
  return (
    <div
      ref={setNodeRef}
      className="calendar-day"
      data-calendar-day={props.date}
      data-in-month={props.inMonth ? "true" : "false"}
      data-today={props.isToday ? "true" : "false"}
      data-overflow={overflow > 0 ? "true" : undefined}
      data-over={isOver ? "" : undefined}
    >
      <div className="calendar-day-body">
        <span className="calendar-day-num">{dayNum}</span>
        <div className="calendar-pack">
          {!open &&
            visible.map((slip) => (
              <DraggableCalendarSlip
                key={slipKey(slip)}
                slip={slip}
                projectSlug={props.projectSlug}
                showBoard={props.showBoard}
                today={props.today}
                watchDays={props.watchDays}
                stub
              />
            ))}
          {overflow > 0 && (
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger className="calendar-more">
                +{overflow}
              </PopoverTrigger>
              <PopoverContent className="rounded-[var(--radius-card)] p-0 w-auto shadow-none bg-transparent ring-0">
                <div
                  ref={setPopoverRef}
                  className="calendar-day-popover"
                  data-over={popoverOver ? "" : undefined}
                >
                  <h3 className="calendar-day-popover-title">
                    {POPOVER_DAY.format(new Date(`${props.date}T00:00:00Z`))}
                  </h3>
                  {props.slips.map((slip) => (
                    <DraggableCalendarSlip
                      key={slipKey(slip)}
                      slip={slip}
                      projectSlug={props.projectSlug}
                      showBoard={props.showBoard}
                      today={props.today}
                      watchDays={props.watchDays}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Month of target dates. Slips drag onto days or the tray; drops call `updateCard`.
 *
 * @param props.projectSlug - Project URL slug.
 * @param props.projectName - Mono eyebrow.
 * @param props.boardSlug - Board slug, or null on the project calendar.
 * @param props.heading - Board or project title beside the month.
 * @param props.month - Visible `YYYY-MM`.
 * @param props.today - UTC day key.
 * @param props.watchDays - Forgotten watch window.
 * @param props.slips - Live slips already filtered by the server.
 * @param props.boards - Known boards for filter chips.
 * @param props.selectedBoards - Chip filter, or null for all.
 * @param props.path - Page path for month and chip links.
 */
export function CalendarView(props: {
  projectSlug: string;
  projectName: string;
  boardSlug: string | null;
  heading: string;
  month: string;
  today: string;
  watchDays: number;
  slips: CalendarSlipData[];
  boards: { slug: string; name: string }[];
  boardIds: string[];
  selectedBoards: string[] | null;
  path: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(props.slips);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingDrops, setPendingDrops] = useState(0);
  useEffect(() => setItems(props.slips), [props.slips]);
  useCalendarRealtime({
    boardIds: props.boardIds,
    busy: activeId !== null || pendingDrops > 0,
    refresh: () => router.refresh(),
  });

  const days = useMemo(
    () => monthMatrix(props.month, props.today),
    [props.month, props.today],
  );
  const { byDate, tray } = useMemo(
    () => calendarGroups(items, days),
    [items, days],
  );
  const monthLabel = MONTH_HEADING.format(new Date(`${props.month}-01`));
  const prevMonth = addCalendarMonths(props.month, -1);
  const nextMonth = addCalendarMonths(props.month, 1);
  const boardBase = props.boardSlug
    ? `/p/${props.projectSlug}/b/${props.boardSlug}`
    : null;
  const projectHref = `/p/${props.projectSlug}`;
  const showBoard = props.boardSlug === null;
  const overlay = items.find((slip) => slip.card.id === activeId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(KeyboardSensor),
  );

  function applyTarget(cardId: string, targetDate: string | null) {
    setItems((prev) =>
      prev.map((slip) =>
        slip.card.id === cardId
          ? { ...slip, card: { ...slip.card, target_date: targetDate } }
          : slip,
      ),
    );
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
    setError(null);
  }

  async function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const over = event.over?.id;
    const cardId = String(event.active.id);
    if (!over) return;
    const previous = items.find((slip) => slip.card.id === cardId);
    if (!previous) return;
    let next: string | null | undefined;
    if (over === "calendar-tray") next = null;
    else {
      const day = calendarDropDate(String(over));
      if (day) next = day;
    }
    if (next === undefined) return;
    if (next === previous.card.target_date) return;
    applyTarget(cardId, next);
    setPendingDrops((count) => count + 1);
    try {
      const result = await updateCard(cardId, { target_date: next });
      if (!result.ok) {
        applyTarget(cardId, previous.card.target_date);
        setError(result.error);
      }
    } finally {
      setPendingDrops((count) => count - 1);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <header className="flex flex-col gap-2">
        <div>
          <p className="eyebrow">{props.projectName}</p>
          <h1 className="text-[27px] leading-none">{monthLabel}</h1>
          <p className="mt-1 text-sm text-[var(--color-grey)]">
            {props.heading}
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            {boardBase ? (
              <nav
                className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]"
                aria-label="Board views"
              >
                <Link className="paper-link" href={boardBase}>
                  Board
                </Link>
                <Link className="paper-link" href={`${boardBase}/cockpit`}>
                  Epic Cockpit
                </Link>
                <Link className="paper-link" href={`${boardBase}/timeline`}>
                  Timeline
                </Link>
                <Link className="paper-link" href={`${boardBase}/manage`}>
                  Manage
                </Link>
                <Link className="paper-link" href={projectHref}>
                  Project
                </Link>
              </nav>
            ) : (
              <nav
                className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]"
                aria-label="Project views"
              >
                <Link className="paper-link" href={projectHref}>
                  Project
                </Link>
              </nav>
            )}
          </div>
        </div>
      </header>
      {props.boards.length > 1 && (
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
                  props.month,
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
      <TooltipProvider>
        <DndContext
          id="calendar-dnd"
          sensors={sensors}
          collisionDetection={pointerWithin}
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <CalendarDesk
            projectSlug={props.projectSlug}
            today={props.today}
            watchDays={props.watchDays}
            showBoard={showBoard}
            days={days}
            byDate={byDate}
            tray={tray}
            nav={
              <nav className="calendar-nav" aria-label="Calendar months">
                <Link
                  className="paper-link"
                  href={monthHref(props.path, prevMonth, props.selectedBoards)}
                >
                  Previous
                </Link>
                <Link
                  className="paper-link"
                  href={monthHref(props.path, nextMonth, props.selectedBoards)}
                >
                  Next
                </Link>
              </nav>
            }
          />
          <DragOverlay modifiers={[snapCenterToCursor]}>
            {overlay ? (
              <CalendarSlip
                slip={overlay}
                projectSlug={props.projectSlug}
                showBoard={showBoard}
                today={props.today}
                watchDays={props.watchDays}
                stub={overlay.card.target_date !== null}
                overlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </TooltipProvider>
    </div>
  );
}
