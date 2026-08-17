import { expect, test } from "@playwright/test";

/**
 * The public client portal is unauthenticated and keyed only by the event id,
 * so the route guard is the whole perimeter. These cases need no seeded data:
 * they assert that anything which is not a real, live event is a 404 rather
 * than a partially rendered page.
 */

test("rejects a malformed event id", async ({ page }) => {
  const response = await page.goto("/client/not-a-uuid");

  expect(response?.status()).toBe(404);
});

test("rejects a well-formed event id that does not exist", async ({ page }) => {
  const response = await page.goto(
    "/client/decafbad-dead-4bee-8fed-0123456789ab"
  );

  expect(response?.status()).toBe(404);
});
