import { describe, expect, it } from "vitest";
import {
  addDays,
  buildMonthGrid,
  dateKey,
  dateKeyFromIso,
  dateKeyInTimeZone,
  moveDateByMonth,
  startOfDayFromKey,
  startOfWeek,
  todayKeyInTimeZone
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

/**
 * The venue's day, which is the one question a UTC day key cannot answer.
 *
 * A kitchen board left up through service asks "has this date passed?" and the
 * answer has to be the hall's, not the server's - the two part company for the
 * last four hours of every New York evening, which is exactly when the board is
 * being used.
 */
describe("the day it is at the venue", () => {
  // 00:30 UTC on the 5th is still half past eight on the 4th in New York.
  const lateEveningInNewYork = new Date("2026-09-05T00:30:00.000Z");

  it("reads an instant as the calendar day the venue is living in", () => {
    expect(dateKeyInTimeZone(lateEveningInNewYork, "America/New_York")).toBe(
      "2026-09-04"
    );
    expect(dateKeyInTimeZone(lateEveningInNewYork, "UTC")).toBe("2026-09-05");
    // Far enough east that the same instant is already the morning after.
    expect(dateKeyInTimeZone(lateEveningInNewYork, "Asia/Jerusalem")).toBe(
      "2026-09-05"
    );
  });

  it("reads a database calendar date back unchanged at UTC", () => {
    // `@db.Date` columns come back as UTC midnight, which is the whole reason
    // every date label in the product is pinned to UTC.
    expect(dateKeyInTimeZone(new Date("2026-09-04T00:00:00.000Z"), "UTC")).toBe(
      "2026-09-04"
    );
  });

  it("falls back to UTC rather than throwing on a zone it cannot read", () => {
    expect(dateKeyInTimeZone(lateEveningInNewYork, "Not/AZone")).toBe(
      "2026-09-05"
    );
  });

  it("answers today in the venue's zone", () => {
    expect(todayKeyInTimeZone("America/New_York", lateEveningInNewYork)).toBe(
      "2026-09-04"
    );
    expect(todayKeyInTimeZone("UTC", lateEveningInNewYork)).toBe("2026-09-05");
  });

  // The join between a venue day key and the Date-walking grid helpers: the
  // board marks "Today" by key, and builds its columns by adding days to a Date.
  it("round-trips a day key through the local frame the grids use", () => {
    expect(dateKey(startOfDayFromKey("2026-09-04"))).toBe("2026-09-04");
    expect(dateKey(addDays(startOfDayFromKey("2026-09-04"), 1))).toBe(
      "2026-09-05"
    );
  });
});
