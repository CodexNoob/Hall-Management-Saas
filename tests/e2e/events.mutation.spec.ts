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

/**
 * The client name the calendar test booked under, handed to `afterEach`.
 *
 * Its cancellation cannot live in the test's own `finally`: a run that exceeds
 * its budget is torn down before that block can finish its requests, so the
 * booking it just made stays active and holds its date for good. Every timed-out
 * run used to cost the organization another date, which made the next run walk
 * further through conflicts and time out in its turn. `afterEach` is given its
 * own budget and still runs after a timeout, which is the whole reason to put
 * the cleanup there.
 */
let calendarBookingClientName: string | null = null;

test.afterEach(async ({ page }) => {
  if (!calendarBookingClientName) return;

  const clientName = calendarBookingClientName;
  calendarBookingClientName = null;
  await cancelBooking(page, clientName);
});

test("creates an isolated event from the Calendar Book date form", async ({
  page
}) => {
  // Provisioning, then a save and a 20s race on the conflict alert per
  // candidate date. One candidate is the normal case now that the search starts
  // clear of the booked stretch, so this is headroom for a run that lands on a
  // date something else already holds, not the usual cost.
  test.setTimeout(120_000);
  const clientName = `E2E Booking ${Date.now()}`;
  calendarBookingClientName = clientName;

  try {
    await page.goto("/dashboard/calendar");
    const { hallNames, eventTypeNames, bookedDates } =
      await prepareOrganization(page);
    // The calendar already cached the pre-provisioning /api/events payload.
    await page.reload();

    // Month view, and there is no longer an in-page switcher to force it: which
    // view the calendar opens on is Settings > Calendar > Default view, and the
    // E2E organization never sets it, so it opens on the month. Assert that
    // rather than assume it - this test walks candidate dates by month, and on
    // the week view the same control is labelled "Show next week" and the day
    // cells below it are a different grid entirely, which would fail further
    // down in a way that says nothing about why.
    await expect(
      page.getByRole("heading", { name: "Month Calendar" })
    ).toBeVisible();

    // The trial plan allows a single hall, so any date that already holds an
    // active booking would fail the hall-reservation conflict check. Pick the
    // first free date rather than a jittered one, so back-to-back runs stay
    // green.
    //
    // The search starts months out rather than the day after tomorrow. Every
    // other fixture in this suite books within the coming fortnight, and each
    // conflict here costs the full 20s race - enough of them and the test spends
    // its whole budget discovering dates it cannot have. Out here the first
    // candidate is normally free, so the loop below runs once. Which date the
    // booking lands on is not what this test is about.
    const SEARCH_START_OFFSET_DAYS = 120;
    const today = new Date();
    const unavailableDates = new Set(
      bookedDates.flatMap((date) =>
        [-1, 0, 1].map((offset) =>
          format(addDays(parseISO(date), offset), "yyyy-MM-dd")
        )
      )
    );
    const bookingCandidates = Array.from({ length: 30 }, (_, offset) =>
      addDays(today, offset + SEARCH_START_OFFSET_DAYS)
    ).filter(
      (candidate) => !unavailableDates.has(format(candidate, "yyyy-MM-dd"))
    );

    if (bookingCandidates.length === 0) {
      throw new Error(
        `Every date in the month from day ${SEARCH_START_OFFSET_DAYS} already has an active booking in the E2E organization.`
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

      /*
       * Which control a day cell offers is Settings > Calendar > click anywhere
       * to add, and this suite runs against a shared organization whose settings
       * it does not own - so the toggle is read off the cell rather than pinned.
       * With it on, the backdrop itself books ("Book July 1, 2026"). With it off
       * the backdrop only selects ("Select July 1, 2026") and a bookable day
       * carries a separate "+" button, labelled "Book July 1, 2026", in its
       * top-right corner.
       *
       * A `^(?:Book|Select) …$` regex covered both settings until that "+" was
       * added, and then matched BOTH controls in one cell and failed strict
       * mode. The Book label is the unambiguous one either way: exactly one
       * control carries it, and it is the one that opens the dialog.
       */
      const bookControl = page.getByRole("button", {
        exact: true,
        name: `Book ${bookingDateLabel}`
      });

      if ((await bookControl.count()) > 0) {
        // The "+" is 24px square and sits above the pills at z-2, so it takes an
        // ordinary centred click.
        await bookControl.click();
      } else {
        // Nothing here books outright, so select the day and let the panel below
        // the grid open the form. Near the top-left corner, not the middle: the
        // backdrop is a full-cell button at z-0 and the day-number header above
        // it is `pointer-events-none` and falls through, but the event pills are
        // deliberately clickable - each one opens its own booking - so they
        // cover the centre of any day that already shows an event.
        await page
          .getByRole("button", {
            exact: true,
            name: `Select ${bookingDateLabel}`
          })
          .click({ position: { x: 10, y: 6 } });
      }

      const dialog = page.getByRole("dialog", { name: "New booking" });

      // Click-anywhere has already opened it; otherwise the selected-day panel
      // below the grid is where the booking starts.
      if (!(await dialog.isVisible())) {
        await page.getByRole("button", { name: "Book date" }).click();
      }

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
      // Bounded, because this one is allowed not to happen. The `.catch` below
      // says as much - the calendar is free to repaint from its own cache
      // rather than refetching - but an unbounded `waitForResponse` never
      // rejects, so there was nothing for the catch to catch. It sat here
      // spending the entire test budget, whatever the budget was, and the
      // assertion that follows was left with no time to run.
      const calendarRefreshed = page
        .waitForResponse(
          (response) =>
            response.request().method() === "GET" &&
            new URL(response.url()).pathname === "/api/events" &&
            response.ok(),
          { timeout: 15_000 }
        )
        .catch(() => null);
      await dialog.getByRole("button", { name: "Save booking" }).click();
      const savedResponse = await savedRequest;

      const conflict = dialog.getByRole("alert").filter({
        hasText: /already reserved during this setup-to-cleanup window/i
      });
      const outcome = await Promise.race([
        dialog
          .waitFor({ state: "hidden", timeout: 20_000 })
          .then(() => "booked" as const),
        conflict
          .waitFor({ state: "visible", timeout: 20_000 })
          .then(() => "conflict" as const)
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
    //
    // Cleared first so `afterEach` does not repeat the work on the normal path.
    // It stays set, and does the cancelling itself, when a run exceeds its
    // budget and never reaches this block at all.
    calendarBookingClientName = null;
    await cancelBooking(page, clientName);
  }
});
