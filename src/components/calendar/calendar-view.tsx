"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarSlip } from "@/components/calendar/calendar-slip";
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
  calendarGroups,
  monthMatrix,
} from "@/lib/calendar";

const MONTH_HEADING = new Intl.DateTimeFormat("en-US", {
  month: "long",
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
 * Task 4 wraps this in DndContext; this export is the layout shell.
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
}) {
  return (
    <div className="calendar-page">
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
      <aside className="calendar-tray" data-calendar-tray="">
        <h2>
          Unscheduled{" "}
          <span className="font-mono text-[10px] text-[var(--color-grey)]">
            {props.tray.length}
          </span>
        </h2>
        <div className="calendar-tray-list">
          {props.tray.length === 0 ? (
            <p className="text-xs text-[var(--color-grey)]">Nothing undated</p>
          ) : (
            props.tray.map((slip) => (
              <CalendarSlip
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
    </div>
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
  const { visible, overflow } = calendarDayOverflow(props.slips);
  const dayNum = Number(props.date.slice(8));
  return (
    <div
      className="calendar-day"
      data-calendar-day={props.date}
      data-in-month={props.inMonth ? "true" : "false"}
      data-today={props.isToday ? "true" : "false"}
    >
      <span className="calendar-day-num">{dayNum}</span>
      <div className="calendar-pack">
        {!open &&
          visible.map((slip) => (
            <CalendarSlip
              key={slipKey(slip)}
              slip={slip}
              projectSlug={props.projectSlug}
              showBoard={props.showBoard}
              today={props.today}
              watchDays={props.watchDays}
            />
          ))}
        {overflow > 0 && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger className="calendar-more">
              +{overflow} more
            </PopoverTrigger>
            <PopoverContent className="rounded-[var(--radius-card)] p-0 w-auto shadow-none bg-transparent ring-0">
              <div className="calendar-day-popover">
                {props.slips.map((slip) => (
                  <CalendarSlip
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
  );
}

/**
 * Read-only month of target dates. Pass `onPatch` in Task 4 to enable drag.
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
 * @param props.onPatch - Optional date write; unused until Task 4.
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
  selectedBoards: string[] | null;
  path: string;
  onPatch?: (
    cardId: string,
    targetDate: string | null,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const days = useMemo(
    () => monthMatrix(props.month, props.today),
    [props.month, props.today],
  );
  const { byDate, tray } = useMemo(
    () => calendarGroups(props.slips, days),
    [props.slips, days],
  );
  const monthLabel = MONTH_HEADING.format(new Date(`${props.month}-01`));
  const prevMonth = addCalendarMonths(props.month, -1);
  const nextMonth = addCalendarMonths(props.month, 1);
  const showBoard = props.boardSlug === null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <header className="flex flex-wrap items-end gap-x-5 gap-y-2">
        <div>
          <p className="eyebrow">{props.projectName}</p>
          <h1 className="text-[27px] leading-none">{monthLabel}</h1>
          <p className="mt-1 text-sm text-[var(--color-grey)]">
            {props.heading}
          </p>
        </div>
        <nav className="ml-auto flex items-center gap-3 pb-0.5 text-[12.5px]">
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
      <p role="alert" className="min-h-0 text-sm text-[var(--pen-red)]" />
      <TooltipProvider>
        <CalendarDesk
          projectSlug={props.projectSlug}
          today={props.today}
          watchDays={props.watchDays}
          showBoard={showBoard}
          days={days}
          byDate={byDate}
          tray={tray}
        />
      </TooltipProvider>
    </div>
  );
}
