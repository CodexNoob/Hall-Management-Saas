import { expect, test } from "@playwright/test";

// The one behaviour jsdom cannot fully model: how a real browser treats a
// numeric input. These fields used to be type="number", where the browser runs
// its value-sanitization algorithm and hands JavaScript "" for anything it
// cannot parse - so "abc" and a deliberately cleared box were indistinguishable
// and `Number("")` turned both into a silent 0.
//
// The hall map is used because it needs no edit permission (the data is
// stubbed) and its inspector is where the defect was originally reported.

const hall = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Hall 1",
  capacity: 500
};

// Next.js injects a #__next-route-announcer__ div with role="alert", so
// assertions target the inspector's own error paragraph instead.
const inspectorError = 'p[role="alert"]';

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

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(
    !process.env.E2E_READONLY_EMAIL || !process.env.E2E_READONLY_PASSWORD,
    "Read-only E2E credentials are not set."
  );
  // Below the md breakpoint the editor is view-only, so the inspector inputs
  // cannot be exercised there.
  test.skip(
    testInfo.project.name.includes("mobile"),
    "The hall map editor is view-only on mobile viewports."
  );

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
  await page.getByLabel("Assigned hall").click();
  await page.getByRole("option", { name: "Hall 1" }).click();
  await page.getByRole("button", { name: "Select Round table" }).click();
  await expect(page.getByLabel("Name")).toHaveValue("Round table");
});

test("a numeric field keeps the text the user typed instead of discarding it", async ({
  page
}) => {
  const width = page.getByLabel("Width");
  await width.fill("12abc");

  // A type="number" input would have reported "" here.
  await expect(width).toHaveValue("12abc");
  await expect(page.locator(inspectorError)).toContainText("Enter a number.");
});

test("clearing a numeric field reports it rather than writing zero", async ({
  page
}) => {
  await page.getByLabel("Width").fill("");

  await expect(page.locator(inspectorError)).toContainText("Enter a number.");
  // The shape must keep its size: the original defect snapped it to 0.
  await expect(page.getByRole("button", { name: "Select Round table" })).toBeVisible();
});

test("a value outside the bound the server enforces is refused", async ({
  page
}) => {
  await page.getByLabel("Width").fill("5");

  await expect(page.locator(inspectorError)).toContainText(
    "Width must be at least 10."
  );
});

test("a fractional seat count is refused", async ({ page }) => {
  await page.getByLabel("Seats").fill("10.5");

  await expect(page.locator(inspectorError)).toContainText(
    "Seats must be a whole number."
  );
});

test("a valid value clears the error and is accepted", async ({ page }) => {
  const width = page.getByLabel("Width");

  await width.fill("");
  await expect(page.locator(inspectorError)).toBeVisible();

  await width.fill("140");
  await expect(page.locator(inspectorError)).toHaveCount(0);
  await expect(width).toHaveValue("140");
});
