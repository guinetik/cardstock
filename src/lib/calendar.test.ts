import { describe, expect, test } from "bun:test";
import type { CalendarSlip } from "./calendar";
import {
  addCalendarMonths,
  calendarBoards,
  calendarDayOverflow,
  calendarDropDate,
  calendarGroups,
  calendarMonth,
  monthMatrix,
} from "./calendar";

const slip = (
  patch: Partial<CalendarSlip["card"]> & { id?: string } = {},
): CalendarSlip => ({
  boardSlug: "backlog",
  boardName: "Product backlog",
  gates: [],
  card: {
    id: patch.id ?? "c1",
    external_id: "1",
    title: "One",
    color: null,
    raised_on: "2026-08-01",
    target_date: null,
    target_label: null,
    status: "backlog",
    shipped_on: null,
    lane_id: "lane-1",
    ...patch,
  },
});

describe("calendarMonth", () => {
  test("keeps a valid YYYY-MM and falls back for garbage", () => {
    expect(calendarMonth("2026-09", "2026-09-02")).toBe("2026-09");
    expect(calendarMonth("2026-13", "2026-09-02")).toBe("2026-09");
    expect(calendarMonth("banana", "2026-09-02")).toBe("2026-09");
    expect(calendarMonth(undefined, "2026-09-02")).toBe("2026-09");
    expect(calendarMonth(["2026-10", "2026-11"], "2026-09-02")).toBe("2026-10");
  });
});

describe("addCalendarMonths", () => {
  test("steps across year boundaries", () => {
    expect(addCalendarMonths("2026-09", 1)).toBe("2026-10");
    expect(addCalendarMonths("2026-01", -1)).toBe("2025-12");
  });
});

describe("calendarBoards", () => {
  const known = ["backlog", "ops"];
  test("omits unknown slugs and treats empty as all", () => {
    expect(calendarBoards(undefined, known)).toBeNull();
    expect(calendarBoards("", known)).toBeNull();
    expect(calendarBoards("nope", known)).toBeNull();
    expect(calendarBoards("backlog,nope", known)).toEqual(["backlog"]);
    expect(calendarBoards("ops,backlog", known)).toEqual(["ops", "backlog"]);
  });
});

describe("monthMatrix", () => {
  test("September 2026 starts Tuesday — first cell is Sunday 30 Aug", () => {
    const days = monthMatrix("2026-09", "2026-09-02");
    expect(days[0]).toEqual({
      date: "2026-08-30",
      inMonth: false,
      isToday: false,
    });
    expect(days.find((d) => d.date === "2026-09-01")).toEqual({
      date: "2026-09-01",
      inMonth: true,
      isToday: false,
    });
    expect(days.find((d) => d.date === "2026-09-02")?.isToday).toBe(true);
    expect(days.at(-1)?.date).toBe("2026-10-03");
    expect(days).toHaveLength(35);
  });

  test("February 2026 is four exact weeks", () => {
    const days = monthMatrix("2026-02", "2026-02-01");
    expect(days[0]?.date).toBe("2026-02-01");
    expect(days.at(-1)?.date).toBe("2026-02-28");
    expect(days).toHaveLength(28);
  });

  test("February 2028 leap month pads to complete weeks", () => {
    const days = monthMatrix("2028-02", "2028-02-01");
    expect(days.some((d) => d.date === "2028-02-29" && d.inMonth)).toBe(true);
    expect(days.length % 7).toBe(0);
  });
});

describe("calendarGroups", () => {
  test("puts dated cards on their day, labels in the tray, ignores off-matrix dates", () => {
    const days = monthMatrix("2026-09", "2026-09-02");
    const { byDate, tray } = calendarGroups(
      [
        slip({ id: "on", external_id: "10", target_date: "2026-09-15" }),
        slip({ id: "pad", external_id: "2", target_date: "2026-08-31" }),
        slip({ id: "away", external_id: "3", target_date: "2026-11-01" }),
        slip({ id: "none", external_id: "4", target_date: null }),
        slip({
          id: "rough",
          external_id: "5",
          target_date: null,
          target_label: "end of Q3",
        }),
      ],
      days,
    );
    expect(byDate.get("2026-09-15")?.map((s) => s.card.id)).toEqual(["on"]);
    expect(byDate.get("2026-08-31")?.map((s) => s.card.id)).toEqual(["pad"]);
    expect(byDate.has("2026-11-01")).toBe(false);
    expect(tray.map((s) => s.card.id).sort()).toEqual(["none", "rough"]);
  });

  test("sorts a day by numeric external_id", () => {
    const days = monthMatrix("2026-09", "2026-09-02");
    const { byDate } = calendarGroups(
      [
        slip({ id: "b", external_id: "10", target_date: "2026-09-15" }),
        slip({ id: "a", external_id: "2", target_date: "2026-09-15" }),
      ],
      days,
    );
    expect(byDate.get("2026-09-15")?.map((s) => s.card.external_id)).toEqual([
      "2",
      "10",
    ]);
  });
});

describe("calendarDayOverflow", () => {
  test("caps at four visible slips", () => {
    expect(calendarDayOverflow([1, 2, 3, 4])).toEqual({
      visible: [1, 2, 3, 4],
      overflow: 0,
    });
    expect(calendarDayOverflow([1, 2, 3, 4, 5, 6]).overflow).toBe(2);
    expect(calendarDayOverflow([1, 2, 3, 4, 5, 6]).visible).toEqual([
      1, 2, 3, 4,
    ]);
  });
});

describe("calendarDropDate", () => {
  test("reads the day key from a cell or its popover", () => {
    expect(calendarDropDate("calendar-day:2026-09-18")).toBe("2026-09-18");
    expect(calendarDropDate("calendar-day:2026-09-18:popover")).toBe(
      "2026-09-18",
    );
    expect(calendarDropDate("calendar-tray")).toBeNull();
    expect(calendarDropDate("calendar-day:not-a-day")).toBeNull();
  });
});
