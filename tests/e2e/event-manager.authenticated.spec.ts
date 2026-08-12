import { expect, test } from "@playwright/test";

const eventResponse = {
  events: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      clientName: "E2E Event",
      eventDate: "2026-08-22T00:00:00.000Z",
      eventType: "Wedding",
      eventStatus: "Confirmed",
      bookingStatus: "CONFIRMED",
      startsAt: "2026-08-22T18:00:00.000Z",
      endsAt: null,
      setupStartsAt: null,
      cleanupEndsAt: null,
      holdExpiresAt: null,
      version: 1,
      paymentStatus: null,
      packageName: "Standard",
      couplesCount: 10,
      menCount: 0,
      ladiesCount: 0,
      boysCount: 0,
      girlsCount: 0,
      kidsCount: 0,
      notes: "Original internal note.",
      diningManagerNotes: "VIP table beside stage.",
      phone: "Not provided",
      email: null,
      workspaceData: null,
      hall: { id: "hall-1", name: "Hall 1" }
    }
  ],
  halls: [{ id: "hall-1", name: "Hall 1" }],
  eventTypes: [],
  packages: [],
  calendarSettings: { dailyEventLimit: 2 }
};

test.beforeEach(async () => {
  test.skip(
    !process.env.E2E_READONLY_EMAIL || !process.env.E2E_READONLY_PASSWORD,
    "Read-only E2E credentials are not set."
  );
});

test("Event details show unsaved changes, discard, and save feedback", async ({
  page
}) => {
  let savedPayload: Record<string, unknown> | null = null;

  await page.route("**/api/events", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(eventResponse)
    });
  });

  await page.route("**/api/events/11111111-1111-4111-8111-111111111111", async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.fallback();
      return;
    }

    savedPayload = route.request().postDataJSON();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ event: { id: eventResponse.events[0].id } })
    });
  });

  await page.goto("/dashboard/events");

  await page.getByLabel("Client").fill("Updated E2E Event");
  await expect(page.getByText("Unsaved changes")).toBeVisible();

  await page.getByRole("button", { name: "Discard changes" }).click();
  await expect(page.getByLabel("Client")).toHaveValue("E2E Event");

  await page.getByLabel("Client").fill("Updated E2E Event");
  await page.getByLabel("Internal notes").fill("Updated internal note.");
  // Scoped to the role: the timeline rows expose aria-labels such as
  // "Timeline time for Guests arrive and first course begins", so a bare
  // getByLabel("Guests") is ambiguous.
  await page.getByRole("spinbutton", { name: "Guests" }).fill("370");
  await page.getByRole("button", { name: "Save event details" }).click();

  await expect(page.getByRole("status")).toContainText("Event details saved");
  expect(savedPayload).toMatchObject({
    clientName: "Updated E2E Event",
    boysCount: 0,
    girlsCount: 0,
    ladiesCount: 0,
    menCount: 350,
    notes: "Updated internal note."
  });
});
