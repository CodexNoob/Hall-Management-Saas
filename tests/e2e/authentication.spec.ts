import { expect, test } from "@playwright/test";
import { waitForHydration } from "./hydration";

// Every failure now renders twice - inline beside the form and as a toast -
// so a bare getByText would match two nodes and trip strict mode. Scope
// assertions to the form, and assert the toast separately by its title.
const inlineError = 'form p[role="alert"]';

test.beforeEach(async ({}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile",
    "The public authentication journey is covered in desktop Chromium."
  );
});

test("the landing navbar routes to the login page", async ({ page }) => {
  // Login used to open a modal over the landing page; it is a route now, so
  // this covers the navbar wiring rather than an overlay.
  await page.goto("/");
  await expect(page.getByRole("status", { name: "Loading website" })).toBeHidden();
  await waitForHydration(page);
  await page.getByRole("link", { name: "Login", exact: true }).first().click();

  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("button", { name: "Login", exact: true }).click();

  await expect(page.locator(inlineError)).toHaveText(
    "Please enter your email address and password."
  );
  // The empty-field branch used to be the only failure that skipped the toast.
  await expect(page.getByText("Sign-in failed")).toBeVisible();
});

test("the standalone login page rejects an empty submission", async ({
  page
}) => {
  await page.goto("/login");
  await waitForHydration(page);
  await page.getByRole("button", { name: "Login", exact: true }).click();

  await expect(page.locator(inlineError)).toHaveText(
    "Please enter your email address and password."
  );
  await expect(page).toHaveURL(/\/login/);
});

test("login rejects a password-only submission", async ({ page }) => {
  await page.goto("/login");
  await waitForHydration(page);
  await page.getByLabel("Password", { exact: true }).fill("Secret123");
  await page.getByRole("button", { name: "Login", exact: true }).click();

  await expect(page.locator(inlineError)).toHaveText(
    "Please enter your email address."
  );
  await expect(page).toHaveURL(/\/login/);
});

/**
 * SILENT-PASS TRAP. The two `tokenRequests` assertions below count requests
 * intercepted by page.route, which sees only what the BROWSER sends. Sign-in
 * runs client-side today, so they are real.
 *
 * Move sign-in to a Server Action or a route handler and the GoTrue call leaves
 * from the server, page.route never sees it, and `tokenRequests` stays 0
 * whether or not the validation still works - the test passes by measuring the
 * wrong process. The cookie/proxy refactor deliberately kept sign-in in the
 * browser; if that changes, replace these with a server-side assertion rather
 * than trusting the green.
 *
 * Same applies to `**\/auth/v1/signup*` in sign-up.spec.ts.
 */
test("a malformed login address never reaches Supabase", async ({ page }) => {
  let tokenRequests = 0;
  await page.route("**/auth/v1/token*", async (route) => {
    tokenRequests += 1;
    await route.abort();
  });

  await page.goto("/login");
  await waitForHydration(page);
  await page.getByLabel("Email Address").fill("not-an-email");
  await page.getByLabel("Password", { exact: true }).fill("Secret123");

  // First layer: the browser's own type="email" guard refuses the click.
  await page.getByRole("button", { name: "Login", exact: true }).click();
  expect(tokenRequests).toBe(0);
  await expect(page.locator(inlineError)).toHaveCount(0);

  // Second layer: dispatching submit directly skips that guard, the way a
  // scripted submit or a non-conforming client would. The app must still
  // refuse rather than letting Supabase answer "Incorrect email or password".
  await page.locator("form").first().dispatchEvent("submit");

  await expect(page.locator(inlineError)).toHaveText(
    "Please enter a valid email address."
  );
  expect(tokenRequests).toBe(0);
  await expect(page).toHaveURL(/\/login/);
});

test("wrong credentials are reported without leaving the login page", async ({
  page
}) => {
  // Stubbed rather than hitting real Supabase: deterministic, offline, and it
  // does not consume a GoTrue rate-limit slot.
  await page.route("**/auth/v1/token*", async (route) => {
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        code: "invalid_credentials",
        error_code: "invalid_credentials",
        msg: "Invalid login credentials",
        message: "Invalid login credentials"
      })
    });
  });

  await page.goto("/login");
  await waitForHydration(page);
  await page.getByLabel("Email Address").fill("e2e-no-such-user@example.com");
  await page.getByLabel("Password", { exact: true }).fill("WrongPassword123");
  await page.getByRole("button", { name: "Login", exact: true }).click();

  await expect(page.locator(inlineError)).toHaveText(
    "Incorrect email or password. Please try again."
  );
  await expect(page.getByText("Sign-in failed")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("button", { name: "Login", exact: true })).toBeEnabled();
});

test("the login error clears when the email is corrected", async ({ page }) => {
  await page.goto("/login");
  await waitForHydration(page);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page.locator(inlineError)).toBeVisible();

  await page.getByLabel("Email Address").fill("owner@example.com");

  // Scoped to the form: the toast lives in a body-level portal and lingers.
  await expect(page.locator(inlineError)).toHaveCount(0);
});

test("the password can be revealed and hidden", async ({ page }) => {
  await page.goto("/login");
  await waitForHydration(page);
  const password = page.getByLabel("Password", { exact: true });
  await password.fill("Secret123");

  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(password).toHaveAttribute("type", "password");
});

test("a fresh authenticated session can log out", async ({ page }) => {
  const email = process.env.E2E_LOGOUT_EMAIL;
  const password = process.env.E2E_LOGOUT_PASSWORD;
  test.skip(!email || !password, "Dedicated logout credentials are not set.");

  await page.goto("/login");
  await waitForHydration(page);
  await page.getByLabel("Email Address").fill(email!);
  await page.getByLabel("Password", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

  await page
    .locator('aside.app-sidebar button[aria-haspopup="menu"][aria-expanded="false"]')
    .click();
  await page.getByRole("menuitem", { name: "Logout", exact: true }).click();
  await page
    .getByRole("alertdialog", { name: "Confirm logout" })
    .getByRole("button", { name: "Logout", exact: true })
    .click();

  // Both redirects below are client-side router.replace calls into the landing
  // route, which `next dev` re-renders in full before the URL commits. Under a
  // parallel run that outlasts the 5s default, the same way the login
  // navigation above does.
  await expect(page).toHaveURL("/", { timeout: 30_000 });
  await page.goto("/dashboard");
  // Protected dashboard routes bounce to the login page carrying the return
  // path (getDashboardLoginPath).
  await expect(page).toHaveURL(/\/login\?next=/, { timeout: 30_000 });
});
