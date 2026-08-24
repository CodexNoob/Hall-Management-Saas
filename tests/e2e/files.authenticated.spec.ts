import { expect, test } from "@playwright/test";

/**
 * The read-only half of the Files module's coverage, which is out of the MVP.
 *
 * Skipped by the `mvpHiddenSpecs` list in playwright.config.ts. Moved here out of
 * dashboard.authenticated.spec.ts rather than folded into files.mutation.spec.ts,
 * because that file runs under the mutation account and this test is about what
 * the read-only one can open - the distinction it exists to make.
 */

test.beforeEach(async ({}, testInfo) => {
  test.skip(
    !process.env.E2E_READONLY_EMAIL || !process.env.E2E_READONLY_PASSWORD,
    "Read-only E2E credentials are not set."
  );
  testInfo.annotations.push({
    type: "account",
    description: "Uses the non-mutating read-only E2E account."
  });
});

test("file workspace is protected and renders for an authorized user", async ({
  page
}) => {
  await page.goto("/dashboard/files");

  await expect(page).toHaveURL(/\/dashboard\/files/);
  await expect(
    page.getByRole("heading", { name: /Files/i }).first()
  ).toBeVisible();
});

test("the file workspace renders without a fatal error", async ({ page }) => {
  // Dropped from the smoke sweep in dashboard.authenticated.spec.ts when
  // /dashboard/files stopped rendering; restored here so the page is still swept
  // when the module ships.
  await page.goto("/dashboard/files");

  await expect(page.locator("body")).not.toContainText("Application error");
  await expect(page.locator("body")).not.toContainText("Internal Server Error");

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
});
