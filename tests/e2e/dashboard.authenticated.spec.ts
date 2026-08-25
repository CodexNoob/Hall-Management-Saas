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

// The overview is out of the MVP, so the landing page these tests measure is
// /dashboard/events now (lib/ui/mvp-features). The overview's own coverage moved
// to dashboard-overview.authenticated.spec.ts, which playwright.config.ts skips
// until the module ships.

test("authenticated state opens the workspace without logging in again", async ({
  page
}) => {
  await page.goto("/dashboard/events");

  await expect(
    page.getByRole("heading", { name: "Event Manager", exact: true })
  ).toBeVisible({ timeout: 45_000 });
});

// Every route here renders `DashboardTopbar`, which is what the assertion below
// measures. Kitchen was in this list until it stopped using that topbar: it now
// draws its own full-width `KitchenHeader` - a Main Menu link, a notifications
// button and the date as its h1 - and offers neither the Search nor the Today
// notes button the wrap regression is about. There is nothing left there to
// wrap, so the route is out rather than skipped, and the smoke list at the foot
// of this file still opens /dashboard/kitchen and checks it fits the viewport.
for (const [label, route] of [["Events", "/dashboard/events"]] as Array<
  [string, string]
>) {
  test(`${label} keeps the topbar actions on the title line on a phone`, async ({
    page
  }) => {
    // The regression this guards: a page passing a custom Today notes button
    // that keeps its label, border and padding at every width. The actions row
    // is then too wide to sit beside the title, wraps onto a second line, and
    // costs 36px of vertical space on every phone. Reported on the overview,
    // which covers itself in dashboard-overview.authenticated.spec.ts now.
    await page.setViewportSize({ width: 360, height: 727 });
    await page.goto(route);

    // Scoped to the topbar: a page may carry a second h1 of its own.
    const topbar = page.locator(".dashboard-topbar-content");
    const title = topbar.getByRole("heading", { level: 1 });
    const search = topbar.getByRole("button", { name: "Search", exact: true });
    const notes = topbar.getByRole("button", { name: "Open today notes" });
    await expect(title).toBeVisible();
    await expect(search).toBeVisible();
    await expect(notes).toBeVisible();

    const [titleBox, searchBox, notesBox] = await Promise.all([
      title.boundingBox(),
      search.boundingBox(),
      notes.boundingBox()
    ]);
    if (!titleBox || !searchBox || !notesBox) {
      throw new Error("Topbar is not visible.");
    }

    // Same row as each other, and level with the title rather than under it.
    expect(Math.abs(searchBox.y - notesBox.y)).toBeLessThan(4);
    expect(searchBox.y).toBeLessThan(titleBox.y + titleBox.height);
    // And clear of the title, so nothing overlaps at the narrowest width.
    expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(searchBox.x);
  });
}

test("authenticated layouts do not overflow the mobile viewport", async ({
  page
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "authenticated-mobile",
    "Mobile-only layout assertion."
  );
  await page.goto("/dashboard/events");

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));

  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
  await expect(
    page.getByRole("button", { name: /Open navigation|Expand sidebar/ })
  ).toBeVisible();
});

test("booking creation is not exposed on the kitchen or event manager pages", async ({
  page
}) => {
  for (const route of ["/dashboard/kitchen", "/dashboard/events"]) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(route.replaceAll("/", "\\/")));
    await expect(
      page.getByRole("button", { name: "Create new booking" })
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "New booking" })).toHaveCount(
      0
    );
  }
});

test("event manager keeps today notes available without exposing booking creation", async ({
  page
}) => {
  await page.goto("/dashboard/events");

  await expect(page).toHaveURL(/\/dashboard\/events/);

  await expect(
    page.getByRole("heading", { name: "Event Manager", exact: true })
  ).toBeVisible({ timeout: 45_000 });

  await expect(page.getByRole("button", { name: "New booking" })).toHaveCount(
    0
  );

  await page.getByRole("button", { name: "Open today notes" }).click();

  await expect(page.getByRole("dialog", { name: "Today notes" })).toBeVisible();
});

// The smoke list is the pages the MVP ships. /dashboard and the four hidden
// modules are gone from it because they no longer render at all - they redirect,
// which mvp-hidden-routes.authenticated.spec.ts asserts directly instead.
const dashboardPages = [
  "/dashboard/kitchen",
  "/dashboard/calendar",
  "/dashboard/events",
  "/dashboard/menu",
  "/dashboard/staff",
  "/dashboard/vendors",
  "/dashboard/settings"
];

for (const route of dashboardPages) {
  test(`dashboard page renders without a fatal error: ${route}`, async ({
    page
  }) => {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(route.replaceAll("/", "\\/")));
    await expect(page.locator("body")).not.toContainText("Application error");
    await expect(page.locator("body")).not.toContainText(
      "Internal Server Error"
    );
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
  });
}
