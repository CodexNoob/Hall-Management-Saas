import { expect, test } from "@playwright/test";

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

test("billing tabs and reports render on desktop and mobile", async ({
  page
}) => {
  await page.goto("/dashboard/billing");
  await expect(
    page.getByRole("heading", { name: "Billing", exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: /Reports/i }).click();
  await expect(
    page.getByRole("heading", { name: "Billing reports" })
  ).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
});
