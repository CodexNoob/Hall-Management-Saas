import { expect, test } from "@playwright/test";

test("login requires both email and password", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile",
    "The public authentication journey is covered in desktop Chromium."
  );
  await page.goto("/");
  await page.locator("[data-login-modal]").click();
  await page
    .getByRole("dialog", { name: "Login", exact: true })
    .getByRole("button", { name: "Login", exact: true })
    .click();

  await expect(
    page.getByText("Please enter your email address and password.")
  ).toBeVisible();
});

test("a fresh authenticated session can log out", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile",
    "Logout is verified once in desktop Chromium."
  );
  const email = process.env.E2E_LOGOUT_EMAIL;
  const password = process.env.E2E_LOGOUT_PASSWORD;
  test.skip(!email || !password, "Dedicated logout credentials are not set.");

  await page.goto("/");
  await page.locator("[data-login-modal]").click();
  await page.getByLabel("Email Address").fill(email!);
  await page.getByLabel("Password", { exact: true }).fill(password!);
  await page
    .getByRole("dialog", { name: "Login", exact: true })
    .getByRole("button", { name: "Login", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

  await page.getByTitle("Sign out").click();

  await expect(page).toHaveURL("/");
  await page.goto("/dashboard");
  await expect(page).toHaveURL("/");
});
