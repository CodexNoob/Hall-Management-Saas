import { expect, test } from "@playwright/test";

test("renders the public landing page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Everything You Need to Manage Your Simcha Hall/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Everything You Need to Run Your Venue/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Simple, Transparent Pricing/i })).toBeVisible();
});
