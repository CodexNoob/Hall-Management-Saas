import { expect, test, type APIResponse, type Page } from "@playwright/test";

/**
 * /dashboard/access, end to end: authoring roles, putting people into them,
 * individual exceptions, the effective-permission explanation, and the audit
 * trail that records all of it.
 *
 * WHAT THESE TESTS ARE ACTUALLY FOR. Every guard in lib/authz/guards.ts has unit
 * coverage already, and re-asserting a pure function through a browser would buy
 * nothing. What only an end-to-end run can prove is that the screen composes its
 * writes correctly - that the epoch it carries is the one it just read, that a
 * refusal reaches the panel instead of vanishing, and that the resolver's answer
 * is what the page renders rather than something the client re-derived.
 *
 * SAFETY IN A SHARED ORGANIZATION. One Supabase database serves every branch, so
 * these specs never touch a starter role, never write to the actor's own
 * privileges, and confine every mutation to a role they created and delete
 * again. The one thing they borrow is a subject to act on - see `findSubject`.
 */

const ACTOR_EMAIL = process.env.E2E_MUTATION_EMAIL;

/**
 * Ranks are "lower outranks higher" and the starter five occupy 100 to 500. The
 * mutation account is Owner at 100, so anything above that is assignable by it;
 * 950 sits clear of the starters so a run can never be mistaken for one.
 */
const E2E_ROLE_RANK = 950;

/** Two harmless, non-dangerous keys the Owner role certainly holds. */
const ROLE_PERMISSION = "schoolcycle.read";
const EXTRA_PERMISSION = "note.manage";

type Assignment = { id: string; roleId: string; roleName: string };

type StaffMember = {
  principalId: string;
  name: string;
  email: string;
  status: "Active" | "Inactive";
  assignments: Assignment[];
};

type OverrideState = { grants: string[]; denies: string[] };

async function readJson<T>(response: APIResponse, what: string): Promise<T> {
  if (!response.ok()) {
    throw new Error(
      `${what} failed with ${response.status()}: ${await response.text()}`
    );
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Fixtures, provisioned over the API
// ---------------------------------------------------------------------------

/**
 * Set-up goes through the API, the way events.mutation.spec.ts provisions a hall
 * before it books one. Driving the role editor to reach the assignment dialog
 * would make every test downstream of the first one fail for the same reason.
 *
 * No `If-Match` header, which the server reads as "no precondition" and accepts:
 * these calls have no grid open behind them to collide with.
 */
async function createRole(page: Page, name: string, permissions: string[]) {
  const response = await page.request.post("/api/access/roles", {
    data: { name, rank: E2E_ROLE_RANK, permissions }
  });
  const payload = await readJson<{ data: { id: string } }>(
    response,
    "POST /api/access/roles"
  );

  return payload.data.id;
}

async function assignRole(page: Page, principalId: string, roleId: string) {
  const response = await page.request.post("/api/access/assignments", {
    data: { principalId, roleId, scope: { type: "org" } }
  });
  const payload = await readJson<{ data: { id: string } }>(
    response,
    "POST /api/access/assignments"
  );

  return payload.data.id;
}

async function readStaff(page: Page) {
  const payload = await readJson<{ staff: StaffMember[] }>(
    await page.request.get("/api/staff"),
    "GET /api/staff"
  );

  return payload.staff;
}

async function readOverrides(page: Page, principalId: string) {
  const payload = await readJson<{ data: OverrideState }>(
    await page.request.get(`/api/access/overrides/${principalId}`),
    "GET /api/access/overrides"
  );

  return payload.data;
}

/**
 * Somebody other than the actor to act on.
 *
 * Requirements, in order of why they matter:
 *
 * - NOT THE ACTOR. Every privilege write refuses a self-elevation, so the actor
 *   is the one principal on which none of this can be exercised. That refusal
 *   gets its own test at the bottom.
 * - NO ROLES YET. Rank is derived from what somebody holds, so a subject with
 *   nothing is unambiguously below the Owner - and it makes the effective panel
 *   assertable, because whatever this test grants is then the only thing there.
 * - A UNIQUE NAME. The People list and the audit trail are both located by name,
 *   and this organization carries dozens of leftover invitees.
 *
 * Inactive members are preferred deliberately: access already revoked means the
 * row is e2e detritus rather than a colleague, so a role that exists for the
 * length of one test is invisible to anybody real.
 */
async function findSubject(page: Page): Promise<StaffMember | null> {
  const staff = await readStaff(page);
  const nameCounts = new Map<string, number>();

  for (const member of staff) {
    nameCounts.set(member.name, (nameCounts.get(member.name) ?? 0) + 1);
  }

  const candidates = staff.filter(
    (member) =>
      member.email !== ACTOR_EMAIL &&
      member.assignments.length === 0 &&
      nameCounts.get(member.name) === 1
  );

  return (
    candidates.find((member) => member.status === "Inactive") ??
    candidates[0] ??
    null
  );
}

async function actorPrincipalId(page: Page) {
  const staff = await readStaff(page);
  const actor = staff.find((member) => member.email === ACTOR_EMAIL);

  if (!actor) {
    throw new Error(
      `${ACTOR_EMAIL} is not a member of the organization it just signed in to.`
    );
  }

  return actor;
}

type Fixtures = {
  assignmentIds: string[];
  roleIds: string[];
  restoreOverrides?: { principalId: string; state: OverrideState };
};

/**
 * What the running test has created and owes the organization back.
 *
 * Registered here rather than unwound in each test's own `finally`, because a
 * `finally` does not survive a test TIMEOUT - Playwright interrupts the test
 * body, every request inside the finally is aborted, and the fixtures are
 * stranded. An earlier draft of this file learned that the direct way: one
 * timed-out run left a role behind in a database shared with every branch.
 * `afterEach` runs after a timeout and carries its own timeout budget.
 */
let pending: Fixtures = { assignmentIds: [], roleIds: [] };

test.beforeEach(async () => {
  test.skip(
    !process.env.E2E_MUTATION_EMAIL || !process.env.E2E_MUTATION_PASSWORD,
    "Mutation E2E credentials are not set."
  );

  pending = { assignmentIds: [], roleIds: [] };
});

/**
 * Undoes the fixtures, in the only order that works.
 *
 * A role with a holder cannot be deleted - the foreign key is RESTRICT - so the
 * assignment has to go first or the role is left behind for every later run to
 * trip over.
 *
 * Nothing here throws: a teardown that failed the test would bury the failure
 * that brought us here. It does WARN, because a delete that quietly 409s reads
 * as a clean run right up until somebody looks at the roles list.
 */
test.afterEach(async ({ page }) => {
  const report = async (what: string, send: () => Promise<APIResponse>) => {
    try {
      const response = await send();

      if (!response.ok()) {
        console.warn(
          `Teardown could not ${what}: ${response.status()} ${await response.text()}`
        );
      }
    } catch (caught) {
      console.warn(`Teardown could not ${what}: ${String(caught)}`);
    }
  };

  for (const assignmentId of pending.assignmentIds) {
    await report(`revoke assignment ${assignmentId}`, () =>
      page.request.delete(`/api/access/assignments/${assignmentId}`)
    );
  }

  if (pending.restoreOverrides) {
    const { principalId, state } = pending.restoreOverrides;

    await report(`restore the overrides on ${principalId}`, () =>
      page.request.put(`/api/access/overrides/${principalId}`, { data: state })
    );
  }

  for (const roleId of pending.roleIds) {
    await report(`delete role ${roleId}`, () =>
      page.request.delete(`/api/access/roles/${roleId}`)
    );
  }
});

// ---------------------------------------------------------------------------
// Locators
// ---------------------------------------------------------------------------

/**
 * One row in the Roles list, matched on its name EXACTLY.
 *
 * Two things made the loose version wrong. The tab draws a second list - the
 * people beneath, whose subtitle is the roles each of them holds - so an
 * unscoped `getByRole("listitem")` reaches rows that are not roles at all. And
 * `hasText` is a case-insensitive substring match, so "Owner" also selected a
 * role literally named "owner": this organization has one, an Administrator row
 * a legacy backfill renamed, and the two are different roles that a test must
 * not confuse. Anchoring on the named list and on exact text distinguishes them
 * while still failing loudly if two roles ever genuinely share a name.
 */
function roleRow(page: Page, name: string) {
  return page
    .getByRole("list", { name: "Roles" })
    .getByRole("listitem")
    .filter({ has: page.getByText(name, { exact: true }) });
}

function permissionRow(page: Page, key: string) {
  return page.getByRole("listitem").filter({ hasText: key });
}

/**
 * A tab in Staff management.
 *
 * Access stopped being its own page and became tabs inside Staff, so the three
 * this suite used to click are now two of four: Roles and the permission
 * summary share "Roles & Permissions", and the audit trail is "Activity". The
 * old names are kept as the argument so the tests below still read in the
 * vocabulary of what they are testing rather than of where it currently lives.
 */
function tab(page: Page, name: "Roles" | "People" | "Audit") {
  // Roles and the permission summary stack in one tab, so "Roles" and "People"
  // resolve to the same button and both sections are on screen together.
  const label = name === "Audit" ? "Activity" : "Roles & Permissions";

  return page.getByRole("button", { name: label, exact: true });
}

/**
 * The refetch `refresh()` runs after every write on this screen.
 *
 * Awaited between mutations rather than skipped, because the epoch the NEXT
 * write carries is read out of this response. Composing a second change against
 * the epoch from before the first one is exactly the stale precondition the
 * server refuses with a 409.
 */
function rolesRefetched(page: Page) {
  return page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/access/roles" &&
      response.request().method() === "GET" &&
      response.ok()
  );
}

function effectiveRefetched(page: Page, principalId: string) {
  return page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/access/effective/${principalId}` &&
      response.request().method() === "GET" &&
      response.ok()
  );
}

/**
 * The role editor overlay, which is a named dialog.
 *
 * Scoped rather than addressed from the page: the effective-permission panel
 * shares the Roles & Permissions tab with the roles list, so it is behind this
 * overlay whenever the editor is open and it carries controls of its own - "the
 * checkbox on the page" is two checkboxes without a boundary.
 */
function roleEditor(page: Page) {
  return page.getByRole("dialog", { name: /^(Edit .+|New role)$/ });
}

/** Filters the catalog down to one key and ticks it. */
async function tickPermission(page: Page, key: string) {
  const editor = roleEditor(page);
  await editor.getByPlaceholder("Filter permissions").fill(key);

  // The editor's own checkboxes: the permission summary behind it carries a
  // filter toggle of its own, which a page-wide lookup counts as a second match.
  const checkbox = editor.getByRole("checkbox");
  await expect(
    checkbox,
    `"${key}" must match exactly one catalog entry for this to be unambiguous`
  ).toHaveCount(1);
  await checkbox.check();
}

// ---------------------------------------------------------------------------
// Roles: the tab that makes "add a role" an INSERT rather than a release
// ---------------------------------------------------------------------------

test("authors a role, edits what it grants, and deletes it", async ({
  page
}) => {
  const roleName = `E2E Role ${Date.now()}`;

  await page.goto("/dashboard/access");

  const newRole = page.getByRole("button", { name: "New role" });
  await expect(
    newRole,
    "the mutation account needs role.manage to author roles"
  ).toBeEnabled({ timeout: 30_000 });

  // Asserted before anything is created, while the list is still only starter
  // roles: a starter role's grants are editable and the role itself is not
  // deletable, and the button says which of those two it is.
  const starterDelete = roleRow(page, "Owner").getByRole("button", {
    name: "Delete"
  });
  await expect(starterDelete).toBeDisabled();
  await expect(starterDelete).toHaveAttribute(
    "title",
    /Starter roles cannot be deleted/
  );

  /* -------------------------------- create -------------------------------- */

  await newRole.click();
  await expect(page.getByRole("heading", { name: "New role" })).toBeVisible();

  await page.getByLabel("Name", { exact: true }).fill(roleName);
  await page.getByLabel("Rank", { exact: true }).fill(String(E2E_ROLE_RANK));
  await tickPermission(page, ROLE_PERMISSION);
  // The counter reads off the whole catalog, not the filtered view, so the
  // denominator is however many keys the catalog carries today.
  await expect(page.getByText(/1 of \d+ permissions selected/)).toBeVisible();

  const created = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/access/roles" &&
      response.request().method() === "POST"
  );
  let refetched = rolesRefetched(page);

  await page.getByRole("button", { name: "Create role" }).click();
  const createResponse = await created;

  expect(createResponse.status()).toBe(201);
  const roleId = ((await createResponse.json()) as { data: { id: string } }).data
    .id;
  pending.roleIds.push(roleId);
  await refetched;

  await expect(page.getByRole("heading", { name: "New role" })).toBeHidden();
  const row = roleRow(page, roleName);
  await expect(row).toHaveCount(1);
  await expect(
    row.getByText(`rank ${E2E_ROLE_RANK} · 1 permissions · 0 holders`)
  ).toBeVisible();

  /* --------------------------------- edit --------------------------------- */

  await row.getByRole("button", { name: "Edit" }).click();
  await expect(
    page.getByRole("heading", { name: `Edit ${roleName}` })
  ).toBeVisible();
  // The editor opens on the role it was launched from, populated from the
  // server's own answer rather than from whatever the list happened to show.
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(roleName);
  await expect(page.getByLabel("Rank", { exact: true })).toHaveValue(
    String(E2E_ROLE_RANK)
  );

  const description = `Authored by an E2E run at ${new Date(Date.now()).toISOString()}`;
  await page.getByLabel("Description", { exact: true }).fill(description);
  await tickPermission(page, EXTRA_PERMISSION);

  const updated = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/access/roles/${roleId}` &&
      response.request().method() === "PATCH"
  );
  refetched = rolesRefetched(page);

  await page.getByRole("button", { name: "Save role" }).click();
  const updateResponse = await updated;

  expect(updateResponse.status()).toBe(200);
  const updatePayload = (await updateResponse.json()) as {
    data: { permissions: string[]; description: string | null };
  };
  expect(updatePayload.data.permissions.sort()).toEqual(
    [ROLE_PERMISSION, EXTRA_PERMISSION].sort()
  );
  expect(updatePayload.data.description).toBe(description);
  await refetched;

  await expect(
    page.getByRole("heading", { name: `Edit ${roleName}` })
  ).toBeHidden();
  await expect(
    row.getByText(`rank ${E2E_ROLE_RANK} · 2 permissions · 0 holders`)
  ).toBeVisible();
  await expect(row.getByText(description)).toBeVisible();

  /* -------------------------------- delete -------------------------------- */

  const deleted = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/access/roles/${roleId}` &&
      response.request().method() === "DELETE"
  );
  refetched = rolesRefetched(page);

  await row.getByRole("button", { name: "Delete" }).click();
  expect((await deleted).status()).toBe(200);
  await refetched;

  await expect(row).toHaveCount(0);
  // Deleted through the screen, so the teardown must not try again and warn
  // about a role that is correctly gone.
  pending.roleIds = [];
});

test("refuses a role edit composed against an epoch somebody else has moved", async ({
  page
}) => {
  const roleName = `E2E Stale ${Date.now()}`;
  const rivalName = `E2E Rival ${Date.now()}`;

  const roleId = await createRole(page, roleName, [ROLE_PERMISSION]);
  pending.roleIds.push(roleId);

  await page.goto("/dashboard/access");
  await expect(roleRow(page, roleName)).toHaveCount(1, { timeout: 30_000 });

  // The editor captures the epoch as it opens, which is what makes the rest of
  // this a genuine race rather than a contrived header.
  await roleRow(page, roleName).getByRole("button", { name: "Edit" }).click();
  await expect(
    page.getByRole("heading", { name: `Edit ${roleName}` })
  ).toBeVisible();

  /**
   * The other administrator. Creating a role writes `role_permissions` rows,
   * and it is those rows that carry the epoch trigger - editing a name or a
   * description does not move the epoch at all, so a rename here would prove
   * nothing.
   */
  pending.roleIds.push(await createRole(page, rivalName, [ROLE_PERMISSION]));

  await page.getByLabel("Name", { exact: true }).fill(`${roleName} v2`);

  const refused = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/access/roles/${roleId}` &&
      response.request().method() === "PATCH"
  );
  await page.getByRole("button", { name: "Save role" }).click();

  expect((await refused).status()).toBe(409);
  await expect(
    page.getByText("Someone else changed permissions while you were editing.")
  ).toBeVisible();
  // The editor deliberately stays open holding the unsaved intent. Silently
  // retrying would apply an edit composed against a matrix that has moved.
  await expect(
    page.getByRole("heading", { name: `Edit ${roleName}` })
  ).toBeVisible();
});

// ---------------------------------------------------------------------------
// Assignments: who holds what
// ---------------------------------------------------------------------------

test("assigns a role from the staff directory and revokes it again", async ({
  page
}) => {
  // The topbar hides its search below the xl breakpoint, and searching is the
  // only way to reach one member of a directory this size without paging.
  await page.setViewportSize({ width: 1440, height: 900 });

  const subject = await findSubject(page);
  test.skip(
    !subject,
    "No staff member is available to act on: every member either is the actor, already holds a role, or shares a name with somebody else."
  );

  const roleName = `E2E Assign ${Date.now()}`;
  const roleId = await createRole(page, roleName, [ROLE_PERMISSION]);
  pending.roleIds.push(roleId);

  await page.goto("/dashboard/staff");
  await page
    .getByPlaceholder("Search staff, roles and departments")
    .fill(subject!.email);

  const row = page.getByRole("row").filter({ hasText: subject!.email });
  await expect(row).toHaveCount(1, { timeout: 30_000 });

  const openAccess = row.getByRole("button", { name: "Access" });
  await expect(
    openAccess,
    "the mutation account needs role.assign to open the assignment dialog"
  ).toBeEnabled();
  await openAccess.click();

  await expect(
    page.getByRole("heading", { name: `Access for ${subject!.name}` })
  ).toBeVisible();
  // The correct default, and the dialog says so rather than looking broken.
  await expect(page.getByText(/Nothing yet\./)).toBeVisible();

  /* --------------------------------- assign -------------------------------- */

  /**
   * Addressed through their options rather than their labels. Each select is
   * nested INSIDE its `<label>`, so the label's text content is the caption
   * followed by every option in the list - `getByLabel("Role")` has no text to
   * match against and never resolves.
   */
  const roleOption = `${roleName} (rank ${E2E_ROLE_RANK})`;
  const roleSelect = page.locator("select").filter({ hasText: roleOption });
  const scopeSelect = page
    .locator("select")
    .filter({ hasText: "Whole organization" });

  await roleSelect.selectOption({ label: roleOption });
  await expect(scopeSelect).toHaveValue("org");

  const assigned = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/access/assignments" &&
      response.request().method() === "POST"
  );
  const staffRefetched = page.waitForResponse(
    async (response) =>
      new URL(response.url()).pathname === "/api/staff" &&
      response.request().method() === "GET" &&
      response.ok() &&
      (await response.text()).includes(roleName)
  );

  await page.getByRole("button", { name: "Assign" }).click();
  const assignResponse = await assigned;

  expect(assignResponse.status()).toBe(201);
  const assignPayload = (await assignResponse.json()) as {
    data: { id: string; scopeType: string };
  };
  pending.assignmentIds.push(assignPayload.data.id);
  expect(assignPayload.data.scopeType).toBe("org");

  await expect(
    page.getByRole("heading", { name: `Access for ${subject!.name}` })
  ).toBeHidden();
  await staffRefetched;
  // The directory is the other half of the assignment: a role somebody holds
  // has to be visible where people actually look for it.
  await expect(row.getByText(roleName, { exact: true })).toBeVisible();

  /* ----------------------- what the holder now prevents --------------------- */

  await page.goto("/dashboard/access");
  const roleListRow = roleRow(page, roleName);
  await expect(roleListRow).toHaveCount(1, { timeout: 30_000 });
  await expect(
    roleListRow.getByText(`rank ${E2E_ROLE_RANK} · 1 permissions · 1 holder`)
  ).toBeVisible();

  // Not merely discouraged: the foreign key is RESTRICT, and the button says
  // what to do about it instead of letting the click fail.
  const deleteRoleButton = roleListRow.getByRole("button", { name: "Delete" });
  await expect(deleteRoleButton).toBeDisabled();
  await expect(deleteRoleButton).toHaveAttribute(
    "title",
    /Reassign the people holding this role first/
  );

  /* --------------------------------- revoke -------------------------------- */

  await page.goto("/dashboard/staff");
  await page
    .getByPlaceholder("Search staff, roles and departments")
    .fill(subject!.email);
  await expect(row).toHaveCount(1, { timeout: 30_000 });
  await row.getByRole("button", { name: "Access" }).click();

  const holding = page.getByRole("listitem").filter({ hasText: roleName });
  await expect(holding).toHaveCount(1);
  await expect(holding.getByText("Whole organization")).toBeVisible();

  const revoked = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/access/assignments/${assignPayload.data.id}` &&
      response.request().method() === "DELETE"
  );

  await holding.getByRole("button", { name: "Revoke" }).click();
  expect((await revoked).status()).toBe(200);
  // Revoked through the screen; the role delete in teardown needs this gone
  // first, and it already is.
  pending.assignmentIds = [];

  // The dialog stays open through a revoke - it is a list you work down, not a
  // one-shot form - so the empty state coming back is the assertion.
  await expect(page.getByText(/Nothing yet\./)).toBeVisible();
  // Exact: the collapsed sidebar behind this overlay carries a "Close Sidebar".
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(row.getByText(roleName, { exact: true })).toBeHidden();
});

test("recovers the assignment dialog from a stale epoch instead of dead-ending", async ({
  page
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  const subject = await findSubject(page);
  test.skip(
    !subject,
    "No staff member is available to act on: every member either is the actor, already holds a role, or shares a name with somebody else."
  );

  const roleName = `E2E Recover ${Date.now()}`;
  const rivalName = `E2E Recover Rival ${Date.now()}`;
  const roleId = await createRole(page, roleName, [ROLE_PERMISSION]);
  pending.roleIds.push(roleId);

  await page.goto("/dashboard/staff");
  await page
    .getByPlaceholder("Search staff, roles and departments")
    .fill(subject!.email);

  const row = page.getByRole("row").filter({ hasText: subject!.email });
  await expect(row).toHaveCount(1, { timeout: 30_000 });

  // Opening the dialog is what captures the epoch, so everything after this is a
  // genuine race rather than a hand-written header.
  await row.getByRole("button", { name: "Access" }).click();
  await expect(
    page.getByRole("heading", { name: `Access for ${subject!.name}` })
  ).toBeVisible();

  const roleOption = `${roleName} (rank ${E2E_ROLE_RANK})`;
  await page
    .locator("select")
    .filter({ hasText: roleOption })
    .selectOption({ label: roleOption });

  /**
   * The other administrator. Creating a role writes `role_permissions` rows and
   * those rows carry the epoch trigger, so this moves the matrix under the open
   * dialog exactly as a colleague would.
   */
  pending.roleIds.push(await createRole(page, rivalName, [ROLE_PERMISSION]));

  /* ------------------------- the refusal, then recovery -------------------- */

  const refused = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/access/assignments" &&
      response.request().method() === "POST"
  );
  // The refetch the 409 handler is supposed to trigger. THIS is the regression
  // guard: before the fix the dialog dead-ended here, nothing refetched, and
  // every retry re-sent the same stale precondition for another 409.
  const recovered = rolesRefetched(page);

  await page.getByRole("button", { name: "Assign" }).click();
  expect((await refused).status()).toBe(409);

  await expect(
    page.getByText("Someone else changed permissions while you were editing.")
  ).toBeVisible();
  // Held open with the unsaved intent rather than closed - the user decides
  // whether it still applies now that they can see the list refresh.
  await expect(
    page.getByRole("heading", { name: `Access for ${subject!.name}` })
  ).toBeVisible();

  await recovered;

  /**
   * The response is not the thing to wait on - the RE-RENDER is.
   *
   * `epoch` reaches the dialog as a prop off `rolesQuery.data`, so between the
   * refetch landing and React writing it into the tree there is a window where
   * the retry would still send the old precondition. The rival role appearing
   * among the options is the observable proof that the new list - and with it
   * the new epoch - is what the dialog is now holding. An earlier draft awaited
   * only the response and failed here for exactly that reason.
   */
  await expect(
    page.locator("select option").filter({ hasText: rivalName }),
    "the refetched role list has to reach the dialog before the retry"
  ).toHaveCount(1);

  /* ---------------------- the same click, now composable ------------------- */

  const accepted = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/access/assignments" &&
      response.request().method() === "POST"
  );

  await page.getByRole("button", { name: "Assign" }).click();
  const assignResponse = await accepted;

  expect(
    assignResponse.status(),
    "the retry after a refreshed epoch has to go through, or the dialog is still a dead end"
  ).toBe(201);

  pending.assignmentIds.push(
    ((await assignResponse.json()) as { data: { id: string } }).data.id
  );

  await expect(
    page.getByRole("heading", { name: `Access for ${subject!.name}` })
  ).toBeHidden();
});

// ---------------------------------------------------------------------------
// Effective permissions and individual overrides
// ---------------------------------------------------------------------------

test("explains where a permission comes from, then grants and denies one by hand", async ({
  page
}) => {
  const subject = await findSubject(page);
  test.skip(
    !subject,
    "No staff member is available to act on: every member either is the actor, already holds a role, or shares a name with somebody else."
  );

  const roleName = `E2E Effective ${Date.now()}`;
  const principalId = subject!.principalId;

  // Registered before anything is written, and read from the server rather than
  // assumed empty: the teardown puts back exactly the exceptions this person
  // already had, instead of clearing whatever it finds.
  pending.restoreOverrides = {
    principalId,
    state: await readOverrides(page, principalId)
  };

  const roleId = await createRole(page, roleName, [ROLE_PERMISSION]);
  pending.roleIds.push(roleId);
  pending.assignmentIds.push(await assignRole(page, principalId, roleId));

  await page.goto("/dashboard/access");
  await tab(page, "People").click();

  await page
    .getByRole("listitem")
    .filter({ hasText: subject!.name })
    .getByRole("button")
    .click();

  await expect(
    page.getByRole("heading", {
      name: `Effective permissions - ${subject!.name}`
    })
  ).toBeVisible();
  // One role carrying one key, and the panel reports the resolver's own count
  // rather than counting the rows it drew.
  await expect(page.getByText(/^1 held\./)).toBeVisible();

  const granted = permissionRow(page, ROLE_PERMISSION);
  await expect(granted).toHaveCount(1);
  await expect(
    granted.getByText(`Via ${roleName} (Whole organization)`)
  ).toBeVisible();

  /* ---------------------------------- DENY --------------------------------- */

  const overrideWritten = () =>
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          `/api/access/overrides/${principalId}` &&
        response.request().method() === "PUT"
    );

  let written = overrideWritten();
  let resolved = effectiveRefetched(page, principalId);
  let refetched = rolesRefetched(page);

  await granted.getByRole("button", { name: "DENY", exact: true }).click();
  expect((await written).status()).toBe(200);
  await Promise.all([resolved, refetched]);

  await expect(granted.getByText(/A DENY is final/)).toBeVisible();
  // A DENY beats the role that grants it, which is the whole point of the
  // precedence rule and the one thing a summary badge could not convey.
  await expect(page.getByText(/^0 held\./)).toBeVisible();

  /* ------------------------------ back to normal --------------------------- */

  written = overrideWritten();
  resolved = effectiveRefetched(page, principalId);
  refetched = rolesRefetched(page);

  await granted.getByRole("button", { name: "Role only", exact: true }).click();
  expect((await written).status()).toBe(200);
  await Promise.all([resolved, refetched]);

  await expect(
    granted.getByText(`Via ${roleName} (Whole organization)`)
  ).toBeVisible();

  /* --------------------------------- GRANT --------------------------------- */

  // Nothing this person holds carries this key, so it is filtered out of the
  // default view - which is what "Only what matters" means, and why granting one
  // by hand starts by turning that off.
  const ungranted = permissionRow(page, EXTRA_PERMISSION);
  await expect(ungranted).toHaveCount(0);
  await page.getByLabel("Only what matters").uncheck();
  await expect(ungranted).toHaveCount(1);
  await expect(ungranted.getByText("Not held.")).toBeVisible();

  written = overrideWritten();
  resolved = effectiveRefetched(page, principalId);
  refetched = rolesRefetched(page);

  await ungranted.getByRole("button", { name: "GRANT", exact: true }).click();
  expect((await written).status()).toBe(200);
  await Promise.all([resolved, refetched]);

  await expect(
    ungranted.getByText("Granted directly to this person, organization-wide.")
  ).toBeVisible();
  await expect(page.getByText(/^2 held\./)).toBeVisible();

  // The role's own key survives the individual grant beside it. The write is a
  // full replacement of this principal's exceptions, so a client that composed
  // the body from anything but the current state would drop one of the two.
  await expect(
    granted.getByText(`Via ${roleName} (Whole organization)`)
  ).toBeVisible();
});

test("refuses to let the actor change their own permissions", async ({
  page
}) => {
  const actor = await actorPrincipalId(page);

  await page.goto("/dashboard/access");
  await tab(page, "People").click();

  await page
    .getByRole("listitem")
    .filter({ hasText: actor.name })
    .getByRole("button")
    .first()
    .click();

  await expect(
    page.getByRole("heading", { name: `Effective permissions - ${actor.name}` })
  ).toBeVisible();

  const row = permissionRow(page, EXTRA_PERMISSION);
  await expect(row).toHaveCount(1);

  /**
   * GRANT rather than DENY, on a key the actor already holds through their role.
   *
   * The direction is a safety property of the test, not a detail. If this guard
   * ever regressed, a DENY here would strip a permission from the only account
   * every other mutation spec signs in as, against a database shared with every
   * branch; a redundant GRANT would change nothing anyone could notice.
   */
  const refused = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/access/overrides/${actor.principalId}` &&
      response.request().method() === "PUT"
  );

  await row.getByRole("button", { name: "GRANT", exact: true }).click();
  expect((await refused).status()).toBe(403);

  await expect(
    page.getByText("You cannot change your own permissions.")
  ).toBeVisible();
  // Refused, not swallowed: the toggle must not look as though it took.
  await expect(
    row.getByText("Granted directly to this person, organization-wide.")
  ).toBeHidden();
});

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

test("records privilege changes in the audit trail and exports them", async ({
  page
}) => {
  const subject = await findSubject(page);
  test.skip(
    !subject,
    "No staff member is available to act on: every member either is the actor, already holds a role, or shares a name with somebody else."
  );

  const roleName = `E2E Audit ${Date.now()}`;
  const roleId = await createRole(page, roleName, [ROLE_PERMISSION]);
  pending.roleIds.push(roleId);
  pending.assignmentIds.push(
    await assignRole(page, subject!.principalId, roleId)
  );

  await page.goto("/dashboard/access");
  await tab(page, "Audit").click();

  const filtered = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/access/audit" &&
      new URL(response.url()).searchParams.get("action") ===
        "assignment.created" &&
      response.ok()
  );
  // The select carries the action codes; the labels are the screen's own
  // vocabulary, which is what an administrator reading this actually knows.
  await page.getByRole("combobox").selectOption({ label: "Role assigned" });
  await filtered;

  const entry = page
    .getByRole("listitem")
    .filter({ hasText: `Role assigned · ${subject!.name}` });
  await expect(entry.first()).toBeVisible();
  // Append-only and attributed: an audit row that cannot say who did it is
  // storage, not a control.
  await expect(entry.first().getByText(/^by /)).toBeVisible();

  /* --------------------------------- export -------------------------------- */

  const exportLink = page.getByRole("link", { name: "Export CSV" });
  await expect(exportLink).toHaveAttribute(
    "href",
    "/api/access/audit?format=csv&action=assignment.created"
  );

  // Fetched rather than clicked. What is worth asserting is that the href
  // answers with a CSV a security questionnaire could be handed; driving a
  // browser download to reach the same bytes only adds a temp file to clean up.
  const csv = await page.request.get(
    "/api/access/audit?format=csv&action=assignment.created"
  );
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(csv.headers()["content-disposition"]).toContain("attachment");

  const body = await csv.text();
  expect(body.split("\n")[0]).toBe(
    "created_at,action,actor_name,subject_name,detail"
  );
  expect(body).toContain(subject!.name);
});
