import type { BoardGate } from "./gates";
import type { Card } from "./types";

const DAY = 86_400_000;
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DAY_DROP = /^calendar-day:(\d{4}-\d{2}-\d{2})(?::popover)?$/;

/** Visible slips in a day cell before "+N more". */
export const CALENDAR_DAY_CAP = 4;

/** Sunday-first weekday labels for the month grid header. */
export const CALENDAR_WEEKDAYS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

/** One cell in the Sunday-start month matrix. */
export interface CalendarDay {
  date: string;
  inMonth: boolean;
  isToday: boolean;
}

/** Card fields a calendar slip and CardAge need. */
export type CalendarCard = Pick<
  Card,
  | "id"
  | "external_id"
  | "title"
  | "color"
  | "raised_on"
  | "target_date"
  | "target_label"
  | "status"
  | "shipped_on"
  | "lane_id"
>;

/** A card placed on the month, tagged with the board CardAge must use. */
export interface CalendarSlip {
  card: CalendarCard;
  boardSlug: string;
  boardName: string;
  gates: readonly BoardGate[];
}

/**
 * Visible month from a query param. Garbage falls back to `today`'s UTC month.
 *
 * @param value - `searchParams.month` (string, array, or missing).
 * @param today - UTC day key `YYYY-MM-DD`.
 */
export function calendarMonth(value: unknown, today: string): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" && MONTH.test(raw) ? raw : today.slice(0, 7);
}

/**
 * Step a `YYYY-MM` by whole months in UTC.
 *
 * @param month - `YYYY-MM`.
 * @param delta - Months to add (negative allowed).
 */
export function addCalendarMonths(month: string, delta: number): string {
  const [yearText, monthText] = month.split("-");
  const shifted = new Date(
    Date.UTC(Number(yearText), Number(monthText) - 1 + delta, 1),
  );
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Board-chip filter. `null` means every known board.
 * Unknown slugs are dropped; nothing left means all.
 *
 * @param value - `searchParams.boards`.
 * @param known - Board slugs in the project.
 */
export function calendarBoards(
  value: unknown,
  known: readonly string[],
): string[] | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || !raw.trim()) return null;
  const wanted = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const ok = wanted.filter((slug) => known.includes(slug));
  return ok.length > 0 ? ok : null;
}

/**
 * Complete Sunday-start weeks covering `month`, including neighbour days.
 *
 * @param month - `YYYY-MM`.
 * @param today - UTC day key for the today outline.
 */
export function monthMatrix(month: string, today: string): CalendarDay[] {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const last = new Date(Date.UTC(year, monthIndex + 1, 0));
  const start = new Date(first.getTime() - first.getUTCDay() * DAY);
  const end = new Date(last.getTime() + (6 - last.getUTCDay()) * DAY);
  const days: CalendarDay[] = [];
  for (let time = start.getTime(); time <= end.getTime(); time += DAY) {
    const date = new Date(time).toISOString().slice(0, 10);
    days.push({
      date,
      inMonth: date.startsWith(month),
      isToday: date === today,
    });
  }
  return days;
}

function byExternalId(a: CalendarSlip, b: CalendarSlip): number {
  return a.card.external_id.localeCompare(b.card.external_id, undefined, {
    numeric: true,
  });
}

/**
 * Split slips into days present in this matrix versus the unscheduled tray.
 * A target outside the matrix is omitted (not tray).
 *
 * @param slips - Live (non-archived) slips.
 * @param days - From {@link monthMatrix}.
 */
export function calendarGroups(
  slips: CalendarSlip[],
  days: CalendarDay[],
): { byDate: Map<string, CalendarSlip[]>; tray: CalendarSlip[] } {
  const present = new Set(days.map((day) => day.date));
  const byDate = new Map<string, CalendarSlip[]>();
  const tray: CalendarSlip[] = [];
  for (const slip of slips) {
    const target = slip.card.target_date;
    if (!target) {
      tray.push(slip);
      continue;
    }
    if (!present.has(target)) continue;
    const list = byDate.get(target) ?? [];
    list.push(slip);
    byDate.set(target, list);
  }
  for (const list of byDate.values()) list.sort(byExternalId);
  tray.sort(byExternalId);
  return { byDate, tray };
}

/**
 * First {@link CALENDAR_DAY_CAP} slips stay in the cell; the rest are `+N`.
 *
 * @param slips - Already sorted day's slips.
 */
export function calendarDayOverflow<T>(slips: readonly T[]): {
  visible: T[];
  overflow: number;
} {
  if (slips.length <= CALENDAR_DAY_CAP) {
    return { visible: [...slips], overflow: 0 };
  }
  return {
    visible: slips.slice(0, CALENDAR_DAY_CAP),
    overflow: slips.length - CALENDAR_DAY_CAP,
  };
}

/**
 * UTC day key from a calendar droppable id, or `null`.
 *
 * Accepts `calendar-day:YYYY-MM-DD` and `calendar-day:YYYY-MM-DD:popover`.
 *
 * @param overId - dnd-kit `over.id`.
 */
export function calendarDropDate(overId: string): string | null {
  return DAY_DROP.exec(overId)?.[1] ?? null;
}
