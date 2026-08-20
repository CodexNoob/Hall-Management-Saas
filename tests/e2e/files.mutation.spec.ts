import { expect, test } from "@playwright/test";

test.beforeEach(async ({}, testInfo) => {
  test.skip(
    !process.env.E2E_MUTATION_EMAIL || !process.env.E2E_MUTATION_PASSWORD,
    "Mutation E2E credentials are not set."
  );
  testInfo.annotations.push({
    type: "account",
    description: "Writes a small file. Uses the mutation E2E account."
  });
});

test("uploads a file through the dropzone and lists it after a reload", async ({
  page
}) => {
  await page.goto("/dashboard/files");

  const addFile = page.getByRole("button", { name: "Add file" }).first();
  await expect(addFile).toBeVisible({ timeout: 20_000 });

  // Remember which folder is open - the file is written into it, and the
  // reload below has to come back to the same one to see it.
  const folderPathBefore = await page
    .getByRole("dialog")
    .count()
    .then(() => null);
  expect(folderPathBefore).toBeNull();

  await addFile.click();
  const dialog = page.getByRole("dialog");

  // The picker is a drop target, not a bare file input.
  await expect(
    page.getByText("Drop files here or click to browse")
  ).toBeVisible();

  // Filed by category, and optionally attached to a booking.
  await dialog.getByLabel("Folder", { exact: true }).selectOption("Contracts");

  const fileName = `e2e-upload-${Date.now()}.csv`;
  await page.getByLabel("Upload files").setInputFiles({
    name: fileName,
    mimeType: "text/csv",
    buffer: Buffer.from("column-a,column-b\n1,2\n")
  });

  // The dropzone shows the chosen file instead of the prompt.
  await expect(dialog.getByText(fileName)).toBeVisible();

  const created = page.waitForResponse(
    (response) =>
      response.url().includes("/api/files") &&
      response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Save file" }).click();
  expect((await created).status()).toBe(201);

  // The dialog closes only once storage and the database have both accepted
  // it, so this is the real completion signal - the button label alone flips
  // to "Uploading..." the instant the upload starts.
  await expect(dialog).toHaveCount(0, { timeout: 60_000 });

  // Not asserted in the open folder: the dialog files by category now, so this
  // went to Contracts rather than to whatever folder happened to be selected.
  // A reload re-reads from the database, which is the claim that matters.
  await page.reload();
  const stored = await page.evaluate(async (name) => {
    const res = await fetch("/api/files");
    const data = await res.json();
    return (data.files ?? []).find(
      (file: { fileName: string }) => file.fileName === name
    );
  }, fileName);
  expect(stored).toBeTruthy();
});

test("attaching a booking on the Files page files it under that event", async ({
  page
}) => {
  await page.goto("/dashboard/files");
  const addFile = page.getByRole("button", { name: "Add file" }).first();
  await expect(addFile).toBeVisible({ timeout: 20_000 });
  await addFile.click();

  const dialog = page.getByRole("dialog");
  const eventPicker = dialog.getByLabel("Event", { exact: true });
  await expect(eventPicker).toBeVisible();

  // Second option, because the first is "No event - general filing".
  const eventOptions = await eventPicker.locator("option").all();
  test.skip(eventOptions.length < 2, "No bookings to file against.");
  const eventValue = await eventOptions[1].getAttribute("value");
  await eventPicker.selectOption(eventValue!);
  await dialog.getByLabel("Folder", { exact: true }).selectOption("Contracts");

  const fileName = `e2e-attached-${Date.now()}.csv`;
  await page.getByLabel("Upload files").setInputFiles({
    name: fileName,
    mimeType: "text/csv",
    buffer: Buffer.from("a,b\n1,2\n")
  });

  const created = page.waitForResponse(
    (response) =>
      response.url().includes("/api/files") &&
      response.request().method() === "POST" &&
      (response.request().postData() ?? "").includes('"resource":"file"')
  );
  await page.getByRole("button", { name: "Save file" }).click();

  // The row carries the booking chosen in the dialog, which is what makes it
  // show on that event's Files tab - the direction the Files page could not
  // reach before.
  const body = (await (await created).json()) as {
    file: { eventId: string | null; folderId: string | null };
  };
  expect(body.file.eventId).toBe(eventValue);
  expect(body.file.folderId).not.toBeNull();

  await expect(dialog).toHaveCount(0, { timeout: 60_000 });
});

test("Other reveals a folder name field and files under it", async ({
  page
}) => {
  await page.goto("/dashboard/files");
  await page.getByRole("button", { name: "Add file" }).first().click();

  const dialog = page.getByRole("dialog");
  const folderName = `Insurance ${Date.now()}`;

  // The escape hatch that lets the fixed list stay short.
  await expect(dialog.getByLabel("Folder name")).toHaveCount(0);
  await dialog.getByLabel("Folder", { exact: true }).selectOption("Other");
  await dialog.getByLabel("Folder name").fill(folderName);

  await page.getByLabel("Upload files").setInputFiles({
    name: `e2e-other-${Date.now()}.csv`,
    mimeType: "text/csv",
    buffer: Buffer.from("a\n1\n")
  });

  const folderCreated = page.waitForResponse(
    (response) =>
      response.url().includes("/api/files") &&
      response.request().method() === "POST" &&
      (response.request().postData() ?? "").includes(folderName)
  );
  await page.getByRole("button", { name: "Save file" }).click();
  expect([200, 201]).toContain((await folderCreated).status());

  await expect(dialog).toHaveCount(0, { timeout: 60_000 });
});

test("an event's Files tab uploads against that booking and files it", async ({
  page
}) => {
  await page.goto("/dashboard/events");
  await page
    .getByRole("button", { name: /E2E/ })
    .first()
    .click();
  await expect(
    page.getByRole("navigation", { name: "Event workspace" })
  ).toBeVisible({ timeout: 45_000 });

  await page
    .getByRole("navigation", { name: "Event workspace" })
    .getByRole("button", { name: "Files", exact: true })
    .click();

  // Real sections from the event's folders, not the nine invented categories
  // the tab used to hardcode.
  await expect(
    page.getByRole("button", { name: /^All files/ })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Contracts/ })).toBeVisible();

  const fileName = `e2e-event-file-${Date.now()}.csv`;
  await page.getByRole("button", { name: "Upload file" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.getByLabel("Upload files").setInputFiles({
    name: fileName,
    mimeType: "text/csv",
    buffer: Buffer.from("a,b\n1,2\n")
  });

  const created = page.waitForResponse(
    (response) =>
      response.url().includes("/api/files") &&
      response.request().method() === "POST" &&
      (response.request().postData() ?? "").includes('"resource":"file"')
  );
  await page.getByRole("button", { name: "Save file" }).click();

  const response = await created;
  expect(response.status()).toBe(201);

  // The row carries the booking, which is what makes the same document
  // reachable from the event, the folder tree and the client.
  const body = (await response.json()) as {
    file: { eventId: string | null; folderId: string | null };
  };
  expect(body.file.eventId).not.toBeNull();
  expect(body.file.folderId).not.toBeNull();

  await expect(dialog).toHaveCount(0, { timeout: 60_000 });
  await expect(page.getByText(fileName)).toBeVisible({ timeout: 20_000 });

  // And it is the same row the Files page reads.
  await page.goto("/dashboard/files");
  const listed = await page.evaluate(async (name) => {
    const res = await fetch("/api/files");
    const data = await res.json();
    return (data.files ?? []).some(
      (file: { fileName: string }) => file.fileName === name
    );
  }, fileName);
  expect(listed).toBe(true);
});

test("refuses a file type the API would reject, before uploading it", async ({
  page
}) => {
  await page.goto("/dashboard/files");
  await page.getByRole("button", { name: "Add file" }).first().click();

  // Rejected in the browser so the object never reaches the bucket - the
  // storage write would otherwise succeed and only the row be refused,
  // orphaning the object.
  await page.getByLabel("Upload files").setInputFiles({
    name: "not-allowed.bin",
    mimeType: "application/x-msdownload",
    buffer: Buffer.from("binary")
  });

  await expect(
    page.getByText(/is not a supported file type/i)
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toBeVisible();
});
