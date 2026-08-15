import { expect, test } from "@playwright/test";
import { waitForHydration } from "./hydration";

// Sign-up failures render twice - inline beside the form and as a toast - so
// assertions are scoped to the form and the toast is checked by its title.
const inlineError = 'form p[role="alert"]';

test.beforeEach(async ({}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile",
    "The public sign-up journey is covered in desktop Chromium."
  );
});

// Confirming a real email needs a real inbox, so these cover the two public
// screens of the flow. The confirm -> /dashboard/new leg is verified manually.
test("sign-up asks only for an email and a password", async ({ page }) => {
  await page.goto("/start-trial");
  await waitForHydration(page);

  await expect(page.getByLabel("Email Address")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();

  // The organization name, owner name, and phone moved to /dashboard/new, and
  // the confirm-password field is gone.
  await expect(page.getByLabel("Full Name")).toHaveCount(0);
  await expect(page.getByLabel("Company or Venue Name")).toHaveCount(0);
  await expect(page.getByLabel("Phone Number")).toHaveCount(0);
  await expect(page.getByLabel("Confirm Password")).toHaveCount(0);
});

test("sign-up asks for an email before it checks anything else", async ({
  page
}) => {
  await page.goto("/start-trial");
  await waitForHydration(page);
  await page.getByLabel("Password", { exact: true }).fill("Testing12345");
  await page.getByRole("button", { name: "Create account", exact: true }).click();

  await expect(page.locator(inlineError)).toHaveText(
    "Please enter your email address."
  );
  await expect(page.getByText("Sign-up failed")).toBeVisible();
  await expect(page).toHaveURL(/\/start-trial/);
});

const passwordRules = [
  { password: "short", expected: "Use at least 8 characters." },
  { password: "passwordonly", expected: "Include at least one number." },
  { password: "12345678", expected: "Include at least one letter." }
];

for (const { password, expected } of passwordRules) {
  test(`sign-up rejects a password that ${expected.toLowerCase()}`, async ({
    page
  }) => {
    await page.goto("/start-trial");
    await waitForHydration(page);
    await page.getByLabel("Email Address").fill("e2e-signup@example.com");
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();

    // Client-side, so this must not have reached Supabase.
    await expect(page.locator(inlineError)).toHaveText(expected);
    await expect(page).toHaveURL(/\/start-trial/);
  });
}

test("sign-up rejects a password past the 72-character limit", async ({
  page
}) => {
  // Worth its own case: it proves no account is created and no confirmation
  // email is sent for a password bcrypt would silently truncate.
  await page.goto("/start-trial");
  await waitForHydration(page);
  await page.getByLabel("Email Address").fill("e2e-signup@example.com");
  await page
    .getByLabel("Password", { exact: true })
    .fill(`a1${"x".repeat(72)}`);
  await page.getByRole("button", { name: "Create account", exact: true }).click();

  await expect(page.locator(inlineError)).toHaveText(
    "Passwords cannot be longer than 72 characters."
  );
  await expect(page).toHaveURL(/\/start-trial/);
});

/**
 * See the SILENT-PASS TRAP note in authentication.spec.ts: page.route observes
 * only what the browser sends, so this holds precisely because sign-up runs
 * client-side.
 */
test("a malformed sign-up address never reaches Supabase", async ({
  page
}) => {
  let signUpRequests = 0;
  await page.route("**/auth/v1/signup*", async (route) => {
    signUpRequests += 1;
    await route.abort();
  });

  await page.goto("/start-trial");
  await waitForHydration(page);
  await page.getByLabel("Email Address").fill("owner@");
  await page.getByLabel("Password", { exact: true }).fill("Testing12345");

  // First layer: the browser's own type="email" guard refuses the click.
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  expect(signUpRequests).toBe(0);
  await expect(page.locator(inlineError)).toHaveCount(0);

  // Second layer: dispatching submit directly skips that guard, so this proves
  // the app validates the address itself rather than trusting the browser.
  await page.locator("form").first().dispatchEvent("submit");

  await expect(page.locator(inlineError)).toHaveText(
    "Please enter a valid email address."
  );
  expect(signUpRequests).toBe(0);
});

test("sign-up tells an existing owner to sign in instead", async ({ page }) => {
  // Stubbed on purpose: Supabase's anti-enumeration default returns a fake
  // success for an existing confirmed address, and a real attempt would send
  // mail. The mapping itself is covered deterministically in the unit tests.
  await page.route("**/auth/v1/signup*", async (route) => {
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        code: "user_already_exists",
        error_code: "user_already_exists",
        msg: "User already registered",
        message: "User already registered"
      })
    });
  });

  await page.goto("/start-trial");
  await waitForHydration(page);
  await page.getByLabel("Email Address").fill("e2e-signup@example.com");
  await page.getByLabel("Password", { exact: true }).fill("Testing12345");
  await page.getByRole("button", { name: "Create account", exact: true }).click();

  await expect(page.locator(inlineError)).toHaveText(
    "An account with this email already exists. Please sign in instead."
  );
  await expect(page).toHaveURL(/\/start-trial/);
});

test("the sign-up error clears when the password is corrected", async ({
  page
}) => {
  await page.goto("/start-trial");
  await waitForHydration(page);
  await page.getByLabel("Email Address").fill("e2e-signup@example.com");
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.locator(inlineError)).toBeVisible();

  await page.getByLabel("Password", { exact: true }).fill("Testing12345");

  await expect(page.locator(inlineError)).toHaveCount(0);
});

test("the free-trial modal enforces the same rules", async ({ page }) => {
  // Covers the auth-modal -> FreeTrialCard wiring, which nothing else tests.
  await page.goto("/?auth=trial");
  await expect(page.getByRole("status", { name: "Loading website" })).toBeHidden();
  await waitForHydration(page);

  const dialog = page.getByRole("dialog", { name: "Get started free" });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("Password", { exact: true }).fill("Testing12345");
  await dialog
    .getByRole("button", { name: "Create account", exact: true })
    .click();

  await expect(dialog.locator('p[role="alert"]')).toHaveText(
    "Please enter your email address."
  );
});

test("the confirm-email page names the address and offers a resend", async ({
  page
}) => {
  await page.goto("/verify-email?email=e2e-signup%40example.com");

  await expect(
    page.getByRole("heading", { name: "Confirm your email" })
  ).toBeVisible();
  await expect(page.getByText("e2e-signup@example.com")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Resend confirmation email" })
  ).toBeEnabled();
  await expect(page.getByRole("link", { name: "Go to sign in" })).toHaveAttribute(
    "href",
    "/login"
  );
});
