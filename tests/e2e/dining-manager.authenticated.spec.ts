import { expect, test } from "@playwright/test";

const hall = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Hall 1"
};

const diningEvent = {
  id: "22222222-2222-4222-8222-222222222222",
  clientName: "E2E Dining Event",
  eventType: "Wedding",
  eventDate: "2026-08-22T00:00:00.000Z",
  startsAt: "2026-08-22T18:00:00.000Z",
  eventStatus: "Confirmed",
  bookingStatus: "CONFIRMED",
  packageName: "Standard",
  couplesCount: 10,
  menCount: 0,
  ladiesCount: 0,
  boysCount: 0,
  girlsCount: 0,
  kidsCount: 0,
  waitersCount: 2,
  tableclothName: "Ivory",
  washingTime: null,
  notes: null,
  hall,
  diningPlan: null
};

// 90 men and 10 ladies. Deliberately lopsided: under the old ceil(adults / 2)
// assumption this booking read as 50/50, which is what the gender-aware split
// and the seats chip below have to disprove.
const lopsidedEvent = {
  ...diningEvent,
  id: "66666666-6666-4666-8666-666666666666",
  clientName: "E2E Lopsided Event",
  couplesCount: 0,
  menCount: 90,
  ladiesCount: 10
};

// Same shape, same hall, but a wildly different head count - the ranking has
// to pass it over in favour of the closer match.
const otherHallEvent = {
  ...diningEvent,
  id: "77777777-7777-4777-8777-777777777777",
  clientName: "E2E Other Hall Event",
  hall: { id: "88888888-8888-4888-8888-888888888888", name: "Hall 2" }
};

const presetA = {
  id: "33333333-3333-4333-8333-333333333333",
  hallId: hall.id,
  name: "Preset A",
  objects: [
    {
      id: "preset-a-table",
      type: "round-table",
      name: "Preset A Table",
      x: 80,
      y: 90,
      width: 80,
      height: 80,
      rotation: 0,
      seats: 10,
      seatingUse: "adult"
    }
  ]
};

const presetB = {
  id: "44444444-4444-4444-8444-444444444444",
  hallId: hall.id,
  name: "Preset B",
  objects: [
    {
      id: "preset-b-table",
      type: "head-table",
      name: "Preset B Head Table",
      x: 260,
      y: 160,
      width: 140,
      height: 56,
      rotation: 0,
      seats: 12,
      seatingUse: "head"
    }
  ]
};

test.beforeEach(async () => {
  test.skip(
    !process.env.E2E_READONLY_EMAIL || !process.env.E2E_READONLY_PASSWORD,
    "Read-only E2E credentials are not set."
  );
});

test("selecting a hall map preset immediately previews its dining table layout", async ({
  page
}) => {
  await page.route("**/api/dining", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          events: [diningEvent],
          hallMapPresets: [presetA, presetB]
        })
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/dashboard/dining-manager");

  await page.getByLabel("Hall map preset").click();
  await page.getByRole("option", { name: "Preset A" }).click();

  // Assert on the table shape itself, not its inner label: inside the small
  // round table the name is clipped to a zero-height box on narrow viewports,
  // so getByText(...).toBeVisible() only holds on desktop.
  await expect(
    page.getByRole("button", { name: "Preset A Table" })
  ).toBeVisible();
  await expect(
    page.getByText("Preset A previewed with 1 seating tables.")
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Preset B Head Table" })
  ).toHaveCount(0);

  await page.getByLabel("Hall map preset").click();
  await page.getByRole("option", { name: "Preset B" }).click();

  await expect(
    page.getByRole("button", { name: "Preset B Head Table" })
  ).toBeVisible();
  await expect(
    page.getByText("Preset B previewed with 1 seating tables.")
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Preset A Table" })
  ).toHaveCount(0);
});

test("saving a dining plan persists the selected hall map preset layout", async ({
  page
}) => {
  let savedPayload: {
    eventId?: string;
    hallMapPresetId?: string | null;
    tables?: Array<{
      mapObjectId?: string;
      name?: string;
      side?: string;
      seats?: number;
    }>;
  } | null = null;

  await page.route("**/api/dining", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          events: [diningEvent],
          hallMapPresets: [presetA, presetB]
        })
      });
      return;
    }

    if (route.request().method() === "PATCH") {
      savedPayload = route.request().postDataJSON();
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          plan: {
            id: "55555555-5555-4555-8555-555555555555",
            ...savedPayload
          }
        })
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/dashboard/dining-manager");

  await page.getByLabel("Hall map preset").click();
  await page.getByRole("option", { name: "Preset B" }).click();
  await page
    .getByLabel("Special notes")
    .fill("VIP table beside stage. Serve kids meals first.");
  const saveRequest = page.waitForRequest((request) => {
    return request.url().includes("/api/dining") && request.method() === "PATCH";
  });
  const refetchResponse = page.waitForResponse((response) => {
    return response.url().includes("/api/dining") && response.status() === 200;
  });

  // Save from the bottom of the page - the position where the old
  // board-pinned message used to fire out of view.
  await page.evaluate(() => {
    document.querySelectorAll("main").forEach((main) => {
      main.scrollTop = main.scrollHeight;
    });
  });

  await page.getByRole("button", { name: "Save dining plan" }).click();
  await saveRequest;
  await refetchResponse;

  const confirmation = page.getByRole("status");
  await expect(confirmation).toContainText("Dining plan saved.");

  // Present in the DOM is not the same as on screen. The confirmation is
  // fixed to the viewport now, so this holds at any scroll position and on
  // every screen size - including mobile, where the board sits far below the
  // Save button and the old board-pinned message was never actually seen.
  await expect(confirmation).toBeInViewport();
  expect(savedPayload).toMatchObject({
    eventId: diningEvent.id,
    hallMapPresetId: presetB.id,
    specialNotes: "VIP table beside stage. Serve kids meals first.",
    tables: [
      expect.objectContaining({
        mapObjectId: "preset-b-table",
        name: "Preset B Head Table",
        side: "head",
        seats: 12
      })
    ]
  });
});

test("the seats chip counts against the booking's own men and ladies split", async ({
  page
}, testInfo) => {
  test.skip(
    testInfo.project.name.includes("mobile"),
    "The board header chip is a desktop affordance (hidden below the sm breakpoint)."
  );

  await page.route("**/api/dining", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ events: [lopsidedEvent], hallMapPresets: [] })
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/dashboard/dining-manager");

  // The eight default tables seat 40 men and 40 women. Against 90 men and 10
  // ladies that is 80 of 100 seats - and short, because the surplus women's
  // seats cannot take the overflow of men.
  const chip = page.getByLabel("Seats provided");
  await expect(chip).toHaveText("80/100 seats · short 20");
  // The per-side breakdown is the part a 50/50 split would get wrong: it would
  // have read "Men 40/50 · Women 40/50" and called this layout nearly right.
  await expect(chip).toHaveAttribute(
    "title",
    "Men 40/90 · Women 40/10 · Kids 0/0"
  );

  await page.getByRole("button", { name: "Auto layout" }).click();

  await expect(
    page.getByText("Auto layout generated 9 men, 1 women, and 0 kids tables.")
  ).toBeVisible();
  await expect(chip).toHaveText("100/100 seats");
});

test("a rearranged preset is marked modified and can be reset", async ({
  page
}, testInfo) => {
  test.skip(
    testInfo.project.name.includes("mobile"),
    "Pointer-drag coverage runs on the desktop dining workspace."
  );

  await page.route("**/api/dining", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          events: [diningEvent],
          hallMapPresets: [presetA]
        })
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/dashboard/dining-manager");
  await page.getByLabel("Hall map preset").click();
  await page.getByRole("option", { name: "Preset A" }).click();

  const badge = page.getByText("Modified - this event only");
  const table = page.getByRole("button", { name: "Preset A Table" });
  await expect(table).toBeVisible();

  // Freshly loaded, the copy still matches its source. Table ids are minted on
  // every load, so a naive comparison would flag this as modified already.
  await expect(badge).toHaveCount(0);

  // hover() first, deliberately: loading a preset schedules fitDiningMapTables
  // on an animation frame, which rescales and rescrolls the board. Measuring
  // before that settles reads a boundingBox the table has already left, and
  // mouse.down() then lands on empty canvas and pans the map instead of
  // dragging the table - no edit, no badge, and a failure that looks like the
  // badge is broken. hover() waits for the element to stop moving.
  await table.hover();
  const before = await table.boundingBox();
  if (!before) throw new Error("Preset table is not visible.");
  await page.mouse.down();
  await page.mouse.move(before.x + 220, before.y + 140, { steps: 10 });
  await page.mouse.up();

  // Prove the drag actually moved the table, so a failure below is about the
  // badge rather than about the drag silently doing nothing.
  await expect
    .poll(async () => (await table.boundingBox())?.x ?? before.x)
    .toBeGreaterThan(before.x + 50);

  // Dragging edits this event's copy, never the preset itself - which is
  // exactly what the badge is there to say.
  await expect(badge).toBeVisible();

  await page.getByRole("button", { name: "Reset to preset" }).click();

  await expect(
    page.getByText("Reset to Preset A. Save the dining plan to keep it.")
  ).toBeVisible();
  await expect(badge).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Reset to preset" })
  ).toHaveCount(0);
});

test("seats per table changes how many tables Auto layout builds", async ({
  page
}) => {
  await page.route("**/api/dining", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ events: [lopsidedEvent], hallMapPresets: [] })
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/dashboard/dining-manager");

  // 90 men and 10 ladies. On tens that is 9 + 1 tables.
  await page.getByRole("button", { name: "Auto layout" }).click();
  await expect(
    page.getByText("Auto layout generated 9 men, 1 women, and 0 kids tables.")
  ).toBeVisible();

  // The default tables are read back as ten-seaters.
  const seatsPerTable = page.getByLabel("Seats per table");
  await expect(seatsPerTable).toHaveValue("10");

  await seatsPerTable.fill("12");
  await seatsPerTable.blur();

  // Existing tables resize, so the figure survives a reload - it is read back
  // from the layout rather than stored separately.
  await expect(
    page.getByText(
      "Tables resized to 12 seats. Re-run Auto layout to match the table count to the guests."
    )
  ).toBeVisible();

  await page.getByRole("button", { name: "Auto layout" }).click();

  // ceil(90/12) = 8 men, ceil(10/12) = 1 women. Two fewer tables than on tens.
  await expect(
    page.getByText("Auto layout generated 8 men, 1 women, and 0 kids tables.")
  ).toBeVisible();
  await expect(seatsPerTable).toHaveValue("12");

  // 8x12 + 1x12 = 108 seats against 100 required, so the chip must read the
  // bigger tables rather than assuming ten apiece.
  await expect(page.getByLabel("Seats provided")).toHaveText("108/100 seats");
});

test("auto layout never reuses a layout from another hall", async ({ page }) => {
  const matchingTables = [
    ...Array.from({ length: 9 }, (_, index) => ({
      id: `men-${index}`,
      number: index + 1,
      seats: 10,
      side: "men",
      x: 40 * index,
      y: 20
    })),
    { id: "women-0", number: 10, seats: 10, side: "women", x: 400, y: 20 }
  ];

  await page.route("**/api/dining", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          events: [
            lopsidedEvent,
            {
              ...otherHallEvent,
              diningPlan: {
                id: "99999999-9999-4999-8999-999999999999",
                eventId: otherHallEvent.id,
                adultCount: 100,
                childrenCount: 0,
                countType: "People",
                hallMapPresetId: null,
                menWaiters: 0,
                womenWaiters: 0,
                specialNotes: null,
                tablecloth: null,
                washingTime: null,
                tables: matchingTables
              }
            }
          ],
          hallMapPresets: []
        })
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/dashboard/dining-manager");
  await page.getByRole("button", { name: "Auto layout" }).click();

  // Hall 2's plan matches this booking on every count, but its table
  // coordinates describe a different room, so it must be generated fresh.
  await expect(
    page.getByText("Auto layout generated 9 men, 1 women, and 0 kids tables.")
  ).toBeVisible();
  // Scoped to the phrase, not the client name: the events list legitimately
  // shows "E2E Other Hall Event" whether or not its layout was reused.
  await expect(page.getByText("Auto layout reused")).toHaveCount(0);
});

test("scrolling outside the map is not dragged back to where the board left it", async ({
  page
}, testInfo) => {
  test.skip(
    testInfo.project.name.includes("mobile"),
    "Wheel coverage runs on the desktop dining workspace."
  );

  // Enough events that the page has somewhere to scroll to.
  await page.route("**/api/dining", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          events: Array.from({ length: 12 }, (_, index) => ({
            ...diningEvent,
            id: `2222${index}222-2222-4222-8222-222222222222`,
            clientName: `E2E Dining Event ${index}`
          })),
          hallMapPresets: [presetA]
        })
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/dashboard/dining-manager");
  const board = page.locator("[data-dining-workspace-scroll]");
  await expect(board).toBeVisible();

  // The page scroller is the INNER <main>, not the window and not the outer
  // dashboard shell - the page nests two <main> elements, and only the inner
  // one has overflow-y: auto.
  const scroller = page.locator("main").filter({ has: board }).last();
  const scrollTop = () =>
    scroller.evaluate((element) => Math.round(element.scrollTop));
  const room = await scroller.evaluate(
    (element) => element.scrollHeight - element.clientHeight
  );
  expect(room).toBeGreaterThan(60);

  const boardBox = await board.boundingBox();
  if (!boardBox) throw new Error("Dining board is not visible.");

  // Land mid-range from the board, so the next scroll can move in either
  // direction rather than being silently clamped at an end.
  await page.mouse.move(
    boardBox.x + boardBox.width / 2,
    boardBox.y + boardBox.height / 2
  );
  await page.mouse.wheel(0, 120);
  await expect.poll(scrollTop).toBeGreaterThan(20);

  const fromBoard = await scrollTop();

  // Now scroll with the cursor over the toolbar, outside the map.
  const button = page.getByRole("button", { name: "+ Adult table" });
  const buttonBox = await button.boundingBox();
  if (!buttonBox) throw new Error("Toolbar is not visible.");
  await page.mouse.move(
    buttonBox.x + buttonBox.width / 2,
    buttonBox.y + buttonBox.height / 2
  );
  await page.mouse.wheel(0, -120);
  await expect.poll(scrollTop).toBeLessThan(fromBoard);

  // The regression: the board used to leave a requestAnimationFrame loop
  // running against a stale target, which pulled the page back to `fromBoard`
  // a few frames after any scroll made anywhere else.
  const landed = await scrollTop();
  await page.waitForTimeout(1200);
  expect(await scrollTop()).toBe(landed);
});

test("the movable dining grid pans and allows dragging past its old bottom edge", async ({
  page
}, testInfo) => {
  test.skip(
    testInfo.project.name.includes("mobile"),
    "Pointer-drag coverage runs on the desktop dining workspace."
  );
  let savedTables: Array<{ x?: number; y?: number }> = [];

  await page.route("**/api/dining", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          events: [diningEvent],
          hallMapPresets: [presetA]
        })
      });
      return;
    }

    if (route.request().method() === "PATCH") {
      savedTables = route.request().postDataJSON().tables;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          plan: { id: "55555555-5555-4555-8555-555555555555" }
        })
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/dashboard/dining-manager");
  await page.getByLabel("Hall map preset").click();
  await page.getByRole("option", { name: "Preset A" }).click();

  const grid = page.getByLabel("Dining map grid");
  const table = grid.getByRole("button", { name: "Preset A Table" });
  await expect(grid).toBeVisible();
  await expect(table).toBeVisible();

  await page.getByRole("button", { name: "Reset dining map zoom" }).click();
  await expect(
    page.getByRole("button", { name: "Reset dining map zoom" })
  ).toHaveText("100%");
  await page.getByRole("button", { name: "Zoom dining map out" }).click();
  await expect(
    page.getByRole("button", { name: "Reset dining map zoom" })
  ).toHaveText("80%");

  // The three dashboard columns stretch to a common row height, so on a short
  // window the board can extend past the fold. Bring it into view first, as a
  // user would: otherwise the drag target below is clamped to the window and
  // never reaches the 48px auto-pan edge, and this fails for a layout reason
  // rather than a panning one.
  await grid.scrollIntoViewIfNeeded();

  const beforeScrollTop = await grid.evaluate((element) => element.scrollTop);
  const gridBox = await grid.boundingBox();
  const tableBox = await table.boundingBox();
  if (!gridBox || !tableBox) throw new Error("Dining map is not visible.");

  await page.mouse.move(
    tableBox.x + tableBox.width / 2,
    tableBox.y + tableBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    gridBox.x + gridBox.width / 2,
    gridBox.y + gridBox.height + 250,
    { steps: 12 }
  );
  await page.mouse.up();

  await expect
    .poll(async () => grid.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(beforeScrollTop);

  await page.getByRole("button", { name: "Save dining plan" }).click();
  await expect.poll(() => savedTables[0]?.y ?? 0).toBeGreaterThan(520);
});

// Dropped from the smoke sweep in dashboard.authenticated.spec.ts when this
// page stopped rendering; restored here so it is still swept when the module
// ships.
test("the dining manager page renders without a fatal error", async ({ page }) => {
  await page.goto("/dashboard/dining-manager");

  await expect(page).toHaveURL(/\/dashboard\/dining-manager/);
  await expect(page.locator("body")).not.toContainText("Application error");
  await expect(page.locator("body")).not.toContainText("Internal Server Error");

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
});
