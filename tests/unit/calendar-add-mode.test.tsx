import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/dashboard/calendar"
}));

vi.mock("@/lib/http/authenticated-fetch", () => ({
  authenticatedFetch: vi.fn()
}));

import { clearAuthenticatedQueryCache } from "@/features/dashboard/hooks/use-authenticated-query";
import { EventCalendarPage } from "@/features/calendar/components/event-calendar-page";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import { cacheTestSessionForStarterRole } from "./auth-session-fixture";

/**
 * The two Settings > Calendar preferences the month grid draws itself from.
 *
 * Both reach the page through /api/calendar rather than a second settings
 * request, so these mount the page against a stubbed response and read the grid
 * back: which day the first column holds, and whether a day is booked from a +
 * button or from the cell itself.
 */

type CalendarSettings = {
  dailyEventLimit: number;
  weekStartsOn?: "sunday" | "monday" | "saturday";
  clickAnywhereToAdd?: boolean;
};

function respondWith(calendarSettings: CalendarSettings) {
  vi.mocked(authenticatedFetch).mockImplementation(
    async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          events: [],
          halls: [{ id: "hall-1", name: "Hall 1", dailyEventLimit: 4 }],
          eventTypes: [],
          blockedDates: [],
          calendarSettings
        })
      }) as unknown as Response
  );
}

async function mountCalendar(calendarSettings: CalendarSettings) {
  respondWith(calendarSettings);
  await act(async () => {
    render(<EventCalendarPage />);
  });
}

/** The seven column headings, in the order the grid renders them. */
function weekdayHeadings() {
  return screen
    .getAllByText(/^(SUN|MON|TUE|WED|THU|FRI|SAT)$/)
    .map((element) => element.textContent);
}

function bookingDialog() {
  return screen.queryByRole("dialog", { name: /booking/i });
}

describe("Calendar add mode and week start", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Pinned so "which day is in the first column" is a fact about the grid
    // rather than about the day the suite happens to run.
    vi.setSystemTime(new Date(2026, 6, 15));
    window.localStorage.clear();
    window.history.replaceState({}, "", "/dashboard/calendar");
    cacheTestSessionForStarterRole("event-manager");
    vi.mocked(authenticatedFetch).mockReset();
    clearAuthenticatedQueryCache();
  });

  it("keeps the + button and a Sunday grid by default", async () => {
    await mountCalendar({ dailyEventLimit: 4 });

    expect(weekdayHeadings()[0]).toBe("SUN");
    expect(screen.getAllByLabelText(/^Book July \d+, 2026$/).length).toBe(31);
    // The cell behind the + button only selects the day.
    expect(screen.getByLabelText("Select July 20, 2026")).toBeInTheDocument();
  });

  it("starts the week on Saturday when Settings says so", async () => {
    await mountCalendar({ dailyEventLimit: 4, weekStartsOn: "saturday" });

    expect(weekdayHeadings()).toEqual([
      "SAT",
      "SUN",
      "MON",
      "TUE",
      "WED",
      "THU",
      "FRI"
    ]);
  });

  it("drops the + button and books from the day itself when click-anywhere is on", async () => {
    await mountCalendar({ dailyEventLimit: 4, clickAnywhereToAdd: true });

    // No + button left on any day, and the cell carries the booking action that
    // used to belong to it.
    expect(screen.queryAllByText("+")).toHaveLength(0);
    expect(
      screen.queryByLabelText("Select July 20, 2026")
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Book July 20, 2026")).toBeInTheDocument();

    expect(bookingDialog()).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Book July 20, 2026"));
    });
    expect(bookingDialog()).not.toBeNull();
  });

  it("still only selects a day that cannot take a booking", async () => {
    // Days outside the visible month are never bookable, whichever mode is on.
    await mountCalendar({ dailyEventLimit: 4, clickAnywhereToAdd: true });

    expect(screen.getByLabelText("Select August 1, 2026")).toBeInTheDocument();
  });
});
