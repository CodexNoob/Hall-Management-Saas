import { expect, test, type Page } from "@playwright/test";

/**
 * The event menu, end to end: fetching it, adding to it in bulk, removing from
 * it, confirming it, and every refusal on the way.
 *
 * This is the suite that guards the bug the feature was built for. The menu
 * used to be stored as `Event.menuItemIds`, a bare uuid array that was only
 * ever written when the user pressed Confirm - so dishes added and left
 * unconfirmed were gone on the next reload. "survives a reload" below is that
 * regression, and it is the reason the happy path goes through the real UI
 * rather than the API: the API always wrote, it was the page that did not call
 * it.
 *
 * Catalog fixtures are looked up by name and created only when missing, the way
 * `events.mutation.spec.ts` provisions `E2E Hall`. Menu items have no cascade
 * out of `event_menu_lines` - the foreign key is RESTRICT on purpose - so a
 * suite that created a fresh dish per run and failed to clean one up would jam
 * every later run behind an undeletable row. Reusing four stable rows forever
 * avoids that entirely.
 *
 * Each test provisions its own INQUIRY event. INQUIRY reserves no hall, so
 * unlike the booking suite these tests take no date out of the pool and can run
 * in parallel; the teardown cancels them anyway so they drop out of the lists.
 */

const HALL_NAME = "E2E Hall";
const BUFFET_A = "E2E Menu Buffet A";
const BUFFET_B = "E2E Menu Buffet B";
const PLATED_A = "E2E Menu Plated A";
const ADD_ON_A = "E2E Menu Add-on A";

/** A uuid that is well formed and belongs to nobody. */
const FOREIGN_ID = "00000000-0000-4000-8000-0000000000ff";

type MenuLine = {
  id: string;
  menuItemId: string | null;
  addOnId: string | null;
  kind: "Dish" | "AddOn";
  name: string;
  serviceStyle: string | null;
  pictureUrl: string | null;
};

type EventMenu = {
  id: string | null;
  status: string;
  version: number;
  lines: MenuLine[];
};

type CatalogItem = { id: string; name: string };

async function readJson<T>(response: Awaited<ReturnType<Page["request"]["get"]>>, label: string) {
  if (!response.ok()) {
    throw new Error(
      `${label} failed with ${response.status()}: ${await response.text()}`
    );
  }

  return (await response.json()) as T;
}

async function readMenuLibrary(page: Page) {
  return readJson<{
    items: Array<{ id: string; name: string; services: Array<{ serviceStyle: string }> }>;
    addOns: Array<{ id: string; name: string }>;
  }>(await page.request.get("/api/menu"), "GET /api/menu");
}

/**
 * The four catalog rows these tests select from, created once and reused by
 * every later run.
 */
async function provisionCatalog(page: Page) {
  const wanted = [
    { name: BUFFET_A, style: "Buffet", unit: "tray" },
    { name: BUFFET_B, style: "Buffet", unit: "tray" },
    { name: PLATED_A, style: "Plated", unit: "plate" }
  ] as const;

  let library = await readMenuLibrary(page);
  let created = false;

  for (const dish of wanted) {
    if (library.items.some((item) => item.name === dish.name)) continue;

    const response = await page.request.post("/api/menu", {
      data: {
        resource: "item",
        name: dish.name,
        usageType: "Both",
        kind: "Food",
        services: [
          {
            serviceStyle: dish.style,
            quantity: 1,
            unit: dish.unit,
            per: dish.style === "Buffet" ? 30 : 1,
            perBasis: "TotalGuests",
            rounding: dish.style === "Buffet" ? "Up" : "Exact",
            minimumUnits: null
          }
        ]
      }
    });

    if (!response.ok()) {
      throw new Error(
        `Could not provision ${dish.name}: ${response.status()} ${await response.text()}`
      );
    }

    created = true;
  }

  if (!library.addOns.some((addOn) => addOn.name === ADD_ON_A)) {
    const response = await page.request.post("/api/menu", {
      data: {
        resource: "addon",
        name: ADD_ON_A,
        price: 250,
        pricingType: "Flat",
        hallIds: []
      }
    });

    if (!response.ok()) {
      throw new Error(
        `Could not provision ${ADD_ON_A}: ${response.status()} ${await response.text()}`
      );
    }

    created = true;
  }

  if (created) library = await readMenuLibrary(page);

  const find = <T extends CatalogItem>(rows: T[], name: string) => {
    const row = rows.find((candidate) => candidate.name === name);
    if (!row) throw new Error(`${name} is missing from the catalog after provisioning.`);
    return row;
  };

  return {
    buffetA: find(library.items, BUFFET_A),
    buffetB: find(library.items, BUFFET_B),
    platedA: find(library.items, PLATED_A),
    addOnA: find(library.addOns, ADD_ON_A)
  };
}

/**
 * An event to hang a menu on. INQUIRY rather than a real booking: it writes no
 * hall reservation, so this consumes no date and cannot collide with a parallel
 * worker.
 */
async function createInquiryEvent(page: Page, clientName: string) {
  const { halls } = await readJson<{ halls: Array<{ id: string; name: string }> }>(
    await page.request.get("/api/events"),
    "GET /api/events"
  );

  let hallId = halls[0]?.id;

  if (!hallId) {
    const created = await page.request.post("/api/halls", {
      data: { name: HALL_NAME, capacity: 300 }
    });

    if (!created.ok() && created.status() !== 409) {
      throw new Error(
        `POST /api/halls failed with ${created.status()}: ${await created.text()}`
      );
    }

    const refreshed = await readJson<{ halls: Array<{ id: string }> }>(
      await page.request.get("/api/events"),
      "GET /api/events"
    );
    hallId = refreshed.halls[0]?.id;
  }

  if (!hallId) {
    throw new Error("The E2E organization has no hall and one could not be created.");
  }

  // Far out, and only ever INQUIRY, so no hall reservation is written and the
  // date this takes is not one a booking test could have wanted.
  const eventDate = new Date(Date.now() + 300 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  // No phone: the field is optional and `createBooking` stores "" for it. A
  // placeholder number would only give the phone validator something to reject.
  //
  // The idempotency key is required by the route, has to be a uuid, and is
  // fresh per call so one test's event is never a replay of another's.
  const response = await page.request.post("/api/events", {
    headers: { "idempotency-key": crypto.randomUUID() },
    data: { clientName, hallId, eventDate, menCount: 40, ladiesCount: 40 }
  });

  const { event } = await readJson<{ event: { id: string } }>(
    response,
    "POST /api/events"
  );

  return event.id;
}

/**
 * Best effort by design, like the booking suite's: a teardown that threw would
 * bury the real failure under its own.
 *
 * The menu is emptied before the event is cancelled so the run leaves no lines
 * pinning the shared catalog rows behind a RESTRICT.
 */
async function cleanUp(page: Page, eventId: string) {
  try {
    // Retried, because emptying the menu is version-guarded: a save the test
    // left in flight can bump the version between the read and the write, and
    // a single attempt would then 409 and leave the lines behind holding the
    // shared catalog rows behind their RESTRICT.
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
      await page.request.get("/api/events")
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

async function getMenu(page: Page, eventId: string) {
  const { menu } = await readJson<{ menu: EventMenu }>(
    await page.request.get(`/api/events/${eventId}/menu`),
    `GET /api/events/${eventId}/menu`
  );

  return menu;
}

/**
 * Opens the event manager on one event with the Menu tab showing.
 *
 * Scoped to the workspace's own tab strip: the sidebar has a "Menu" button too,
 * and an unscoped lookup picks that one and navigates to the menu library.
 */
function workspaceTab(page: Page, label: string) {
  return page
    .getByRole("navigation", { name: "Event workspace" })
    .getByRole("button", { name: label, exact: true });
}

async function openMenuTab(page: Page, eventId: string) {
  await page.goto(`/dashboard/events?eventId=${eventId}`);
  await workspaceTab(page, "Menu").click();
  await expect(
    page.getByRole("heading", { name: "Menu for this event" })
  ).toBeVisible({ timeout: 30_000 });
}

function drawer(page: Page) {
  return page.getByRole("dialog", { name: /Add to/ });
}

/** Every PUT this page makes to the menu, so a batch can be proved to be one. */
function recordMenuWrites(page: Page, eventId: string) {
  const writes: string[] = [];

  page.on("request", (request) => {
    if (
      request.method() === "PUT" &&
      new URL(request.url()).pathname === `/api/events/${eventId}/menu`
    ) {
      writes.push(request.url());
    }
  });

  return writes;
}

test.beforeEach(async () => {
  test.skip(
    !process.env.E2E_MUTATION_EMAIL || !process.env.E2E_MUTATION_PASSWORD,
    "Mutation E2E credentials are not set."
  );
});

test.describe("event menu", () => {
  test("serves an empty draft for an event that has never had one", async ({
    page
  }) => {
    const eventId = await createInquiryEvent(page, `E2E Menu Fetch ${Date.now()}`);

    try {
      const menu = await getMenu(page, eventId);

      // No row is created by a read, and version 0 is what the first save sends.
      expect(menu).toMatchObject({ id: null, status: "Draft", version: 0 });
      expect(menu.lines).toEqual([]);
    } finally {
      await cleanUp(page, eventId);
    }
  });

  test("bulk-adds dishes and an add-on in one save, and they survive a reload", async ({
    page
  }) => {
    test.setTimeout(120_000);

    const eventId = await createInquiryEvent(page, `E2E Menu Bulk ${Date.now()}`);

    try {
      await provisionCatalog(page);
      const writes = recordMenuWrites(page, eventId);
      await openMenuTab(page, eventId);

      await page.getByRole("button", { name: "Add buffet item" }).click();
      await expect(drawer(page)).toBeVisible();

      await drawer(page).getByRole("button", { name: BUFFET_A }).click();
      await drawer(page).getByRole("button", { name: BUFFET_B }).click();

      // A pick made on one tab has to survive switching to another, or a mixed
      // batch is impossible.
      await drawer(page).getByRole("button", { name: "Add-ons", exact: true }).click();
      await drawer(page).getByRole("button", { name: ADD_ON_A }).click();

      const addButton = drawer(page).getByRole("button", { name: "Add 3 items" });
      await expect(addButton).toBeEnabled();

      // Awaited, not merely counted. `page.on("request")` fires when a request
      // is sent, so asserting on that alone and reloading straight after
      // cancels the very save this test exists to prove landed.
      const saved = page.waitForResponse(
        (response) =>
          response.request().method() === "PUT" &&
          new URL(response.url()).pathname === `/api/events/${eventId}/menu`
      );
      await addButton.click();
      expect((await saved).status()).toBe(200);
      await expect(drawer(page)).toBeHidden();

      for (const name of [BUFFET_A, BUFFET_B, ADD_ON_A]) {
        await expect(
          page.getByRole("button", { name: `Remove ${name}` })
        ).toBeVisible({ timeout: 20_000 });
      }

      // One request for the batch. Three would each be a save against the
      // menu's version, so the second and third would come back as conflicts.
      await expect.poll(() => writes.length).toBe(1);

      // --- and again from a cold page --------------------------------------
      // The regression this whole feature exists for: before it, nothing was
      // written until Confirm, so a reload here came back empty.
      await page.reload();
      await workspaceTab(page, "Menu").click();

      for (const name of [BUFFET_A, BUFFET_B, ADD_ON_A]) {
        await expect(
          page.getByRole("button", { name: `Remove ${name}` })
        ).toBeVisible({ timeout: 30_000 });
      }

      const menu = await getMenu(page, eventId);
      expect(menu.lines).toHaveLength(3);
      // The tab a dish was picked under is the style it is served in.
      expect(
        menu.lines.map((line) => `${line.name}:${line.serviceStyle ?? "-"}`).sort()
      ).toEqual(
        [`${BUFFET_A}:Buffet`, `${BUFFET_B}:Buffet`, `${ADD_ON_A}:-`].sort()
      );

      // The mirrors the kitchen dashboard, the PDF and the client portal still
      // read while they have not moved to the line table.
      const { events } = await readJson<{
        events: Array<{ id: string; menuItemIds: string[]; addOnIds: string[] }>;
      }>(await page.request.get("/api/events"), "GET /api/events");
      const stored = events.find((candidate) => candidate.id === eventId);

      expect(stored?.menuItemIds).toHaveLength(2);
      expect(stored?.addOnIds).toEqual([
        (await provisionCatalog(page)).addOnA.id
      ]);
    } finally {
      await cleanUp(page, eventId);
    }
  });

  test("will not offer a dish that is already on the menu", async ({ page }) => {
    const eventId = await createInquiryEvent(page, `E2E Menu Dupe ${Date.now()}`);

    try {
      const catalog = await provisionCatalog(page);
      await page.request.put(`/api/events/${eventId}/menu`, {
        data: {
          meal: "Main",
          version: 0,
          lines: [{ menuItemId: catalog.buffetA.id, serviceStyle: "Buffet" }]
        }
      });

      await openMenuTab(page, eventId);
      await page.getByRole("button", { name: "Add buffet item" }).click();

      const already = drawer(page).getByRole("button", { name: BUFFET_A });
      await expect(already).toBeDisabled();
      await expect(drawer(page).getByText("Already on this menu")).toBeVisible();

      // Nothing picked, so there is nothing to commit.
      await expect(
        drawer(page).getByRole("button", { name: "Add selected" })
      ).toBeDisabled();
    } finally {
      await cleanUp(page, eventId);
    }
  });

  test("removes one line from its card and the removal sticks", async ({
    page
  }) => {
    const eventId = await createInquiryEvent(page, `E2E Menu Remove ${Date.now()}`);

    try {
      const catalog = await provisionCatalog(page);
      await page.request.put(`/api/events/${eventId}/menu`, {
        data: {
          meal: "Main",
          version: 0,
          lines: [
            { menuItemId: catalog.buffetA.id, serviceStyle: "Buffet" },
            { menuItemId: catalog.buffetB.id, serviceStyle: "Buffet" }
          ]
        }
      });

      await openMenuTab(page, eventId);
      await page.getByRole("button", { name: `Remove ${BUFFET_A}` }).click();

      await expect(
        page.getByRole("button", { name: `Remove ${BUFFET_A}` })
      ).toBeHidden({ timeout: 20_000 });
      // The other one is untouched - a remove is not a clear.
      await expect(
        page.getByRole("button", { name: `Remove ${BUFFET_B}` })
      ).toBeVisible();

      await expect
        .poll(async () => (await getMenu(page, eventId)).lines.map((l) => l.name))
        .toEqual([BUFFET_B]);
    } finally {
      await cleanUp(page, eventId);
    }
  });

  test("locks the menu on confirm and reopens it", async ({ page }) => {
    test.setTimeout(120_000);

    const eventId = await createInquiryEvent(page, `E2E Menu Confirm ${Date.now()}`);

    try {
      const catalog = await provisionCatalog(page);
      await page.request.put(`/api/events/${eventId}/menu`, {
        data: {
          meal: "Main",
          version: 0,
          lines: [{ menuItemId: catalog.platedA.id, serviceStyle: "Plated" }]
        }
      });

      await openMenuTab(page, eventId);
      await page.getByRole("button", { name: "Review & confirm" }).click();

      const dialog = page.getByRole("dialog", { name: "Confirm event menu?" });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: /Confirm & lock menu/ }).click();

      // The Reopen button rather than the "Confirmed" badge: the event filter
      // beside it has a "Confirmed" <option>, so the bare text is ambiguous.
      await expect(page.getByRole("button", { name: "Reopen menu" })).toBeVisible(
        { timeout: 20_000 }
      );
      // Locked means locked: no add card and no remove control.
      await expect(
        page.getByRole("button", { name: "Add buffet item" })
      ).toBeDisabled();
      await expect(
        page.getByRole("button", { name: `Remove ${PLATED_A}` })
      ).toBeHidden();

      const confirmed = await getMenu(page, eventId);
      expect(confirmed.status).toBe("Confirmed");
      // The name is frozen at confirmation, so it no longer follows the library.
      expect(confirmed.lines[0].name).toBe(PLATED_A);

      // A write to a confirmed menu is refused even though the caller has every
      // permission and a current version.
      const blocked = await page.request.put(`/api/events/${eventId}/menu`, {
        data: { meal: "Main", version: confirmed.version, lines: [] }
      });
      expect(blocked.status()).toBe(409);
      expect(await blocked.text()).toContain("Reopen");
      // Refused, not partially applied.
      expect((await getMenu(page, eventId)).lines).toHaveLength(1);

      await page.getByRole("button", { name: "Reopen menu" }).click();
      await expect(
        page.getByRole("button", { name: "Review & confirm" })
      ).toBeVisible({ timeout: 20_000 });
      expect((await getMenu(page, eventId)).status).toBe("Draft");
    } finally {
      await cleanUp(page, eventId);
    }
  });

  test("refuses to open the confirm dialog on an empty menu", async ({
    page
  }) => {
    const eventId = await createInquiryEvent(page, `E2E Menu Empty ${Date.now()}`);

    try {
      await openMenuTab(page, eventId);
      await page.getByRole("button", { name: "Review & confirm" }).click();

      await expect(page.getByRole("status")).toContainText(
        "Add at least one menu item before confirming."
      );
      await expect(
        page.getByRole("dialog", { name: "Confirm event menu?" })
      ).toBeHidden();

      // The server refuses it too, so the button is a courtesy and not the guard.
      const response = await page.request.post(`/api/events/${eventId}/menu`, {
        data: { action: "confirm", meal: "Main", version: 0 }
      });
      expect(response.status()).toBe(400);
    } finally {
      await cleanUp(page, eventId);
    }
  });

  test.describe("refusals", () => {
    test("404s for an event that does not exist", async ({ page }) => {
      const response = await page.request.get(`/api/events/${FOREIGN_ID}/menu`);

      expect(response.status()).toBe(404);
    });

    test("409s on a stale version and writes nothing", async ({ page }) => {
      const eventId = await createInquiryEvent(page, `E2E Menu Stale ${Date.now()}`);

      try {
        const catalog = await provisionCatalog(page);
        await page.request.put(`/api/events/${eventId}/menu`, {
          data: {
            meal: "Main",
            version: 0,
            lines: [{ menuItemId: catalog.buffetA.id, serviceStyle: "Buffet" }]
          }
        });

        const current = await getMenu(page, eventId);

        // What a second tab, opened before that save, would send.
        const stale = await page.request.put(`/api/events/${eventId}/menu`, {
          data: {
            meal: "Main",
            version: current.version - 1,
            lines: [{ menuItemId: catalog.buffetB.id, serviceStyle: "Buffet" }]
          }
        });

        expect(stale.status()).toBe(409);
        // Last-write-wins is exactly what the version guard exists to prevent.
        const after = await getMenu(page, eventId);
        expect(after.lines.map((line) => line.name)).toEqual([BUFFET_A]);
        expect(after.version).toBe(current.version);
      } finally {
        await cleanUp(page, eventId);
      }
    });

    test("400s for a dish that belongs to no organization", async ({ page }) => {
      const eventId = await createInquiryEvent(page, `E2E Menu Foreign ${Date.now()}`);

      try {
        const response = await page.request.put(`/api/events/${eventId}/menu`, {
          data: {
            meal: "Main",
            version: 0,
            lines: [{ menuItemId: FOREIGN_ID, serviceStyle: "Buffet" }]
          }
        });

        expect(response.status()).toBe(400);
        // Rejected before anything was written, so no header was created either.
        expect(await getMenu(page, eventId)).toMatchObject({ id: null });
      } finally {
        await cleanUp(page, eventId);
      }
    });

    test("400s for an add-on that belongs to no organization", async ({
      page
    }) => {
      const eventId = await createInquiryEvent(page, `E2E Menu ForeignAddOn ${Date.now()}`);

      try {
        const response = await page.request.put(`/api/events/${eventId}/menu`, {
          data: {
            meal: "Main",
            version: 0,
            lines: [{ addOnId: FOREIGN_ID }]
          }
        });

        expect(response.status()).toBe(400);
      } finally {
        await cleanUp(page, eventId);
      }
    });

    test("400s for a line that is both a dish and an add-on, or neither", async ({
      page
    }) => {
      const eventId = await createInquiryEvent(page, `E2E Menu Malformed ${Date.now()}`);

      try {
        const catalog = await provisionCatalog(page);

        const both = await page.request.put(`/api/events/${eventId}/menu`, {
          data: {
            meal: "Main",
            version: 0,
            lines: [
              { menuItemId: catalog.buffetA.id, addOnId: catalog.addOnA.id }
            ]
          }
        });
        expect(both.status()).toBe(400);

        const neither = await page.request.put(`/api/events/${eventId}/menu`, {
          data: { meal: "Main", version: 0, lines: [{ serviceStyle: "Buffet" }] }
        });
        expect(neither.status()).toBe(400);

        // A style on an add-on is the third way a line can be self-contradictory.
        const styledAddOn = await page.request.put(`/api/events/${eventId}/menu`, {
          data: {
            meal: "Main",
            version: 0,
            lines: [{ addOnId: catalog.addOnA.id, serviceStyle: "Buffet" }]
          }
        });
        expect(styledAddOn.status()).toBe(400);

        expect(await getMenu(page, eventId)).toMatchObject({ id: null });
      } finally {
        await cleanUp(page, eventId);
      }
    });

    test("refuses to delete a library item an event is still serving", async ({
      page
    }) => {
      const eventId = await createInquiryEvent(page, `E2E Menu Guard ${Date.now()}`);

      try {
        const catalog = await provisionCatalog(page);
        await page.request.put(`/api/events/${eventId}/menu`, {
          data: {
            meal: "Main",
            version: 0,
            lines: [{ menuItemId: catalog.buffetA.id, serviceStyle: "Buffet" }]
          }
        });

        const response = await page.request.delete(
          `/api/menu/items/${catalog.buffetA.id}`
        );

        // 409 rather than a foreign-key error the caller could not read - and
        // rather than a delete that would leave the menu pointing at nothing.
        expect(response.status()).toBe(409);
        expect(await response.text()).toContain("still used");

        // Still there, and still on the menu.
        const library = await readMenuLibrary(page);
        expect(library.items.some((item) => item.id === catalog.buffetA.id)).toBe(
          true
        );
      } finally {
        await cleanUp(page, eventId);
      }
    });
  });
});
