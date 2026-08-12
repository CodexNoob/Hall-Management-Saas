import { expect, test } from "@playwright/test";

const hall = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Hall 1",
  capacity: 500
};

const preset = {
  id: "22222222-2222-4222-8222-222222222222",
  organizationId: "33333333-3333-4333-8333-333333333333",
  hallId: hall.id,
  name: "charles",
  objects: [
    {
      id: "table-1",
      type: "round-table",
      name: "Round table",
      x: 120,
      y: 120,
      width: 96,
      height: 96,
      rotation: 0,
      seats: 10,
      seatingUse: "adult"
    }
  ],
  createdAt: "2026-08-11T00:00:00.000Z",
  updatedAt: "2026-08-11T00:00:00.000Z",
  hall
};

test.beforeEach(async () => {
  test.skip(
    !process.env.E2E_READONLY_EMAIL || !process.env.E2E_READONLY_PASSWORD,
    "Read-only E2E credentials are not set."
  );
});

test("saving a hall map shows a non-layout-shifting saved confirmation", async ({
  page
}) => {
  let saveRequestCount = 0;

  await page.route("**/api/hall-maps", async (route) => {
    const method = route.request().method();

    if (method === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ halls: [hall], presets: [preset] })
      });
      return;
    }

    if (method === "PATCH") {
      saveRequestCount += 1;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          preset: {
            ...preset,
            updatedAt: new Date().toISOString()
          }
        })
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/dashboard/hall-room-map");

  await page.getByLabel("assigned-hall").click();
  await page.getByRole("option", { name: "Hall 1" }).click();

  const grid = page.getByLabel("Hall map grid");
  const beforeBox = await grid.boundingBox();

  await page.getByRole("button", { name: "Save map" }).click();

  const confirmation = page.getByText("Layout saved").locator("..");
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText("charles is saved to Hall 1.");
  await expect(page.locator(".fixed.bottom-5")).toHaveCount(0);
  expect(saveRequestCount).toBe(1);

  const afterBox = await grid.boundingBox();
  expect(afterBox?.y).toBe(beforeBox?.y);
});

test("clear selection resets the selected hall map object", async ({ page }) => {
  await page.route("**/api/hall-maps", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ halls: [hall], presets: [preset] })
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/dashboard/hall-room-map");

  await page.getByLabel("assigned-hall").click();
  await page.getByRole("option", { name: "Hall 1" }).click();
  await expect(
    page.getByRole("button", { name: "Clear selection" })
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Select Round table" }).click();

  await expect(page.getByLabel("Name")).toHaveValue("Round table");

  const clearSelection = page.getByRole("button", {
    name: "Clear selection"
  });
  await expect(clearSelection).toBeEnabled();
  await clearSelection.click();

  await expect(page.getByLabel("Name")).toHaveValue("");
  await expect(page.getByLabel("Name")).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Clear selection" })
  ).toHaveCount(0);
});
