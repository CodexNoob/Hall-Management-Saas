import { expect, test } from "@playwright/test";

test("renders the public landing page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Manage Your Hall Bookings/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Everything You Need/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Simple, Transparent Pricing/i })).toBeVisible();
});
