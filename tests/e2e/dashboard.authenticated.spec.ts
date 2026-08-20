import { expect, test } from "@playwright/test";

test.beforeEach(async ({}, testInfo) => {
  test.skip(
    !process.env.E2E_READONLY_EMAIL || !process.env.E2E_READONLY_PASSWORD,
    "Read-only E2E credentials are not set."
  );
  testInfo.annotations.push({
    type: "account",
    description: "Uses the non-mutating read-only E2E account."
  });
});

test("authenticated state opens the dashboard without logging in again", async ({
  page
}) => {
  await page.goto("/dashboard");

  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true })
  ).toBeVisible();
});

for (const [label, route] of [
  ["Dashboard", "/dashboard"],
  ["Kitchen", "/dashboard/kitchen"]
] as Array<[string, string]>) {
  test(`${label} keeps the topbar actions on the title line on a phone`, async ({
    page
  }) => {
    // Both pages used to pass a custom Today notes button that kept its label,
    // border and padding at every width. The actions row was then too wide to
    // sit beside the title and wrapped onto a second line, costing 36px of
    // vertical space on every phone.
    await page.setViewportSize({ width: 360, height: 727 });
    await page.goto(route);

    // Scoped to the topbar: the Kitchen page has a second h1 of its own.
    const topbar = page.locator(".dashboard-topbar-content");
    const title = topbar.getByRole("heading", { level: 1 });
    const search = topbar.getByRole("button", { name: "Search", exact: true });
    const notes = topbar.getByRole("button", { name: "Open today notes" });
    await expect(title).toBeVisible();
    await expect(search).toBeVisible();
    await expect(notes).toBeVisible();

    const [titleBox, searchBox, notesBox] = await Promise.all([
      title.boundingBox(),
      search.boundingBox(),
      notes.boundingBox()
    ]);
    if (!titleBox || !searchBox || !notesBox) {
      throw new Error("Topbar is not visible.");
    }

    // Same row as each other, and level with the title rather than under it.
    expect(Math.abs(searchBox.y - notesBox.y)).toBeLessThan(4);
    expect(searchBox.y).toBeLessThan(titleBox.y + titleBox.height);
    // And clear of the title, so nothing overlaps at the narrowest width.
    expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(searchBox.x);
  });
}

test("dashboard cards stay inside a narrow phone screen", async ({
  page
}, testInfo) => {
  // The test sets its own 360px viewport, so running it again under the Pixel 5
  // project measures the same thing while doubling the authenticated traffic -
  // which is what starved the route handler below and made it flaky.
  test.skip(
    testInfo.project.name.includes("mobile"),
    "Viewport is set explicitly; one project is enough."
  );
  // The route handler below re-issues an authenticated request, which the
  // mutation specs can starve when the whole suite runs at once.
  test.slow();

  // The overflow is driven by the widest client name in the data, so the name
  // is injected rather than left to whatever the account happens to hold that
  // day - otherwise this passes against the bug whenever the data is short.
  const longName = "Rosenbaum-Weiss Anniversary Reception 1786752877440";

  // Rewrite the first /api/dashboard response so the check does not depend on
  // whatever names the account holds that day - with short data it passes
  // against the bug. Only the first of the page's three dashboard calls is
  // rewritten; re-fetching all three tripled the round-trips.
  let rewritten = false;
  await page.route("**/api/dashboard**", async (route) => {
    if (rewritten) {
      await route.fallback();
      return;
    }
    try {
      const response = await route.fetch();
      const body = await response.json();
      if (Array.isArray(body?.events) && body.events.length) {
        body.events[0] = { ...body.events[0], clientName: longName };
        rewritten = true;
      }
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(body)
      });
    } catch {
      await route.fallback();
    }
  });

  // 360px rather than the 393px Pixel 5 the suite already uses: this is the
  // narrowest phone worth supporting, and where the clipping is worst.
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/dashboard");

  for (const heading of [
    "Operating schedule",
    "Events timeline",
    "Attention needed",
    "Quick actions"
  ]) {
    await expect(
      page.getByRole("heading", { name: heading, exact: true })
    ).toBeVisible();
  }

  // Wait for the rewritten name to reach the DOM. The headings render with the
  // loading skeleton, so measuring on those alone reads a layout with no long
  // text in it yet - and passes against the bug.
  await expect(page.getByText(longName).first()).toBeAttached({
    timeout: 20_000
  });

  // The grid holding all four used to size its single mobile column from its
  // items' min-content. With this name it resolved to 576px inside a 336px
  // box, pushing the cards 228px off the right of the screen.
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const widest = Array.from(
      document.querySelectorAll<HTMLElement>("main *")
    ).reduce((worst, el) => {
      // Ignore deliberate horizontal scrollers, such as the module carousel.
      if (el.closest("[data-allow-x-scroll], .overflow-x-auto")) return worst;
      const right = Math.round(el.getBoundingClientRect().right);
      return right > worst ? right : worst;
    }, 0);

    return { clientWidth: doc.clientWidth, widestRight: widest };
  });

  expect(overflow.widestRight).toBeLessThanOrEqual(overflow.clientWidth + 1);
});

test("file workspace is protected and renders for an authorized user", async ({
  page
}) => {
  await page.goto("/dashboard/files");

  await expect(page).toHaveURL(/\/dashboard\/files/);
  await expect(
    page.getByRole("heading", { name: /Files/i }).first()
  ).toBeVisible();
});

test("authenticated layouts do not overflow the mobile viewport", async ({
  page
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "authenticated-mobile",
    "Mobile-only layout assertion."
  );
  await page.goto("/dashboard");

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));

  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
  await expect(
    page.getByRole("button", { name: /Open navigation|Expand sidebar/ })
  ).toBeVisible();
});

test("booking creation is not exposed on overview, kitchen, or event manager pages", async ({
  page
}) => {
  for (const route of [
    "/dashboard",
    "/dashboard/kitchen",
    "/dashboard/events"
  ]) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(route.replaceAll("/", "\\/")));
    await expect(
      page.getByRole("button", { name: "Create new booking" })
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "New booking" })).toHaveCount(
      0
    );
  }
});

test("event manager keeps today notes available without exposing booking creation", async ({
  page
}) => {
  await page.goto("/dashboard/events");

  await expect(page).toHaveURL(/\/dashboard\/events/);

  await expect(
    page.getByRole("heading", { name: "Event Manager", exact: true })
  ).toBeVisible({ timeout: 45_000 });

  await expect(page.getByRole("button", { name: "New booking" })).toHaveCount(
    0
  );

  await page.getByRole("button", { name: "Open today notes" }).click();

  await expect(page.getByRole("dialog", { name: "Today notes" })).toBeVisible();
});

const dashboardPages = [
  "/dashboard",
  "/dashboard/kitchen",
  "/dashboard/calendar",
  "/dashboard/events",
  "/dashboard/menu",
  "/dashboard/dining-manager",
  "/dashboard/hall-room-map",
  "/dashboard/files",
  "/dashboard/billing",
  "/dashboard/staff",
  "/dashboard/vendors",
  "/dashboard/settings"
];

for (const route of dashboardPages) {
  test(`dashboard page renders without a fatal error: ${route}`, async ({
    page
  }) => {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(route.replaceAll("/", "\\/")));
    await expect(page.locator("body")).not.toContainText("Application error");
    await expect(page.locator("body")).not.toContainText(
      "Internal Server Error"
    );
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
  });
}
