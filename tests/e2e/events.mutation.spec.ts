import { addDays, format, isSameMonth, parseISO } from "date-fns";
import { expect, test, type Page } from "@playwright/test";

const E2E_HALL_NAME = "E2E Hall";

type OrganizationFixture = {
  hallNames: string[];
  bookedDates: string[];
};

/**
 * The E2E organization is a throwaway trial workspace that can be recreated at
 * any time, so this spec provisions what it needs instead of assuming seeded
 * data: without a bookable hall the New booking form's required Hall / room
 * select can never be satisfied and the browser blocks the submit silently.
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
    }>;
  };

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

  const activeStatuses = new Set(["CONFIRMED", "TENTATIVE_HOLD"]);

  return {
    hallNames: data.halls.map((hall) => hall.name),
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
  const clientName = `E2E Booking ${Date.now()}`;

  try {
    await page.goto("/dashboard/calendar");
    const { hallNames, bookedDates } = await prepareOrganization(page);
    // The calendar already cached the pre-provisioning /api/events payload.
    await page.reload();

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
    const bookingDate = Array.from({ length: 30 }, (_, offset) =>
      addDays(today, offset + 2)
    ).find(
      (candidate) => !unavailableDates.has(format(candidate, "yyyy-MM-dd"))
    );

    if (!bookingDate) {
      throw new Error(
        "Every date in the next month already has an active booking in the E2E organization."
      );
    }

    const bookingDateLabel = format(bookingDate, "MMMM d, yyyy");
    const bookingDateValue = format(bookingDate, "yyyy-MM-dd");

    // The grid opens on the current month; a free date can spill into the next.
    if (!isSameMonth(bookingDate, today)) {
      await page.getByRole("button", { name: "Show next month" }).click();
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
    // A real number, not "555-0199": the field now checks the value against the
    // selected country's numbering plan, and a bare exchange is not dialable.
    await dialog.getByLabel("Phone", { exact: true }).fill("212 555 0199");
    await dialog
      .getByLabel("Hall / room")
      .selectOption({ label: hallNames[0] });
    // Event types can restrict which weekdays they're bookable on; this test
    // doesn't care about that rule, so opt out of it rather than couple the
    // booking date to this org's event-type configuration.
    await dialog
      .getByLabel("Event type")
      .selectOption({ label: "Not assigned" });
    await dialog.getByRole("button", { name: "Save booking" }).click();

    await expect(dialog).toBeHidden({ timeout: 20_000 });
    await expect(
      page.getByText(clientName, { exact: true }).first()
    ).toBeVisible();
  } finally {
    // In a `finally` rather than after the assertions: a run that fails partway
    // has usually created the booking already, and that is precisely the run
    // whose date would otherwise be lost for good.
    await cancelBooking(page, clientName);
  }
});
