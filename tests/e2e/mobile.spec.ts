import { expect, test } from "@playwright/test";

test("public landing page fits the mobile viewport", async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile-only assertion.");
  await page.goto("/");

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));

  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
  await expect(
    page.getByRole("heading", { name: /Everything You Need to Manage Your Simcha Hall/i })
  ).toBeVisible();
});
