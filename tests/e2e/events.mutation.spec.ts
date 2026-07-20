import { expect, test } from "@playwright/test";

test.beforeEach(async () => {
  test.skip(
    !process.env.E2E_MUTATION_EMAIL ||
      !process.env.E2E_MUTATION_PASSWORD,
    "Mutation E2E credentials are not set."
  );
});

test("creates an isolated event from the Calendar Book date form", async ({
  page
}) => {
  const clientName = `E2E Booking ${Date.now()}`;

  await page.goto("/dashboard/calendar");
  await page.getByRole("button", { name: "Select July 22, 2026" }).click();
  await page.getByRole("button", { name: "Book date" }).click();

  const dialog = page.getByRole("dialog", { name: "New booking" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Date")).toHaveValue("2026-07-22");
  await dialog.getByLabel("Client name").fill(clientName);
  await dialog.getByLabel("Phone").fill("555-0199");
  await dialog.getByRole("button", { name: "Save booking" }).click();

  await expect(dialog).toBeHidden({ timeout: 20_000 });
  await expect(page.getByText(clientName, { exact: true })).toBeVisible();
});
