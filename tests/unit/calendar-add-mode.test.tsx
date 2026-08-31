import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen
} from "@testing-library/react";
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
 * The Settings > Calendar preferences the calendar draws itself from.
 *
 * They all reach the page through /api/calendar rather than a second settings
 * request, so these mount the page against a stubbed response and read the
 * result back: which day the first column holds, whether a day is booked from a
 * + button or from the cell itself, and which of the three views a visit opens
 * on.
 */

type CalendarSettings = {
  dailyEventLimit: number;
  defaultView?: "month" | "week" | "agenda";
  weekStartsOn?: "sunday" | "monday" | "saturday";
  showHebrewDate?: boolean;
  showAvailability?: boolean;
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

describe("Calendar default view", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 15));
    window.localStorage.clear();
    window.history.replaceState({}, "", "/dashboard/calendar");
    cacheTestSessionForStarterRole("event-manager");
    vi.mocked(authenticatedFetch).mockReset();
    clearAuthenticatedQueryCache();
  });

  /** The panel heading, which names the view - not the topbar's page title. */
  function viewHeading(name: string) {
    return screen.queryByRole("heading", { name });
  }

  /** A second mount in one test, from a clean document and a clean cache. */
  async function remountCalendar(calendarSettings: CalendarSettings) {
    cleanup();
    clearAuthenticatedQueryCache();
    await mountCalendar(calendarSettings);
  }

  it("opens on the month grid when nothing is saved", async () => {
    await mountCalendar({ dailyEventLimit: 4 });

    expect(viewHeading("Month Calendar")).toBeInTheDocument();
    expect(screen.getByText("July 2026")).toBeInTheDocument();
  });

  it("opens on the week the selected day falls in when Settings says week", async () => {
    await mountCalendar({ dailyEventLimit: 4, defaultView: "week" });

    expect(viewHeading("Week Calendar")).toBeInTheDocument();
    // Sunday-start week around Wednesday 15 July 2026, and arrows that step by
    // the unit the view is measured in.
    expect(screen.getByText("Jul 12 – Jul 18, 2026")).toBeInTheDocument();
    expect(screen.getByLabelText("Show previous week")).toBeInTheDocument();
    expect(screen.getByLabelText("Book July 18, 2026")).toBeInTheDocument();
    // A week reaching into the next month still books every day it shows.
    expect(screen.queryByLabelText("Book July 31, 2026")).toBeNull();
  });

  it("steps a week at a time from the week view", async () => {
    await mountCalendar({ dailyEventLimit: 4, defaultView: "week" });

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Show next week"));
    });

    expect(screen.getByText("Jul 19 – Jul 25, 2026")).toBeInTheDocument();
  });

  it("opens on the agenda when Settings says agenda", async () => {
    await mountCalendar({ dailyEventLimit: 4, defaultView: "agenda" });

    expect(viewHeading("Agenda")).toBeInTheDocument();
    expect(
      screen.getByText("Nothing is booked in July 2026.")
    ).toBeInTheDocument();
  });

  it("offers no in-page switcher, so the saved default is the whole story", async () => {
    await mountCalendar({ dailyEventLimit: 4, defaultView: "week" });

    expect(viewHeading("Week Calendar")).toBeInTheDocument();
    for (const label of ["Month", "Week", "Agenda"]) {
      expect(screen.queryByRole("button", { name: label })).toBeNull();
    }
  });

  it("drops the Hebrew date from the grid when it is switched off", async () => {
    await mountCalendar({ dailyEventLimit: 4 });
    expect(document.querySelectorAll('[dir="rtl"]').length).toBeGreaterThan(0);

    await remountCalendar({ dailyEventLimit: 4, showHebrewDate: false });
    expect(document.querySelectorAll('[dir="rtl"]')).toHaveLength(0);
  });

  it("marks the days that still have room, and stops when it is switched off", async () => {
    await mountCalendar({ dailyEventLimit: 4 });
    // One bookable hall with a limit of 4 and nothing booked: every day of the
    // visible month has its four slots free.
    expect(screen.getAllByText("4 open")).toHaveLength(31);
    expect(screen.getByText("Open slots")).toBeInTheDocument();

    await remountCalendar({ dailyEventLimit: 4, showAvailability: false });
    expect(screen.queryAllByText("4 open")).toHaveLength(0);
    expect(screen.queryByText("Open slots")).toBeNull();
  });
});
