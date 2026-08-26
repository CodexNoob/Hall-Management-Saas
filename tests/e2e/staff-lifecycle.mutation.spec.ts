import { expect, test, type Page } from "@playwright/test";

/**
 * One staff member through the whole directory: invited, edited, revoked.
 *
 * The counterpart to staff-invite.mutation.spec.ts, which stops at the invite
 * and spends its assertions on delivery. This one starts where that ends - it
 * needs a member to exist only so it has something to edit and switch off - and
 * asserts the two writes that spec never reaches: PATCH /api/staff/:principalId
 * and POST /api/staff/:principalId/deactivate.
 *
 * THERE IS NO DELETE. Removing somebody is `Revoke`, which flips the membership
 * for this organization and leaves the person and their history intact, so that
 * is what stands in for the delete step here. Restoring is the same endpoint
 * with the flag the other way; this spec drives the revoke direction, because
 * that is the one with a rank ceiling in front of it.
 */

const inviteMailbox = process.env.E2E_STAFF_INVITE_EMAIL;

/**
 * Routes every run to one real mailbox through + subaddressing, so no invite is
 * ever sent to a fabricated address. Invented recipients hard-bounce, and
 * bounces are charged against the sending domain's reputation.
 *
 * Duplicated from staff-invite.mutation.spec.ts rather than shared: the two
 * specs run in the same project against the same account, and a helper module
 * between them is worth adding when a third needs it.
 */
function uniqueInviteAddress(mailbox: string) {
  const [local, domain] = mailbox.split("@");
  return `${local.split("+")[0]}+e2e-${Date.now()}@${domain}`;
}

/**
 * Neither dialog on this page carries a dialog role or an accessible name, so
 * each is anchored on a field only it contains - "Job title" is in the edit
 * form and not the invite one.
 */
function editDialog(page: Page) {
  return page.locator("form").filter({ has: page.getByLabel("Job title") });
}

function inviteDialog(page: Page) {
  return page
    .locator("form")
    .filter({ has: page.getByLabel("Email addresses") });
}

/**
 * The member this run created, so the hook below can reach them.
 *
 * Not a `finally` inside the test: a `finally` does not survive a test TIMEOUT.
 * Playwright interrupts the test body and every request in the finally is
 * aborted - which is exactly the run that has already created the member and
 * would otherwise leave them with live access.
 */
let invitedPrincipalId = "";

test.beforeEach(async () => {
  test.skip(
    !process.env.E2E_MUTATION_EMAIL || !process.env.E2E_MUTATION_PASSWORD,
    "Mutation E2E credentials are not set."
  );

  invitedPrincipalId = "";
});

/**
 * Best effort, and not a real teardown - there is none to write. Staff rows
 * cannot be deleted, so every run leaves a member behind exactly as
 * staff-invite.mutation.spec.ts does; the most this can do is make sure the
 * leftover holds no access.
 */
test.afterEach(async ({ page }) => {
  if (!invitedPrincipalId) return;

  try {
    const response = await page.request.post(
      `/api/staff/${invitedPrincipalId}/deactivate`,
      { data: { isActive: false } }
    );

    if (!response.ok()) {
      console.warn(
        `Teardown could not revoke ${invitedPrincipalId}: ${response.status()} ${await response.text()}`
      );
    }
  } catch (caught) {
    // Never let teardown bury the failure that brought us here.
    console.warn(
      `Teardown could not revoke ${invitedPrincipalId}: ${String(caught)}`
    );
  }
});

test("invites a staff member, edits their profile and revokes their access", async ({
  page
}) => {
  test.skip(
    !inviteMailbox,
    "E2E_STAFF_INVITE_EMAIL is not set, and this test refuses to send invites to an invented address."
  );

  const stamp = Date.now();
  const inviteEmail = uniqueInviteAddress(inviteMailbox!);
  // The invite dialog's Department lands on the new user row, and the directory
  // filters by it. A unique value is what isolates this run's member from the
  // rest of the organization without depending on the search box, which the
  // topbar hides below the xl breakpoint.
  const department = `E2E Dept ${stamp}`;
  const invitedName = inviteEmail.split("@")[0];
  const editedName = `E2E Staff ${stamp}`;
  const editedTitle = `E2E Title ${stamp}`;
  // Typed the way a person would and asserted back in E.164: the edit dialog's
  // Phone is a plain input, so normalizing this is the server's job and the
  // stored form is what the directory shows.
  const typedPhone = "212 555 0199";
  const storedPhone = "+12125550199";

  await page.goto("/dashboard/staff");

  /* ------------------------------- create ------------------------------- */

  const invite = page.getByRole("button", { name: "Invite", exact: true });
  await expect(
    invite,
    "the mutation account needs staff.invite to invite anyone"
  ).toBeEnabled({ timeout: 30_000 });
  await invite.click();

  const invitePanel = inviteDialog(page);
  await expect(invitePanel).toBeVisible();

  const addresses = invitePanel.getByLabel("Email addresses");
  await addresses.fill(inviteEmail);
  // The textarea takes a list and parses it on blur; until then `Send
  // invitations` is disabled, and clicking a disabled button moves no focus.
  await addresses.blur();
  await invitePanel.getByLabel("Department").fill(department);

  const invitePost = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/staff" &&
      response.request().method() === "POST"
  );
  // The refetch that runs AFTER the invite, told apart from the mount-time one
  // by the address it carries. Registered before the click because `refresh()`
  // fires the moment the POST resolves.
  const directoryRefresh = page.waitForResponse(
    async (response) =>
      new URL(response.url()).pathname === "/api/staff" &&
      response.request().method() === "GET" &&
      response.status() === 200 &&
      (await response.text()).includes(inviteEmail)
  );

  await invitePanel.getByRole("button", { name: "Send invitations" }).click();
  const inviteResponse = await invitePost;

  // The invitation email is allowed to fail - staff-invite.mutation.spec.ts
  // owns that branch. What this spec needs is only that the records exist.
  expect(inviteResponse.status()).toBe(200);
  await expect(invitePanel).toBeHidden({ timeout: 30_000 });

  const invitePayload = (await inviteResponse.json()) as {
    staff: Array<{ email: string; principalId: string; department: string }>;
  };
  const created = invitePayload.staff.find(
    (member) => member.email === inviteEmail
  );
  expect(created, "the invited address must come back as a staff row").toBeTruthy();
  expect(created!.department).toBe(department);

  // Handed to the teardown hook the moment it exists, so a run that dies later
  // still leaves this member without access.
  const principalId = created!.principalId;
  invitedPrincipalId = principalId;
  await directoryRefresh;

  // Narrowing to this run's department leaves exactly one row, so every
  // locator below can be scoped to it instead of to a paginated table whose
  // page this member may not be on.
  const departmentFilter = page
    .locator("select")
    .filter({ hasText: department });
  await departmentFilter.selectOption(department);

  const row = page.getByRole("row").filter({ hasText: inviteEmail });
  await expect(row).toHaveCount(1);
  // Exact, because the invited name IS the local part of the address beside
  // it - a substring match would resolve to both spans and fail strict mode.
  await expect(row.getByText(invitedName, { exact: true })).toBeVisible();
  await expect(row.getByText("Active", { exact: true })).toBeVisible();

  /* ------------------------------- update ------------------------------- */

  const edit = row.getByRole("button", { name: "Edit" });
  await expect(
    edit,
    "the mutation account needs staff.update to edit a profile"
  ).toBeEnabled();
  await edit.click();

  const editPanel = editDialog(page);
  await expect(editPanel).toBeVisible();
  // The dialog opens on the row it was launched from, not on whatever the
  // directory happened to list first.
  await expect(editPanel.getByLabel("Name", { exact: true })).toHaveValue(
    invitedName
  );

  await editPanel.getByLabel("Name", { exact: true }).fill(editedName);
  await editPanel.getByLabel("Phone", { exact: true }).fill(typedPhone);
  await editPanel.getByLabel("Job title", { exact: true }).fill(editedTitle);

  const profilePatch = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/staff/${principalId}` &&
      response.request().method() === "PATCH"
  );
  const editRefresh = page.waitForResponse(
    async (response) =>
      new URL(response.url()).pathname === "/api/staff" &&
      response.request().method() === "GET" &&
      response.status() === 200 &&
      (await response.text()).includes(editedName)
  );

  await editPanel.getByRole("button", { name: "Save", exact: true }).click();
  const patchResponse = await profilePatch;

  expect(patchResponse.status()).toBe(200);
  // Asserted before the refetch is awaited: this notice clears itself after
  // 2.8 seconds, and a full directory round trip can outlast it.
  await expect(page.getByText("Profile saved.")).toBeVisible();
  await expect(editPanel).toBeHidden();

  const patchPayload = (await patchResponse.json()) as {
    staff: { name: string; phone: string | null; title: string | null };
  };
  expect(patchPayload.staff.name).toBe(editedName);
  expect(patchPayload.staff.title).toBe(editedTitle);
  expect(
    patchPayload.staff.phone,
    "a national number must be stored as E.164"
  ).toBe(storedPhone);

  await editRefresh;
  await expect(row.getByText(editedName, { exact: true })).toBeVisible();

  // Phone and job title are not columns, so the profile dialog is the only
  // place the browser can be asked whether they actually landed.
  await row.locator("button").filter({ hasText: inviteEmail }).click();

  const profile = page.getByRole("dialog");
  await expect(profile).toBeVisible();
  await expect(profile.getByText(storedPhone, { exact: true })).toBeVisible();
  await expect(profile.getByText(editedTitle, { exact: true })).toBeVisible();
  await expect(profile.getByText(department, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Close staff profile" }).click();
  await expect(profile).toBeHidden();

  /* ------------------------------- revoke ------------------------------- */

  const revoke = row.getByRole("button", { name: "Revoke" });
  await expect(
    revoke,
    "the mutation account needs staff.deactivate to revoke anyone"
  ).toBeEnabled();

  const deactivatePost = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/staff/${principalId}/deactivate` &&
      response.request().method() === "POST"
  );
  const revokeRefresh = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/staff" &&
      response.request().method() === "GET" &&
      response.status() === 200
  );

  await revoke.click();
  const deactivateResponse = await deactivatePost;

  // A 403 here would mean the rank ceiling refused: the invitee holds no role
  // at all, so nothing about them can sit at or above the actor.
  expect(deactivateResponse.status()).toBe(200);
  await expect(page.getByText("Access revoked.")).toBeVisible();

  await revokeRefresh;
  // The status filter is still "All", so a revoked member stays on screen -
  // which is what makes the row itself assertable rather than its absence.
  await expect(row.getByText("Inactive", { exact: true })).toBeVisible();
  await expect(row.getByRole("button", { name: "Restore" })).toBeVisible();
});
