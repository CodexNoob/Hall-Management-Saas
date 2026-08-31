import { addDays, addMonths, format, isSameMonth, parseISO } from "date-fns";
import { expect, test, type Page } from "@playwright/test";

const E2E_HALL_NAME = "E2E Hall";
const E2E_EVENT_TYPE_NAME = "E2E Event Type";

type OrganizationFixture = {
  hallNames: string[];
  eventTypeNames: string[];
  bookedDates: string[];
};

/**
 * The E2E organization is a throwaway trial workspace that can be recreated at
 * any time, so this spec provisions what it needs instead of assuming seeded
 * data: without a bookable hall the New booking form's required Hall / room
 * select can never be satisfied and the form is refused.
 *
 * Event type is required by that form too, and a type can be restricted to
 * certain weekdays - booking one on any other day is rejected - so what this
 * needs is specifically a type with no day restriction at all.
 */
async function prepareOrganization(page: Page): Promise<OrganizationFixture> {
  // page.request shares the browser context's cookie jar, which is where the
  // session lives now.
  //
  // This used to run inside page.evaluate, digging an access token out of an
  // `sb-*-auth-token` localStorage entry and setting an Authorization header by
  // hand. @supabase/ssr writes cookies and never touches localStorage, so that
  // key no longer exists and the helper threw "No Supabase access token in
  // localStorage" before this spec reached its first assertion.
  const readEvents = async () => {
    const response = await page.request.get("/api/events");

    if (!response.ok()) {
      throw new Error(
        `GET /api/events failed with ${response.status()}: ${await response.text()}`
      );
    }

    return response.json() as Promise<{
      events: Array<{ eventDate: string; bookingStatus: string }>;
      halls: Array<{ name: string }>;
      eventTypes: Array<{ name: string; validDays: number[] }>;
    }>;
  };

  const bookableOnAnyDay = (
    eventTypes: Array<{ name: string; validDays: number[] }>
  ) => eventTypes.filter((eventType) => eventType.validDays.length === 0);

  let data = await readEvents();

  if (data.halls.length === 0) {
    const created = await page.request.post("/api/halls", {
      data: { name: E2E_HALL_NAME, capacity: 300 }
    });

    // 409 means a hall with this name already exists but is inactive or not
    // bookable, which the refetch below surfaces as a clearer failure.
    if (!created.ok() && created.status() !== 409) {
      throw new Error(
        `POST /api/halls failed with ${created.status()}: ${await created.text()}`
      );
    }

    data = await readEvents();
  }

  if (data.halls.length === 0) {
    throw new Error(
      "The E2E organization has no active, bookable hall and one could not be created."
    );
  }

  if (bookableOnAnyDay(data.eventTypes).length === 0) {
    const created = await page.request.post("/api/event-types", {
      data: { name: E2E_EVENT_TYPE_NAME, validDays: [] }
    });

    // 409 means the name is taken by a type that is inactive or day-restricted,
    // which the refetch below surfaces as a clearer failure.
    if (!created.ok() && created.status() !== 409) {
      throw new Error(
        `POST /api/event-types failed with ${created.status()}: ${await created.text()}`
      );
    }

    data = await readEvents();
  }

  if (bookableOnAnyDay(data.eventTypes).length === 0) {
    throw new Error(
      "The E2E organization has no event type that can be booked on any day and one could not be created."
    );
  }

  const activeStatuses = new Set(["CONFIRMED", "TENTATIVE_HOLD"]);

  return {
    hallNames: data.halls.map((hall) => hall.name),
    eventTypeNames: bookableOnAnyDay(data.eventTypes).map(
      (eventType) => eventType.name
    ),
    bookedDates: data.events
      .filter((event) => activeStatuses.has(event.bookingStatus))
      .map((event) => String(event.eventDate).slice(0, 10))
  };
}

/**
 * Releases the date a test booked, by client name.
 *
 * There is no DELETE for an event, so cancelling is the teardown: a CANCELLED
 * booking deactivates its hall reservation and drops out of the active set the
 * date picker above reads, which returns the day to the pool.
 *
 * Without this every run permanently consumed a date - and, through the +/- 1
 * day exclusion, usually two - until the whole 30-day window was blocked and
 * every later run failed on "Every date in the next month already has an active
 * booking". The database is shared across branches, so that backlog was
 * everyone's, not one machine's.
 *
 * Best effort by design: a teardown that threw would bury the real failure
 * under its own.
 */
async function cancelBooking(page: Page, clientName: string) {
  try {
    const response = await page.request.get("/api/events");

    if (!response.ok()) return;

    const { events } = (await response.json()) as {
      events: Array<{
        id: string;
        clientName: string | null;
        bookingStatus: string;
        version: number;
      }>;
    };

    for (const event of events.filter(
      (candidate) => candidate.clientName === clientName
    )) {
      await page.request.patch(`/api/events/${event.id}/status`, {
        data: { status: "CANCELLED", expectedVersion: event.version }
      });
    }
  } catch {
    // Teardown only - nothing here is worth failing a passing test over.
  }
}

test.beforeEach(async () => {
  test.skip(
    !process.env.E2E_MUTATION_EMAIL || !process.env.E2E_MUTATION_PASSWORD,
    "Mutation E2E credentials are not set."
  );
});

test("creates an isolated event from the Calendar Book date form", async ({
  page
}) => {
  // Provisioning, then a candidate date per attempt - each one a save and a
  // 20s race on the conflict alert - and a cancellation to hand the date back.
  // The ±1 day skipped below is narrower than the hall's real setup-to-cleanup
  // window, so dates this picks as free can still come back as conflicts, and
  // each of those costs the full race. The default 60s was being spent before
  // the last assertion could run.
  test.setTimeout(180_000);
  const clientName = `E2E Booking ${Date.now()}`;

  try {
    await page.goto("/dashboard/calendar");
    const { hallNames, eventTypeNames, bookedDates } =
      await prepareOrganization(page);
    // The calendar already cached the pre-provisioning /api/events payload.
    await page.reload();

    // Month view, explicitly. Which view the calendar opens on is an
    // organization setting now, and this test walks candidate dates by month -
    // on the week view the same control is labelled "Show next week" and the
    // day cells below it are a different grid entirely.
    await page
      .getByRole("group", { name: "Calendar view" })
      .getByRole("button", { name: "Month", exact: true })
      .click();

    // The trial plan allows a single hall, so any date that already holds an
    // active booking would fail the hall-reservation conflict check. Pick the
    // first free date rather than a jittered one, so back-to-back runs stay
    // green; the teardown below is what keeps the pool from draining.
    const today = new Date();
    const unavailableDates = new Set(
      bookedDates.flatMap((date) =>
        [-1, 0, 1].map((offset) =>
          format(addDays(parseISO(date), offset), "yyyy-MM-dd")
        )
      )
    );
    const bookingCandidates = Array.from({ length: 30 }, (_, offset) =>
      addDays(today, offset + 2)
    ).filter(
      (candidate) => !unavailableDates.has(format(candidate, "yyyy-MM-dd"))
    );

    if (bookingCandidates.length === 0) {
      throw new Error(
        "Every date in the next month already has an active booking in the E2E organization."
      );
    }

    let visibleMonth = today;
    let booked = false;

    for (const bookingDate of bookingCandidates) {
      const bookingDateLabel = format(bookingDate, "MMMM d, yyyy");
      const bookingDateValue = format(bookingDate, "yyyy-MM-dd");

      // The grid opens on the current month; a free date can spill into the
      // next. Keep the visible month in step with the candidate being tried.
      while (!isSameMonth(bookingDate, visibleMonth)) {
        await page.getByRole("button", { name: "Show next month" }).click();
        visibleMonth = addMonths(visibleMonth, 1);
      }

      // Near the top-left corner, not the middle. The select button is a
      // full-cell backdrop at z-0; the day-number header above it is
      // `pointer-events-none` and falls through, but the list of event pills is
      // deliberately clickable - each one opens its booking - so it covers the
      // centre of any day that already shows an event. Clicking the middle works
      // only on a day nothing has ever been booked on, which is not a property
      // this test can rely on.
      await page
        .getByRole("button", { name: `Select ${bookingDateLabel}` })
        .click({ position: { x: 10, y: 6 } });
      await page.getByRole("button", { name: "Book date" }).click();

      const dialog = page.getByRole("dialog", { name: "New booking" });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByLabel("Date")).toHaveValue(bookingDateValue);
      await dialog.getByLabel("Client name").fill(clientName);
      // A real number, not "555-0199": the field now checks the value against
      // the selected country's numbering plan, and a bare exchange is not
      // dialable.
      await dialog.getByLabel("Phone", { exact: true }).fill("212 555 0199");
      await dialog
        .getByLabel("Hall / room")
        .selectOption({ label: hallNames[0] });
      // Event type is required now, and types can restrict which weekdays they
      // are bookable on. `prepareOrganization` hands back only the unrestricted
      // ones, so this stays independent of the org's event-type configuration.
      await dialog
        .getByLabel("Event type")
        .selectOption({ label: eventTypeNames[0] });
      const savedRequest = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname === "/api/events"
      );
      const calendarRefreshed = page.waitForResponse(
        (response) =>
          response.request().method() === "GET" &&
          new URL(response.url()).pathname === "/api/events" &&
          response.ok()
      ).catch(() => null);
      await dialog.getByRole("button", { name: "Save booking" }).click();
      const savedResponse = await savedRequest;

      const conflict = dialog.getByRole("alert").filter({
        hasText: /already reserved during this setup-to-cleanup window/i
      });
      const outcome = await Promise.race([
        dialog.waitFor({ state: "hidden", timeout: 20_000 }).then(
          () => "booked" as const
        ),
        conflict.waitFor({ state: "visible", timeout: 20_000 }).then(
          () => "conflict" as const
        )
      ]);

      if (outcome === "booked") {
        expect(savedResponse.ok()).toBe(true);
        await calendarRefreshed;
        booked = true;
        break;
      }

      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).toBeHidden();
    }

    if (!booked) {
      throw new Error(
        "Every candidate date in the next month was reserved by the time the booking form submitted."
      );
    }

    // Bounded explicitly so a failure here reads as "the booking never
    // appeared on the calendar". On the bare default this assertion was being
    // cut off by the test budget instead, and reported itself as `undefined`.
    await expect(
      page.getByText(clientName, { exact: true }).first()
    ).toBeVisible({ timeout: 15_000 });
  } finally {
    // In a `finally` rather than after the assertions: a run that fails partway
    // has usually created the booking already, and that is precisely the run
    // whose date would otherwise be lost for good.
    await cancelBooking(page, clientName);
  }
});
