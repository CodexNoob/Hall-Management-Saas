import { expect, test } from "@playwright/test";
import { waitForHydration } from "./hydration";

/**
 * Registration ends at the confirmation step, not at the dashboard.
 *
 * The beta page is where the applicant lands LATER - after confirming the
 * address and being refused by the gate - which is why these exercise it
 * directly rather than by walking there.
 *
 * Supabase is stubbed rather than exercised: a real registration would send
 * mail and leave an account behind on every run. What these cover is our half -
 * where the browser is sent and what the applicant is told when it arrives. The
 * refusal itself is deterministic in tests/unit/auth-session-route.test.ts.
 */

const PENDING_MESSAGE =
  "Thank you for your interest in Event Core. Your beta access request has been received. We'll reach out when your account is approved.";

test.beforeEach(async ({}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile",
    "The public sign-up journey is covered in desktop Chromium."
  );
});

/** Supabase with email confirmation on: a user, and no session. */
async function stubSignUp(page: import("@playwright/test").Page) {
  await page.route("**/auth/v1/signup*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "00000000-0000-4000-8000-000000000000",
        email: "e2e-beta@example.com",
        session: null,
        user: null
      })
    });
  });
}

test("the beta-pending page states the outcome and creates nothing", async ({
  page
}) => {
  // No `waitForHydration`: that helper waits for React to claim a `form`, and
  // this page has none. There is nothing to submit, which is rather the point.
  await page.goto("/beta-pending");

  await expect(
    page.getByRole("heading", { name: "Beta access requested" })
  ).toBeVisible();
  await expect(page.getByRole("status")).toHaveText(PENDING_MESSAGE);
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/login"
  );
});

test("a rejected applicant is not told to wait for a reply", async ({
  page
}) => {
  await page.goto("/beta-pending?status=rejected");

  await expect(page.getByRole("heading", { name: "Not approved" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("has not been approved");
  await expect(page.getByRole("status")).not.toContainText("We'll reach out");
});

test("an unrecognised status falls back to the pending copy", async ({
  page
}) => {
  // The query string is attacker-supplied - anyone can type one - so it is
  // mapped through a fixed table, and anything else renders the variant that
  // claims less.
  await page.goto("/beta-pending?status=approved");

  await expect(page.getByRole("status")).toHaveText(PENDING_MESSAGE);
});

test("registering asks for confirmation and queues nothing yet", async ({
  page
}) => {
  const writes: string[] = [];

  await stubSignUp(page);
  // Every write of ours the form attempts. The queue must not be written, and
  // the approval inbox must not be mailed, until the address is confirmed.
  // Scoped to non-GET so an unrelated read on page load cannot fail this.
  await page.route("**/api/**", async (route) => {
    if (route.request().method() !== "GET") {
      writes.push(new URL(route.request().url()).pathname);
    }
    await route.continue();
  });

  await page.goto("/signup");
  await waitForHydration(page);
  await page.getByLabel("Email Address").fill("e2e-beta@example.com");
  await page.getByLabel("Password", { exact: true }).fill("Testing12345");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();

  await expect(page).toHaveURL(/\/verify-email\?email=e2e-beta%40example\.com$/);
  await expect(
    page.getByRole("heading", { name: "Confirm your email" })
  ).toBeVisible();
  expect(writes).toEqual([]);
});

test("the sign-up page says access is reviewed rather than immediate", async ({
  page
}) => {
  await page.goto("/signup");
  await waitForHydration(page);

  await expect(
    page.getByRole("heading", { name: "Request beta access" })
  ).toBeVisible();
  // The old copy promised organization setup came next. It does not.
  await expect(page.getByText("Step 1 of 2")).toHaveCount(0);
});
