import { expect, test } from "@playwright/test";
import { waitForHydration } from "./hydration";

/**
 * The public half of password recovery: the /forgot-password form, the two
 * screens a dead recovery link lands on, and the links that stitch them to
 * /login.
 *
 * Sending a real reset email is not part of this. It would consume a GoTrue
 * rate-limit slot on every run and still tell us nothing without an inbox, so
 * the Supabase call is intercepted and the *request* is asserted instead - the
 * address it carries and the `redirect_to` that decides where the emailed link
 * comes back to. That is the part of the flow this repo actually owns.
 *
 * Unlike login and sign-up, the reset card's errors render inline only - there
 * is no toast and no role="alert" - so assertions here match on the copy.
 */

const RESET_ENDPOINT = "**/auth/v1/recover*";

test.beforeEach(async ({}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile",
    "The public password recovery journey is covered in desktop Chromium."
  );
});

test("the login page links to the password reset screen", async ({ page }) => {
  await page.goto("/login");
  await waitForHydration(page);
  await page.getByRole("link", { name: "Forgot password?" }).click();

  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(
    page.getByRole("heading", { name: "Forgot Password" })
  ).toBeVisible();
  await expect(page.getByLabel("Email Address")).toBeVisible();
});

test("an empty submission never reaches Supabase", async ({ page }) => {
  // Counting what the BROWSER sends. See the SILENT-PASS TRAP note in
  // authentication.spec.ts: this holds precisely because the reset request is
  // issued client-side by the Supabase browser client. Move it server-side and
  // the counter stays 0 whether or not the guard still works.
  let resetRequests = 0;
  await page.route(RESET_ENDPOINT, async (route) => {
    resetRequests += 1;
    await route.abort();
  });

  await page.goto("/forgot-password");
  await waitForHydration(page);
  await page.getByRole("button", { name: "Send Reset Link" }).click();

  await expect(page.getByText("Please enter your email address.")).toBeVisible();
  expect(resetRequests).toBe(0);
  await expect(page).toHaveURL(/\/forgot-password/);
});

test("a whitespace-only address is refused as empty", async ({ page }) => {
  // The card trims before it decides, so this must fail the same way an empty
  // field does rather than mailing a reset link to "   ".
  let resetRequests = 0;
  await page.route(RESET_ENDPOINT, async (route) => {
    resetRequests += 1;
    await route.abort();
  });

  await page.goto("/forgot-password");
  await waitForHydration(page);
  await page.getByLabel("Email Address").fill("   ");
  await page.locator("form").first().dispatchEvent("submit");

  await expect(page.getByText("Please enter your email address.")).toBeVisible();
  expect(resetRequests).toBe(0);
});

test("a malformed address is refused before Supabase is called", async ({
  page
}) => {
  let resetRequests = 0;
  await page.route(RESET_ENDPOINT, async (route) => {
    resetRequests += 1;
    await route.abort();
  });

  await page.goto("/forgot-password");
  await waitForHydration(page);
  await page.getByLabel("Email Address").fill("not-an-email");
  await page.getByRole("button", { name: "Send Reset Link" }).click();

  // The browser's own type="email" guard refuses the click, so nothing is sent
  // and the form stays put with no success message.
  expect(resetRequests).toBe(0);
  await expect(
    page.getByText("Reset link sent. Please check your email.")
  ).toHaveCount(0);
  await expect(page).toHaveURL(/\/forgot-password/);

  // NOTE: that browser guard is the ONLY layer here. Login and sign-up each
  // validate the address themselves as well, which is why their specs go on to
  // dispatch submit directly and still expect a refusal. This card does not, so
  // a scripted submit reaches Supabase. Add the second layer to the card and
  // this test should grow the same dispatchEvent("submit") leg.
});

test("a sent reset link is confirmed on the form", async ({ page }) => {
  // Stubbed rather than hitting real Supabase: deterministic, offline, sends no
  // mail, and costs no GoTrue rate-limit slot.
  await page.route(RESET_ENDPOINT, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}"
    });
  });

  await page.goto("/forgot-password");
  await waitForHydration(page);
  await page.getByLabel("Email Address").fill("e2e-reset@example.com");
  await page.getByRole("button", { name: "Send Reset Link" }).click();

  await expect(
    page.getByText("Reset link sent. Please check your email.")
  ).toBeVisible();
  // Re-enabled, not stuck in "Sending...": the address may have been a typo and
  // the user needs a second attempt without a reload.
  await expect(
    page.getByRole("button", { name: "Send Reset Link" })
  ).toBeEnabled();
  await expect(page).toHaveURL(/\/forgot-password/);
});

test("the reset email is pointed back at /auth/confirm", async ({ page }) => {
  // The highest-value assertion in this file. `redirect_to` is what decides
  // where the emailed link returns to, and /auth/confirm is the only route that
  // verifies a recovery token and forwards to /set-password. Point it anywhere
  // else and every reset email in production dead-ends - with no failing unit
  // test, because the value is computed in the browser at submit time.
  const resetRequest = page.waitForRequest(RESET_ENDPOINT);
  await page.route(RESET_ENDPOINT, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}"
    });
  });

  await page.goto("/forgot-password");
  await waitForHydration(page);
  // Padded on purpose: the address that goes out must be the trimmed one.
  await page.getByLabel("Email Address").fill("  e2e-reset@example.com  ");
  await page.getByRole("button", { name: "Send Reset Link" }).click();

  const request = await resetRequest;
  const origin = new URL(page.url()).origin;

  expect(new URL(request.url()).searchParams.get("redirect_to")).toBe(
    `${origin}/auth/confirm`
  );
  expect(request.postDataJSON()).toMatchObject({
    email: "e2e-reset@example.com"
  });
});

test("a Supabase refusal is reported on the form", async ({ page }) => {
  // GoTrue rate-limits reset requests per address, and that answer has to reach
  // the user - silently showing "Reset link sent" for a mail that was never
  // sent is the worst outcome this form has.
  await page.route(RESET_ENDPOINT, async (route) => {
    await route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({
        code: "over_email_send_rate_limit",
        error_code: "over_email_send_rate_limit",
        msg: "For security purposes, you can only request this after 47 seconds.",
        message:
          "For security purposes, you can only request this after 47 seconds."
      })
    });
  });

  await page.goto("/forgot-password");
  await waitForHydration(page);
  await page.getByLabel("Email Address").fill("e2e-reset@example.com");
  await page.getByRole("button", { name: "Send Reset Link" }).click();

  await expect(page.getByText(/you can only request this after/)).toBeVisible();
  await expect(
    page.getByText("Reset link sent. Please check your email.")
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Send Reset Link" })
  ).toBeEnabled();
});

test("the error clears when the address is corrected", async ({ page }) => {
  await page.goto("/forgot-password");
  await waitForHydration(page);
  await page.getByRole("button", { name: "Send Reset Link" }).click();
  await expect(page.getByText("Please enter your email address.")).toBeVisible();

  await page.getByLabel("Email Address").fill("e2e-reset@example.com");

  await expect(page.getByText("Please enter your email address.")).toHaveCount(
    0
  );
});

test("the reset form offers a way back to login", async ({ page }) => {
  await page.goto("/forgot-password");
  await waitForHydration(page);
  await page.getByRole("link", { name: "Back to Login" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Login", exact: true })).toBeVisible();
});

/**
 * The second half of the flow: what the emailed link lands on. A token that
 * verifies cannot be produced without an inbox, so these cover the failure
 * legs - the ones a user actually meets, since a recovery link is single-use
 * and mail scanners routinely spend it first.
 */

test("an incomplete recovery link lands on the auth error page", async ({
  page
}) => {
  // No token and no code, so /auth/confirm answers without calling Supabase.
  // This is also the health check for the email-template cutover: it must
  // redirect, never 404.
  await page.goto("/auth/confirm");

  await expect(page).toHaveURL(/\/auth\/auth-error/);
  await expect(
    page.getByRole("heading", { name: "Confirmation needs attention" })
  ).toBeVisible();
  await expect(page.getByText(/This link is incomplete/)).toBeVisible();

  await page.getByRole("link", { name: "Email me a new link" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
});

test("a recovery link of an unknown type is rejected without a Supabase call", async ({
  page
}) => {
  // `type` is attacker-controlled, so /auth/confirm narrows it against the
  // supported list before it ever reaches verifyOtp.
  await page.goto("/auth/confirm?token_hash=not-a-real-token&type=nonsense");

  await expect(page).toHaveURL(/\/auth\/auth-error/);
  await expect(
    page.getByText(/This link is not a kind we recognize/)
  ).toBeVisible();
});

test("an expired recovery link sends the user to sign in, not to a form", async ({
  page
}) => {
  // Supabase reports both an expired link and an already-spent one as
  // `otp_expired`, and reloading either re-sends the same dead token - so the
  // page must offer sign-in rather than "try again".
  await page.goto(
    "/auth/auth-error?error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"
  );

  await expect(page.getByText(/This link has expired or was already used/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to sign in" })).toHaveAttribute(
    "href",
    "/login"
  );
  await expect(
    page.getByRole("link", { name: "Email me a new link" })
  ).toHaveCount(0);
});

test("/set-password without a session offers a fresh reset link", async ({
  page
}) => {
  // Where a recovery link lands once its token has already been spent: the
  // browser client finds no session, so the card must show the dead-link panel
  // instead of a password form that cannot possibly save.
  //
  // No waitForHydration here - it waits for a `form`, and this branch renders
  // the panel in place of one.
  await page.goto("/set-password?flow=recovery");

  await expect(
    page.getByText("This link has expired or has already been used.")
  ).toBeVisible();
  await expect(page.getByLabel("New Password")).toHaveCount(0);

  await page.getByRole("link", { name: "Email me a new link" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
});
