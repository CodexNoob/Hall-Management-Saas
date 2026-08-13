import fs from "node:fs/promises";
import path from "node:path";
import { expect, test as setup } from "@playwright/test";

const authDirectory = path.resolve("playwright/.auth");

async function authenticate(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
  stateFile: string
) {
  await page.addInitScript(() => {
    window.localStorage.removeItem("hms.syncedUser");
    window.localStorage.removeItem("hms.syncedUser.subject");
    window.localStorage.removeItem("hms.syncedUser.syncedAt");
    window.sessionStorage.removeItem("hms.syncedUser");
  });

  await page.goto("/");
  await expect(page.getByRole("status", { name: "Loading website" })).toBeHidden();
  await page.locator("[data-login-modal]:visible").click();
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Remember me").check();
  await page
    .getByRole("dialog", { name: "Employee Login", exact: true })
    .getByRole("button", { name: "Login", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  await page.context().storageState({ path: stateFile });
}

setup.beforeAll(async () => {
  await fs.mkdir(authDirectory, { recursive: true });
  const emptyState = JSON.stringify({ cookies: [], origins: [] });
  await Promise.all([
    fs.writeFile(path.join(authDirectory, "readonly.json"), emptyState),
    fs.writeFile(path.join(authDirectory, "mutation.json"), emptyState)
  ]);
});

setup("create read-only authenticated state", async ({ page }) => {
  const email = process.env.E2E_READONLY_EMAIL;
  const password = process.env.E2E_READONLY_PASSWORD;
  setup.skip(!email || !password, "Read-only E2E credentials are not set.");

  await authenticate(
    page,
    email!,
    password!,
    path.join(authDirectory, "readonly.json")
  );
});

setup("create mutation-account authenticated state", async ({ page }) => {
  const email = process.env.E2E_MUTATION_EMAIL;
  const password = process.env.E2E_MUTATION_PASSWORD;
  setup.skip(!email || !password, "Mutation E2E credentials are not set.");

  await authenticate(
    page,
    email!,
    password!,
    path.join(authDirectory, "mutation.json")
  );
});
