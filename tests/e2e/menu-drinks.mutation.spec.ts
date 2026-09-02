import {
  expect,
  test,
  type Locator,
  type Page,
  type Response
} from "@playwright/test";

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
    containsAlcohol: boolean | null;
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
 * Seeds an item straight through the API.
 *
 * Used by the tests below, where the starting item is a fixture rather than the
 * subject - building it through the form would make a create failure look like
 * an editor failure.
 */
async function createItem(
  page: Page,
  fields: Record<string, unknown> & { name: string }
) {
  const response = await page.request.post("/api/menu", {
    data: { resource: "item", ...fields }
  });

  if (response.status() !== 201) {
    throw new Error(
      `POST /api/menu failed with ${response.status()}: ${await response.text()}`
    );
  }

  const payload = (await response.json()) as { item: { id: string } };
  return payload.item.id;
}

function createFoodItem(page: Page, name: string) {
  return createItem(page, {
    name,
    category: "Main",
    // The business segment, not a service style.
    usageType: "Both",
    kind: "Food",
    kosherType: "Parve"
  });
}

/**
 * A drink that is already served, which is what the editor test needs: the rule
 * has to exist before anything can prove the form opens on it rather than on the
 * defaults.
 *
 * `Plated` is the stored value behind the word "Table" - see service-style.ts -
 * so this is two bottles per table, written the way the column holds it.
 */
function createDrinkItem(page: Page, name: string) {
  return createItem(page, {
    name,
    // Not asked by the drink form, which files every drink under this one -
    // seeded here so the fixture matches what the form would have written.
    category: "Drink",
    usageType: "Both",
    kind: "Drink",
    containsAlcohol: false,
    services: [
      {
        serviceStyle: "Plated",
        quantity: 2,
        unit: "bottle",
        per: 1,
        perBasis: "Tables",
        rounding: "Up",
        minimumUnits: null
      }
    ]
  });
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

function itemResponse(method: string) {
  return (response: Response) =>
    response.url().includes("/api/menu/items/") &&
    response.request().method() === method;
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

    // The tab settles the kind rather than seeding it, and nothing in the form
    // reopens it: the kind decides which questions get asked, so it cannot also
    // be one of them.
    await expect(dialog.getByLabel("Food or drink")).toBeHidden();
    // Which questions, exactly. A course and a kashrut type are food
    // vocabulary - a bottle of wine is not an appetizer - so the drink form asks
    // the one thing anyone scans a drinks list for instead.
    await expect(dialog.getByLabel("Category")).toBeHidden();
    await expect(dialog.getByLabel("Kashrut type")).toBeHidden();
    const alcoholSwitch = dialog.getByRole("switch", {
      name: "Contains alcohol"
    });
    await expect(alcoholSwitch).not.toBeChecked();
    // "Table", not "Plated": a drink is put on the table, not plated. Only the
    // word changes - `Plated` is still what gets stored.
    await expect(
      dialog.getByRole("checkbox", { name: "Table", exact: true })
    ).toBeVisible();

    await dialog.getByLabel("Item name").fill(name);
    await alcoholSwitch.click();
    await expect(alcoholSwitch).toBeChecked();
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
    // The switch has somewhere to show for itself. Drinks all file under one
    // category now that the form stopped asking for one, so the pill carries
    // the answer an operator actually scans for.
    await expect(card.getByText("Alcohol", { exact: true })).toBeVisible();
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
    expect(saved?.containsAlcohol).toBe(true);
    expect(saved?.pictureUrl).toEqual(expect.stringContaining("token="));
    expect(saved).not.toHaveProperty("picturePath");
    expect(saved).not.toHaveProperty("pictureBucket");
  } finally {
    // Resolved again rather than trusting the id above: a failure before that
    // assignment would otherwise leave the row and its object behind.
    await deleteItem(page, itemId ?? (await findItem(page, name))?.id);
  }
});

/**
 * The editor used to carry a "Food or drink" select, which was how a mis-filed
 * item crossed between the two tabs. It is gone, and this is the assertion that
 * replaced the one covering that crossing.
 *
 * The kind decides which questions the form asks - a dish is asked for a course
 * and a kashrut type, a drink for whether it contains alcohol - so offering to
 * change it mid-edit offered to swap the questions under someone halfway
 * through answering them, and to carry a dish's answers onto a drink that was
 * never asked them. A mis-filed item is remade on the tab it belongs to.
 */
test("does not offer to turn a dish into a drink", async ({ page }) => {
  const name = `E2E Fixed Kind ${Date.now()}`;
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

    await expect(editDialog.getByLabel("Food or drink")).toBeHidden();
    // The other half of the same rule: a dish keeps the two questions the drink
    // form gave up, and is never asked the one it took in exchange.
    await expect(editDialog.getByLabel("Category")).toBeVisible();
    await expect(editDialog.getByLabel("Kashrut type")).toBeVisible();
    await expect(
      editDialog.getByRole("switch", { name: "Contains alcohol" })
    ).toBeHidden();
  } finally {
    await deleteItem(page, itemId);
  }
});

/**
 * The other two thirds of a drink's lifecycle. The suite above creates one and
 * cleans it up through the API; this drives the update and the removal through
 * the card and the editor, which is the only path an operator has.
 *
 * The fixture is seeded with a rule on purpose: what breaks silently in an
 * editor is the seeding, and a form that opened on the defaults would rewrite a
 * rule nobody touched while every visible thing about the save looked right.
 */
test("renames a drink, corrects its rule, and removes it from the tab", async ({
  page
}) => {
  const stamp = Date.now();
  const name = `E2E Drink A${stamp}`;
  // Deliberately not built by suffixing the first: `hasText` matches
  // substrings, so "E2E Drink A123 updated" would still satisfy a lookup for the
  // old name and the rename assertion would pass without a rename happening.
  const renamedName = `E2E Drink B${stamp}`;
  const itemId = await createDrinkItem(page, name);

  try {
    // The grid rendered before the fixture existed and its query cache lives as
    // long as the page does.
    await page.reload();
    await openDrinkTab(page);

    const card = itemCard(page, name);
    await expect(card).toBeVisible({ timeout: 20_000 });
    // Loose on the trailing plural, as above: `formatServiceRule` writes
    // "1 tables" today and pinning that would make a wording fix look like a
    // regression.
    await expect(card.getByText(/2 bottle per 1 table/)).toBeVisible();
    // Nothing to declare yet - the pill carries the category until there is.
    await expect(card.getByText("Alcohol", { exact: true })).toBeHidden();

    // --- update -------------------------------------------------------------
    await card.getByRole("button", { name: `Edit ${name}` }).click();

    const editDialog = page.getByRole("dialog", { name: "Edit drink item" });
    await expect(editDialog).toBeVisible();
    await expect(editDialog.getByLabel("Item name")).toHaveValue(name);

    const alcoholSwitch = editDialog.getByRole("switch", {
      name: "Contains alcohol"
    });
    await expect(alcoholSwitch).not.toBeChecked();
    // "Table", not "Plated", on an edit as well as on a create: the vocabulary
    // follows the item's kind, and this dialog reads that off the row rather
    // than off the tab the card was clicked on.
    await expect(
      editDialog.getByRole("checkbox", { name: "Table", exact: true })
    ).toBeChecked();
    await expect(
      editDialog.getByRole("checkbox", { name: "Buffet", exact: true })
    ).not.toBeChecked();

    // The rule the fixture was saved with, not the defaults a create opens on -
    // which is the assertion this whole test is built around.
    //
    // Folded, and safe to assume so only because of the reload above: the fold
    // is `useState` on a dialog that is never unmounted, so it carries whatever
    // the last dialog on this page had open. Nothing has opened one since.
    await editDialog
      .getByRole("button", { name: "Add a counting rule (optional)" })
      .click();
    await expect(editDialog.getByLabel("Table quantity")).toHaveValue("2");
    await expect(editDialog.getByLabel("Table unit")).toHaveValue("bottle");
    await expect(editDialog.getByLabel("Table per basis")).toHaveValue("Tables");

    await editDialog.getByLabel("Item name").fill(renamedName);
    await editDialog.getByLabel("Table quantity").fill("3");
    await alcoholSwitch.click();
    await expect(alcoholSwitch).toBeChecked();

    const updated = page.waitForResponse(itemResponse("PATCH"));
    await editDialog.getByRole("button", { name: "Save changes" }).click();
    expect((await updated).status()).toBe(200);
    await expect(editDialog).toBeHidden({ timeout: 20_000 });

    // All three changes have somewhere to show for themselves on the card, and
    // the card is still on this tab: an edit that filed the drink away from the
    // one screen it is managed on reads as a delete.
    const renamedCard = itemCard(page, renamedName);
    await expect(renamedCard).toBeVisible({ timeout: 20_000 });
    await expect(renamedCard.getByText(/3 bottle per 1 table/)).toBeVisible();
    await expect(
      renamedCard.getByText("Alcohol", { exact: true })
    ).toBeVisible();
    await expect(itemCard(page, name)).toBeHidden();

    // --- remove -------------------------------------------------------------
    await renamedCard
      .getByRole("button", { name: `Edit ${renamedName}` })
      .click();

    const removalEditor = page.getByRole("dialog", { name: "Edit drink item" });
    await expect(removalEditor).toBeVisible();
    await removalEditor.getByRole("button", { name: "Remove item" }).click();

    // The same confirmation the library grid puts in front of a delete: a drink
    // is a menu item, so it goes out the way every other one does.
    const confirmDialog = page.getByRole("alertdialog", {
      name: "Remove menu item"
    });
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog.getByText(renamedName)).toBeVisible();

    const removed = page.waitForResponse(itemResponse("DELETE"));
    await confirmDialog
      .getByRole("button", { name: "Remove from library" })
      .click();
    expect((await removed).status()).toBe(200);

    await expect(confirmDialog).toBeHidden({ timeout: 20_000 });
    // The editor the removal was started from goes with it: leaving it up would
    // be a form pointing at a row that no longer exists.
    await expect(removalEditor).toBeHidden({ timeout: 20_000 });
    await expect(itemCard(page, renamedName)).toBeHidden({ timeout: 20_000 });
    // And the row is actually gone, not merely filtered off the tab by the
    // change that was saved a moment earlier.
    expect(await findItem(page, renamedName)).toBeUndefined();
  } finally {
    await deleteItem(page, itemId);
  }
});
