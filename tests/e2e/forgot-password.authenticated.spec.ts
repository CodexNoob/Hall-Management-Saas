import { expect, test } from "@playwright/test";

/**
 * /forgot-password is one of the three ANONYMOUS_ONLY_PATHS in
 * lib/supabase/proxy.ts. Dropping it from that set is a one-line change with no
 * failing unit test attached, and the result is a signed-in user staring at a
 * reset form for an account they are already using.
 *
 * The mirror case - /set-password staying reachable WITH a session - is
 * deliberately not tested here: adding it to that set would break recovery for
 * everyone, and the comment in proxy.ts spells out why.
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

test("a signed-in visitor is sent to the dashboard instead of the reset form", async ({
  page
}) => {
  await page.goto("/forgot-password");

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByLabel("Email Address")).toHaveCount(0);
});

test("a signed-in visitor keeps their return path off the reset form", async ({
  page
}) => {
  // The `?next=` shape proxy.ts itself hands out. It is run through
  // getSafeDashboardReturnPath, so this doubles as the open-redirect guard.
  await page.goto("/forgot-password?next=%2Fdashboard%2Fbilling");
  await expect(page).toHaveURL(/\/dashboard\/billing/);

  await page.goto("/forgot-password?next=https%3A%2F%2Fevil.example.com");
  await expect(page).toHaveURL(/127\.0\.0\.1:3000\/dashboard$/);
});
