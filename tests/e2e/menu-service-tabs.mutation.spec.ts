import { expect, test, type Locator, type Page, type Response } from "@playwright/test";

/**
 * Covers the Buffet Menu and Plated Menu tabs, which are views over `menu_items`
 * filtered on the service rules a dish carries rather than lists of their own.
 * So what has to be proved here is not that a dish can be stored, but that the
 * tab it was created from is the tab it lands on, that its rule travels with it,
 * and that changing the rule moves it between the two.
 *
 * The create is driven from each tab's own "Add buffet item" / "Add plated item"
 * button, which opens the library dialog already scoped to that style - the tab
 * has answered the Buffet/Plated question, so the form does not ask it again.
 *
 * The update and the removal are driven from the Menu Library, deliberately.
 * The service tabs now open the same editor from their own cards, but the
 * library grid is the screen every item is reachable from whatever it is served
 * as - so driving the write from there proves the path an operator has for any
 * item, not only for one that happens to be on the tab in front of them. A test
 * that edited through the API instead would pass on the day that path
 * disappeared.
 */

type MenuPayload = {
  items: Array<{ id: string; name: string }>;
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
 * Drops the item however the test ended.
 *
 * Resolved by name rather than by an id captured on the way in: these tests
 * create through the form, so a failure before the save came back leaves a row
 * with no id in hand, and a failure after a successful UI removal leaves nothing
 * to drop at all.
 */
async function deleteItemByName(page: Page, name: string) {
  const item = await findItem(page, name);

  if (item) await page.request.delete(`/api/menu/items/${item.id}`);
}

function itemCard(page: Page, name: string) {
  return page.getByRole("article").filter({ hasText: name });
}

/** Exact, or "Buffet Menu" also matches the "Buffet Menu" text in the Add-ons blurb. */
async function openTab(page: Page, label: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
}

/**
 * Opens a service tab and waits for the control that only it has, so a later
 * click cannot land on the tab this one was opened from.
 */
async function openServiceTab(page: Page, style: "buffet" | "plated") {
  await openTab(page, style === "buffet" ? "Buffet Menu" : "Plated Menu");
  await expect(
    page.getByRole("button", { name: `Add ${style} item` })
  ).toBeVisible({ timeout: 20_000 });
}

async function openLibraryTab(page: Page) {
  await openTab(page, "Menu Library");
  await expect(
    page.getByRole("button", { name: "New item", exact: true })
  ).toBeVisible({ timeout: 20_000 });
}

/**
 * Shows one style's counting rule, folded or not.
 *
 * The fold outlives the dialog: `openRuleStyles` is `useState` on a component
 * that is never unmounted - the dialog returns null while closed rather than
 * being removed - so whether a rule opens shown depends on what the last dialog
 * on this page had unfolded, not on the item being opened. Clicking the link
 * unconditionally is what hung this suite the first time: after a create had
 * unfolded it, the edit reopened with no link to click.
 *
 * Only ever called where one style is enabled, so the link is unambiguous. Two
 * folded styles would put two of them in the dialog.
 */
async function showRuleFields(dialog: Locator, label: string) {
  const quantity = dialog.getByLabel(`${label} quantity`);

  if (await quantity.isVisible()) return;

  await dialog
    .getByRole("button", { name: "Add a counting rule (optional)" })
    .click();
  await expect(quantity).toBeVisible();
}

/** Opens the editor the way the library grid does it: the card itself is the button. */
async function openItemEditor(page: Page, card: Locator, name: string) {
  await card.getByRole("button", { name: `Edit ${name}` }).click();

  const editDialog = page.getByRole("dialog", { name: "Edit library item" });
  await expect(editDialog).toBeVisible();

  return editDialog;
}

/**
 * Removes an item through the library editor and its confirmation.
 *
 * The whole path rather than a DELETE: the confirmation is the step that sends
 * it, and the editor it was started from has to go with it.
 */
async function removeItemFromLibrary(page: Page, name: string) {
  await openLibraryTab(page);

  const card = itemCard(page, name);
  await expect(card).toBeVisible({ timeout: 20_000 });

  const editDialog = await openItemEditor(page, card, name);
  await editDialog.getByRole("button", { name: "Remove item" }).click();

  const confirmDialog = page.getByRole("alertdialog", {
    name: "Remove menu item"
  });
  await expect(confirmDialog).toBeVisible();
  await expect(confirmDialog.getByText(name)).toBeVisible();

  const removed = page.waitForResponse(itemResponse("DELETE"));
  await confirmDialog
    .getByRole("button", { name: "Remove from library" })
    .click();
  expect((await removed).status()).toBe(200);

  await expect(confirmDialog).toBeHidden({ timeout: 20_000 });
  await expect(editDialog).toBeHidden({ timeout: 20_000 });
  await expect(itemCard(page, name)).toBeHidden({ timeout: 20_000 });
}

function itemResponse(method: string) {
  return (response: Response) =>
    response.url().includes("/api/menu/items/") &&
    response.request().method() === method;
}

function createResponse(response: Response) {
  return (
    response.url().includes("/api/menu") &&
    response.request().method() === "POST"
  );
}

test.beforeEach(async ({ page }) => {
  test.skip(
    !process.env.E2E_MUTATION_EMAIL || !process.env.E2E_MUTATION_PASSWORD,
    "Mutation E2E credentials are not set."
  );

  await page.goto("/dashboard/menu");
  // Tab-independent, unlike "New item" - both tests start by leaving the library
  // tab, so the gate cannot be a control that only exists on it.
  await expect(
    page.getByRole("button", { name: "Bulk upload menu items" }),
    "the mutation account needs canEditMenu to manage the menu"
  ).toBeVisible({ timeout: 30_000 });
});

test("adds a buffet dish from its tab, moves it to plated, and removes it", async ({
  page
}) => {
  // Three writes and six tab switches, each with a round trip behind it. The
  // default 60s is enough on a warm server and not on a cold one, and a timeout
  // here would read as a defect rather than as a slow first request.
  test.setTimeout(90_000);

  const stamp = Date.now();
  const name = `E2E Buffet Dish ${stamp}`;

  try {
    await openServiceTab(page, "buffet");
    await page.getByRole("button", { name: "Add buffet item" }).click();

    // "Buffet item", not "Library item": the tab said which menu this is for, so
    // the form opens as a buffet form rather than asking the question again.
    const dialog = page.getByRole("dialog", { name: "Buffet item", exact: true });
    await expect(dialog).toBeVisible();

    // And having said it, does not offer to unsay it. The style checkboxes the
    // library's own create shows are absent here - answering Plated on this tab
    // would file the dish somewhere the operator cannot see from where they are
    // standing.
    await expect(
      dialog.getByRole("checkbox", { name: "Buffet", exact: true })
    ).toBeHidden();
    await expect(
      dialog.getByRole("checkbox", { name: "Plated", exact: true })
    ).toBeHidden();
    // What is left in its place: one rule, for the one style this form is about.
    await expect(
      dialog.getByRole("group", { name: "Buffet rule" })
    ).toBeVisible();

    await dialog.getByLabel("Item name").fill(name);

    // The rule is folded away until someone comes to answer it - cataloguing a
    // dish and working out how much of it to cook are two different jobs.
    await showRuleFields(dialog, "Buffet");

    // The buffet defaults, which are what makes this form worth opening from
    // this tab: a tray per thirty guests, not the plate per head a plated dish
    // starts on.
    await expect(dialog.getByLabel("Buffet quantity")).toHaveValue("1");
    await expect(dialog.getByLabel("Buffet unit")).toHaveValue("tray");
    await expect(dialog.getByLabel("Buffet per quantity")).toHaveValue("30");
    await expect(dialog.getByLabel("Buffet per basis")).toHaveValue(
      "TotalGuests"
    );

    // Typed over, so the card below is proving the operator's numbers reached
    // the row rather than that a default survived a round trip.
    await dialog.getByLabel("Buffet quantity").fill("2");
    await dialog.getByLabel("Buffet per quantity").fill("25");

    const created = page.waitForResponse(createResponse);
    await dialog.getByRole("button", { name: "Save item" }).click();
    expect((await created).status()).toBe(201);
    await expect(dialog).toBeHidden({ timeout: 20_000 });

    // --- and it landed where it was added ----------------------------------
    // Still on the Buffet Menu: jumping to the library after a save is what made
    // "Add buffet item" look like it had created the wrong thing.
    await expect(
      page.getByRole("button", { name: "Add buffet item" })
    ).toBeVisible();

    const card = itemCard(page, name);
    await expect(card).toBeVisible({ timeout: 20_000 });
    // The rule, on the card - the one thing a service tab exists to show that
    // the library does not.
    await expect(card.getByText("2 tray per 25 guests")).toBeVisible();
    // Kashrut, not the service style: you already know which tab you are on.
    await expect(card.getByText("Parve", { exact: true })).toBeVisible();

    await openServiceTab(page, "plated");
    await expect(itemCard(page, name)).toBeHidden({ timeout: 20_000 });

    // The library lists it too, and that is not a duplicate: a dish exists once
    // and the service tabs are views over it. It is also the only screen the
    // dish can be edited from, which the rest of this test depends on.
    await openLibraryTab(page);
    await expect(itemCard(page, name)).toBeVisible({ timeout: 20_000 });

    // --- update ------------------------------------------------------------
    const editDialog = await openItemEditor(page, itemCard(page, name), name);

    // Both blocks, unlike the scoped create above: the styles are stored per
    // dish, so an item opened from the library has to be editable into either.
    const servesBuffet = editDialog.getByRole("checkbox", {
      name: "Buffet",
      exact: true
    });
    const servesPlated = editDialog.getByRole("checkbox", {
      name: "Plated",
      exact: true
    });
    await expect(servesBuffet).toBeChecked();
    await expect(servesPlated).not.toBeChecked();

    // The saved rule is what the editor is seeded with. An edit form that took
    // the defaults instead would quietly rewrite a rule the operator never
    // touched.
    await showRuleFields(editDialog, "Buffet");
    await expect(editDialog.getByLabel("Buffet quantity")).toHaveValue("2");
    await expect(editDialog.getByLabel("Buffet per quantity")).toHaveValue("25");

    await servesBuffet.uncheck();
    await servesPlated.check();

    const updated = page.waitForResponse(itemResponse("PATCH"));
    await editDialog.getByRole("button", { name: "Save changes" }).click();
    expect((await updated).status()).toBe(200);
    await expect(editDialog).toBeHidden({ timeout: 20_000 });

    // --- and it moved tabs --------------------------------------------------
    await openServiceTab(page, "buffet");
    await expect(itemCard(page, name)).toBeHidden({ timeout: 20_000 });

    await openServiceTab(page, "plated");
    const platedCard = itemCard(page, name);
    await expect(platedCard).toBeVisible({ timeout: 20_000 });
    // The plated defaults the ticked style brought with it, and not the buffet
    // rule it used to carry: a dish that stopped being served buffet must not
    // keep counting in trays.
    //
    // Loose on the trailing plural: `formatServiceRule` writes "1 guests"
    // today, and pinning that would make a wording fix look like a regression.
    await expect(platedCard.getByText(/1 plate per 1 guest/)).toBeVisible();
    await expect(platedCard.getByText(/tray/)).toBeHidden();

    // --- remove -------------------------------------------------------------
    await removeItemFromLibrary(page, name);

    await openServiceTab(page, "plated");
    await expect(itemCard(page, name)).toBeHidden({ timeout: 20_000 });
  } finally {
    await deleteItemByName(page, name);
  }
});

test("adds a plated dish from its tab and serves it both ways", async ({
  page
}) => {
  // Same reasoning as the test above: several writes, and a cold first request.
  test.setTimeout(90_000);

  const name = `E2E Plated Dish ${Date.now()}`;

  try {
    await openServiceTab(page, "plated");
    await page.getByRole("button", { name: "Add plated item" }).click();

    const dialog = page.getByRole("dialog", { name: "Plated item", exact: true });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("group", { name: "Plated rule" })
    ).toBeVisible();

    await dialog.getByLabel("Item name").fill(name);
    await showRuleFields(dialog, "Plated");

    // The other half of the pair the buffet test asserts. A plate is one per
    // head and is never rounded - rounding it up sends out a plate for a guest
    // who is not there.
    await expect(dialog.getByLabel("Plated quantity")).toHaveValue("1");
    await expect(dialog.getByLabel("Plated unit")).toHaveValue("plate");
    await expect(dialog.getByLabel("Plated per quantity")).toHaveValue("1");
    await expect(dialog.getByLabel("Plated rounding")).toHaveValue("Exact");

    const created = page.waitForResponse(createResponse);
    await dialog.getByRole("button", { name: "Save item" }).click();
    expect((await created).status()).toBe(201);
    await expect(dialog).toBeHidden({ timeout: 20_000 });

    const card = itemCard(page, name);
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card.getByText(/1 plate per 1 guest/)).toBeVisible();

    await openServiceTab(page, "buffet");
    await expect(itemCard(page, name)).toBeHidden({ timeout: 20_000 });

    // --- served two ways ----------------------------------------------------
    // The case the service rows were split out to express: one dish, a rule per
    // style, listed under both tabs without being stored twice.
    await openLibraryTab(page);

    const editDialog = await openItemEditor(page, itemCard(page, name), name);
    await editDialog
      .getByRole("checkbox", { name: "Buffet", exact: true })
      .check();

    const updated = page.waitForResponse(itemResponse("PATCH"));
    await editDialog.getByRole("button", { name: "Save changes" }).click();
    expect((await updated).status()).toBe(200);
    await expect(editDialog).toBeHidden({ timeout: 20_000 });

    await openServiceTab(page, "buffet");
    const buffetCard = itemCard(page, name);
    await expect(buffetCard).toBeVisible({ timeout: 20_000 });
    // Each tab reads its own rule off the same dish, which is the whole reason
    // these are rows rather than a column: the buffet counts trays while the
    // plated menu still counts plates.
    await expect(buffetCard.getByText("1 tray per 30 guests")).toBeVisible();

    await openServiceTab(page, "plated");
    const platedCard = itemCard(page, name);
    await expect(platedCard).toBeVisible({ timeout: 20_000 });
    await expect(platedCard.getByText(/1 plate per 1 guest/)).toBeVisible();

    // One card per dish on each tab, not one per rule: a dish holding two rules
    // that flattened into two cards is the regression this counts against.
    await expect(platedCard).toHaveCount(1);

    // --- remove -------------------------------------------------------------
    // One removal takes it off both tabs, because there was only ever one dish.
    await removeItemFromLibrary(page, name);

    await openServiceTab(page, "buffet");
    await expect(itemCard(page, name)).toBeHidden({ timeout: 20_000 });

    await openServiceTab(page, "plated");
    await expect(itemCard(page, name)).toBeHidden({ timeout: 20_000 });
  } finally {
    await deleteItemByName(page, name);
  }
});
