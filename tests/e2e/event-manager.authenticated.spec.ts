import { expect, test, type Page } from "@playwright/test";

const eventResponse = {
  events: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      bookingStatus: "CONFIRMED",
      clientName: "E2E Event",
      eventDate: "2026-08-22T00:00:00.000Z",
      eventType: "Wedding",
      eventTypeId: "44444444-4444-4444-8444-444444444444",
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
      // A real number: Event information is the booking form now, so the phone
      // is a required, validated field rather than a display string.
      phone: "+12125550123",
      email: null,
      workspaceData: null,
      // A uuid, like a real hall: the booking form validates the id it posts.
      hall: { id: "55555555-5555-4555-8555-555555555555", name: "Hall 1" }
    }
  ],
  halls: [{ id: "55555555-5555-4555-8555-555555555555", name: "Hall 1" }],
  eventTypes: [
    { id: "44444444-4444-4444-8444-444444444444", name: "Wedding" }
  ],
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

// The Hall map tab is withdrawn from the event workspace for the MVP
// (lib/ui/mvp-features), so there is no tab left to click. Skipped rather than
// listed in playwright.config.ts's `mvpHiddenSpecs`, because that lever works on
// whole files and the other three tests here cover event details, which ships.
// Deleting `.skip` is what brings it back, alongside the tab.
test.skip("Hall map tab shows the Dining Manager saved preset layout", async ({
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
      phone: payload.phone,
      couplesCount: payload.couplesCount,
      menCount: payload.menCount,
      ladiesCount: payload.ladiesCount,
      boysCount: payload.boysCount,
      girlsCount: payload.girlsCount,
      kidsCount: payload.kidsCount,
      notes: payload.notes
    });

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ event: { id: eventId, version: 2 } })
    });
  });

  await page.goto("/dashboard/events");
  await openFixtureEvent(page);

  await page.getByLabel("Client name").fill("Updated E2E Event");
  // Also role-scoped: getByLabel matches substrings, and the topbar's "Open
  // today notes" button sits behind the dialog, so a bare getByLabel("Notes")
  // matches it too.
  await page
    .getByRole("textbox", { exact: true, name: "Notes" })
    .fill("Updated internal note.");
  // Scoped to the role: a timeline row exposes aria-labels naming its own
  // instruction ("Timeline time for ..."), so a bare getByLabel("Guests") is
  // ambiguous against any row a fixture saves. This is a textbox rather than a
  // spinbutton because the count fields moved off type="number" - that input
  // type hands JavaScript "" for anything it cannot parse, which is how
  // garbage used to be stored as a silent 0.
  await page.getByRole("textbox", { name: "Guests", exact: true }).fill("370");
  await page.getByRole("button", { name: "Save event details" }).click();

  await expect(page.getByRole("status")).toContainText("Event details saved");
  expect(savedPayload).toMatchObject({
    clientName: "Updated E2E Event",
    phone: "+12125550123",
    eventTypeId: "44444444-4444-4444-8444-444444444444",
    hallId: "55555555-5555-4555-8555-555555555555",
    boysCount: 0,
    girlsCount: 0,
    ladiesCount: 0,
    couplesCount: 10,
    kidsCount: 0,
    // 370 guests less the 10 couples already recorded.
    menCount: 350,
    notes: "Updated internal note."
  });

  await page.reload();
  // A reload is a fresh page with no ?eventId= on it, so the selection is gone
  // and the pane is back to empty. Choosing the row again is what re-reads the
  // saved values from the server, which is the half of this test the reload is
  // here for.
  await openFixtureEvent(page);
  await expect(page.getByLabel("Client name")).toHaveValue("Updated E2E Event");
  await expect(
    page.getByRole("textbox", { exact: true, name: "Guests" })
  ).toHaveValue("370");
  await expect(
    page.getByRole("textbox", { exact: true, name: "Notes" })
  ).toHaveValue("Updated internal note.");
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
  await page.getByRole("button", { name: "Save event details" }).click();

  // The 20 guests on the fixture cannot cover 10 couples plus 999 children, and
  // the shared booking schema says so rather than letting the total be clamped.
  await expect(
    page.getByText(
      "Guests must be at least 1019 to cover the couples and children entered."
    )
  ).toBeVisible();
  expect(patchRequests).toBe(0);
});

test("Confirm event saves the details first, then confirms the booking", async ({
  page
}) => {
  const eventId = eventResponse.events[0].id;
  const persistedResponse = structuredClone(eventResponse);
  Object.assign(persistedResponse.events[0], {
    bookingStatus: "TENTATIVE_HOLD",
    eventStatus: "On Hold"
  });
  let savedPayload: Record<string, unknown> | null = null;
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

  await page.route(`**/api/events/${eventId}`, async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.fallback();
      return;
    }

    savedPayload = route.request().postDataJSON();
    Object.assign(persistedResponse.events[0], {
      clientName: savedPayload?.clientName,
      version: 2
    });

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ event: { id: eventId, version: 2 } })
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
      version: 3
    });

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ event: persistedResponse.events[0] })
    });
  });

  await page.goto("/dashboard/events");
  await openFixtureEvent(page);

  await page.getByLabel("Client name").fill("Confirmed E2E Event");
  await page.getByRole("button", { name: "Confirm event" }).click();

  await expect(page.getByRole("status")).toContainText("Event confirmed");
  expect(savedPayload).toMatchObject({ clientName: "Confirmed E2E Event" });
  // Version 2, not 1: saving the details bumped the row, so the transition has
  // to quote what came back rather than what the panel first rendered with.
  expect(statusPayload).toMatchObject({
    status: "CONFIRMED",
    expectedVersion: 2
  });
  // Nothing left to confirm once the booking is confirmed.
  await expect(
    page.getByRole("button", { name: "Confirm event" })
  ).toBeDisabled();
});
