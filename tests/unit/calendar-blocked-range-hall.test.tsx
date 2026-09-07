import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within
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
 * A blocked range closes one hall.
 *
 * It used to close the date for the whole organization, which said nothing
 * useful in a venue with more than one hall. Settings > Calendar now refuses to
 * add a range until a hall is named, and the range carries that hall to the API.
 */

const HALL_A = "11111111-1111-4111-8111-111111111111";
const HALL_B = "22222222-2222-4222-8222-222222222222";

type StubBlockedDate = {
  id: string;
  hallId: string | null;
  startDate: string;
  endDate: string;
  label: string;
};

function respondWith(blockedDates: StubBlockedDate[] = []) {
  vi.mocked(authenticatedFetch).mockImplementation(
    async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          events: [],
          halls: [
            { id: HALL_A, name: "Ateres Akiva", dailyEventLimit: 1 },
            { id: HALL_B, name: "Beis Yaakov", dailyEventLimit: 3 }
          ],
          eventTypes: [],
          blockedDates,
          calendarSettings: { dailyEventLimit: 2 }
        })
      }) as unknown as Response
  );
}

async function openSettings(blockedDates: StubBlockedDate[] = []) {
  respondWith(blockedDates);

  await act(async () => {
    render(<EventCalendarPage />);
  });

  await act(async () => {
    fireEvent.click(
      within(
        screen.getByRole("navigation", { name: "Calendar views" })
      ).getByRole("button", { name: /Settings/ })
    );
  });
}

async function openCalendar(blockedDates: StubBlockedDate[] = []) {
  respondWith(blockedDates);

  await act(async () => {
    render(<EventCalendarPage />);
  });
}

function addButton() {
  return screen.getByRole("button", { name: "Add blocked range" });
}

function hallPicker() {
  return screen.getByRole("combobox", { name: /Hall/ });
}

/** The POST body of the blocked-range request, if one was made. */
function postedBody() {
  const call = vi
    .mocked(authenticatedFetch)
    .mock.calls.find(([, init]) => init?.method === "POST");

  return call ? JSON.parse(String(call[1]?.body)) : null;
}

describe("Blocked ranges name a hall", () => {
  beforeEach(() => {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {}
    })) as unknown as typeof window.matchMedia;
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 15));
    window.localStorage.clear();
    window.history.replaceState({}, "", "/dashboard/calendar");
    cacheTestSessionForStarterRole("owner");
    vi.mocked(authenticatedFetch).mockReset();
    clearAuthenticatedQueryCache();
    cleanup();
  });

  it("will not add a range until a hall is chosen", async () => {
    await openSettings();

    expect(addButton()).toBeDisabled();
    expect(
      screen.getByText(/A range blocks the hall it names/)
    ).toBeInTheDocument();
  });

  it("sends the chosen hall with the range", async () => {
    await openSettings();

    await act(async () => {
      fireEvent.change(hallPicker(), { target: { value: HALL_B } });
    });

    expect(addButton()).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(addButton());
    });

    expect(postedBody()).toEqual(expect.objectContaining({ hallId: HALL_B }));
  });

  /**
   * The row for one saved range. Dates well away from the draft range the panel
   * opens on, so this matches the list rather than the "Add blocked range"
   * heading above it, which shows the draft in the same words.
   */
  function savedRangeRow() {
    return screen.getByText(/Mon, Aug 10, 2026/).closest("article");
  }

  function savedRange(hallId: string | null) {
    return [
      {
        id: "range-1",
        hallId,
        startDate: "2026-08-10T00:00:00.000Z",
        endDate: "2026-08-11T00:00:00.000Z",
        label: "Blocked"
      }
    ];
  }

  function julyRange(hallId: string | null, day: string) {
    return {
      id: `range-${hallId ?? "all"}-${day}`,
      hallId,
      startDate: `2026-07-${day}T00:00:00.000Z`,
      endDate: `2026-07-${day}T00:00:00.000Z`,
      label: "Blocked"
    };
  }

  it("names the hall each saved range closes", async () => {
    await openSettings(savedRange(HALL_A));

    expect(
      within(savedRangeRow()!).getByText("Ateres Akiva")
    ).toBeInTheDocument();
  });

  it("calls a range with no hall All halls", async () => {
    await openSettings(savedRange(null));

    // Saved before ranges named a hall, so it still closes the whole venue and
    // the list says so rather than leaving the row unlabelled.
    expect(within(savedRangeRow()!).getByText("All halls")).toBeInTheDocument();
  });

  it("keeps the main calendar bookable when only one hall is blocked", async () => {
    await openCalendar([julyRange(HALL_A, "20")]);

    expect(screen.getByLabelText("Book July 20, 2026")).toBeInTheDocument();
    expect(screen.getByText("3 open")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Select July 20, 2026"));
    });

    expect(
      screen.getByRole("button", { name: "Book date" })
    ).toBeInTheDocument();
    expect(screen.getByText("Blocked")).toBeInTheDocument();
  });

  it("blocks the main calendar date when every visible hall is blocked", async () => {
    await openCalendar([julyRange(HALL_A, "21"), julyRange(HALL_B, "21")]);

    expect(screen.queryByLabelText("Book July 21, 2026")).toBeNull();
    expect(screen.getByLabelText("Select July 21, 2026")).toBeInTheDocument();
    expect(screen.getByText("Blocked")).toBeInTheDocument();
  });
});
