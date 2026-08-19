import { expect, test } from "@playwright/test";

const hall = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Hall 1",
  capacity: 500
};

const preset = {
  id: "22222222-2222-4222-8222-222222222222",
  organizationId: "33333333-3333-4333-8333-333333333333",
  hallId: hall.id,
  name: "charles",
  objects: [
    {
      id: "table-1",
      type: "round-table",
      name: "Round table",
      x: 120,
      y: 120,
      width: 96,
      height: 96,
      rotation: 0,
      seats: 10,
      seatingUse: "adult"
    }
  ],
  createdAt: "2026-08-11T00:00:00.000Z",
  updatedAt: "2026-08-11T00:00:00.000Z",
  hall
};

test.beforeEach(async ({}, testInfo) => {
  test.skip(
    !process.env.E2E_READONLY_EMAIL || !process.env.E2E_READONLY_PASSWORD,
    "Read-only E2E credentials are not set."
  );
  // Below the md breakpoint the editor is intentionally view-only: the map
  // objects are pointer-events-none and Save/Clear are hidden, so editing
  // the layout can only be exercised on the desktop viewport.
  test.skip(
    testInfo.project.name.includes("mobile"),
    "The hall map editor is view-only on mobile viewports."
  );
});

test("saving a hall map shows a non-layout-shifting saved confirmation", async ({
  page
}, testInfo) => {
  test.skip(
    testInfo.project.name === "authenticated-mobile",
    "Hall map editing is intentionally disabled on mobile."
  );

  let saveRequestCount = 0;

  await page.route("**/api/hall-maps", async (route) => {
    const method = route.request().method();

    if (method === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          halls: [hall],
          presets: [preset],
          shapeLibrary: []
        })
      });
      return;
    }

    if (method === "PATCH") {
      saveRequestCount += 1;
      // Slow enough for the saving overlay to be observable, fast enough not
      // to slow the suite.
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          preset: {
            ...preset,
            updatedAt: new Date().toISOString()
          }
        })
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/dashboard/hall-room-map");

  await page.getByLabel("Assigned hall").click();
  await page.getByRole("option", { name: "Hall 1" }).click();

  const grid = page.getByLabel("Hall map grid");
  await expect(grid).toBeVisible();

  // Save from the very bottom of the page - the position where the old
  // board-pinned confirmation fired out of view. The topbar Save button is
  // fixed, so it stays clickable; the message must too.
  await page.evaluate(() => {
    document.querySelectorAll("main").forEach((main) => {
      main.scrollTop = main.scrollHeight;
    });
  });

  await page.getByRole("button", { name: "Save layout" }).click();

  // While the save round-trips, the site's loading indicator covers the page.
  const savingOverlay = page.getByRole("status", { name: "Saving layout" });
  await expect(savingOverlay).toBeVisible();

  const confirmation = page
    .getByRole("status")
    .filter({ hasText: "Layout saved" });
  await expect(confirmation).toBeVisible();
  await expect(savingOverlay).toHaveCount(0);
  await expect(confirmation).toContainText("charles is saved to Hall 1.");
  // The check that matters. This toast used to render inside the pannable
  // canvas, which opens scrolled to the world origin - so it was present and
  // "visible" to the DOM while sitting thousands of pixels off screen, and no
  // user ever saw it. toBeVisible alone does not catch that; toBeInViewport does.
  await expect(confirmation).toBeInViewport();
  await expect(page.locator(".fixed.bottom-5")).toHaveCount(0);
  expect(saveRequestCount).toBe(1);
});

test("dragging a map object at the viewport edge pans the infinite canvas", async ({
  page
}, testInfo) => {
  test.skip(
    testInfo.project.name === "authenticated-mobile",
    "Hall map editing is intentionally disabled on mobile."
  );

  await page.route("**/api/hall-maps", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          halls: [hall],
          presets: [preset],
          shapeLibrary: []
        })
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/dashboard/hall-room-map");

  await page.getByLabel("Assigned hall").click();
  await page.getByRole("option", { name: "Hall 1" }).click();

  const addTable = page.getByRole("button", { name: "Select Round table" });
  await addTable.click();
  await expect(page.getByLabel("Name")).toHaveValue("Round table");

  const grid = page.getByLabel("Hall map grid");
  const table = grid.getByRole("button", { name: "Select Round table" });

  // Drags past the map edge on purpose: the pointer leaves the object, so this
  // only works while pointer capture is held for the whole gesture.
  async function dragPastBottomRight() {
    const box = await table.boundingBox();
    const gridBox = await grid.boundingBox();

    if (!box || !gridBox) throw new Error("Map or object is not visible.");

    const target = {
      x: gridBox.x + gridBox.width + 300,
      y: gridBox.y + gridBox.height + 300
    };

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 12 });
    await page.mouse.up();
  }

  // `exact` matters: an unanchored "X" also matches the Next.js dev-tools
  // button ("Ne(x)t.js Dev Tools") in development.
  const positionX = page.getByLabel("X", { exact: true });
  const positionY = page.getByLabel("Y", { exact: true });

  const beforeScroll = await grid.evaluate((element) => ({
    left: element.scrollLeft,
    top: element.scrollTop
  }));

  await dragPastBottomRight();

  await expect
    .poll(async () => Number(await positionX.inputValue()))
    .toBeGreaterThan(180);
  await expect
    .poll(async () => Number(await positionY.inputValue()))
    .toBeGreaterThan(280);

  const afterScroll = await grid.evaluate((element) => ({
    left: element.scrollLeft,
    top: element.scrollTop
  }));
  expect(afterScroll.left).toBeGreaterThan(beforeScroll.left);
  expect(afterScroll.top).toBeGreaterThan(beforeScroll.top);
});

test("map zoom controls resize the canvas and can fit every shape", async ({
  page
}) => {
  await page.route("**/api/hall-maps", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          halls: [hall],
          presets: [preset],
          shapeLibrary: []
        })
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/dashboard/hall-room-map");
  await page.getByLabel("Assigned hall").click();
  await page.getByRole("option", { name: "Hall 1" }).click();

  const table = page
    .getByLabel("Hall map grid")
    .getByRole("button", { name: "Select Round table" });
  const initialBox = await table.boundingBox();

  await page.getByRole("button", { name: "Zoom out" }).click();
  await expect(page.getByRole("button", { name: "Fit all shapes" })).toHaveText(
    "80%"
  );
  await expect
    .poll(async () => (await table.boundingBox())?.width ?? 0)
    .toBeLessThan(initialBox?.width ?? 0);

  await page.getByRole("button", { name: "Fit all shapes" }).click();
  await expect(table).toBeVisible();

  // A previously focused inspector field must not hand the shortcut back to
  // browser-level page zoom.
  await page.getByLabel("Name").focus();
  await page.keyboard.press("Control+0");
  await expect(page.getByRole("button", { name: "Fit all shapes" })).toHaveText(
    "100%"
  );
  await page.keyboard.press("Control+-");
  await expect(page.getByRole("button", { name: "Fit all shapes" })).toHaveText(
    "80%"
  );
  await page.keyboard.press("Control+=");
  await expect(page.getByRole("button", { name: "Fit all shapes" })).toHaveText(
    "100%"
  );
  await page.keyboard.press("Shift+1");
  await expect(page.getByRole("button", { name: "Fit all shapes" })).toHaveText(
    "200%"
  );
  await expect(table).toBeVisible();

  await page.getByLabel("Show hall map shortcuts").click();
  await expect(page.getByText("Hall map shortcuts")).toBeVisible();
  await page.getByLabel("Hall map grid").click({ position: { x: 20, y: 20 } });
  await expect(page.getByText("Hall map shortcuts")).toBeHidden();
});

test("edge handles resize a hall map shape", async ({ page }) => {
  await page.route("**/api/hall-maps", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          halls: [hall],
          presets: [preset],
          shapeLibrary: []
        })
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/dashboard/hall-room-map");
  await page.getByLabel("Assigned hall").click();
  await page.getByRole("option", { name: "Hall 1" }).click();

  const table = page
    .getByLabel("Hall map grid")
    .getByRole("button", { name: "Select Round table" });
  await table.click();
  const handle = table.locator('[data-resize-handle="east"]');
  const handleBox = await handle.boundingBox();

  if (!handleBox) throw new Error("Resize handle is not visible.");

  await page.mouse.move(
    handleBox.x + handleBox.width / 2,
    handleBox.y + handleBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(handleBox.x + 60, handleBox.y + 40, { steps: 5 });
  await page.mouse.up();

  await expect
    .poll(async () => Number(await page.getByLabel("Width").inputValue()))
    .toBeGreaterThan(96);
  await expect(page.getByLabel("Height")).toHaveValue("96");
});

test("Shift-click and Select All operate on groups of shapes", async ({ page }) => {
  const groupPreset = {
    ...preset,
    objects: [
      { ...preset.objects[0], id: "table-1", name: "First table" },
      { ...preset.objects[0], id: "table-2", name: "Second table", x: 300 },
      { ...preset.objects[0], id: "table-3", name: "Third table", x: 480 }
    ]
  };

  await page.route("**/api/hall-maps", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          halls: [hall],
          presets: [groupPreset],
          shapeLibrary: []
        })
      });
      return;
    }
    await route.fallback();
  });

  await page.goto("/dashboard/hall-room-map");
  await page.getByLabel("Assigned hall").click();
  await page.getByRole("option", { name: "Hall 1" }).click();

  const grid = page.getByLabel("Hall map grid");
  const first = grid.getByRole("button", { name: "Select First table" });
  const second = grid.getByRole("button", { name: "Select Second table" });
  const third = grid.getByRole("button", { name: "Select Third table" });

  await first.click();
  await second.click({ modifiers: ["Shift"] });
  await page.keyboard.press("Delete");
  await expect(first).toHaveCount(0);
  await expect(second).toHaveCount(0);
  await expect(third).toBeVisible();

  await page.keyboard.press("Control+z");
  await expect(first).toBeVisible();
  await expect(second).toBeVisible();
  await first.click();
  await page.keyboard.press("Control+a");

  const before = await Promise.all([
    first.boundingBox(),
    second.boundingBox(),
    third.boundingBox()
  ]);
  const firstBox = before[0];
  if (!firstBox) throw new Error("Selected group is not visible.");

  await page.mouse.move(
    firstBox.x + firstBox.width / 2,
    firstBox.y + firstBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(firstBox.x + firstBox.width / 2 + 60, firstBox.y + firstBox.height / 2 + 30, { steps: 6 });
  await page.mouse.up();

  const after = await Promise.all([
    first.boundingBox(),
    second.boundingBox(),
    third.boundingBox()
  ]);
  // Snap-to-grid rounds the dragged anchor onto the 20px grid, so the exact
  // landing point can differ from the raw pointer delta by up to half a cell.
  // The invariant this test guards is that the whole selection moves as one:
  // every member shifts by the same delta, and that delta tracks the pointer.
  const groupDeltaX = (after[0]?.x ?? 0) - (before[0]?.x ?? 0);
  const groupDeltaY = (after[0]?.y ?? 0) - (before[0]?.y ?? 0);
  expect(Math.abs(groupDeltaX - 60)).toBeLessThanOrEqual(10);
  expect(Math.abs(groupDeltaY - 30)).toBeLessThanOrEqual(10);
  after.forEach((box, index) => {
    expect(box?.x).toBeCloseTo((before[index]?.x ?? 0) + groupDeltaX, 0);
    expect(box?.y).toBeCloseTo((before[index]?.y ?? 0) + groupDeltaY, 0);
  });

  await second.click();
  await expect(first.locator("[data-resize-handle]")).toHaveCount(0);
  await expect(second.locator("[data-resize-handle]")).toHaveCount(4);

  await page.keyboard.press("Control+a");
  await page.keyboard.press("Escape");
  await expect(grid.locator("[data-resize-handle]")).toHaveCount(0);

  await page.keyboard.press("Control+a");
  await grid.click({ position: { x: 20, y: 20 } });
  await expect(grid.locator("[data-resize-handle]")).toHaveCount(0);
});

test("the rotation handle rotates a selected hall map shape", async ({ page }) => {
  await page.route("**/api/hall-maps", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          halls: [hall],
          presets: [preset],
          shapeLibrary: []
        })
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/dashboard/hall-room-map");
  await page.getByLabel("Assigned hall").click();
  await page.getByRole("option", { name: "Hall 1" }).click();

  const table = page
    .getByLabel("Hall map grid")
    .getByRole("button", { name: "Select Round table" });
  await table.click();
  const tableBox = await table.boundingBox();
  const rotateHandle = table.locator('[data-rotate-handle="true"]');
  const handleBox = await rotateHandle.boundingBox();

  if (!tableBox || !handleBox) throw new Error("Rotation handle is not visible.");

  const center = {
    x: tableBox.x + tableBox.width / 2,
    y: tableBox.y + tableBox.height / 2
  };
  await page.mouse.move(
    handleBox.x + handleBox.width / 2,
    handleBox.y + handleBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(center.x + tableBox.width, center.y, { steps: 8 });
  await page.mouse.up();

  await expect(page.getByLabel("Rotation")).toHaveValue("90");
  await page.keyboard.press("r");
  await expect(page.getByLabel("Rotation")).toHaveValue("105");
  await page.keyboard.press("Shift+r");
  await expect(page.getByLabel("Rotation")).toHaveValue("90");
  await page.keyboard.press("Alt+r");
  await expect(page.getByLabel("Rotation")).toHaveValue("0");
});

test("clear selection resets the selected hall map object", async ({
  page
}, testInfo) => {
  test.skip(
    testInfo.project.name === "authenticated-mobile",
    "Hall map editing is intentionally disabled on mobile."
  );

  await page.route("**/api/hall-maps", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          halls: [hall],
          presets: [preset],
          shapeLibrary: []
        })
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/dashboard/hall-room-map");

  await page.getByLabel("Assigned hall").click();
  await page.getByRole("option", { name: "Hall 1" }).click();
  await expect(
    page.getByRole("button", { name: "Clear selection" })
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Select Round table" }).click();

  await expect(page.getByLabel("Name")).toHaveValue("Round table");

  const clearSelection = page.getByRole("button", {
    name: "Clear selection"
  });
  await expect(clearSelection).toBeEnabled();
  await clearSelection.click();

  await expect(page.getByLabel("Name")).toHaveValue("");
  await expect(page.getByLabel("Name")).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Clear selection" })
  ).toHaveCount(0);
});

test("planner tools: capacity readout, snap-to-grid drag, undo and redo", async ({
  page
}) => {
  await page.route("**/api/hall-maps", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ halls: [hall], presets: [preset], shapeLibrary: [] })
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/dashboard/hall-room-map");
  await page.getByLabel("Assigned hall").click();
  await page.getByRole("option", { name: "Hall 1" }).click();

  // The layout's seats measured against the hall's stored capacity.
  await expect(page.getByLabel("Seat capacity")).toHaveText("10 seats / 500");
  await expect(page.getByText(/overlapping/)).toHaveCount(0);

  const table = page.getByRole("button", { name: "Select Round table" });
  await table.click();
  const positionX = page.getByLabel("X", { exact: true });
  await expect(positionX).toHaveValue("120");

  // Drag by an off-grid amount; snapping lands the shape on the next line.
  const box = await table.boundingBox();
  if (!box) throw new Error("Table is not visible.");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 33, box.y + box.height / 2 + 17, {
    steps: 8
  });
  await page.mouse.up();

  await table.click();
  await expect(positionX).toHaveValue("160");
  await expect(page.getByLabel("Y", { exact: true })).toHaveValue("140");

  // Undo returns to the pre-drag position; redo replays the snapped move.
  await page.keyboard.press("Control+z");
  await table.click();
  await expect(positionX).toHaveValue("120");

  await page.keyboard.press("Control+Shift+z");
  await table.click();
  await expect(positionX).toHaveValue("160");
});

test("planner tools: overlap warning, bulk rows, and the print sheet", async ({
  page
}) => {
  const crowded = {
    ...preset,
    id: "44444444-4444-4444-8444-444444444444",
    name: "crowded",
    objects: [
      preset.objects[0],
      {
        ...preset.objects[0],
        id: "table-2",
        name: "Second table",
        // 10px from the first table: the chair rings collide even though the
        // table tops do not.
        x: 226,
        y: 120
      }
    ]
  };

  await page.route("**/api/hall-maps", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          halls: [hall],
          presets: [crowded],
          shapeLibrary: []
        })
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/dashboard/hall-room-map");
  await page.getByLabel("Assigned hall").click();
  await page.getByRole("option", { name: "Hall 1" }).click();

  await expect(page.getByText("2 overlapping")).toBeVisible();

  // Bulk add: six more tables in rows of three, placed clear of the originals.
  await page.getByLabel("Tables").fill("6");
  await page.getByLabel("Per row").fill("3");
  await page.getByLabel("Seats per table").fill("8");
  await page.getByRole("button", { name: "Add round tables in rows" }).click();

  await expect(page.getByRole("button", { name: /^Select / })).toHaveCount(8);
  await expect(page.getByLabel("Seat capacity")).toHaveText("68 seats / 500");

  // The print sheet renders the layout with the map's name and totals.
  await page.getByRole("button", { name: "Print map" }).click();
  await expect(
    page.getByRole("heading", { name: "crowded", exact: true })
  ).toBeVisible();
  await expect(page.getByText(/68 seats \(68 adult/)).toBeVisible();
  // exact: an unanchored "Close" also matches the topbar's "Close Sidebar".
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Print preview" })
  ).toHaveCount(0);
});
