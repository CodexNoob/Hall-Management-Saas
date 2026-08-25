import { expect, test, type Page } from "@playwright/test";

import type { PermissionKey } from "@/lib/authz/catalog";
import { starterRoles } from "@/lib/authz/starter-roles";

// Exercises the home page's role gating through the real stack: app/dashboard
// layout -> DashboardAuthGuard -> DashboardShell -> DashboardOverview, against
// live /api/dashboard responses.
//
// There is no per-role E2E account (tests/e2e/auth.setup.ts logs in through the
// real UI with the single read-only account, and roles are not seeded), so the
// role is forced by patching the cached sync blob that lib/auth/client.ts reads.
// That means this covers the CLIENT gating layer only - which is exactly what
// lib/auth/dashboard-routes.ts's own header says that layer is. The server keeps
// answering with the real account's permissions, so section contents may be
// empty for a role the real account cannot load data for; these tests assert
// which sections render, never what is inside them.
//
// Gating follows the READ keys and canAccessDashboardRoute. The per-surface
// expectations are pinned in tests/unit/dashboard-overview-gating,
// dashboard-side-panels and dashboard-module-links.

const AUTH_SESSION_CACHE_KEY = "hms.authSession";
const AUTH_SESSION_FETCHED_AT_KEY = "hms.authSession.fetchedAt";

const sectionHeadings = [
  "Total Events",
  "Booked Events",
  "Income timeline",
  "Operating schedule",
  "Events timeline",
  "Attention needed",
  "Quick actions"
] as const;

const quickActionLabels = [
  "Kitchen board",
  "Open billing",
  "Dining sheets"
] as const;

const moduleTileDescriptions = {
  Kitchen: "Menu production, quantities, workers, and completion status.",
  Calendar: "Month view with room availability and closed-date rules.",
  Events: "Full event file: client, menu, dining, staff, vendors, files.",
  Billing: "Retainers, invoices, payment links, and balances due."
} as const;

type Expected = {
  role: string;
  sections: Array<(typeof sectionHeadings)[number]>;
  actions: Array<(typeof quickActionLabels)[number]>;
  tiles: Array<keyof typeof moduleTileDescriptions>;
};

const expectations: Expected[] = [
  {
    role: "administrator",
    sections: [...sectionHeadings],
    actions: [...quickActionLabels],
    tiles: ["Kitchen", "Calendar", "Events", "Billing"]
  },
  {
    role: "event-manager",
    sections: [...sectionHeadings],
    actions: [...quickActionLabels],
    tiles: ["Kitchen", "Calendar", "Events", "Billing"]
  },
  {
    // No canViewPaymentInfo, so no income timeline and no attention panel;
    // /dashboard/events is still reachable through canViewCalendar.
    role: "kitchen-staff",
    sections: [
      "Total Events",
      "Booked Events",
      "Operating schedule",
      "Events timeline",
      "Quick actions"
    ],
    actions: ["Kitchen board", "Dining sheets"],
    tiles: ["Kitchen", "Calendar", "Events"]
  },
  {
    // Read-only: sees the operational surfaces it can open, no payment data,
    // no booking action.
    role: "viewer",
    sections: [
      "Total Events",
      "Booked Events",
      "Operating schedule",
      "Events timeline",
      "Quick actions"
    ],
    actions: ["Kitchen board", "Dining sheets"],
    tiles: ["Kitchen", "Calendar", "Events"]
  }
];

// Rewrites the cached sync blob so the app runs as `role`. Leaves the cache
// subject untouched and refreshes fetchedAt, so fetchAuthSession takes its
// cache-fresh branch and never calls /api/auth/session; the route patch below
// is a fallback for the case where it does.
function permissionsFor(role: string): PermissionKey[] {
  const starter = starterRoles.find((candidate) => candidate.key === role);
  if (!starter) throw new Error(`No starter role keyed "${role}".`);
  return [...starter.permissions];
}

async function forceRole(page: Page, role: string) {
  await page.goto("/dashboard");

  const blob = await page.evaluate(
    (key) =>
      window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key),
    AUTH_SESSION_CACHE_KEY
  );

  expect(
    blob,
    "no cached sync blob - the storage state may be stale, re-run the setup project"
  ).toBeTruthy();

  const authSession = JSON.parse(blob as string);
  // Only the KEYS are swapped. subscriptionStatus and the trial fields are
  // preserved, otherwise UpgradePlanDialog's forceSelection covers the page.
  const patched = {
    ...authSession,
    permissions: permissionsFor(role)
  };

  await page.addInitScript(
    ({ cacheKey, timeKey, payload }) => {
      const serialized = JSON.stringify(payload);
      window.localStorage.setItem(cacheKey, serialized);
      window.sessionStorage.setItem(cacheKey, serialized);
      window.localStorage.setItem(timeKey, String(Date.now()));
    },
    {
      cacheKey: AUTH_SESSION_CACHE_KEY,
      timeKey: AUTH_SESSION_FETCHED_AT_KEY,
      payload: patched
    }
  );

  await page.route("**/api/auth/session", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({
      response,
      json: { ...body, permissions: permissionsFor(role) }
    });
  });

  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { exact: true, name: "Dashboard" })
  ).toBeVisible();

  // Fails loudly instead of silently passing if the app ever re-syncs over the
  // fake (e.g. fetchAuthSession gaining force: true), which would quietly test
  // the real account's role instead of `role`.
  const effectivePermissions = await page.evaluate((key) => {
    const raw =
      window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw).permissions ?? null;
  }, AUTH_SESSION_CACHE_KEY);

  expect(
    effectivePermissions,
    "the forced key set was overwritten, so this assertion would have tested the real account"
  ).toEqual(permissionsFor(role));
}

test.beforeEach(async ({}, testInfo) => {
  test.skip(
    !process.env.E2E_READONLY_EMAIL || !process.env.E2E_READONLY_PASSWORD,
    "Read-only E2E credentials are not set."
  );
  testInfo.annotations.push({
    type: "account",
    description:
      "Uses the read-only E2E account with a client-side forced role; no data is mutated."
  });
});

for (const { role, sections, actions, tiles } of expectations) {
  test(`home page renders the ${role} section set`, async ({ page }) => {
    await forceRole(page, role);

    for (const heading of sectionHeadings) {
      const locator = page.getByRole("heading", { exact: true, name: heading });
      if (sections.includes(heading)) {
        await expect(locator, `${role} should see "${heading}"`).toBeVisible();
      } else {
        await expect(
          locator,
          `${role} should not see "${heading}"`
        ).toHaveCount(0);
      }
    }

    for (const label of quickActionLabels) {
      // exact: true matters - the Billing module tile's accessible name is its
      // whole card text and would substring-match "Open billing" otherwise.
      const locator = page.getByRole("button", { exact: true, name: label });
      if (actions.includes(label)) {
        await expect(locator, `${role} should see "${label}"`).toBeVisible();
      } else {
        await expect(locator, `${role} should not see "${label}"`).toHaveCount(0);
      }
    }

    const moduleShortcuts = page.getByRole("region", {
      name: "Module shortcuts"
    });
    for (const [title, description] of Object.entries(moduleTileDescriptions)) {
      const locator = moduleShortcuts.getByText(description, { exact: true });
      if (tiles.includes(title as keyof typeof moduleTileDescriptions)) {
        await expect(
          locator,
          `${role} should see the ${title} tile`
        ).toBeVisible();
      } else {
        await expect(
          locator,
          `${role} should not see the ${title} tile`
        ).toHaveCount(0);
      }
    }
  });
}

test("a role with no dashboard access at all gets the restricted panel, not a partial page", async ({
  page
}) => {
  await page.goto("/dashboard");

  const blob = await page.evaluate(
    (key) =>
      window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key),
    AUTH_SESSION_CACHE_KEY
  );
  expect(blob).toBeTruthy();

  const authSession = JSON.parse(blob as string);
  // A principal holding nothing the dashboard needs. `settings.read` is kept so
  // the session is still well-formed and the layout renders - the point is that
  // neither key the overview is gated on is present.
  const patched = {
    ...authSession,
    permissions: ["settings.read"]
  };

  await page.addInitScript(
    ({ cacheKey, timeKey, payload }) => {
      const serialized = JSON.stringify(payload);
      window.localStorage.setItem(cacheKey, serialized);
      window.sessionStorage.setItem(cacheKey, serialized);
      window.localStorage.setItem(timeKey, String(Date.now()));
    },
    {
      cacheKey: AUTH_SESSION_CACHE_KEY,
      timeKey: AUTH_SESSION_FETCHED_AT_KEY,
      payload: patched
    }
  );

  await page.goto("/dashboard");

  // /dashboard requires canViewCalendar or canViewEventManager, so the layout
  // guard replaces the page rather than rendering a stripped-down overview.
  // AsyncState renders emptyTitle as a <p>, not a heading.
  await expect(page.getByText("Access restricted")).toBeVisible();
  await expect(
    page.getByRole("heading", { exact: true, name: "Operating schedule" })
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { exact: true, name: "Total Events" })
  ).toHaveCount(0);
});
