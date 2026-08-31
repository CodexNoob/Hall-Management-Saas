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
 * The Availability tab reads one hall at a time.
 *
 * Every number on it - open slots, holds - is a fact about a single hall, and
 * the venue-wide total it used to sum could call a day available while the room
 * the caller actually wanted was taken. So nothing is shown until a hall is
 * picked, and what is shown afterwards ignores every other hall.
 */

const HALL_A = "11111111-1111-4111-8111-111111111111";
const HALL_B = "22222222-2222-4222-8222-222222222222";

type StubEvent = {
  id: string;
  eventDate: string;
  bookingStatus: string;
  hallId: string;
};

function respondWith(events: StubEvent[] = []) {
  vi.mocked(authenticatedFetch).mockImplementation(
    async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          events: events.map((event) => ({
            id: event.id,
            clientName: "Stern",
            eventDate: `${event.eventDate}T00:00:00.000Z`,
            eventStatus: "Confirmed",
            bookingStatus: event.bookingStatus,
            eventType: "Bar Mitzvah",
            packageName: null,
            hall: {
              id: event.hallId,
              name: event.hallId === HALL_A ? "Ateres Akiva" : "Beis Yaakov",
              color: null
            }
          })),
          halls: [
            { id: HALL_A, name: "Ateres Akiva", dailyEventLimit: 1 },
            { id: HALL_B, name: "Beis Yaakov", dailyEventLimit: 3 }
          ],
          eventTypes: [],
          blockedDates: [],
          calendarSettings: { dailyEventLimit: 2 }
        })
      }) as unknown as Response
  );
}

async function openAvailability(events: StubEvent[] = []) {
  respondWith(events);

  await act(async () => {
    render(<EventCalendarPage />);
  });

  await act(async () => {
    fireEvent.click(
      within(
        screen.getByRole("navigation", { name: "Calendar views" })
      ).getByRole("button", { name: /Availability/ })
    );
  });
}

function hallPicker() {
  return screen.getByRole("combobox", { name: /Hall/ });
}

async function chooseHall(hallId: string) {
  await act(async () => {
    fireEvent.change(hallPicker(), { target: { value: hallId } });
  });
}

/** The row for one day, found by the date its heading renders. */
function dayRow(label: string) {
  return screen.getByRole("heading", { name: label }).closest("article");
}

describe("Calendar availability by hall", () => {
  beforeEach(() => {
    // jsdom ships no matchMedia, and clicking a tab runs centerMobileTab, which
    // asks for the viewport before deciding whether to scroll the tab into view.
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {}
    })) as unknown as typeof window.matchMedia;
    vi.useFakeTimers();
    // Pinned so the default range is a known month.
    vi.setSystemTime(new Date(2026, 6, 15));
    window.localStorage.clear();
    window.history.replaceState({}, "", "/dashboard/calendar");
    cacheTestSessionForStarterRole("event-manager");
    vi.mocked(authenticatedFetch).mockReset();
    clearAuthenticatedQueryCache();
    cleanup();
  });

  it("shows no days until a hall is chosen", async () => {
    await openAvailability();

    expect(
      screen.getByText("Choose a hall to see its availability")
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Wed, Jul 1, 2026" })).toBeNull();
  });

  it("lists the range once a hall is chosen", async () => {
    await openAvailability();
    await chooseHall(HALL_A);

    expect(
      screen.queryByText("Choose a hall to see its availability")
    ).toBeNull();
    expect(dayRow("Wed, Jul 1, 2026")).not.toBeNull();
  });

  it("counts only the chosen hall's bookings", async () => {
    await openAvailability([
      {
        id: "in-hall-b",
        eventDate: "2026-07-02",
        bookingStatus: "CONFIRMED",
        hallId: HALL_B
      }
    ]);

    // Hall A has a limit of one and nothing booked, so July 2 is open for it
    // even though the day is spoken for next door.
    await chooseHall(HALL_A);
    const forHallA = dayRow("Thu, Jul 2, 2026");
    expect(within(forHallA!).getByText("Available")).toBeInTheDocument();
    expect(
      within(forHallA!).getByText("1 event slots available")
    ).toBeInTheDocument();

    // The same day read for hall B, which is the one that is booked.
    await chooseHall(HALL_B);
    const forHallB = dayRow("Thu, Jul 2, 2026");
    expect(
      within(forHallB!).getByText("2 event slots available")
    ).toBeInTheDocument();
  });

  it("reads a hall at its own daily limit as full", async () => {
    await openAvailability([
      {
        id: "fills-hall-a",
        eventDate: "2026-07-02",
        bookingStatus: "CONFIRMED",
        hallId: HALL_A
      }
    ]);
    await chooseHall(HALL_A);

    const row = dayRow("Thu, Jul 2, 2026");
    expect(within(row!).getByText("Full")).toBeInTheDocument();
    expect(
      within(row!).getByText("0 event slots available")
    ).toBeInTheDocument();
  });

  it("reads a hold in the chosen hall as Hold", async () => {
    await openAvailability([
      {
        id: "held-in-hall-b",
        eventDate: "2026-07-02",
        bookingStatus: "TENTATIVE_HOLD",
        hallId: HALL_B
      }
    ]);
    await chooseHall(HALL_B);

    expect(within(dayRow("Thu, Jul 2, 2026")!).getByText("Hold")).toBeInTheDocument();
    // A hold next door leaves hall A alone.
    await chooseHall(HALL_A);
    expect(
      within(dayRow("Thu, Jul 2, 2026")!).getByText("Available")
    ).toBeInTheDocument();
  });
});
