import { expect, test } from "@playwright/test";

// The one behaviour jsdom cannot fully model: how a real browser treats a
// numeric input. These fields used to be type="number", where the browser runs
// its value-sanitization algorithm and hands JavaScript "" for anything it
// cannot parse - so "abc" and a deliberately cleared box were indistinguishable
// and `Number("")` turned both into a silent 0.
//
// This used to run against the hall map's object inspector, where the defect was
// originally reported. That page is out of the MVP (lib/ui/mvp-features), so the
// vehicle moved to Calendar -> Settings -> "Events allowed per day". It is the
// same component - LiveNumberField from components/ui/number-field - driven by
// the same countSchema, so nothing about what is under test changed. The
// component is still shipped on this page, which is the reason this file was
// retargeted rather than parked with the hall map: parking it would have left a
// live field with no browser-level coverage at all.

// Next.js injects a #__next-route-announcer__ div with role="alert", so
// assertions target the field's own error paragraph instead.
const fieldError = 'p[role="alert"]';

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(
    !process.env.E2E_READONLY_EMAIL || !process.env.E2E_READONLY_PASSWORD,
    "Read-only E2E credentials are not set."
  );
  // Component behaviour, not layout: the same code path runs at every width, so
  // a second project would double the authenticated traffic for no new signal.
  test.skip(
    testInfo.project.name.includes("mobile"),
    "Viewport-independent behaviour; one project is enough."
  );

  await page.goto("/dashboard/calendar");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Calendar Settings", exact: true })
  ).toBeVisible();
  await expect(page.getByLabel("Events allowed per day")).toBeVisible();
});

test("a numeric field keeps the text the user typed instead of discarding it", async ({
  page
}) => {
  const limit = page.getByLabel("Events allowed per day");
  await limit.fill("12abc");

  // A type="number" input would have reported "" here.
  await expect(limit).toHaveValue("12abc");
  await expect(page.locator(fieldError)).toContainText("Enter a number.");
});

test("clearing a numeric field reports it rather than writing zero", async ({
  page
}) => {
  const limit = page.getByLabel("Events allowed per day");
  // Read rather than hardcoded: the saved limit is whatever the account holds.
  const savedLimit = await limit.inputValue();

  await limit.fill("");
  await expect(page.locator(fieldError)).toContainText("Enter a number.");

  // Leaving the field is where the original defect landed its 0. Nothing parsed,
  // so nothing was committed and the box rolls back to what was there before.
  await limit.blur();
  await expect(limit).toHaveValue(savedLimit);
  await expect(limit).not.toHaveValue("0");
});

test("a value outside the bound the server enforces is refused", async ({
  page
}) => {
  await page.getByLabel("Events allowed per day").fill("0");

  await expect(page.locator(fieldError)).toContainText(
    "Events allowed per day must be at least 1."
  );
});

test("a fractional count is refused", async ({ page }) => {
  await page.getByLabel("Events allowed per day").fill("1.5");

  await expect(page.locator(fieldError)).toContainText(
    "Events allowed per day must be a whole number."
  );
});

test("a valid value clears the error and is accepted", async ({ page }) => {
  const limit = page.getByLabel("Events allowed per day");

  await limit.fill("");
  await expect(page.locator(fieldError)).toBeVisible();

  await limit.fill("5");
  await expect(page.locator(fieldError)).toHaveCount(0);
  await expect(limit).toHaveValue("5");
});
