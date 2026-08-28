import { describe, expect, it } from "vitest";
import {
  addDays,
  buildMonthGrid,
  dateKey,
  dateKeyFromIso,
  moveDateByMonth,
  startOfWeek
} from "@/lib/dates/calendar-date";

describe("calendar date helpers", () => {
  it("builds a six-week month grid beginning on Sunday", () => {
    const grid = buildMonthGrid(new Date(2026, 6, 1));

    expect(grid).toHaveLength(42);
    expect(grid[0].dateKey).toBe("2026-06-28");
    expect(grid[3]).toMatchObject({
      currentMonth: true,
      dateKey: "2026-07-01",
      day: 1
    });
    expect(grid[41].dateKey).toBe("2026-08-08");
  });

  // July 2026 opens on a Wednesday, so each start day pulls a different number
  // of days in from June: none for Wednesday itself, and the grid always keeps
  // the 1st inside it.
  it("starts the grid on the day Settings names", () => {
    const saturdayGrid = buildMonthGrid(new Date(2026, 6, 1), "saturday");
    expect(saturdayGrid[0].dateKey).toBe("2026-06-27");
    expect(saturdayGrid[0].date.getDay()).toBe(6);
    expect(saturdayGrid[4]).toMatchObject({
      currentMonth: true,
      dateKey: "2026-07-01"
    });

    const mondayGrid = buildMonthGrid(new Date(2026, 6, 1), "monday");
    expect(mondayGrid[0].dateKey).toBe("2026-06-29");
    expect(mondayGrid[0].date.getDay()).toBe(1);
  });

  // Every rotation has to reach the last day of the longest month, which is
  // what makes 42 cells enough rather than only enough for Sunday.
  it("covers the whole month from every start day", () => {
    for (const weekStartsOn of ["sunday", "monday", "saturday"] as const) {
      for (const month of [new Date(2026, 0, 1), new Date(2026, 7, 1)]) {
        const grid = buildMonthGrid(month, weekStartsOn);
        const daysInMonth = grid.filter((day) => day.currentMonth);
        expect(daysInMonth).toHaveLength(31);
        expect(daysInMonth[0].day).toBe(1);
        expect(daysInMonth[30].day).toBe(31);
      }
    }
  });

  it("moves safely between months when the destination is shorter", () => {
    expect(dateKey(moveDateByMonth(new Date(2026, 0, 31), 1))).toBe(
      "2026-02-28"
    );
    expect(dateKey(moveDateByMonth(new Date(2024, 0, 31), 1))).toBe(
      "2024-02-29"
    );
  });

  it("handles week and day navigation across month boundaries", () => {
    expect(dateKey(startOfWeek(new Date(2026, 6, 1)))).toBe("2026-06-28");
    expect(dateKey(startOfWeek(new Date(2026, 6, 1), "saturday"))).toBe(
      "2026-06-27"
    );
    // A Saturday is already the start of its own week, not six days into the
    // previous one.
    expect(dateKey(startOfWeek(new Date(2026, 6, 4), "saturday"))).toBe(
      "2026-07-04"
    );
    expect(dateKey(addDays(new Date(2026, 6, 31), 1))).toBe("2026-08-01");
  });

  it("keeps the database calendar date independent of its time zone suffix", () => {
    expect(dateKeyFromIso("2026-07-31T23:30:00.000Z")).toBe("2026-07-31");
  });
});
