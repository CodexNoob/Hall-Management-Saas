import { expect, test } from "@playwright/test";

test.beforeEach(async ({}, testInfo) => {
  test.skip(
    !process.env.E2E_READONLY_EMAIL ||
      !process.env.E2E_READONLY_PASSWORD,
    "Read-only E2E credentials are not set."
  );
  testInfo.annotations.push({
    type: "account",
    description: "Uses the non-mutating read-only E2E account."
  });
});

test("authenticated state opens the dashboard without logging in again", async ({
  page
}) => {
  await page.goto("/dashboard");

  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true })
  ).toBeVisible();
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

test("authenticated layouts do not overflow the mobile viewport", async ({
  page
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "authenticated-mobile",
    "Mobile-only layout assertion."
  );
  await page.goto("/dashboard");

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));

  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
  await expect(
    page.getByRole("button", { name: /Open navigation|Expand sidebar/ })
  ).toBeVisible();
});

test("booking creation is not exposed on overview, kitchen, or event manager pages", async ({
  page
}) => {
  for (const route of ["/dashboard", "/dashboard/kitchen", "/dashboard/events"]) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(route.replaceAll("/", "\\/")));
    await expect(
      page.getByRole("button", { name: "Create new booking" })
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "New booking" })
    ).toHaveCount(0);
  }
});

const dashboardPages = [
  "/dashboard",
  "/dashboard/kitchen",
  "/dashboard/calendar",
  "/dashboard/events",
  "/dashboard/menu",
  "/dashboard/dining-manager",
  "/dashboard/hall-room-map",
  "/dashboard/files",
  "/dashboard/billing",
  "/dashboard/staff",
  "/dashboard/vendors",
  "/dashboard/settings"
];

for (const route of dashboardPages) {
  test(`dashboard page renders without a fatal error: ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(route.replaceAll("/", "\\/")));
    await expect(page.locator("body")).not.toContainText("Application error");
    await expect(page.locator("body")).not.toContainText("Internal Server Error");
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
  });
}
