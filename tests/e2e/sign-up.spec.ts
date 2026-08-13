import { expect, test } from "@playwright/test";

// Confirming a real email needs a real inbox, so these cover the two public
// screens of the flow. The confirm -> /dashboard/new leg is verified manually.
test("sign-up asks only for an email and a password", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile",
    "The public sign-up journey is covered in desktop Chromium."
  );

  await page.goto("/start-trial");

  await expect(page.getByLabel("Email Address")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();

  // The organization name, owner name, and phone moved to /dashboard/new, and
  // the confirm-password field is gone.
  await expect(page.getByLabel("Full Name")).toHaveCount(0);
  await expect(page.getByLabel("Company or Venue Name")).toHaveCount(0);
  await expect(page.getByLabel("Phone Number")).toHaveCount(0);
  await expect(page.getByLabel("Confirm Password")).toHaveCount(0);
});

test("sign-up rejects a password that cannot work", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile",
    "The public sign-up journey is covered in desktop Chromium."
  );

  await page.goto("/start-trial");
  await page.getByLabel("Email Address").fill("e2e-signup@example.com");
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Create account", exact: true }).click();

  // Client-side, so this must not have reached Supabase.
  await expect(page.getByRole("alert").first()).toContainText(
    "Use at least 8 characters"
  );
  await expect(page).toHaveURL(/\/start-trial/);
});

test("the confirm-email page names the address and offers a resend", async ({
  page
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile",
    "The public sign-up journey is covered in desktop Chromium."
  );

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
