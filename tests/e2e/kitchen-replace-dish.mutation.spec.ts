import { addDays, format, parseISO } from "date-fns";
import { expect, test, type Page } from "@playwright/test";

/**
 * Swapping a dish from the kitchen board, end to end.
 *
 * The board carried a replace control once before and it was taken out, because
 * it wrote `Event.menuItemIds` - the legacy mirror - and never reached
 * `EventMenuLine`, which is what the board's own arithmetic, the event's Menu
 * tab and the client portal all read. The two views of one menu diverged from
 * the moment anyone used it, and no test noticed, because both halves of the
 * assertion could be made against the same wrong column.
 *
 * That is the bug this suite exists for, and it is why the happy path goes
 * through the real UI and then checks the *menu document*: swapping on the board
 * and reading back the menu is the one shape that could not have passed before.
 *
 * Catalog fixtures are reused by name, the way `event-menu.mutation.spec.ts`
 * does and for the same reason: `event_menu_lines` holds menu items behind a
 * RESTRICT, so a suite that created a fresh dish per run and failed to clean one
 * up would jam every later run behind an undeletable row. These are the same two
 * dishes that suite provisions, so between them they create nothing new.
 *
 * Unlike the menu suite, these events cannot be inquiries: the board lists only
 * bookings the hall is committed to. A CONFIRMED booking reserves its date, so
 * each test takes a free date out of the pool and the teardown cancels the
 * booking to put it back.
 */

const HALL_NAME = "E2E Hall";
const BUFFET_A = "E2E Menu Buffet A";
const BUFFET_B = "E2E Menu Buffet B";

/** A uuid that is well formed and belongs to nobody. */
const FOREIGN_ID = "00000000-0000-4000-8000-0000000000ff";

type MenuLine = {
  menuItemId: string | null;
  name: string;
  serviceStyle: string | null;
};

type EventMenu = {
  id: string | null;
  status: string;
  version: number;
  lines: MenuLine[];
};

type KitchenLine = {
  menuItemId: string | null;
  name: string;
  status: string | null;
};

async function readJson<T>(
  response: Awaited<ReturnType<Page["request"]["get"]>>,
  label: string
) {
  if (!response.ok()) {
    throw new Error(
      `${label} failed with ${response.status()}: ${await response.text()}`
    );
  }

  return (await response.json()) as T;
}

async function readMenuLibrary(page: Page) {
  return readJson<{
    items: Array<{ id: string; name: string }>;
  }>(await page.request.get("/api/menu"), "GET /api/menu");
}

/**
 * The two dishes these tests swap between, created once and reused by every
 * later run. Both are buffet, so the replacement inherits the style the line
 * already had rather than landing on a different one - which is the behaviour
 * the swap promises and the quantity arithmetic depends on.
 */
async function provisionCatalog(page: Page) {
  let library = await readMenuLibrary(page);
  let created = false;

  for (const name of [BUFFET_A, BUFFET_B]) {
    if (library.items.some((item) => item.name === name)) continue;

    const response = await page.request.post("/api/menu", {
      data: {
        resource: "item",
        name,
        usageType: "Both",
        kind: "Food",
        services: [
          {
            serviceStyle: "Buffet",
            quantity: 1,
            unit: "tray",
            per: 30,
            perBasis: "TotalGuests",
            rounding: "Up",
            minimumUnits: null
          }
        ]
      }
    });

    if (!response.ok()) {
      throw new Error(
        `Could not provision ${name}: ${response.status()} ${await response.text()}`
      );
    }

    created = true;
  }

  if (created) library = await readMenuLibrary(page);

  const find = (name: string) => {
    const row = library.items.find((candidate) => candidate.name === name);
    if (!row)
      throw new Error(
        `${name} is missing from the catalog after provisioning.`
      );
    return row;
  };

  return { buffetA: find(BUFFET_A), buffetB: find(BUFFET_B) };
}

/**
 * A confirmed booking the board will actually list.
 *
 * Dated between two and fourteen days out: the window the board reads is 28
 * days from today, and its four-week grid starts on this week's Sunday, so
 * anything inside a fortnight is on screen whichever weekday the run lands on.
 *
 * The date is chosen the way the booking suite chooses one - first free day,
 * with its neighbours excluded - because a confirmed booking writes a hall
 * reservation, and the trial plan these tests run on has a single hall.
 *
 * Unlike that suite, this one books several times over, and the workers run in
 * parallel: each reads the pool before any of them has written to it, so two
 * can pick the same free day. A reservation clash comes back as a 409, which is
 * why this walks the candidates rather than committing to the first one.
 */
async function createConfirmedEvent(page: Page, clientName: string) {
  const readEvents = async () =>
    readJson<{
      events: Array<{ eventDate: string; bookingStatus: string }>;
      halls: Array<{ id: string; name: string }>;
    }>(await page.request.get("/api/events"), "GET /api/events");

  let data = await readEvents();

  if (data.halls.length === 0) {
    const created = await page.request.post("/api/halls", {
      data: { name: HALL_NAME, capacity: 300 }
    });

    if (!created.ok() && created.status() !== 409) {
      throw new Error(
        `POST /api/halls failed with ${created.status()}: ${await created.text()}`
      );
    }

    data = await readEvents();
  }

  const hallId = data.halls[0]?.id;

  if (!hallId) {
    throw new Error(
      "The E2E organization has no hall and one could not be created."
    );
  }

  const active = new Set(["CONFIRMED", "TENTATIVE_HOLD"]);
  const unavailable = new Set(
    data.events
      .filter((event) => active.has(event.bookingStatus))
      .flatMap((event) =>
        [-1, 0, 1].map((offset) =>
          format(
            addDays(parseISO(String(event.eventDate).slice(0, 10)), offset),
            "yyyy-MM-dd"
          )
        )
      )
  );
  const candidates = Array.from({ length: 13 }, (_, index) =>
    format(addDays(new Date(), index + 2), "yyyy-MM-dd")
  ).filter((candidate) => !unavailable.has(candidate));

  if (candidates.length === 0) {
    throw new Error(
      "Every date in the next fortnight already has an active booking in the E2E organization."
    );
  }

  let lastRefusal = "";

  for (const eventDate of candidates) {
    // No event type on purpose: the board titles a card `clientName eventType`,
    // and leaving the type off makes the card's name exactly the client name
    // this test generated, which is what every lookup below matches on.
    //
    // A fresh idempotency key per attempt: the same one replayed would answer
    // with the refusal it was first given rather than trying the new date.
    const response = await page.request.post("/api/events", {
      headers: { "idempotency-key": crypto.randomUUID() },
      data: {
        clientName,
        hallId,
        eventDate,
        bookingStatus: "CONFIRMED",
        menCount: 40,
        ladiesCount: 40
      }
    });

    if (response.ok()) {
      const { event } = (await response.json()) as { event: { id: string } };

      return event.id;
    }

    lastRefusal = `${response.status()}: ${await response.text()}`;

    // Anything but a clash over the day is a real failure, and retrying it on
    // twelve more dates would only bury the reason.
    if (response.status() !== 409) break;
  }

  throw new Error(`Could not book a date for ${clientName} - ${lastRefusal}`);
}

async function seedMenu(page: Page, eventId: string, menuItemIds: string[]) {
  const response = await page.request.put(`/api/events/${eventId}/menu`, {
    data: {
      meal: "Main",
      version: 0,
      lines: menuItemIds.map((menuItemId) => ({
        menuItemId,
        serviceStyle: "Buffet"
      }))
    }
  });

  if (!response.ok()) {
    throw new Error(
      `Could not seed the menu: ${response.status()} ${await response.text()}`
    );
  }
}

async function getMenu(page: Page, eventId: string) {
  const { menu } = await readJson<{ menu: EventMenu }>(
    await page.request.get(`/api/events/${eventId}/menu`),
    `GET /api/events/${eventId}/menu`
  );

  return menu;
}

async function getKitchenSheet(page: Page, eventId: string) {
  const { kitchen } = await readJson<{ kitchen: { lines: KitchenLine[] } }>(
    await page.request.get(`/api/events/${eventId}/kitchen`),
    `GET /api/events/${eventId}/kitchen`
  );

  return kitchen;
}

/**
 * Best effort by design: a teardown that threw would bury the real failure.
 *
 * The menu is emptied before the booking is cancelled, so no line is left
 * holding a shared catalog row behind its RESTRICT, and the date goes back into
 * the pool the next run picks from.
 */
async function cleanUp(page: Page, eventId: string) {
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const menu = await page.request.get(`/api/events/${eventId}/menu`);

      if (!menu.ok()) break;

      const { menu: document } = (await menu.json()) as { menu: EventMenu };

      if (document.id === null || document.lines.length === 0) break;

      if (document.status === "Confirmed") {
        await page.request.post(`/api/events/${eventId}/menu`, {
          data: { action: "reopen", meal: "Main", version: document.version }
        });
        continue;
      }

      const emptied = await page.request.put(`/api/events/${eventId}/menu`, {
        data: { meal: "Main", version: document.version, lines: [] }
      });

      if (emptied.ok()) break;
    }

    const { events } = (await (
      await page.request.get(`/api/events?eventId=${eventId}`)
    ).json()) as { events: Array<{ id: string; version: number }> };
    const event = events.find((candidate) => candidate.id === eventId);

    if (event) {
      await page.request.patch(`/api/events/${eventId}/status`, {
        data: { status: "CANCELLED", expectedVersion: event.version }
      });
    }
  } catch {
    // Teardown only - nothing here is worth failing a passing test over.
  }
}

/**
 * Opens the board on the four-week view and the event's own dialog.
 *
 * Four weeks rather than the day view it lands on: the booking above is dated
 * days out, and the day view draws one date at a time.
 */
async function openEventDialog(
  page: Page,
  eventId: string,
  clientName: string
) {
  const board = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === "/api/kitchen",
    { timeout: 30_000 }
  );

  await page.goto("/dashboard/kitchen");
  await board;

  await page.getByRole("button", { name: "4 Weeks" }).click();

  // The sheet behind the dialog is a second request, and every control in it is
  // absent until it lands.
  const sheet = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === `/api/events/${eventId}/kitchen`,
    { timeout: 30_000 }
  );

  await page
    .getByRole("button", { name: clientName })
    .click({ timeout: 30_000 });
  await sheet;

  const dialog = page.getByRole("dialog", { name: clientName });
  await expect(dialog).toBeVisible();

  return dialog;
}

function replaceDrawer(page: Page) {
  return page.getByRole("dialog", { name: "Replace a dish" });
}

test.beforeEach(async () => {
  test.skip(
    !process.env.E2E_MUTATION_EMAIL || !process.env.E2E_MUTATION_PASSWORD,
    "Mutation E2E credentials are not set."
  );
});

test.describe("kitchen board dish replacement", () => {
  test("swaps a dish from the board, and the event's menu changes with it", async ({
    page
  }) => {
    test.setTimeout(120_000);

    const clientName = `E2E Kitchen Swap ${Date.now()}`;
    const catalog = await provisionCatalog(page);
    const eventId = await createConfirmedEvent(page, clientName);

    try {
      await seedMenu(page, eventId, [catalog.buffetA.id]);

      // Started, so the swap can be shown not to carry progress across: the new
      // dish has not been cooked, whatever was true of the one it replaced.
      const started = await page.request.patch("/api/kitchen", {
        data: {
          action: "status",
          eventId,
          menuItemId: catalog.buffetA.id,
          status: "PENDING"
        }
      });
      expect(started.status()).toBe(200);

      const dialog = await openEventDialog(page, eventId, clientName);
      // The card's own control rather than its name: the name also appears in
      // the assignment select's label, and a bare text lookup matches both.
      const replaceA = dialog.getByRole("button", {
        name: `Replace ${BUFFET_A}`
      });
      await expect(replaceA).toBeVisible({ timeout: 20_000 });

      await replaceA.click();

      const drawer = replaceDrawer(page);
      await expect(drawer).toBeVisible();
      // The dish coming off, named where the swap was opened from.
      await expect(drawer.getByText(BUFFET_A, { exact: true })).toHaveCount(1);

      // The library, filtered rather than scrolled: the E2E organization
      // accumulates dishes from every other suite.
      await drawer.getByLabel("Search the menu library").fill(BUFFET_B);

      const option = drawer.getByRole("button", { name: BUFFET_B });
      await expect(option).toBeEnabled({ timeout: 20_000 });
      // What the swap would do to the line, said before it is done: both dishes
      // are buffet, so the style is inherited rather than changed.
      await expect(option.getByText("Will be served buffet")).toBeVisible();

      await option.click();

      // Both ends of the swap are now named - the dish coming off appears a
      // second time, struck through, in the sentence above the button.
      await expect(drawer.getByText(BUFFET_A, { exact: true })).toHaveCount(2);

      const swapped = page.waitForResponse(
        (response) =>
          response.request().method() === "PATCH" &&
          new URL(response.url()).pathname === "/api/kitchen",
        { timeout: 30_000 }
      );
      await drawer
        .getByRole("button", { name: "Replace dish", exact: true })
        .click();
      expect((await swapped).status()).toBe(200);

      await expect(drawer).toBeHidden({ timeout: 20_000 });
      await expect(
        dialog.getByRole("button", { name: `Replace ${BUFFET_B}` })
      ).toBeVisible({ timeout: 20_000 });
      await expect(replaceA).toBeHidden();

      // --- and in the menu the rest of the product reads ---------------------
      // The assertion the old replace action could never have passed: it wrote
      // the mirror only, so the line here would still have named the old dish.
      const menu = await getMenu(page, eventId);
      expect(
        menu.lines.map((line) => `${line.name}:${line.serviceStyle ?? "-"}`)
      ).toEqual([`${BUFFET_B}:Buffet`]);

      // Progress does not travel with the swap.
      const sheet = await getKitchenSheet(page, eventId);
      expect(sheet.lines).toHaveLength(1);
      expect(sheet.lines[0]).toMatchObject({
        menuItemId: catalog.buffetB.id,
        status: null
      });

      // The legacy mirror the event PDF and the client portal still read.
      const { events } = await readJson<{
        events: Array<{ id: string; menuItemIds: string[] }>;
      }>(
        await page.request.get(`/api/events?eventId=${eventId}`),
        "GET /api/events"
      );
      expect(
        events.find((candidate) => candidate.id === eventId)?.menuItemIds
      ).toEqual([catalog.buffetB.id]);
    } finally {
      await cleanUp(page, eventId);
    }
  });

  test("will not offer a dish this menu already carries", async ({ page }) => {
    test.setTimeout(120_000);

    const clientName = `E2E Kitchen Dupe ${Date.now()}`;
    const catalog = await provisionCatalog(page);
    const eventId = await createConfirmedEvent(page, clientName);

    try {
      await seedMenu(page, eventId, [catalog.buffetA.id, catalog.buffetB.id]);

      const dialog = await openEventDialog(page, eventId, clientName);
      await dialog
        .getByRole("button", { name: `Replace ${BUFFET_A}` })
        .click({ timeout: 20_000 });

      const drawer = replaceDrawer(page);
      await drawer.getByLabel("Search the menu library").fill(BUFFET_B);

      // A dish appears once per menu - the unique index would refuse the second
      // line - so this is offered as unavailable rather than as a swap that
      // fails on the way back.
      const already = drawer.getByRole("button", { name: BUFFET_B });
      await expect(already).toBeDisabled({ timeout: 20_000 });
      await expect(already.getByText("Already on this menu")).toBeVisible();

      // Nothing picked, so there is nothing to commit. Exact, or this matches
      // the drawer's own close button as well.
      await expect(
        drawer.getByRole("button", { name: "Replace dish", exact: true })
      ).toBeDisabled();
    } finally {
      await cleanUp(page, eventId);
    }
  });

  test.describe("refusals", () => {
    test("409s on a dish the menu already carries, and writes nothing", async ({
      page
    }) => {
      const clientName = `E2E Kitchen Dupe API ${Date.now()}`;
      const catalog = await provisionCatalog(page);
      const eventId = await createConfirmedEvent(page, clientName);

      try {
        await seedMenu(page, eventId, [catalog.buffetA.id, catalog.buffetB.id]);
        const before = await getMenu(page, eventId);

        const response = await page.request.patch("/api/kitchen", {
          data: {
            action: "replace-menu-item",
            eventId,
            menuItemId: catalog.buffetA.id,
            replacementMenuItemId: catalog.buffetB.id
          }
        });

        expect(response.status()).toBe(409);
        expect(await response.text()).toContain("already on this menu");

        // Refused, not partially applied - and the version guard did not fire
        // either, so a Menu tab open elsewhere is not sent to reload for nothing.
        const after = await getMenu(page, eventId);
        expect(after.lines.map((line) => line.name).sort()).toEqual(
          [BUFFET_A, BUFFET_B].sort()
        );
        expect(after.version).toBe(before.version);
      } finally {
        await cleanUp(page, eventId);
      }
    });

    test("404s for a replacement that belongs to no organization", async ({
      page
    }) => {
      const clientName = `E2E Kitchen Foreign ${Date.now()}`;
      const catalog = await provisionCatalog(page);
      const eventId = await createConfirmedEvent(page, clientName);

      try {
        await seedMenu(page, eventId, [catalog.buffetA.id]);

        const response = await page.request.patch("/api/kitchen", {
          data: {
            action: "replace-menu-item",
            eventId,
            menuItemId: catalog.buffetA.id,
            replacementMenuItemId: FOREIGN_ID
          }
        });

        expect(response.status()).toBe(404);
        expect(
          (await getMenu(page, eventId)).lines.map((line) => line.name)
        ).toEqual([BUFFET_A]);
      } finally {
        await cleanUp(page, eventId);
      }
    });

    test("404s when the dish being replaced is not on the menu", async ({
      page
    }) => {
      // A board left open while somebody empties the menu on the Menu tab.
      const clientName = `E2E Kitchen Stale ${Date.now()}`;
      const catalog = await provisionCatalog(page);
      const eventId = await createConfirmedEvent(page, clientName);

      try {
        await seedMenu(page, eventId, [catalog.buffetB.id]);

        const response = await page.request.patch("/api/kitchen", {
          data: {
            action: "replace-menu-item",
            eventId,
            menuItemId: catalog.buffetA.id,
            replacementMenuItemId: catalog.buffetB.id
          }
        });

        expect(response.status()).toBe(404);
      } finally {
        await cleanUp(page, eventId);
      }
    });
  });
});
