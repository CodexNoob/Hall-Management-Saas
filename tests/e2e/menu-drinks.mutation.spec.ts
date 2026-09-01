import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Covers the Drink Menu tab, which is a view over `menu_items` filtered on
 * `kind` rather than a table of its own - so what has to be proved here is not
 * that drinks can be stored, but that they land on exactly one tab and that the
 * picture field the library dialog already ships with works for them too.
 *
 * The upload in the first test is real, not stubbed, for the reason the add-on
 * suite gives: the browser writes to Supabase Storage itself, under the tenant
 * prefix the storage policy checks, and that is the one hop no unit test can
 * reach. It needs the `menu-images` bucket to exist in the Supabase project;
 * nothing in this repo provisions it (see lib/storage/buckets.ts).
 *
 * Unlike an add-on, a drink is a menu item and therefore has a DELETE, so both
 * tests clean up after themselves instead of leaving a row per run behind.
 */

/**
 * A real 1x1 PNG rather than a committed fixture: it is 70 bytes, and the bytes
 * have to decode because the assertion is that the browser rendered the image,
 * not merely that an `src` was set.
 */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

type MenuPayload = {
  items: Array<{
    id: string;
    name: string;
    kind: string;
    pictureUrl: string | null;
  }>;
};

// page.request rather than the standalone `request` fixture, matching the other
// mutation specs: it shares the browser context's cookie jar, which is where the
// session lives.
async function readMenu(page: Page) {
  const response = await page.request.get("/api/menu");

  if (!response.ok()) {
    throw new Error(
      `GET /api/menu failed with ${response.status()}: ${await response.text()}`
    );
  }

  return (await response.json()) as MenuPayload;
}

async function findItem(page: Page, name: string) {
  return (await readMenu(page)).items.find((item) => item.name === name);
}

/**
 * Seeds a food item straight through the API.
 *
 * Used by the kind-switch test, where the starting item is a fixture rather than
 * the subject - building it through the form would make a create failure look
 * like an update failure.
 */
async function createFoodItem(page: Page, name: string) {
  const response = await page.request.post("/api/menu", {
    data: {
      resource: "item",
      name,
      category: "Main",
      // The business segment, not a service style.
      usageType: "Both",
      kind: "Food",
      kosherType: "Parve"
    }
  });

  if (response.status() !== 201) {
    throw new Error(
      `POST /api/menu failed with ${response.status()}: ${await response.text()}`
    );
  }

  const payload = (await response.json()) as { item: { id: string } };
  return payload.item.id;
}

async function deleteItem(page: Page, itemId: string | undefined) {
  if (itemId) await page.request.delete(`/api/menu/items/${itemId}`);
}

function itemCard(page: Page, name: string) {
  return page.getByRole("article").filter({ hasText: name });
}

/** Exact, or "Drink Menu" also matches the "New drink" button beneath it. */
async function openTab(page: Page, label: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
}

async function openDrinkTab(page: Page) {
  await openTab(page, "Drink Menu");
  await expect(page.getByRole("button", { name: "New drink" })).toBeVisible({
    timeout: 20_000
  });
}

async function expectDecodedThumbnail(thumbnail: Locator, message: string) {
  await expect(thumbnail).toHaveAttribute("src", /token=/, { timeout: 20_000 });
  // Decoded, not merely pointed at: a src the browser cannot fetch - an expired
  // signature, a path outside the tenant prefix - leaves naturalWidth at 0 and
  // the card showing nothing.
  await expect
    .poll(
      () => thumbnail.evaluate((image: HTMLImageElement) => image.naturalWidth),
      { message, timeout: 20_000 }
    )
    .toBeGreaterThan(0);
}

test.beforeEach(async ({ page }) => {
  test.skip(
    !process.env.E2E_MUTATION_EMAIL || !process.env.E2E_MUTATION_PASSWORD,
    "Mutation E2E credentials are not set."
  );

  await page.goto("/dashboard/menu");
  // Tab-independent, unlike "New item" - this suite starts by leaving the
  // library tab, so the gate cannot be a control that only exists on it.
  await expect(
    page.getByRole("button", { name: "Bulk upload menu items" }),
    "the mutation account needs canEditMenu to manage the menu"
  ).toBeVisible({ timeout: 30_000 });
});

test("creates a drink with a picture and keeps it off the food tabs", async ({
  page
}) => {
  const name = `E2E Drink ${Date.now()}`;
  let itemId: string | undefined;

  try {
    await openDrinkTab(page);
    await page.getByRole("button", { name: "New drink" }).click();

    const dialog = page.getByRole("dialog", { name: "Drink item", exact: true });
    await expect(dialog).toBeVisible();

    // The tab seeds the kind, which is what makes the rest of the form a drink's
    // form rather than a dish's.
    await expect(dialog.getByLabel("Food or drink")).toHaveValue("Drink");
    // "Table", not "Plated": a drink is put on the table, not plated. Only the
    // word changes - `Plated` is still what gets stored.
    await expect(
      dialog.getByRole("checkbox", { name: "Table", exact: true })
    ).toBeVisible();

    await dialog.getByLabel("Item name").fill(name);
    await dialog.getByRole("checkbox", { name: "Table", exact: true }).check();
    await dialog
      .getByRole("button", { name: "Add a counting rule (optional)" })
      .click();

    // The drink defaults, which existed in service-style.ts but were unreachable
    // from the UI before this tab: two bottles per table, not one plate per head.
    await expect(dialog.getByLabel("Table quantity")).toHaveValue("2");
    await expect(dialog.getByLabel("Table unit")).toHaveValue("bottle");
    await expect(dialog.getByLabel("Table per basis")).toHaveValue("Tables");

    await dialog.getByLabel("Picture").setInputFiles({
      name: "drink.png",
      mimeType: "image/png",
      buffer: PNG_1X1
    });

    const created = page.waitForResponse(
      (response) =>
        response.url().includes("/api/menu") &&
        response.request().method() === "POST"
    );
    await dialog.getByRole("button", { name: "Save item" }).click();
    // Anything but 201 means the upload resolved to a path the server refused,
    // which the dialog would report instead of closing.
    expect((await created).status()).toBe(201);
    await expect(dialog).toBeHidden({ timeout: 20_000 });

    const card = itemCard(page, name);
    await expect(card).toBeVisible({ timeout: 20_000 });
    // alt="" makes the thumbnail decorative, so it has no img role to look up.
    await expectDecodedThumbnail(
      card.locator("img"),
      "the signed URL has to be fetchable, not just present"
    );

    // The tick has somewhere to show for itself. Ticking Table used to change
    // nothing visible on this tab, which is what made the choice feel like it
    // went nowhere. Now the numbers are on the card...
    //
    // Loose on the trailing plural: `formatServiceRule` writes "1 tables"
    // today, and pinning that would make a wording fix look like a regression.
    await expect(card.getByText(/2 bottle per 1 table/)).toBeVisible();

    // ...and the sub-tabs are the answer to "where did it go": under Table,
    // and provably not under Buffet. `role="tab"` separates these pills from
    // the "Buffet Menu" button in the strip above them.
    await page.getByRole("tab", { name: /^Table/ }).click();
    await expect(itemCard(page, name)).toBeVisible();

    await page.getByRole("tab", { name: /^Buffet/ }).click();
    await expect(itemCard(page, name)).toBeHidden();

    // --- and again from a cold page ----------------------------------------
    // The thumbnail above could have come from state the save left behind. This
    // proves the path reached the column and is signed fresh on every read.
    await page.reload();
    await openDrinkTab(page);
    await expectDecodedThumbnail(
      itemCard(page, name).locator("img"),
      "the freshly signed URL has to be fetchable too"
    );

    // --- one tab, not three -------------------------------------------------
    // The drink carries a Table rule, which is stored as `Plated` - so before
    // the Drink Menu tab existed this same row appeared under Plated Menu and in
    // the library. Both are the regression this asserts against.
    await openTab(page, "Menu Library");
    await expect(itemCard(page, name)).toBeHidden({ timeout: 20_000 });

    await openTab(page, "Plated Menu");
    await expect(itemCard(page, name)).toBeHidden({ timeout: 20_000 });

    await openTab(page, "Buffet Menu");
    await expect(itemCard(page, name)).toBeHidden({ timeout: 20_000 });

    // The response itself, not just what the card made of it: the raw path is
    // the one thing that must never leave the server.
    const saved = await findItem(page, name);
    itemId = saved?.id;
    expect(saved?.kind).toBe("Drink");
    expect(saved?.pictureUrl).toEqual(expect.stringContaining("token="));
    expect(saved).not.toHaveProperty("picturePath");
    expect(saved).not.toHaveProperty("pictureBucket");
  } finally {
    // Resolved again rather than trusting the id above: a failure before that
    // assignment would otherwise leave the row and its object behind.
    await deleteItem(page, itemId ?? (await findItem(page, name))?.id);
  }
});

test("moves an item between the library and the drink tab when its kind changes", async ({
  page
}) => {
  const name = `E2E Kind Switch ${Date.now()}`;
  const itemId = await createFoodItem(page, name);

  try {
    // The grid rendered before the fixture existed and its query cache lives as
    // long as the page does.
    await page.reload();

    const card = itemCard(page, name);
    await expect(card).toBeVisible({ timeout: 20_000 });

    await card.getByRole("button", { name: `Edit ${name}` }).click();
    const editDialog = page.getByRole("dialog", { name: "Edit library item" });
    await expect(editDialog).toBeVisible();

    await editDialog
      .getByLabel("Food or drink")
      .selectOption({ label: "Drink" });
    // The heading follows the select, so the form renames itself before it is
    // saved rather than after - which means the locator has to be taken again.
    // `editDialog` is bound by the old accessible name and stops matching here.
    const drinkDialog = page.getByRole("dialog", { name: "Edit drink item" });
    await expect(drinkDialog).toBeVisible();

    const updated = page.waitForResponse(
      (response) =>
        response.url().includes("/api/menu/items/") &&
        response.request().method() === "PATCH"
    );
    await drinkDialog.getByRole("button", { name: "Save changes" }).click();
    expect((await updated).status()).toBe(200);
    await expect(drinkDialog).toBeHidden({ timeout: 20_000 });

    // Gone from the library it was created in...
    await expect(itemCard(page, name)).toBeHidden({ timeout: 20_000 });
    // ...and on the drink tab instead, which is the whole point of the split.
    await openDrinkTab(page);
    await expect(itemCard(page, name)).toBeVisible({ timeout: 20_000 });
  } finally {
    await deleteItem(page, itemId);
  }
});
