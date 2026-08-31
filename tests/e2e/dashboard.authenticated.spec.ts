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

// Every route here renders `DashboardTopbar` with at least one action button,
// which is what the assertion below measures. Kitchen was in this list until it
// stopped using that topbar: it now draws its own full-width `KitchenHeader` -
// an Open sidebar button, notifications and the date as its h1. Events left it
// for the opposite reason: its topbar carries neither a search box nor an
// action now that the event list owns the only search. Both still appear in the
// smoke list at the foot of this file, which opens them and checks they fit the
// viewport.
//
// The search box is no longer measured. Menu is the last route in this list and
// it passes `showSearch={false}` - its own library search is the one place the
// list is filtered from - so there is no topbar search left to sit beside. The
// action is named by its aria-label because that is all there is at 360px: the
// button's "Bulk upload" text is `hidden lg:inline`.
for (const [label, route, action] of [
  ["Menu", "/dashboard/menu", "Bulk upload menu items"]
] as Array<[string, string, string]>) {
  test(`${label} keeps the topbar actions on the title line on a phone`, async ({
    page
  }) => {
    // The regression this guards: a page passing a custom action button that
    // keeps its label, border and padding at every width. The actions row is
    // then too wide to sit beside the title, wraps onto a second line, and
    // costs 36px of vertical space on every phone. Reported on the overview,
    // which covers itself in dashboard-overview.authenticated.spec.ts now.
    await page.setViewportSize({ width: 360, height: 727 });
    await page.goto(route);

    // Scoped to the topbar: a page may carry a second h1 of its own.
    const topbar = page.locator(".dashboard-topbar-content");
    const title = topbar.getByRole("heading", { level: 1 });
    const actionButton = topbar.getByRole("button", { name: action });
    await expect(title).toBeVisible();
    await expect(actionButton).toBeVisible();

    const [titleBox, actionBox] = await Promise.all([
      title.boundingBox(),
      actionButton.boundingBox()
    ]);
    if (!titleBox || !actionBox) {
      throw new Error("Topbar is not visible.");
    }

    // Level with the title rather than under it.
    expect(actionBox.y).toBeLessThan(titleBox.y + titleBox.height);
    // And clear of the title, so nothing overlaps at the narrowest width.
    expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(actionBox.x);
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

test("the Kitchen sidebar overlays rather than squeezing the mobile board", async ({
  page
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "authenticated-mobile",
    "Mobile-only Kitchen drawer assertion."
  );

  await page.goto("/dashboard/kitchen");
  const sidebar = page.locator("aside.app-sidebar");
  await page.getByRole("button", { name: "Open sidebar" }).click();
  await expect(sidebar).toHaveClass(/translate-x-0/);

  const dimensions = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>(".dashboard-shell-main");
    return {
      content: document.documentElement.scrollWidth,
      paddingLeft: shell ? getComputedStyle(shell).paddingLeft : null,
      viewport: document.documentElement.clientWidth
    };
  });
  expect(dimensions.paddingLeft).toBe("0px");
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
  await expect(
    page.getByRole("button", { name: "Close navigation" })
  ).toBeVisible();
  await page.mouse.click(dimensions.viewport - 4, 100);
  await expect(sidebar).toHaveClass(/-translate-x-full/);
});

test("the kitchen board takes the whole screen until its own button asks for the sidebar", async ({
  page
}, testInfo) => {
  test.skip(
    testInfo.project.name === "authenticated-mobile",
    "Reaching the sidebar's Kitchen entry on a phone means opening the drawer first; the gutter this guards is a desktop rule."
  );

  await page.goto("/dashboard/events");
  const sidebar = page.locator("aside.app-sidebar");
  await expect(sidebar).toBeAttached();

  // Arrived at client-side on purpose. The sidebar writes
  // `html[data-dashboard-sidebar]` and that flag outlives its unmount, so this
  // is the path where globals.css would go on padding the shell by a sidebar
  // width and leave an empty gutter beside a board that owns the screen.
  await page.getByRole("button", { name: "Kitchen", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/kitchen/);

  await expect(sidebar).toBeAttached();
  await expect(sidebar).toHaveClass(/-translate-x-full/);
  await expect(page.locator(".dashboard-topbar-brand")).toHaveCount(0);
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const shell = document.querySelector(".dashboard-shell-main");

        return shell ? getComputedStyle(shell).paddingLeft : null;
      })
    )
    .toBe("0px");

  // The sidebar slides into its normal left-hand position while the Kitchen
  // board moves by exactly the same width. The button that opened it therefore
  // remains visible immediately to its right instead of being covered. Mimic
  // the collapsed preference left by selecting an event first: opening this
  // full drawer must replace that preference with expanded navigation.
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent("dashboard-sidebar-toggle", {
        detail: { collapsed: true }
      })
    );
  });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.dataset.dashboardSidebar)
    )
    .toBe("collapsed");
  const openButton = page.getByRole("button", { name: "Open sidebar" });
  await openButton.click();
  await expect(sidebar).toHaveClass(/translate-x-0/);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.dataset.dashboardSidebar)
    )
    .toBe("expanded");
  await expect(page.locator(".dashboard-topbar-brand")).toHaveCount(0);
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const shell = document.querySelector(".dashboard-shell-main");
        return shell ? getComputedStyle(shell).paddingLeft : null;
      })
    )
    .toBe("256px");

  // One control, two names: opening the sidebar renames it to Close sidebar,
  // which is the whole point of it - Kitchen carries no duplicate X inside the
  // panel, so this button has to be the way back out. Measured under the name it
  // has now, because the locator that opened it no longer matches anything.
  const closeButton = page.getByRole("button", { name: "Close sidebar" });
  const [sidebarBox, openBox] = await Promise.all([
    sidebar.boundingBox(),
    closeButton.boundingBox()
  ]);
  if (!sidebarBox || !openBox) {
    throw new Error("The sidebar and its own toggle must both be drawn.");
  }
  expect(openBox.x).toBeGreaterThanOrEqual(sidebarBox.x + sidebarBox.width - 1);

  await expect(
    sidebar.getByRole("button", { name: "Close navigation" })
  ).toHaveCount(0);
  await closeButton.click();
  await expect(sidebar).toHaveClass(/-translate-x-full/);
  await expect(openButton).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const shell = document.querySelector(".dashboard-shell-main");
        return shell ? getComputedStyle(shell).paddingLeft : null;
      })
    )
    .toBe("0px");

  // Reopen it and leave Kitchen. Desktop navigation keeps this same panel in
  // place instead of closing it and making the destination slide it back in.
  await openButton.click();
  await expect(sidebar).toHaveClass(/translate-x-0/);
  await sidebar.getByRole("button", { name: "Calendar", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/calendar/);
  await expect(sidebar).toHaveClass(/translate-x-0/);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.dataset.dashboardSidebar)
    )
    .toBe("expanded");
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

test("event manager topbar carries the title only, leaving search to the event list", async ({
  page
}) => {
  await page.goto("/dashboard/events");

  await expect(page).toHaveURL(/\/dashboard\/events/);

  await expect(
    page.getByRole("heading", { name: "Event Manager", exact: true })
  ).toBeVisible({ timeout: 45_000 });

  const topbar = page.locator(".dashboard-topbar-content");
  await expect(topbar.getByRole("button", { name: "New booking" })).toHaveCount(
    0
  );
  await expect(
    topbar.getByRole("button", { name: "Open today notes" })
  ).toHaveCount(0);
  await expect(topbar.getByRole("searchbox")).toHaveCount(0);

  // The one search this page keeps, which filters the list rather than jumping
  // between modules.
  await expect(
    page.getByPlaceholder("Search client, hall, type")
  ).toBeVisible();
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
