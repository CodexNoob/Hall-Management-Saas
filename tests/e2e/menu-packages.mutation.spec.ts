import { expect, test, type Page, type Response } from "@playwright/test";

/**
 * Covers a package through the UI it ships with: the New package dialog, the
 * Edit package dialog, the library picker that fills it, and the card menu that
 * empties it again.
 *
 * One test rather than four, for two reasons. `fullyParallel` runs tests in a
 * file concurrently, so separate tests could not share the package they act on
 * and would each have to create one. And there is no DELETE for a package - not
 * in the API and not in the app - so every package this suite creates is a row
 * that stays in the E2E organization. One per run is the floor while that is
 * true; the menu item and the package's contents are still cleaned up, so a run
 * cannot leave an item behind or a package pointing at a deleted one.
 *
 * The refused add in the middle is stubbed, for the reason the library spec
 * stubs its failing update: nothing a browser can do makes a healthy server
 * reject a valid add, and what is under test is the banner - adding an item
 * opens no dialog, so that banner is the only place a refusal can be read.
 */

const PACKAGE_PATCH_ROUTE = /\/api\/menu\/packages\//;

/**
 * Every alert on the page except Next's own.
 *
 * Next mounts a permanently empty `<div role="alert" id="__next-route-announcer__">`
 * on every page, so a bare `getByRole("alert")` is a strict-mode violation
 * anywhere in this app. Excluding it by id rather than filtering by the expected
 * text keeps the assertion honest: it still fails if the banner shows a generic
 * fallback instead of what the server said.
 */
const PAGE_ALERT = '[role="alert"]:not(#__next-route-announcer__)';

type MenuPayload = {
  items: Array<{ id: string; name: string }>;
  packages: Array<{ id: string; name: string; includedMenuItemIds: string[] }>;
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

/**
 * Seeds the library item the package is filled with.
 *
 * Created through the API on purpose: it is a fixture here, not the subject, and
 * building it through the New item dialog would make every package failure look
 * like a library failure the day the create form breaks.
 */
async function createItem(page: Page, name: string) {
  const response = await page.request.post("/api/menu", {
    data: {
      resource: "item",
      name,
      category: "Main",
      usageType: "Library",
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

/**
 * Releases the item from any package holding it, then drops it.
 *
 * The order is the point: the delete guard refuses an item a package still
 * includes, so an item left attached would block its own cleanup and be
 * inherited by the next run. Packages are found by what they reference rather
 * than by name, because a run that failed before the rename left the package
 * under its first one - and only this item is pulled out, never the whole list,
 * so a mistargeted package would not be emptied.
 */
async function releaseFixtures(page: Page, itemId: string) {
  const holders = (await readMenu(page)).packages.filter((item) =>
    item.includedMenuItemIds.includes(itemId)
  );

  for (const holder of holders) {
    await page.request.patch(`/api/menu/packages/${holder.id}`, {
      data: {
        includedMenuItemIds: holder.includedMenuItemIds.filter(
          (id) => id !== itemId
        )
      }
    });
  }

  await page.request.delete(`/api/menu/items/${itemId}`);
}

function packageResponse(method: string) {
  return (response: Response) =>
    response.url().includes("/api/menu/packages/") &&
    response.request().method() === method;
}

test.beforeEach(async ({ page }) => {
  test.skip(
    !process.env.E2E_MUTATION_EMAIL || !process.env.E2E_MUTATION_PASSWORD,
    "Mutation E2E credentials are not set."
  );

  await page.goto("/dashboard/menu");
  await expect(
    page.getByRole("button", { name: "Create new package" }),
    "the mutation account needs canEditMenu to manage packages"
  ).toBeVisible({ timeout: 30_000 });
});

test("creates a package, edits it, and fills and empties it from the library", async ({
  page
}) => {
  const stamp = Date.now();
  const packageName = `E2E Package A${stamp}`;
  // Not built by suffixing the first: `hasText` and the accessible-name lookups
  // both match substrings, so "E2E Package A123 renamed" would still satisfy a
  // search for the old name and the rename assertion would pass without a
  // rename happening.
  const renamedPackage = `E2E Package B${stamp}`;
  const itemName = `E2E Package Item ${stamp}`;
  const itemId = await createItem(page, itemName);

  try {
    // The page was loaded before the item existed and its query cache lives as
    // long as the page does.
    await page.reload();

    // --- create -----------------------------------------------------------
    await page.getByRole("button", { name: "Create new package" }).click();

    const createDialog = page.getByRole("dialog", { name: "New package" });
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel("Package name").fill(packageName);
    await createDialog.getByLabel("Base price").fill("80");

    const created = page.waitForResponse(
      (response) =>
        response.url().includes("/api/menu") &&
        response.request().method() === "POST"
    );
    await createDialog.getByRole("button", { name: "Save package" }).click();
    expect((await created).status()).toBe(201);
    await expect(createDialog).toBeHidden({ timeout: 20_000 });

    // Saving a package switches to the Packages tab and opens the new one, so
    // there is nothing left to click before it can be filled.
    const packageHeading = page.getByRole("heading", { name: packageName });
    await expect(packageHeading).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Base $80.00 - 0 items included")).toBeVisible();
    await expect(
      page.getByText("No items in this package yet.")
    ).toBeVisible();

    // --- edit -------------------------------------------------------------
    await page.getByRole("button", { name: "Edit package" }).click();

    const editDialog = page.getByRole("dialog", { name: "Edit package" });
    await expect(editDialog).toBeVisible();
    // The seeding is the assertion: an edit form that opens blank quietly turns
    // every field the user did not retype into a change they never made.
    await expect(editDialog.getByLabel("Package name")).toHaveValue(
      packageName
    );
    await expect(editDialog.getByLabel("Base price")).toHaveValue("80");

    await editDialog.getByLabel("Package name").fill(renamedPackage);
    await editDialog.getByLabel("Base price").fill("125.5");

    const edited = page.waitForResponse(packageResponse("PATCH"));
    await editDialog.getByRole("button", { name: "Save package" }).click();
    expect((await edited).status()).toBe(200);
    await expect(editDialog).toBeHidden({ timeout: 20_000 });

    await expect(
      page.getByRole("heading", { name: renamedPackage })
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText("Base $125.50 - 0 items included")
    ).toBeVisible();
    // Still the open package after the rename, which is what selecting by id
    // rather than by name buys.
    await expect(page.getByRole("heading", { name: packageName })).toBeHidden();

    // --- a refused add ----------------------------------------------------
    const failureMessage = "Menu is locked while a kitchen sheet is printing.";
    await page.route(PACKAGE_PATCH_ROUTE, async (route) => {
      if (route.request().method() !== "PATCH") return route.continue();

      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: failureMessage })
      });
    });

    await page
      .getByLabel("Search library items to add")
      .fill(itemName);

    const addCard = page.getByRole("button", {
      name: `Add ${itemName} to package`
    });
    await expect(addCard).toBeVisible({ timeout: 20_000 });
    await addCard.click();

    await expect(page.locator(PAGE_ALERT)).toHaveText(failureMessage);
    // The package is unchanged and the card is still on offer: a refusal that
    // left the item looking added would be worse than the refusal.
    await expect(
      page.getByText("Base $125.50 - 0 items included")
    ).toBeVisible();
    await expect(addCard).toBeVisible();

    await page.getByRole("button", { name: "Dismiss" }).click();
    await expect(page.locator(PAGE_ALERT)).toBeHidden();
    await page.unroute(PACKAGE_PATCH_ROUTE);

    // --- add --------------------------------------------------------------
    const added = page.waitForResponse(packageResponse("PATCH"));
    await addCard.click();
    expect((await added).status()).toBe(200);

    // The card the item is drawn as in the package - the same one the library
    // grid uses, so the picture comes with it.
    const includedCard = page.getByRole("article").filter({ hasText: itemName });
    await expect(includedCard).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText("Base $125.50 - 1 item included")
    ).toBeVisible();
    // Gone from the picker: an item offered twice invites a click that cannot
    // do anything.
    await expect(addCard).toBeHidden();

    // --- remove -----------------------------------------------------------
    await includedCard
      .getByRole("button", { name: `More actions for ${itemName}` })
      .click();

    const removed = page.waitForResponse(packageResponse("PATCH"));
    await includedCard
      .getByRole("menuitem", { name: "Remove", exact: true })
      .click();
    expect((await removed).status()).toBe(200);

    await expect(includedCard).toBeHidden({ timeout: 20_000 });
    await expect(
      page.getByText("Base $125.50 - 0 items included")
    ).toBeVisible();
    // Back on offer, which is the only way it could ever be added again.
    await expect(addCard).toBeVisible({ timeout: 20_000 });
  } finally {
    await page.unroute(PACKAGE_PATCH_ROUTE);
    await releaseFixtures(page, itemId);
  }
});
