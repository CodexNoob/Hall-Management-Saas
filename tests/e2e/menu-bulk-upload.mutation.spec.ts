import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Covers the CSV bulk upload through the UI it ships with: the three-step
 * dialog, the review the operator confirms, and the rows the import writes.
 *
 * The file is built in memory and handed to the real file input, because the
 * thing under test is the whole path a spreadsheet takes - parse, classify,
 * import - and the parse is the half no route test can reach. Two assertions
 * here exist specifically to catch what a naive `line.split(",")` would do to
 * this format: a quoted allergen cell has to survive as two tags rather than
 * shifting every column after it, and a row the parser refused must not reach
 * the server.
 *
 * Every item created here is deleted in a `finally`, the way
 * menu-library.mutation.spec.ts does it - unlike add-ons, menu items have a
 * DELETE endpoint, so leaving 3 rows per run behind would be a choice.
 */

const CSV_HEADER =
  "Item Name,Category,Kashrut Type,Allergies,Description,Food or Drink";

type MenuPayload = {
  items: Array<{
    id: string;
    name: string;
    category: string | null;
    kosherType: string | null;
    allergens: string[];
    notes: string | null;
    kind: string;
    services: Array<{ serviceStyle: string; unit: string; per: number }>;
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

async function deleteItems(page: Page, names: string[]) {
  const items = (await readMenu(page)).items.filter((item) =>
    names.includes(item.name)
  );

  for (const item of items) {
    await page.request.delete(`/api/menu/items/${item.id}`);
  }
}

async function openBulkUpload(page: Page) {
  await page.getByRole("button", { name: "Bulk upload menu items" }).click();

  const dialog = page.getByRole("dialog", { name: "Bulk upload menu items" });
  await expect(dialog).toBeVisible();

  return dialog;
}

/** Walks the guide, then hands the file to the picker on step 2. */
async function uploadCsv(dialog: Locator, csv: string) {
  await dialog.getByRole("button", { name: "My sheet is ready" }).click();
  await dialog.getByLabel("CSV file").setInputFiles({
    name: "menu.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf8")
  });
}

test.beforeEach(async ({ page }) => {
  test.skip(
    !process.env.E2E_MUTATION_EMAIL || !process.env.E2E_MUTATION_PASSWORD,
    "Mutation E2E credentials are not set."
  );

  await page.goto("/dashboard/menu");
  await expect(
    page.getByRole("button", { name: "Bulk upload menu items" }),
    "the mutation account needs canEditMenu to manage the menu"
  ).toBeVisible({ timeout: 30_000 });
});

test("shows the sheet layout before asking for a file", async ({ page }) => {
  const dialog = await openBulkUpload(page);

  // The client's actual ask: the format is shown, with the column letters an
  // operator sees in their own spreadsheet, before any file picker appears.
  for (const [letter, header] of [
    ["A", "Item Name"],
    ["B", "Category"],
    ["C", "Kashrut Type"],
    ["D", "Allergies"],
    ["E", "Description"],
    ["F", "Food or Drink"]
  ]) {
    await expect(
      dialog.getByRole("columnheader", { name: letter, exact: true })
    ).toBeVisible();
    // The heading as a cell of the mock sheet, not merely the word somewhere on
    // the step: what is being asserted is that the operator can see which
    // column each field goes in.
    await expect(
      dialog.getByRole("cell", { name: header, exact: true })
    ).toBeVisible();
  }

  await expect(dialog.getByLabel("CSV file")).toBeHidden();
  await expect(
    dialog.getByRole("button", { name: "Download template CSV" })
  ).toBeVisible();
  // The sheet with the dropdowns, offered beside the plain one: the columns
  // with a closed set of values are the ones a hand-typed CSV gets wrong.
  await expect(
    dialog.getByRole("button", { name: "Download template xlsx" })
  ).toBeVisible();

  await dialog.getByRole("button", { name: "My sheet is ready" }).click();
  await expect(dialog.getByLabel("CSV file")).toBeVisible();
});

test("imports the good rows and refuses the broken one", async ({ page }) => {
  const stamp = Date.now();
  const good = `E2E Bulk Gefilte ${stamp}`;
  const drink = `E2E Bulk Juice ${stamp}`;
  const names = [good, drink];

  try {
    const dialog = await openBulkUpload(page);

    await uploadCsv(
      dialog,
      [
        CSV_HEADER,
        // The cell whose own separator is the CSV delimiter. Quoted, as the
        // guide teaches and as any spreadsheet writes it.
        `${good},Appetizer,Parve,"fish, eggs",Served cold,Food`,
        `${drink},Drink,Parve,,1L bottle,Drink`,
        // No name: the review must name this row rather than drop it quietly.
        `,Main,Fleishig,,Orphan row,Food`
      ].join("\r\n")
    );

    await expect(dialog.getByText("2 ready")).toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByText("Item name is empty.")).toBeVisible();

    const imported = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/menu/import" &&
        response.request().method() === "POST"
    );
    // The count is on the button, so the operator confirms a number rather than
    // a file - the broken row is already excluded from it.
    await dialog.getByRole("button", { name: "Import 2 items" }).click();
    expect((await imported).status()).toBe(201);

    await expect(dialog.getByText("2 items imported")).toBeVisible({
      timeout: 20_000
    });
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(dialog).toBeHidden();

    // --- what actually reached the database ---------------------------------
    const items = (await readMenu(page)).items;
    const savedGood = items.find((item) => item.name === good);
    const savedDrink = items.find((item) => item.name === drink);

    expect(savedGood).toMatchObject({
      category: "Appetizer",
      kosherType: "Parve",
      notes: "Served cold",
      kind: "Food"
    });
    // The assertion a naive splitter fails: two tags, not one mangled string,
    // and Description still holding the description rather than "eggs".
    expect(savedGood?.allergens).toEqual(["fish", "eggs"]);
    expect(savedDrink).toMatchObject({ kind: "Drink", category: "Drink" });
    // Imported from the library tab, so no service rule was asked for or set.
    expect(savedGood?.services).toEqual([]);

    expect(items.filter((item) => item.notes === "Orphan row")).toEqual([]);

    // Visible on the page, not merely in the API - the grid refetches before
    // the dialog reports the count.
    await expect(
      page.getByRole("article").filter({ hasText: good })
    ).toBeVisible({ timeout: 20_000 });
  } finally {
    await deleteItems(page, names);
  }
});

test("flags a dish already in the menu and leaves it out of the count", async ({
  page
}) => {
  const stamp = Date.now();
  const name = `E2E Bulk Repeat ${stamp}`;

  try {
    // Imported once through the dialog, so the duplicate check is being asked
    // about a row this feature itself created.
    const first = await openBulkUpload(page);
    await uploadCsv(
      first,
      [CSV_HEADER, `${name},Main,Parve,,First pass,Food`].join("\r\n")
    );
    await first.getByRole("button", { name: "Import 1 item" }).click();
    await expect(first.getByText("1 item imported")).toBeVisible({
      timeout: 20_000
    });
    await first.getByRole("button", { name: "Close", exact: true }).click();

    const second = await openBulkUpload(page);
    await uploadCsv(
      second,
      [CSV_HEADER, `${name},Main,Parve,,Second pass,Food`].join("\r\n")
    );

    await expect(second.getByText("Already in your menu.")).toBeVisible({
      timeout: 20_000
    });
    // Nothing to import, so the button cannot be pressed: re-uploading the same
    // sheet is the accident this guard exists for, and there is no bulk delete
    // to undo it with.
    await expect(
      second.getByRole("button", { name: /^Import 0 items$/ })
    ).toBeDisabled();

    await second.getByLabel(/Import the 1 duplicate row anyway/).check();
    await expect(
      second.getByRole("button", { name: "Import 1 item" })
    ).toBeEnabled();

    await second.getByRole("button", { name: "Cancel" }).click();
    await expect(second).toBeHidden();

    // Cancelling wrote nothing: still one row, still the first import's notes.
    const saved = (await readMenu(page)).items.filter(
      (item) => item.name === name
    );
    expect(saved).toHaveLength(1);
    expect(saved[0]?.notes).toBe("First pass");
  } finally {
    await deleteItems(page, [name]);
  }
});

test("gives every imported dish the buffet rule set in the dialog", async ({
  page
}) => {
  const stamp = Date.now();
  const name = `E2E Bulk Buffet ${stamp}`;

  try {
    // Exact, or it also matches the "Buffet Menu" text elsewhere on the page.
    await page
      .getByRole("button", { name: "Buffet Menu", exact: true })
      .click();

    const dialog = await openBulkUpload(page);
    await uploadCsv(
      dialog,
      [CSV_HEADER, `${name},Main,Fleishig,,Tray of chicken,Food`].join("\r\n")
    );

    // Opened from the Buffet tab, so the rule block is there and pre-filled -
    // an import that landed in the library would read as the wrong tab having
    // been used.
    const quantity = dialog.getByLabel("Buffet quantity");
    await expect(quantity).toBeVisible({ timeout: 20_000 });
    await expect(quantity).toHaveValue("1");
    await dialog.getByLabel("Buffet per quantity").fill("25");

    await dialog.getByRole("button", { name: "Import 1 item" }).click();
    await expect(dialog.getByText("1 item imported")).toBeVisible({
      timeout: 20_000
    });
    await dialog.getByRole("button", { name: "Close", exact: true }).click();

    const saved = (await readMenu(page)).items.find(
      (item) => item.name === name
    );
    expect(saved?.services).toEqual([
      expect.objectContaining({
        serviceStyle: "Buffet",
        unit: "tray",
        // The edited value, not the default it was seeded with.
        per: 25
      })
    ]);

    await expect(
      page.getByRole("article").filter({ hasText: name })
    ).toBeVisible({ timeout: 20_000 });
  } finally {
    await deleteItems(page, [name]);
  }
});
