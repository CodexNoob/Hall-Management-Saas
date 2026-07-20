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

  it("moves safely between months when the destination is shorter", () => {
    expect(dateKey(moveDateByMonth(new Date(2026, 0, 31), 1))).toBe("2026-02-28");
    expect(dateKey(moveDateByMonth(new Date(2024, 0, 31), 1))).toBe("2024-02-29");
  });

  it("handles week and day navigation across month boundaries", () => {
    expect(dateKey(startOfWeek(new Date(2026, 6, 1)))).toBe("2026-06-28");
    expect(dateKey(addDays(new Date(2026, 6, 31), 1))).toBe("2026-08-01");
  });

  it("keeps the database calendar date independent of its time zone suffix", () => {
    expect(dateKeyFromIso("2026-07-31T23:30:00.000Z")).toBe("2026-07-31");
  });
});
