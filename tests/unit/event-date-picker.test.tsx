import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/http/authenticated-fetch", () => ({
  authenticatedFetch: vi.fn()
}));

import { clearAuthenticatedQueryCache } from "@/features/dashboard/hooks/use-authenticated-query";
import { EventDatePickerDialog } from "@/features/events/forms/event-date-picker-dialog";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import {
  hallDayRefusal,
  hallDayStatus
} from "@/lib/bookings/hall-day-availability";
import { cacheTestSessionForStarterRole } from "./auth-session-fixture";

/**
 * Moving an event is refused on a day its hall cannot take, and the picker is
 * where that refusal is made visible: the same rule the PATCH route re-checks
 * decides which rows are buttons and which are greyed out.
 */

type StubEvent = {
  id: string;
  eventDate: string;
  bookingStatus: string;
  hallId: string;
};

const HALL_ID = "hall-1";
const OTHER_HALL_ID = "hall-2";

function respondWith({
  events = [],
  dailyEventLimit = 2,
  blockedDates = []
}: {
  events?: StubEvent[];
  dailyEventLimit?: number | null;
  blockedDates?: Array<{
    hallId: string | null;
    startDate: string;
    endDate: string;
  }>;
}) {
  vi.mocked(authenticatedFetch).mockImplementation(
    async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          events: events.map((event) => ({
            id: event.id,
            eventDate: `${event.eventDate}T00:00:00.000Z`,
            bookingStatus: event.bookingStatus,
            hall: { id: event.hallId }
          })),
          halls: [
            { id: HALL_ID, dailyEventLimit },
            { id: OTHER_HALL_ID, dailyEventLimit: 5 }
          ],
          eventTypes: [],
          blockedDates,
          calendarSettings: { dailyEventLimit: 2 }
        })
      }) as unknown as Response
  );
}

async function mountPicker(
  response: Parameters<typeof respondWith>[0],
  onSelect = vi.fn()
) {
  respondWith(response);

  await act(async () => {
    render(
      <EventDatePickerDialog
        eventId="event-being-moved"
        hallId={HALL_ID}
        hallName="Ateres Akiva"
        onClose={vi.fn()}
        onSelect={onSelect}
        open
        selectedDate="2026-07-15"
      />
    );
  });

  return onSelect;
}

/** The row for one day, found by the label its own heading renders. */
function dayRow(label: string) {
  return screen.getByRole("button", { name: new RegExp(label) });
}

describe("Event date picker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Pinned so "the next 90 days" is a fixed window rather than a fact about
    // the day the suite happens to run.
    vi.setSystemTime(new Date(2026, 6, 15));
    cacheTestSessionForStarterRole("event-manager");
    vi.mocked(authenticatedFetch).mockReset();
    clearAuthenticatedQueryCache();
    cleanup();
  });

  it("offers a day the hall has room on", async () => {
    const onSelect = await mountPicker({});

    const row = dayRow("Jul 16, 2026");
    expect(row).not.toBeDisabled();

    await act(async () => {
      row.click();
    });

    expect(onSelect).toHaveBeenCalledWith("2026-07-16");
  });

  it("refuses a day that has an event on hold, with room to spare", async () => {
    await mountPicker({
      dailyEventLimit: 4,
      events: [
        {
          id: "held",
          eventDate: "2026-07-16",
          bookingStatus: "TENTATIVE_HOLD",
          hallId: HALL_ID
        }
      ]
    });

    // Three slots still free, and still refused: a held date is one somebody is
    // already negotiating for.
    expect(dayRow("Jul 16, 2026")).toBeDisabled();
    expect(dayRow("Jul 17, 2026")).not.toBeDisabled();
  });

  it("refuses a day the hall has no slots left on", async () => {
    await mountPicker({
      dailyEventLimit: 1,
      events: [
        {
          id: "booked",
          eventDate: "2026-07-16",
          bookingStatus: "CONFIRMED",
          hallId: HALL_ID
        }
      ]
    });

    expect(dayRow("Jul 16, 2026")).toBeDisabled();
  });

  it("ignores holds in a different hall", async () => {
    await mountPicker({
      dailyEventLimit: 1,
      events: [
        {
          id: "held-elsewhere",
          eventDate: "2026-07-16",
          bookingStatus: "TENTATIVE_HOLD",
          hallId: OTHER_HALL_ID
        }
      ]
    });

    expect(dayRow("Jul 16, 2026")).not.toBeDisabled();
  });

  it("does not let the event block its own current date", async () => {
    await mountPicker({
      dailyEventLimit: 1,
      events: [
        {
          id: "event-being-moved",
          eventDate: "2026-07-20",
          bookingStatus: "CONFIRMED",
          hallId: HALL_ID
        }
      ]
    });

    expect(dayRow("Jul 20, 2026")).not.toBeDisabled();
  });

  it("refuses a date blocked for this hall", async () => {
    await mountPicker({
      blockedDates: [
        {
          hallId: HALL_ID,
          startDate: "2026-07-16T00:00:00.000Z",
          endDate: "2026-07-18T00:00:00.000Z"
        }
      ]
    });

    expect(dayRow("Jul 16, 2026")).toBeDisabled();
    expect(dayRow("Jul 18, 2026")).toBeDisabled();
    expect(dayRow("Jul 19, 2026")).not.toBeDisabled();
  });

  it("ignores a range that closes a different hall", async () => {
    await mountPicker({
      blockedDates: [
        {
          hallId: OTHER_HALL_ID,
          startDate: "2026-07-16T00:00:00.000Z",
          endDate: "2026-07-18T00:00:00.000Z"
        }
      ]
    });

    expect(dayRow("Jul 16, 2026")).not.toBeDisabled();
  });

  it("still honours a range saved before ranges named a hall", async () => {
    await mountPicker({
      blockedDates: [
        {
          hallId: null,
          startDate: "2026-07-16T00:00:00.000Z",
          endDate: "2026-07-16T00:00:00.000Z"
        }
      ]
    });

    // A null hall is the legacy reading: it closed the whole venue when it was
    // saved, and it still does.
    expect(dayRow("Jul 16, 2026")).toBeDisabled();
  });

  it("falls back to the organization limit for a hall with none of its own", async () => {
    await mountPicker({
      dailyEventLimit: null,
      events: [
        {
          id: "one",
          eventDate: "2026-07-16",
          bookingStatus: "CONFIRMED",
          hallId: HALL_ID
        },
        {
          id: "two",
          eventDate: "2026-07-16",
          bookingStatus: "CONFIRMED",
          hallId: HALL_ID
        }
      ]
    });

    // calendarSettings.dailyEventLimit is 2, and both are used.
    expect(dayRow("Jul 16, 2026")).toBeDisabled();
  });
});

describe("hallDayStatus", () => {
  const open = {
    isBlocked: false,
    holdCount: 0,
    activeCount: 0,
    dailyEventLimit: 2
  };

  it("reads an empty, unblocked day as available", () => {
    expect(hallDayStatus(open)).toBe("available");
  });

  it("puts blocked ahead of every other reason", () => {
    expect(
      hallDayStatus({ ...open, isBlocked: true, holdCount: 1, activeCount: 9 })
    ).toBe("blocked");
  });

  it("puts a hold ahead of the limit, so the reason names the hold", () => {
    expect(hallDayStatus({ ...open, holdCount: 1, activeCount: 1 })).toBe(
      "hold"
    );
  });

  it("reads a day at its limit as full", () => {
    expect(hallDayStatus({ ...open, activeCount: 2 })).toBe("full");
  });

  it("explains a refusal and stays quiet about an available day", () => {
    const where = { hallName: "Ateres Akiva", dateLabel: "August 30, 2026" };

    expect(hallDayRefusal("hold", where)).toContain("on hold in Ateres Akiva");
    expect(hallDayRefusal("full", where)).toContain("no event slots left");
    expect(hallDayRefusal("blocked", where)).toContain("blocked date");
    expect(hallDayRefusal("available", where)).toBeNull();
  });
});
