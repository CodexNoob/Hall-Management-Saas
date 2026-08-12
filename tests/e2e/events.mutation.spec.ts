import { addDays, format } from "date-fns";
import { expect, test } from "@playwright/test";

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
  // A few days out, not "today" - stays within the calendar's default month
  // grid regardless of which day of the month the suite runs on. Jittered by
  // the current timestamp so back-to-back runs on the same day don't collide
  // with a hall booking a previous run already created (no teardown exists).
  const bookingDate = addDays(new Date(), 4 + (Date.now() % 5));
  const bookingDateLabel = format(bookingDate, "MMMM d, yyyy");
  const bookingDateValue = format(bookingDate, "yyyy-MM-dd");

  await page.goto("/dashboard/calendar");
  await page
    .getByRole("button", { name: `Select ${bookingDateLabel}` })
    .click();
  await page.getByRole("button", { name: "Book date" }).click();

  const dialog = page.getByRole("dialog", { name: "New booking" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Date")).toHaveValue(bookingDateValue);
  await dialog.getByLabel("Client name").fill(clientName);
  await dialog.getByLabel("Phone").fill("555-0199");
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
