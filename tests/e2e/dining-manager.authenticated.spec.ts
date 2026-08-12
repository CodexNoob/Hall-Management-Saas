import { expect, test } from "@playwright/test";

const hall = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Hall 1"
};

const diningEvent = {
  id: "22222222-2222-4222-8222-222222222222",
  clientName: "E2E Dining Event",
  eventType: "Wedding",
  eventDate: "2026-08-22T00:00:00.000Z",
  startsAt: "2026-08-22T18:00:00.000Z",
  eventStatus: "Confirmed",
  bookingStatus: "CONFIRMED",
  packageName: "Standard",
  couplesCount: 10,
  menCount: 0,
  ladiesCount: 0,
  boysCount: 0,
  girlsCount: 0,
  kidsCount: 0,
  waitersCount: 2,
  tableclothName: "Ivory",
  washingTime: null,
  notes: null,
  hall,
  diningPlan: null
};

const presetA = {
  id: "33333333-3333-4333-8333-333333333333",
  hallId: hall.id,
  name: "Preset A",
  objects: [
    {
      id: "preset-a-table",
      type: "round-table",
      name: "Preset A Table",
      x: 80,
      y: 90,
      width: 80,
      height: 80,
      rotation: 0,
      seats: 10,
      seatingUse: "adult"
    }
  ]
};

const presetB = {
  id: "44444444-4444-4444-8444-444444444444",
  hallId: hall.id,
  name: "Preset B",
  objects: [
    {
      id: "preset-b-table",
      type: "head-table",
      name: "Preset B Head Table",
      x: 260,
      y: 160,
      width: 140,
      height: 56,
      rotation: 0,
      seats: 12,
      seatingUse: "head"
    }
  ]
};

test.beforeEach(async () => {
  test.skip(
    !process.env.E2E_READONLY_EMAIL || !process.env.E2E_READONLY_PASSWORD,
    "Read-only E2E credentials are not set."
  );
});

test("selecting a hall map preset immediately previews its dining table layout", async ({
  page
}) => {
  await page.route("**/api/dining", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          events: [diningEvent],
          hallMapPresets: [presetA, presetB]
        })
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/dashboard/dining-manager");

  await page.getByLabel("Hall map preset").click();
  await page.getByRole("option", { name: "Preset A" }).click();

  await expect(page.getByText("Preset A Table")).toBeVisible();
  await expect(page.getByText("Preset A previewed with 1 seating tables.")).toBeVisible();
  await expect(page.getByText("Preset B Head Table")).toHaveCount(0);

  await page.getByLabel("Hall map preset").click();
  await page.getByRole("option", { name: "Preset B" }).click();

  await expect(page.getByText("Preset B Head Table")).toBeVisible();
  await expect(page.getByText("Preset B previewed with 1 seating tables.")).toBeVisible();
  await expect(page.getByText("Preset A Table")).toHaveCount(0);
});

test("saving a dining plan persists the selected hall map preset layout", async ({
  page
}) => {
  let savedPayload: {
    eventId?: string;
    hallMapPresetId?: string | null;
    tables?: Array<{
      mapObjectId?: string;
      name?: string;
      side?: string;
      seats?: number;
    }>;
  } | null = null;

  await page.route("**/api/dining", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          events: [diningEvent],
          hallMapPresets: [presetA, presetB]
        })
      });
      return;
    }

    if (route.request().method() === "PATCH") {
      savedPayload = route.request().postDataJSON();
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          plan: {
            id: "55555555-5555-4555-8555-555555555555",
            ...savedPayload
          }
        })
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/dashboard/dining-manager");

  await page.getByLabel("Hall map preset").click();
  await page.getByRole("option", { name: "Preset B" }).click();
  await page
    .getByLabel("Special notes")
    .fill("VIP table beside stage. Serve kids meals first.");
  const saveRequest = page.waitForRequest((request) => {
    return request.url().includes("/api/dining") && request.method() === "PATCH";
  });
  const refetchResponse = page.waitForResponse((response) => {
    return response.url().includes("/api/dining") && response.status() === 200;
  });

  await page.getByRole("button", { name: "Save dining plan" }).click();
  await saveRequest;
  await refetchResponse;

  await expect(page.getByRole("status")).toHaveText("Dining plan saved.");
  expect(savedPayload).toMatchObject({
    eventId: diningEvent.id,
    hallMapPresetId: presetB.id,
    specialNotes: "VIP table beside stage. Serve kids meals first.",
    tables: [
      expect.objectContaining({
        mapObjectId: "preset-b-table",
        name: "Preset B Head Table",
        side: "head",
        seats: 12
      })
    ]
  });
});
