import {
  expect,
  test,
  type Locator,
  type Page,
  type Response
} from "@playwright/test";

/**
 * Covers the menu library item lifecycle through the UI it actually ships with:
 * the New item dialog, the card that opens an editor when it is clicked, the
 * Remove button inside that editor, and the confirmation step in front of the
 * removal itself.
 *
 * Both failure paths are here too, and they are provoked differently on purpose.
 * The 409 is real - a package genuinely holds the item and the server refuses -
 * because that guard is the whole reason the delete is not a plain delete. The
 * update failure is stubbed, because nothing a browser can do makes a healthy
 * server reject a valid edit, and what is under test there is the dialog: it has
 * to stay open, say why, and leave the card as it was.
 */

// Reused across runs rather than created per run: packages have no delete
// endpoint, so one per run would pile up in the E2E organization. This one is
// emptied again by the same test that fills it.
const GUARD_PACKAGE_NAME = "E2E Menu Guard";

const IN_USE_MESSAGE =
  "This item is still used by an event or package. Remove it there first.";

type MenuPayload = {
  items: Array<{ id: string; name: string }>;
  packages: Array<{ id: string; name: string; includedMenuItemIds: string[] }>;
};

// page.request rather than the standalone `request` fixture, matching
// events.mutation.spec.ts: it shares the browser context's cookie jar, which is
// where the session lives.
async function readMenu(page: Page) {
  const response = await page.request.get("/api/menu");

  if (!response.ok()) {
    throw new Error(
      `GET /api/menu failed with ${response.status()}: ${await response.text()}`
    );
  }

  return (await response.json()) as MenuPayload;
}

/**
 * Seeds an item straight through the API.
 *
 * Used by the failure tests only. There the item is a fixture, not the subject,
 * and building it through the form would make every update failure look like a
 * create failure the day the create breaks.
 */
async function createItem(page: Page, name: string) {
  const response = await page.request.post("/api/menu", {
    data: {
      resource: "item",
      name,
      category: "Main",
      // The business segment, not a service style. Sending no `services` is what
      // makes this a library-only item - the fixture wants a dish that exists,
      // not one that is served anywhere.
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

async function deleteItem(page: Page, itemId: string) {
  await page.request.delete(`/api/menu/items/${itemId}`);
}

/** Returns the guard package, creating it the first time this suite ever runs. */
async function resolveGuardPackage(page: Page) {
  const existing = (await readMenu(page)).packages.find(
    (item) => item.name === GUARD_PACKAGE_NAME
  );

  if (existing) return existing.id;

  const response = await page.request.post("/api/menu", {
    data: {
      resource: "package",
      name: GUARD_PACKAGE_NAME,
      hallIds: [],
      eventTypeIds: [],
      includedMenuItemIds: []
    }
  });

  if (response.status() !== 201) {
    throw new Error(
      `POST /api/menu (package) failed with ${response.status()}: ${await response.text()}`
    );
  }

  const payload = (await response.json()) as { package: { id: string } };
  return payload.package.id;
}

async function setPackageItems(
  page: Page,
  packageId: string,
  includedMenuItemIds: string[]
) {
  const response = await page.request.patch(`/api/menu/packages/${packageId}`, {
    data: { includedMenuItemIds }
  });

  if (!response.ok()) {
    throw new Error(
      `PATCH /api/menu/packages failed with ${response.status()}: ${await response.text()}`
    );
  }
}

function itemCard(page: Page, name: string) {
  return page.getByRole("article").filter({ hasText: name });
}

/**
 * Opens the editor the way the grid does it: the card itself is the button.
 *
 * Returns the dialog rather than leaving the caller to find it, because every
 * path into an item now goes through this one.
 */
async function openItemEditor(page: Page, card: Locator, name: string) {
  await card.getByRole("button", { name: `Edit ${name}` }).click();

  const editDialog = page.getByRole("dialog", { name: "Edit library item" });
  await expect(editDialog).toBeVisible();

  return editDialog;
}

/**
 * Walks from a card to the open confirmation: click the card, then Remove item
 * in the editor's footer. The delete has not been sent yet when this returns -
 * the confirmation is the step that sends it.
 */
async function startItemRemoval(page: Page, card: Locator, name: string) {
  const editDialog = await openItemEditor(page, card, name);
  await editDialog.getByRole("button", { name: "Remove item" }).click();

  const confirmDialog = page.getByRole("alertdialog", {
    name: "Remove menu item"
  });
  await expect(confirmDialog).toBeVisible();

  return { confirmDialog, editDialog };
}

function itemResponse(method: string) {
  return (response: Response) =>
    response.url().includes("/api/menu/items/") &&
    response.request().method() === method;
}

test.beforeEach(async ({ page }) => {
  test.skip(
    !process.env.E2E_MUTATION_EMAIL || !process.env.E2E_MUTATION_PASSWORD,
    "Mutation E2E credentials are not set."
  );

  await page.goto("/dashboard/menu");
  await expect(
    page.getByRole("button", { name: "New item", exact: true }),
    "the mutation account needs canEditMenu to manage the library"
  ).toBeVisible({ timeout: 30_000 });
});

test("adds, updates and removes a library item from the grid", async ({
  page
}) => {
  const stamp = Date.now();
  const createdName = `E2E Item A${stamp}`;
  // Deliberately not built by suffixing the first: `hasText` matches
  // substrings, so "E2E Item A123 updated" would still satisfy a lookup for the
  // old name and the rename assertion would pass without a rename happening.
  const renamedName = `E2E Item B${stamp}`;
  const description = "Created by the menu library E2E suite.";

  await page.getByRole("button", { name: "New item", exact: true }).click();

  const createDialog = page.getByRole("dialog", {
    name: "Library item",
    exact: true
  });
  await expect(createDialog).toBeVisible();
  await createDialog.getByLabel("Item name").fill(createdName);
  await createDialog.getByLabel("Category").selectOption({ label: "Main" });
  await createDialog.getByLabel("Description").fill(description);

  const created = page.waitForResponse(
    (response) =>
      response.url().includes("/api/menu") &&
      response.request().method() === "POST"
  );
  await createDialog.getByRole("button", { name: "Save item" }).click();
  expect((await created).status()).toBe(201);
  await expect(createDialog).toBeHidden({ timeout: 20_000 });

  const card = itemCard(page, createdName);
  await expect(card).toBeVisible({ timeout: 20_000 });

  // --- update -------------------------------------------------------------
  const editDialog = await openItemEditor(page, card, createdName);
  // The seeding is the point of the assertion: an edit form that opens blank
  // quietly turns every field the user did not retype into a deletion.
  await expect(editDialog.getByLabel("Item name")).toHaveValue(createdName);
  await expect(editDialog.getByLabel("Category")).toHaveValue("Main");
  await expect(editDialog.getByLabel("Description")).toHaveValue(description);

  await editDialog.getByLabel("Item name").fill(renamedName);
  await editDialog.getByLabel("Category").selectOption({ label: "Dessert" });

  const updated = page.waitForResponse(itemResponse("PATCH"));
  await editDialog.getByRole("button", { name: "Save changes" }).click();
  expect((await updated).status()).toBe(200);
  await expect(editDialog).toBeHidden({ timeout: 20_000 });

  // Visible under its new category, not filtered out of the grid by the change
  // that was just saved.
  const renamedCard = itemCard(page, renamedName);
  await expect(renamedCard).toBeVisible({ timeout: 20_000 });
  await expect(renamedCard.getByText("Dessert")).toBeVisible();
  await expect(itemCard(page, createdName)).toBeHidden();

  // --- remove -------------------------------------------------------------
  const { confirmDialog, editDialog: removalEditor } = await startItemRemoval(
    page,
    renamedCard,
    renamedName
  );
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
});

test("refuses to remove an item a package still includes, and says why", async ({
  page
}) => {
  const name = `E2E Guarded ${Date.now()}`;
  const itemId = await createItem(page, name);
  const packageId = await resolveGuardPackage(page);
  await setPackageItems(page, packageId, [itemId]);

  try {
    // The grid rendered before the fixture existed and its query cache lives as
    // long as the page does.
    await page.reload();

    const card = itemCard(page, name);
    await expect(card).toBeVisible({ timeout: 20_000 });
    const { confirmDialog, editDialog } = await startItemRemoval(
      page,
      card,
      name
    );

    const refused = page.waitForResponse(itemResponse("DELETE"));
    await confirmDialog
      .getByRole("button", { name: "Remove from library" })
      .click();
    expect((await refused).status()).toBe(409);

    // The dialog is the only place that refusal can be read, so it has to stay
    // open and repeat what the server said.
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog.getByText(IN_USE_MESSAGE)).toBeVisible();
    // And name the holder: "used somewhere" leaves the operator with nowhere to
    // go, so the package actually blocking the delete is listed under it.
    await expect(
      confirmDialog
        .getByRole("listitem")
        .filter({ hasText: GUARD_PACKAGE_NAME })
    ).toBeVisible();

    // Backing out of the confirmation lands back in the editor rather than on
    // the grid: the removal was refused, not the edit.
    await confirmDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(confirmDialog).toBeHidden();
    await expect(editDialog).toBeVisible();
    await expect(editDialog.getByLabel("Item name")).toHaveValue(name);

    await editDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(editDialog).toBeHidden();
    await expect(itemCard(page, name)).toBeVisible();
  } finally {
    // Empty the guard package before the item goes, or the next run inherits a
    // package pointing at a row that no longer exists.
    await setPackageItems(page, packageId, []);
    await deleteItem(page, itemId);
  }
});

test("keeps the edit open with the server's message when an update fails", async ({
  page
}) => {
  const name = `E2E Unsaved ${Date.now()}`;
  const itemId = await createItem(page, name);
  const rejectedName = `${name} REJECTED`;
  const failureMessage = "Menu is locked while a kitchen sheet is printing.";

  try {
    // Only the PATCH is stubbed. The list refetch, the grid and the dialog all
    // stay real, so this measures how the app handles a rejection rather than
    // how it handles a mock.
    await page.route(/\/api\/menu\/items\//, async (route) => {
      if (route.request().method() !== "PATCH") return route.continue();

      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: failureMessage })
      });
    });

    await page.reload();

    const card = itemCard(page, name);
    await expect(card).toBeVisible({ timeout: 20_000 });
    const editDialog = await openItemEditor(page, card, name);

    await editDialog.getByLabel("Item name").fill(rejectedName);
    await editDialog.getByRole("button", { name: "Save changes" }).click();

    await expect(editDialog.getByRole("alert")).toHaveText(failureMessage);
    // Open, and still holding what was typed: closing here would throw the edit
    // away along with the only explanation of why it did not save.
    await expect(editDialog).toBeVisible();
    await expect(editDialog.getByLabel("Item name")).toHaveValue(rejectedName);
    await expect(
      editDialog.getByRole("button", { name: "Save changes" })
    ).toBeEnabled();

    await editDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(editDialog).toBeHidden();
    // The card kept the name the server never accepted a change to.
    await expect(itemCard(page, name)).toBeVisible();
    await expect(itemCard(page, rejectedName)).toBeHidden();
  } finally {
    await page.unroute(/\/api\/menu\/items\//);
    await deleteItem(page, itemId);
  }
});
