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
 * Stepping between months is the one navigation on this page that changes the
 * url it reads, and it used to take the whole page down with it: the topbar, the
 * tabs, the filters and the arrows were all replaced by one centred spinner
 * until the new month's events landed.
 *
 * These pin the two halves of the fix - the month either side is fetched before
 * it is asked for, so the arrows usually land on the cache; and when they do
 * miss, only the panels that draw bookings wait.
 */

const CALENDAR_PAYLOAD = {
  events: [],
  halls: [{ id: "hall-1", name: "Hall 1", dailyEventLimit: 4 }],
  eventTypes: [],
  blockedDates: [],
  calendarSettings: { dailyEventLimit: 4 }
};

function calendarResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => CALENDAR_PAYLOAD
  } as unknown as Response;
}

/** Every url the page has asked for, in the order it asked. */
let requestedUrls: string[] = [];

/** Answers the first request and leaves every later one in the air. */
function answerOnlyTheFirstRequest() {
  vi.mocked(authenticatedFetch).mockImplementation(async (input) => {
    requestedUrls.push(String(input));

    if (requestedUrls.length === 1) return calendarResponse();

    return new Promise<Response>(() => {});
  });
}

function answerEveryRequest() {
  vi.mocked(authenticatedFetch).mockImplementation(async (input) => {
    requestedUrls.push(String(input));

    return calendarResponse();
  });
}

async function mountCalendar() {
  await act(async () => {
    render(<EventCalendarPage />);
  });
  // A second flush: the neighbouring months are only warmed once the month on
  // screen has landed.
  await act(async () => {});
}

async function showNextMonth() {
  await act(async () => {
    fireEvent.click(screen.getByLabelText("Show next month"));
  });
}

function calendarSkeleton() {
  return screen.queryByText(/Loading this period/);
}

function pageSpinner() {
  return screen.queryByText("Loading data…");
}

describe("Calendar period navigation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 15));
    window.localStorage.clear();
    window.history.replaceState({}, "", "/dashboard/calendar");
    cacheTestSessionForStarterRole("event-manager");
    vi.mocked(authenticatedFetch).mockReset();
    clearAuthenticatedQueryCache();
    requestedUrls = [];
  });

  it("warms the month either side, so stepping to one draws no loading state", async () => {
    answerEveryRequest();
    await mountCalendar();

    // July on screen, June and August fetched behind it.
    expect(requestedUrls).toHaveLength(3);
    const beforeStepping = [...requestedUrls];

    await showNextMonth();

    expect(screen.getByText("August 2026")).toBeInTheDocument();
    expect(calendarSkeleton()).toBeNull();
    expect(pageSpinner()).toBeNull();
    // Drawn from the cache: the grid is there without August having been asked
    // for a second time.
    expect(screen.getByLabelText("Book August 3, 2026")).toBeInTheDocument();
    expect(requestedUrls.slice(0, beforeStepping.length)).toEqual(
      beforeStepping
    );
  });

  it("keeps the page around a month that is still loading", async () => {
    answerOnlyTheFirstRequest();
    await mountCalendar();

    await showNextMonth();

    // The whole-page spinner is gone: the chrome is still here, still usable,
    // and only the grid and the day panel are placeholders.
    expect(pageSpinner()).toBeNull();
    expect(calendarSkeleton()).not.toBeNull();
    expect(screen.getByText("August 2026")).toBeInTheDocument();
    expect(screen.getByLabelText("Show previous month")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument();
    expect(
      document.querySelector('select[name="calendarHallFilter"]')
    ).not.toBeNull();
    // No day is drawn until the days are real.
    expect(screen.queryByLabelText("Book August 3, 2026")).toBeNull();
  });

  it("steps back onto the month it came from without refetching it", async () => {
    answerEveryRequest();
    await mountCalendar();
    await showNextMonth();
    const beforeStepingBack = requestedUrls.length;

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Show previous month"));
    });

    expect(screen.getByText("July 2026")).toBeInTheDocument();
    expect(calendarSkeleton()).toBeNull();
    expect(requestedUrls).toHaveLength(beforeStepingBack);
  });
});
