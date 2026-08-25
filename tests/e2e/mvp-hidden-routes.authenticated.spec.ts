import { expect, test } from "@playwright/test";

import {
  MVP_LANDING_ROUTE,
  isHiddenDashboardRoute
} from "@/lib/ui/mvp-features";

/**
 * That the hidden modules are actually unreachable, not merely unadvertised.
 *
 * New coverage rather than a moved test: withdrawing the sidebar and search
 * entries is a thing unit tests can see, but a bookmark, a stale prefetch or a
 * typed url going to the landing page instead is only observable end to end. It
 * is also the half that is easy to get wrong - hiding the link while leaving the
 * page reachable looks identical in every other test.
 *
 * Deliberately NOT in playwright.config.ts's `mvpHiddenSpecs`: this file is
 * about the gate, so it runs while the gate is up. When a module ships, its
 * route leaves the list below and its own spec comes back.
 */

const hiddenRoutes = [
  "/dashboard",
  "/dashboard/billing",
  "/dashboard/dining-manager",
  "/dashboard/hall-room-map",
  "/dashboard/files",
  "/dashboard/vendors",
  "/dashboard/settings"
];

// Guards against this list and lib/ui/mvp-features drifting apart: shipping a
// module again means deleting its route above, and forgetting to leaves a test
// asserting a redirect that no longer happens.
test("every route asserted here is one the gate actually hides", () => {
  for (const route of hiddenRoutes) {
    expect(isHiddenDashboardRoute(route), route).toBe(true);
  }
});

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

for (const route of hiddenRoutes) {
  test(`${route} sends an authenticated visitor to the landing page`, async ({
    page
  }) => {
    await page.goto(route);

    // A client-side router.replace out of the dashboard layout, so it needs
    // longer than the 5s default under a parallel run.
    await expect(page).toHaveURL(
      new RegExp(`${MVP_LANDING_ROUTE.replaceAll("/", "\\/")}$`),
      { timeout: 30_000 }
    );
    // The page under the redirect must never paint: these modules fetch on
    // mount, and a frame of Billing's chrome would mean the route rendered.
    await expect(page.locator("body")).not.toContainText("Application error");
  });
}

test("the sidebar offers no way into a hidden module", async ({ page }) => {
  await page.goto(MVP_LANDING_ROUTE);

  const sidebar = page.locator("aside.app-sidebar");
  await expect(sidebar).toBeAttached();

  for (const label of [
    "Dashboard",
    "Billing",
    "Dining Manager",
    "Hall Room Map",
    "Files"
  ]) {
    await expect(
      sidebar.getByRole("button", { exact: true, name: label }),
      `the sidebar still offers ${label}`
    ).toHaveCount(0);
  }

  // Operations held nothing but the three hidden modules, so the whole section
  // goes rather than being left as a heading over an empty list.
  await expect(
    sidebar.getByRole("button", { exact: true, name: "Operations" })
  ).toHaveCount(0);

  // The MVP's own destinations are untouched - without this the test would pass
  // just as well against a sidebar that failed to render at all.
  for (const label of ["Kitchen", "Calendar", "Events", "Menu", "Staff"]) {
    await expect(
      sidebar.getByRole("button", { exact: true, name: label }),
      `the sidebar dropped ${label}, which the MVP ships`
    ).toHaveCount(1);
  }
});

// The event workspace's withdrawn tabs are asserted in
// tests/unit/event-workspace-tabs.test.ts instead. Reaching the tab strip here
// would mean selecting an event, which needs the stubbed /api/events fixture
// that event-manager.authenticated.spec.ts owns - and the thing under test is
// just which labels the filtered `tabs` export holds, which a unit test settles
// without a browser or an account that happens to have events in it.
