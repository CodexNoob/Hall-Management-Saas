import { addDays, format, isSameMonth } from "date-fns";
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
  return page.evaluate(async (hallName) => {
    const authStorageKey = Object.keys(window.localStorage).find(
      (key) => key.startsWith("sb-") && key.endsWith("-auth-token")
    );
    const accessToken = authStorageKey
      ? (JSON.parse(window.localStorage.getItem(authStorageKey) ?? "{}")
          .access_token as string | undefined)
      : undefined;

    if (!accessToken) {
      throw new Error(
        "No Supabase access token in localStorage - the auth setup project did not persist a session."
      );
    }

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    };

    const readEvents = async () => {
      const response = await fetch("/api/events", { headers });

      if (!response.ok) {
        throw new Error(
          `GET /api/events failed with ${response.status}: ${await response.text()}`
        );
      }

      return response.json() as Promise<{
        events: Array<{ eventDate: string; bookingStatus: string }>;
        halls: Array<{ name: string }>;
      }>;
    };

    let data = await readEvents();

    if (data.halls.length === 0) {
      const created = await fetch("/api/halls", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: hallName, capacity: 300 })
      });

      // 409 means a hall with this name already exists but is inactive or not
      // bookable, which the refetch below surfaces as a clearer failure.
      if (!created.ok && created.status !== 409) {
        throw new Error(
          `POST /api/halls failed with ${created.status}: ${await created.text()}`
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
  }, E2E_HALL_NAME);
}

test.beforeEach(async () => {
  test.skip(
    !process.env.E2E_MUTATION_EMAIL ||
      !process.env.E2E_MUTATION_PASSWORD,
    "Mutation E2E credentials are not set."
  );
});

test("creates an isolated event from the Calendar Book date form", async ({
  page
}) => {
  const clientName = `E2E Booking ${Date.now()}`;

  await page.goto("/dashboard/calendar");
  const { hallNames, bookedDates } = await prepareOrganization(page);
  // The calendar already cached the pre-provisioning /api/events payload.
  await page.reload();

  // The trial plan allows a single hall, so any date that already holds an
  // active booking would fail the hall-reservation conflict check. Pick the
  // first free date instead of a jittered one, which keeps back-to-back runs
  // green even though no teardown exists.
  const today = new Date();
  const bookingDate = Array.from({ length: 30 }, (_, offset) =>
    addDays(today, offset + 2)
  ).find((candidate) => !bookedDates.includes(format(candidate, "yyyy-MM-dd")));

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

  await page
    .getByRole("button", { name: `Select ${bookingDateLabel}` })
    .click();
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
  await dialog.getByLabel("Event type").selectOption({ label: "Not assigned" });
  await dialog.getByRole("button", { name: "Save booking" }).click();

  await expect(dialog).toBeHidden({ timeout: 20_000 });
  await expect(
    page.getByText(clientName, { exact: true }).first()
  ).toBeVisible();
});
