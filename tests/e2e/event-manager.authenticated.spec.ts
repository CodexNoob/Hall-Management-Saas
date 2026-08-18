import { expect, test, type Page } from "@playwright/test";

const eventResponse = {
  events: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      bookingStatus: "CONFIRMED",
      clientName: "E2E Event",
      eventDate: "2026-08-22T00:00:00.000Z",
      eventType: "Wedding",
      eventStatus: "Confirmed",
      startsAt: "2026-08-22T18:00:00.000Z",
      endsAt: null,
      setupStartsAt: null,
      cleanupEndsAt: null,
      holdExpiresAt: null,
      cancelledAt: null,
      completedAt: null,
      version: 1,
      paymentStatus: null,
      packageName: "Standard",
      couplesCount: 10,
      menCount: 0,
      ladiesCount: 0,
      boysCount: 0,
      girlsCount: 0,
      kidsCount: 0,
      waitersCount: 2,
      setupTime: "16:30",
      washingTime: "22:30",
      tableclothName: "Ivory",
      notes: "Original internal note.",
      daveningNote: "Original davening note.",
      memberShulName: "Congregation Event Core",
      sideBoxes: "Men side boxes near entrance.",
      shabbosSetup: "Set before Shabbos.",
      activityLogs: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          actionType: "Booking Status Changed",
          message: "Changed E2E Event's booking from On Hold to Confirmed.",
          userName: "Event Admin",
          createdAt: "2026-08-13T12:00:00.000Z"
        }
      ],
      diningManagerNotes: "VIP table beside stage.",
      diningHallMapPreset: {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Wedding Layout",
        objects: [
          {
            id: "vip-table",
            type: "round-table",
            name: "VIP Table",
            x: 80,
            y: 90,
            width: 80,
            height: 80,
            rotation: 0,
            seats: 10,
            seatingUse: "adult"
          }
        ]
      },
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

/**
 * Opens the fixture's event.
 *
 * The workspace no longer opens anything on arrival - it shows an empty pane
 * until a row is chosen, because the old fallback to the first event presented a
 * selection nobody had made. So every test that works inside the workspace picks
 * the event first.
 */
async function openFixtureEvent(page: Page) {
  await page
    .getByRole("button", { name: /E2E Event/ })
    .first()
    .click();
  // The workspace's own tab strip, rather than the event's title: the title is
  // rendered by the list row as well, so waiting on it would match two things.
  await expect(
    page.getByRole("navigation", { name: "Event workspace" })
  ).toBeVisible({ timeout: 45_000 });
}

test("Hall map tab shows the Dining Manager saved preset layout", async ({
  page
}) => {
  await page.route("**/api/events", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ...eventResponse
      })
    });
  });

  await page.goto("/dashboard/events");
  await openFixtureEvent(page);
  await page.getByRole("button", { name: "Hall map" }).click();

  await expect(
    page.getByRole("heading", { name: "Wedding Layout" })
  ).toBeVisible();
  await expect(page.getByText("VIP Table")).toBeVisible();
  await expect(page.getByText("Saved dining layout")).toBeVisible();
});

test("Event details save and persist edited fields", async ({ page }) => {
  let savedPayload: Record<string, unknown> | null = null;
  const eventId = eventResponse.events[0].id;
  const persistedResponse = structuredClone(eventResponse);

  await page.route("**/api/events", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(persistedResponse)
    });
  });

  await page.route(`**/api/events/${eventId}`, async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.fallback();
      return;
    }

    const payload = route.request().postDataJSON() as Record<string, unknown>;
    savedPayload = payload;
    Object.assign(persistedResponse.events[0], {
      clientName: payload.clientName,
      couplesCount: payload.couplesCount,
      menCount: payload.menCount,
      ladiesCount: payload.ladiesCount,
      boysCount: payload.boysCount,
      girlsCount: payload.girlsCount,
      kidsCount: payload.kidsCount,
      waitersCount: payload.waitersCount,
      setupTime: payload.setupTime,
      washingTime: payload.washingTime,
      tableclothName: payload.tableclothName,
      notes: payload.notes,
      daveningNote: payload.daveningNote,
      memberShulName: payload.memberShulName,
      sideBoxes: payload.sideBoxes,
      shabbosSetup: payload.shabbosSetup
    });

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ event: { id: eventId } })
    });
  });

  await page.goto("/dashboard/events");
  await openFixtureEvent(page);

  await expect(page.getByText("Activity history")).toBeVisible();
  await expect(
    page.getByText("Changed E2E Event's booking from On Hold to Confirmed.")
  ).toBeVisible();

  await page.getByLabel("Client").fill("Updated E2E Event");
  await expect(page.getByText("Unsaved changes")).toBeVisible();

  await page.getByRole("button", { name: "Discard changes" }).click();
  await expect(page.getByLabel("Client")).toHaveValue("E2E Event");

  await page.getByLabel("Client").fill("Updated E2E Event");
  await page.getByLabel("Internal notes").fill("Updated internal note.");
  await page.getByLabel("Davening notes").fill("Updated davening note.");
  await page.getByLabel("Setup time").fill("17:15");
  await page.getByLabel("Washing start time").fill("23:00");
  await page.getByLabel("Waiters").fill("8");
  await page.getByLabel("Tablecloth").fill("Champagne");
  await page.getByLabel("Member shul").fill("Updated Shul");
  await page.getByLabel("Side boxes").fill("Women side boxes beside stage.");
  await page.getByLabel("Shabbos setup").fill("Set before candle lighting.");
  // Scoped to the role: the timeline rows expose aria-labels such as
  // "Timeline time for Guests arrive and first course begins", so a bare
  // getByLabel("Guests") is ambiguous. This is a textbox rather than a
  // spinbutton because the count fields moved off type="number" - that input
  // type hands JavaScript "" for anything it cannot parse, which is how
  // garbage used to be stored as a silent 0.
  await page.getByRole("textbox", { name: "Guests", exact: true }).fill("370");
  await page.getByRole("button", { name: "Save event details" }).click();

  await expect(page.getByRole("status")).toContainText("Event details saved");
  expect(savedPayload).toMatchObject({
    clientName: "Updated E2E Event",
    boysCount: 0,
    girlsCount: 0,
    ladiesCount: 0,
    menCount: 350,
    waitersCount: 8,
    notes: "Updated internal note.",
    daveningNote: "Updated davening note.",
    setupTime: "17:15",
    washingTime: "23:00",
    tableclothName: "Champagne",
    memberShulName: "Updated Shul",
    sideBoxes: "Women side boxes beside stage.",
    shabbosSetup: "Set before candle lighting."
  });

  await page.reload();
  await expect(page.getByLabel("Client")).toHaveValue("Updated E2E Event");
  await expect(
    page.getByRole("textbox", { exact: true, name: "Guests" })
  ).toHaveValue("370");
  await expect(page.getByLabel("Setup time")).toHaveValue("17:15");
  await expect(page.getByLabel("Washing start time")).toHaveValue("23:00");
  await expect(page.getByLabel("Waiters")).toHaveValue("8");
  await expect(page.getByLabel("Tablecloth")).toHaveValue("Champagne");
  await expect(page.getByLabel("Member shul")).toHaveValue("Updated Shul");
  await expect(page.getByLabel("Internal notes")).toHaveValue(
    "Updated internal note."
  );
  await expect(page.getByLabel("Davening notes")).toHaveValue(
    "Updated davening note."
  );
  await expect(page.getByLabel("Side boxes")).toHaveValue(
    "Women side boxes beside stage."
  );
  await expect(page.getByLabel("Shabbos setup")).toHaveValue(
    "Set before candle lighting."
  );
});

test("Event details prevent invalid guest count values before saving", async ({
  page
}) => {
  let patchRequests = 0;

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

  await page.route(
    "**/api/events/11111111-1111-4111-8111-111111111111",
    async (route) => {
      if (route.request().method() !== "PATCH") {
        await route.fallback();
        return;
      }

      patchRequests += 1;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ event: { id: eventResponse.events[0].id } })
      });
    }
  );

  await page.goto("/dashboard/events");
  await openFixtureEvent(page);
  await page
    .getByRole("textbox", { exact: true, name: "Children" })
    .fill("999");

  await expect(
    page.getByText("Children cannot be greater than total guests.")
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save event details" })
  ).toBeDisabled();
  expect(patchRequests).toBe(0);
});

test("Event lifecycle actions expose valid transitions with confirmation", async ({
  page
}) => {
  const eventId = eventResponse.events[0].id;
  const persistedResponse = structuredClone(eventResponse);
  Object.assign(persistedResponse.events[0], {
    bookingStatus: "TENTATIVE_HOLD",
    eventStatus: "On Hold"
  });
  let statusPayload: Record<string, unknown> | null = null;

  await page.route("**/api/events", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(persistedResponse)
    });
  });

  await page.route(`**/api/events/${eventId}/status`, async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.fallback();
      return;
    }

    statusPayload = route.request().postDataJSON();
    Object.assign(persistedResponse.events[0], {
      bookingStatus: "CONFIRMED",
      eventStatus: "Confirmed",
      version: 2
    });

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ event: persistedResponse.events[0] })
    });
  });

  await page.goto("/dashboard/events");
  await openFixtureEvent(page);

  await expect(
    page.getByRole("combobox", { name: "Event status" })
  ).toHaveValue("TENTATIVE_HOLD");
  await expect(page.getByRole("option", { name: "Confirm event" })).toHaveCount(
    1
  );
  await expect(
    page.getByRole("option", { name: "Mark completed" })
  ).toHaveCount(0);

  await page
    .getByRole("combobox", { name: "Event status" })
    .selectOption("CONFIRMED");
  await expect(
    page.getByRole("dialog", { name: "Confirm this event?" })
  ).toBeVisible();
  await page
    .getByRole("dialog", { name: "Confirm this event?" })
    .getByRole("button", { name: "Confirm event" })
    .click();

  await expect(page.getByRole("status")).toContainText(
    "Confirm event saved successfully."
  );
  expect(statusPayload).toMatchObject({
    status: "CONFIRMED",
    expectedVersion: 1
  });
  await expect(
    page.getByRole("combobox", { name: "Event status" })
  ).toHaveValue("CONFIRMED");
  await expect(
    page.getByRole("option", { name: "Mark completed" })
  ).toHaveCount(1);
});
