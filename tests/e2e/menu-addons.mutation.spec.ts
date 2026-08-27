import { expect, test, type Page } from "@playwright/test";

/**
 * Covers the add-on picture through the UI it ships with: the New add-on
 * dialog's file field, the browser's direct upload to Supabase Storage, and the
 * thumbnail the card draws from the URL the server signs.
 *
 * The upload is real, not stubbed. It is the only part of this feature that
 * does not go through Next - the browser writes to the bucket itself, under the
 * tenant prefix the storage policy checks - so stubbing it would leave the one
 * hop no unit test can reach untested. That does mean this suite needs the
 * `menu-images` bucket to exist in the Supabase project; nothing in this repo
 * provisions it (see lib/storage/buckets.ts).
 *
 * The successful test leaves its add-on behind, for the reason the package
 * suite spells out: there is no DELETE for an add-on, not in the API and not in
 * the app, so one row per run - and one 70-byte object beside it - is the floor
 * while that is true. The rejected-file test creates nothing at all, which is
 * the point of it.
 */

/**
 * A real 1x1 PNG rather than a committed fixture file: it is 70 bytes, and the
 * bytes have to decode because the assertion below is that the browser actually
 * rendered the image, not merely that an `src` was set.
 */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const NOT_AN_IMAGE_MESSAGE = "Pictures must be a JPEG, PNG or WebP image.";

type MenuPayload = {
  addOns: Array<{
    id: string;
    name: string;
    pictureUrl: string | null;
  }>;
};

// page.request rather than the standalone `request` fixture, matching the other
// mutation specs: it shares the browser context's cookie jar, which is where the
// session lives.
async function readMenu(page: Page) {
  const response = await page.request.get("/api/menu");

  if (!response.ok()) {
    throw new Error(
      `GET /api/menu failed with ${response.status()}: ${await response.text()}`
    );
  }

  return (await response.json()) as MenuPayload;
}

function addOnCard(page: Page, name: string) {
  return page.getByRole("article").filter({ hasText: name });
}

/** Exact, or it also matches the "New add-on" button beneath it. */
async function openAddOnsTab(page: Page) {
  await page.getByRole("button", { name: "Add-ons", exact: true }).click();
  await expect(page.getByRole("button", { name: "New add-on" })).toBeVisible({
    timeout: 20_000
  });
}

async function openNewAddOnDialog(page: Page) {
  await page.getByRole("button", { name: "New add-on" }).click();

  const dialog = page.getByRole("dialog", { name: "New add-on" });
  await expect(dialog).toBeVisible();

  return dialog;
}

test.beforeEach(async ({ page }) => {
  test.skip(
    !process.env.E2E_MUTATION_EMAIL || !process.env.E2E_MUTATION_PASSWORD,
    "Mutation E2E credentials are not set."
  );

  await page.goto("/dashboard/menu");
  await expect(
    page.getByRole("button", { name: "Create new library item" }),
    "the mutation account needs canEditMenu to manage the menu"
  ).toBeVisible({ timeout: 30_000 });
});

test("creates an add-on with a picture and draws it from a signed URL", async ({
  page
}) => {
  const name = `E2E Add-on ${Date.now()}`;

  await openAddOnsTab(page);

  const dialog = await openNewAddOnDialog(page);
  await dialog.getByLabel("Name", { exact: true }).fill(name);
  await dialog.getByLabel("Price").fill("250");
  await dialog.getByLabel("Picture").setInputFiles({
    name: "add-on.png",
    mimeType: "image/png",
    buffer: PNG_1X1
  });

  const created = page.waitForResponse(
    (response) =>
      response.url().includes("/api/menu") &&
      response.request().method() === "POST"
  );
  await dialog.getByRole("button", { name: "Save add-on" }).click();
  // Anything but 201 here means the upload resolved to a path the server then
  // refused, which the dialog would report instead of closing.
  expect((await created).status()).toBe(201);
  await expect(dialog).toBeHidden({ timeout: 20_000 });

  const card = addOnCard(page, name);
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card.getByText("$250.00")).toBeVisible();

  // alt="" makes the thumbnail decorative, so it has no img role to look up.
  const thumbnail = card.locator("img");
  await expect(thumbnail).toHaveAttribute("src", /token=/, { timeout: 20_000 });
  // Decoded, not merely pointed at: a src the browser cannot fetch - an expired
  // signature, a path outside the tenant prefix, a bucket that is public when it
  // should not be - leaves naturalWidth at 0 and the card showing nothing.
  await expect
    .poll(
      () => thumbnail.evaluate((image: HTMLImageElement) => image.naturalWidth),
      {
        message: "the signed URL has to be fetchable, not just present",
        timeout: 20_000
      }
    )
    .toBeGreaterThan(0);

  // --- and again from a cold page ------------------------------------------
  // The thumbnail above could have come from state the save left behind. This
  // proves the path reached the column and is signed fresh on every read.
  await page.reload();
  await openAddOnsTab(page);

  const reloadedThumbnail = addOnCard(page, name).locator("img");
  await expect(reloadedThumbnail).toHaveAttribute("src", /token=/, {
    timeout: 20_000
  });
  // The same 20s the first decode gets. This one is the slower of the two - a
  // cold page signs a fresh URL and fetches the object with nothing warmed - so
  // the 5s default was failing the test on a round trip rather than on a defect.
  await expect
    .poll(
      () =>
        reloadedThumbnail.evaluate(
          (image: HTMLImageElement) => image.naturalWidth
        ),
      {
        message: "the freshly signed URL has to be fetchable too",
        timeout: 20_000
      }
    )
    .toBeGreaterThan(0);

  // The response itself, not just what the card made of it: the raw path is the
  // one thing that must never leave the server.
  const saved = (await readMenu(page)).addOns.find(
    (addOn) => addOn.name === name
  );
  expect(saved?.pictureUrl).toEqual(expect.stringContaining("token="));
  expect(saved).not.toHaveProperty("picturePath");
  expect(saved).not.toHaveProperty("pictureBucket");
});

test("refuses a file that is not an image before an add-on is created", async ({
  page
}) => {
  const name = `E2E Add-on Rejected ${Date.now()}`;
  // The check runs in the browser, so no request is the assertion - and this is
  // recorded rather than routed, because a route would stop the very call that
  // must not happen from being observable.
  const menuWrites: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/menu"
    ) {
      menuWrites.push(request.url());
    }
  });

  await openAddOnsTab(page);

  const dialog = await openNewAddOnDialog(page);
  await dialog.getByLabel("Name", { exact: true }).fill(name);
  await dialog.getByLabel("Price").fill("40");
  // `accept` filters the picker, not this - and not a determined caller either.
  await dialog.getByLabel("Picture").setInputFiles({
    name: "menu.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image")
  });

  await dialog.getByRole("button", { name: "Save add-on" }).click();

  await expect(dialog.getByRole("alert")).toHaveText(NOT_AN_IMAGE_MESSAGE);
  // Open, and still holding what was typed: closing here would throw the entry
  // away along with the only explanation of why it did not save.
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Name", { exact: true })).toHaveValue(name);
  await expect(
    dialog.getByRole("button", { name: "Save add-on" })
  ).toBeEnabled();

  // Nothing was written, so nothing needs cleaning up - which matters here,
  // because there is no endpoint that could clean it up.
  expect(menuWrites).toEqual([]);

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(addOnCard(page, name)).toBeHidden();
});
