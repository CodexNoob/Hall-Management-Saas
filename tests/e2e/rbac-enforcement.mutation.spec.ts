import {
  expect,
  test as base,
  type APIRequestContext,
  type APIResponse,
  type Page
} from "@playwright/test";

/**
 * RBAC from the OTHER SIDE: what the person who was given the role can actually
 * do.
 *
 * access.mutation.spec.ts already covers authoring a role, putting somebody in
 * it, overriding an individual key, and the audit trail behind all of it - but
 * every assertion in that file is made from the Owner's browser, reading an
 * administration screen that DESCRIBES the grant. Nobody in it ever holds the
 * new role and tries to use it.
 *
 * That gap is where the interesting bug lives. A route that forgot its guard, a
 * `menu.read` check standing in for `menu.update`, a button hidden in the UI
 * while the endpoint behind it still answers - none of those are visible from
 * the effective-permissions panel, because the panel reports what the RESOLVER
 * believes and the resolver is not what a request goes through.
 * tests/unit/authz-route-coverage.test.ts proves each handler CALLS a guard; it
 * cannot prove the guard says no to the right people.
 *
 * So these tests drive two live sessions at once. The Owner grants and revokes;
 * a second, genuinely signed-in account calls the API and is believed only when
 * the server answers.
 *
 * NO WAITING IS NEEDED BETWEEN THE TWO. The decision cache is keyed on
 * `principalId:organizationId:epoch` (lib/authz/decide.ts) and three database
 * triggers bump that epoch - on principal_roles, principal_permissions and
 * role_permissions (the 20260827090000_rbac_roles_as_rows migration). A grant is
 * therefore visible to the very next request the other session makes, and a poll
 * or a sleep here would only hide a regression in those triggers.
 *
 * SAFETY IN A SHARED ORGANIZATION. One Supabase database serves every branch.
 * Nothing here touches a starter role or the Owner's own privileges, every role
 * it creates is deleted again, and the restricted account is left holding
 * exactly what it started with: nothing.
 */

const RESTRICTED_STATE = "playwright/.auth/restricted.json";

const RESTRICTED_EMAIL = process.env.E2E_RESTRICTED_EMAIL;

/** Ranks are "lower outranks higher"; the starter five occupy 100 to 500. */
const E2E_ROLE_RANK = 950;

/**
 * The probes, chosen so each answer means exactly one thing.
 *
 * `vendor.read` and `vendor.manage` are the pair that matters most: they guard
 * the SAME resource through the same route file, so a role carrying only the
 * read key is the sharpest test of whether a write is really a separate
 * question. Vendors are also inert - no money, no scheduling, no event - and
 * `GET /api/vendors` needs no fixture data to answer.
 *
 * `menu.read` is the unrelated resource: the restricted account must be refused
 * there for a reason that has nothing to do with vendors.
 */
const GRANTED_KEY = "vendor.read";
const ALLOWED_URL = "/api/vendors";
const OTHER_RESOURCE_URL = "/api/menu";

/**
 * Every negative WRITE below sends an empty body on purpose.
 *
 * In each of these routes `authorize()` is the first statement and the Zod parse
 * comes after it, so a working guard answers 403 without ever looking at the
 * body - and a guard that REGRESSED falls through to schema validation and fails
 * this test with a 4xx of a different shape. Either way nothing is written to an
 * organization every branch shares. A well-formed body would make a regression
 * here create real rows.
 */
const EMPTY_BODY = {};

type Assignment = {
  id: string;
  roleId: string;
  roleName: string;
  rank: number;
};

type StaffMember = {
  principalId: string;
  name: string;
  email: string;
  status: "Active" | "Inactive";
  assignments: Assignment[];
};

type RoleSummary = {
  id: string;
  key: string;
  name: string;
  rank: number;
  permissions: string[];
};

/**
 * The restricted account's own API session, as a fixture rather than something
 * each test opens and closes.
 *
 * A fixture's teardown runs even when the test body TIMES OUT, which a `finally`
 * does not - the same reason the fixture bookkeeping below lives in `afterEach`.
 * `baseURL` is threaded through explicitly because a context built by hand from
 * `browser` does not inherit the project's `use` options.
 *
 * The second parameter is Playwright's `use`, renamed. It is passed positionally
 * so the name is free, and `react-hooks/rules-of-hooks` reads a bare `use(...)`
 * call as a misplaced React hook - a rename keeps the lint honest everywhere
 * else rather than spending a disable comment here.
 */
const test = base.extend<{ restricted: APIRequestContext }>({
  restricted: async ({ browser, baseURL }, provide) => {
    const context = await browser.newContext({
      storageState: RESTRICTED_STATE,
      baseURL
    });

    await provide(context.request);
    await context.close();
  }
});

async function readJson<T>(response: APIResponse, what: string): Promise<T> {
  if (!response.ok()) {
    throw new Error(
      `${what} failed with ${response.status()}: ${await response.text()}`
    );
  }

  return response.json() as Promise<T>;
}

/**
 * "Refused, for the right reason, with the right words."
 *
 * The status alone is not enough. A 403 carrying `unauthenticated` would mean
 * the restricted session had simply expired, and this whole file would go green
 * while proving nothing - so the CODE is asserted too. The browser branches on
 * that code (lib/auth/errors.ts); the prose beside it is for a human.
 */
async function expectRefused(response: APIResponse, what: string) {
  expect(
    response.status(),
    `${what} must be refused by the server, not merely hidden in the UI`
  ).toBe(403);

  const body = (await response.json()) as { error?: string; code?: string };

  expect(
    body.code,
    `${what} was refused, but as "${body.code}" rather than a permission denial`
  ).toBe("not_permitted");
}

// ---------------------------------------------------------------------------
// Fixtures, provisioned over the API by the Owner
// ---------------------------------------------------------------------------

async function createRole(page: Page, name: string, permissions: string[]) {
  const payload = await readJson<{ data: { id: string } }>(
    await page.request.post("/api/access/roles", {
      data: { name, rank: E2E_ROLE_RANK, permissions }
    }),
    "POST /api/access/roles"
  );

  return payload.data.id;
}

async function assignRole(page: Page, principalId: string, roleId: string) {
  const payload = await readJson<{ data: { id: string } }>(
    await page.request.post("/api/access/assignments", {
      data: { principalId, roleId, scope: { type: "org" } }
    }),
    "POST /api/access/assignments"
  );

  return payload.data.id;
}

/**
 * The restricted account as the Owner's directory sees it.
 *
 * The zero-assignment check is an assertion rather than a filter, and it is the
 * load-bearing one in this file. If a previous run died between assigning and
 * revoking, this account still holds a role - and then a 200 further down would
 * be evidence of that leftover rather than of the grant the test just made. It
 * has to fail loudly instead, with the instruction for putting it right.
 */
async function restrictedPrincipal(page: Page) {
  const { staff } = await readJson<{ staff: StaffMember[] }>(
    await page.request.get("/api/staff"),
    "GET /api/staff"
  );

  const member = staff.find((candidate) => candidate.email === RESTRICTED_EMAIL);

  expect(
    member,
    `${RESTRICTED_EMAIL} is not a member of the organization the mutation account administers. It has to be invited and its invitation accepted before this suite can run.`
  ).toBeTruthy();

  expect(
    member!.status,
    `${RESTRICTED_EMAIL} is deactivated, so every request it makes is refused for that reason rather than for the permission under test.`
  ).toBe("Active");

  expect(
    member!.assignments.map((assignment) => assignment.roleName),
    `${RESTRICTED_EMAIL} must hold no role, or a 200 below would prove nothing. Revoke what it holds on /dashboard/access - most likely a role stranded by an interrupted run.`
  ).toEqual([]);

  return member!;
}

type Fixtures = { assignmentIds: string[]; roleIds: string[] };

/**
 * Registered as the test goes, unwound in `afterEach` - which, unlike a
 * `finally`, still runs after a timeout and carries its own timeout budget. A
 * role stranded here is a role every later run trips over, in a database shared
 * with every branch.
 */
let pending: Fixtures = { assignmentIds: [], roleIds: [] };

test.beforeEach(async () => {
  test.skip(
    !process.env.E2E_MUTATION_EMAIL || !process.env.E2E_MUTATION_PASSWORD,
    "Mutation E2E credentials are not set."
  );
  test.skip(
    !process.env.E2E_RESTRICTED_EMAIL || !process.env.E2E_RESTRICTED_PASSWORD,
    "Restricted E2E credentials are not set - see tests/README.md for what that account has to be."
  );

  pending = { assignmentIds: [], roleIds: [] };
});

/**
 * Assignments first: the foreign key from a role to its holders is RESTRICT, so
 * a role with somebody still in it cannot be deleted.
 *
 * Nothing here throws - a failing teardown would bury the failure that brought
 * us here - but everything warns, because a delete that quietly 409s reads as a
 * clean run right up until the next run fails on the leftover.
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

  for (const roleId of pending.roleIds) {
    await report(`delete role ${roleId}`, () =>
      page.request.delete(`/api/access/roles/${roleId}`)
    );
  }
});

// ---------------------------------------------------------------------------
// The baseline: holding nothing
// ---------------------------------------------------------------------------

test("a signed-in principal holding no role is refused by the API itself", async ({
  page,
  restricted
}) => {
  const subject = await restrictedPrincipal(page);

  /**
   * Proof of life, and it has to come first.
   *
   * `GET /api/support/tickets` goes through `authorizeMember` - an active member
   * of this tenant, no key required - so a 200 here separates "signed in and
   * denied everything" from "not signed in at all". Without it, every refusal
   * below would be equally well explained by an expired storage state, and this
   * file would be a very elaborate way of asserting that logged-out users get
   * 403s.
   *
   * NOT `/api/auth/session`, which is POST-only: it is the sign-in exchange, not
   * a readable session resource.
   */
  const alive = await restricted.get("/api/support/tickets");
  expect(
    alive.status(),
    "the restricted storage state is stale - re-run the setup project"
  ).toBe(200);

  /**
   * And the effective set really is empty, asked of the resolver rather than
   * inferred from the absence of assignments.
   *
   * `restrictedPrincipal` above proves this account holds no ROLE. An individual
   * GRANT override would not show up there and would quietly explain away a 200
   * further down, so the count the resolver itself reports is what settles it.
   */
  const effective = await readJson<{ data: { heldCount: number } }>(
    await page.request.get(`/api/access/effective/${subject.principalId}`),
    "GET /api/access/effective"
  );
  expect(
    effective.data.heldCount,
    "the restricted account is meant to start holding nothing at all"
  ).toBe(0);

  // Reads, across unrelated resources.
  await expectRefused(await restricted.get(ALLOWED_URL), "GET /api/vendors");
  await expectRefused(await restricted.get(OTHER_RESOURCE_URL), "GET /api/menu");
  await expectRefused(await restricted.get("/api/halls"), "GET /api/halls");
  await expectRefused(
    await restricted.get("/api/dashboard"),
    "GET /api/dashboard"
  );

  // And the access surface itself, which a principal with nothing must not even
  // be able to read.
  await expectRefused(
    await restricted.get("/api/access/roles"),
    "GET /api/access/roles"
  );
  await expectRefused(
    await restricted.get("/api/access/audit"),
    "GET /api/access/audit"
  );
});

// ---------------------------------------------------------------------------
// The loop: grant, use, revoke
// ---------------------------------------------------------------------------

test("a newly authored role grants exactly its own keys, and revoking it takes them back", async ({
  page,
  restricted
}) => {
  const subject = await restrictedPrincipal(page);
  const roleName = `E2E Enforced ${Date.now()}`;

  // Before, so that the 200 further down is attributable to the grant and not to
  // something this account could already do.
  await expectRefused(
    await restricted.get(ALLOWED_URL),
    "GET /api/vendors before any role is granted"
  );

  /* --------------------------------- grant --------------------------------- */

  const roleId = await createRole(page, roleName, [GRANTED_KEY]);
  pending.roleIds.push(roleId);
  pending.assignmentIds.push(await assignRole(page, subject.principalId, roleId));

  // No wait between the Owner's write and this read: the epoch trigger makes the
  // grant effective on the next request, and a retry loop here would paper over
  // exactly the regression worth catching.
  const allowed = await restricted.get(ALLOWED_URL);
  expect(
    allowed.status(),
    `${GRANTED_KEY} was granted, so ${ALLOWED_URL} has to answer it`
  ).toBe(200);

  // The endpoint really served the resource rather than an empty shell that
  // happened to carry a 200.
  const body = (await allowed.json()) as { vendors?: unknown[] };
  expect(Array.isArray(body.vendors)).toBe(true);

  /* ------------------------- and nothing beyond them ------------------------ */

  /**
   * The sharpest assertion in the file. `vendor.read` and `vendor.manage` guard
   * the same route file, so this is where "the read key quietly admits a write"
   * would surface - and that is a mistake nobody notices from the UI, because
   * the UI never draws the button.
   */
  await expectRefused(
    await restricted.post(ALLOWED_URL, { data: EMPTY_BODY }),
    "POST /api/vendors while holding only vendor.read"
  );

  // An unrelated resource stays shut: the grant was one key, not a door.
  await expectRefused(
    await restricted.get(OTHER_RESOURCE_URL),
    "GET /api/menu while holding only vendor.read"
  );

  /* -------------------------------- revoke --------------------------------- */

  const assignmentId = pending.assignmentIds.pop()!;
  const revoked = await page.request.delete(
    `/api/access/assignments/${assignmentId}`
  );
  expect(revoked.status()).toBe(200);

  /**
   * Revocation is the half that a permissive cache would break silently, and the
   * half nobody tests. A stale entry keyed on the OLD epoch would keep answering
   * 200 here for as long as the process lived.
   */
  await expectRefused(
    await restricted.get(ALLOWED_URL),
    "GET /api/vendors after the role was revoked"
  );
});

// ---------------------------------------------------------------------------
// Escalation, attempted by the holder rather than by the Owner
// ---------------------------------------------------------------------------

test("a role's holder cannot use it to widen itself", async ({
  page,
  restricted
}) => {
  const subject = await restrictedPrincipal(page);
  const roleName = `E2E Confined ${Date.now()}`;

  /**
   * `role.read` is granted deliberately.
   *
   * Someone who cannot see the access screen at all is refused everything below
   * for the boring reason, and the test would pass on a system with no
   * escalation guards whatsoever. Granting the READ key puts this account inside
   * the access surface - it can enumerate the roles and see exactly which one
   * would make it an Owner - and the question becomes the real one: can it act
   * on what it can see?
   *
   * access.mutation.spec.ts asserts the mirror of this from the Owner's side
   * (self-elevation, rank ceiling). Neither file covers the other: that one asks
   * whether the ADMIN screen refuses, this one asks whether the API refuses
   * somebody who never opens it.
   */
  const roleId = await createRole(page, roleName, [GRANTED_KEY, "role.read"]);
  pending.roleIds.push(roleId);
  pending.assignmentIds.push(await assignRole(page, subject.principalId, roleId));

  const readable = await restricted.get("/api/access/roles");
  expect(
    readable.status(),
    "role.read was granted, so the role list has to be readable"
  ).toBe(200);

  // Authoring a role - the direct route to any key in the catalog.
  await expectRefused(
    await restricted.post("/api/access/roles", { data: EMPTY_BODY }),
    "POST /api/access/roles while holding only role.read"
  );

  // Putting somebody - themselves included - into a role that already exists.
  await expectRefused(
    await restricted.post("/api/access/assignments", { data: EMPTY_BODY }),
    "POST /api/access/assignments while holding only role.read"
  );

  // Editing the role they hold, which would otherwise be the quiet way to add a
  // key to themselves without touching an assignment at all.
  await expectRefused(
    await restricted.patch(`/api/access/roles/${roleId}`, { data: EMPTY_BODY }),
    "PATCH the role they hold"
  );

  /**
   * And the individual exception, aimed at themselves.
   *
   * Two independent guards should stop this - `permission.override`, which this
   * account does not hold, and the self-elevation refusal that would catch it
   * even if it did. `permission.override` is the one that answers first, so
   * `not_permitted` is the expected code; the self-elevation path has its own
   * coverage in access.mutation.spec.ts and tests/unit/authz-escalation.test.ts.
   */
  await expectRefused(
    await restricted.put(`/api/access/overrides/${subject.principalId}`, {
      data: EMPTY_BODY
    }),
    "PUT an individual override onto themselves"
  );

  // Reading the audit trail is a separate key again, and was not granted.
  await expectRefused(
    await restricted.get("/api/access/audit"),
    "GET /api/access/audit while holding only role.read"
  );
});

// ---------------------------------------------------------------------------
// Every role in turn, through one account
// ---------------------------------------------------------------------------

/**
 * The whole matrix: each starter role put onto the SAME member, in turn, and
 * every probe below asked of it.
 *
 * One account rather than one per role, because a role swap needs no new
 * session. `authorize()` resolves the principal from the cookie and reads
 * effective access out of the database on every request, so the moment the Owner
 * assigns a different role the very next call the member makes is decided under
 * it. Six accounts would test the same code and cost six mailboxes, six
 * passwords and six invitations that all have to stay in step with the seed.
 *
 * EXPECTATIONS ARE READ FROM THE DATABASE, NOT FROM lib/authz/starter-roles.ts.
 * That file is seed data and says so: `ensureStarterRoles` is create-only for
 * permissions, so an organization seeded before a key was dropped still holds
 * it. Asserting against the file would fail on drift that is not a bug. Asking
 * `GET /api/access/roles` for the role's live permission array means the test
 * says "whatever this role actually grants, exactly that works, and nothing
 * else" - which is the claim worth making, and it holds for roles a tenant
 * authored as well as for the starter six.
 */

/**
 * One request that some permission key guards.
 *
 * `strict` marks the reads that answer with no query parameters at all, where a
 * holder must get a plain 200. The rest take a date, a range or an id this test
 * has no business inventing, so for those a granted key only has to mean NOT
 * REFUSED - which is the entire question anyway. A denial is asserted exactly
 * either way, and that is the direction a security bug points.
 */
type Probe = {
  permission: string;
  method: "GET" | "POST" | "PUT";
  url: string;
  strict?: boolean;
};

/**
 * Every write here sends an empty body, for the reason given at EMPTY_BODY
 * above: `authorize()` is the first statement in each of these handlers and the
 * schema parse comes after it, so a holder falls through to a 4xx from Zod and
 * writes nothing. That is what makes it safe to point the write probes at an
 * organization every branch shares.
 */
const PROBES: Probe[] = [
  // Reads that need nothing to answer.
  { permission: "menu.read", method: "GET", url: "/api/menu", strict: true },
  { permission: "kitchen.read", method: "GET", url: "/api/kitchen", strict: true },
  {
    permission: "kitchen.worker.read",
    method: "GET",
    url: "/api/kitchen/workers",
    strict: true
  },
  { permission: "hall.read", method: "GET", url: "/api/halls", strict: true },
  {
    permission: "hallmap.read",
    method: "GET",
    url: "/api/hall-map-shapes",
    strict: true
  },
  { permission: "dining.read", method: "GET", url: "/api/dining", strict: true },
  { permission: "client.read", method: "GET", url: "/api/clients", strict: true },
  { permission: "vendor.read", method: "GET", url: "/api/vendors", strict: true },
  { permission: "invoice.read", method: "GET", url: "/api/billing", strict: true },
  {
    permission: "report.read",
    method: "GET",
    url: "/api/billing/reports",
    strict: true
  },
  { permission: "staff.read", method: "GET", url: "/api/staff", strict: true },
  {
    permission: "settings.read",
    method: "GET",
    url: "/api/settings",
    strict: true
  },
  {
    permission: "role.read",
    method: "GET",
    url: "/api/access/roles",
    strict: true
  },
  {
    permission: "role.read",
    method: "GET",
    url: "/api/access/catalog",
    strict: true
  },
  {
    permission: "audit.read",
    method: "GET",
    url: "/api/access/audit",
    strict: true
  },

  // Reads that take parameters this test will not invent.
  { permission: "calendar.read", method: "GET", url: "/api/dashboard" },
  { permission: "event.read", method: "GET", url: "/api/events" },
  { permission: "file.read", method: "GET", url: "/api/files" },

  /**
   * The bank feed. Held back from Administrator on purpose - see
   * ADMINISTRATOR_WITHHELD in lib/authz/starter-roles.ts - so this probe is what
   * makes "Administrator is not just a lower-ranked Owner" an assertion rather
   * than a comment.
   */
  {
    permission: "bank.connect",
    method: "GET",
    url: "/api/billing/plaid/connection"
  },

  // Writes.
  { permission: "vendor.manage", method: "POST", url: "/api/vendors" },
  { permission: "client.create", method: "POST", url: "/api/clients" },
  { permission: "hall.manage", method: "POST", url: "/api/halls" },
  { permission: "menu.create", method: "POST", url: "/api/menu" },
  { permission: "eventtype.manage", method: "POST", url: "/api/event-types" },
  {
    permission: "kitchen.worker.assign",
    method: "POST",
    url: "/api/kitchen/workers"
  },
  /**
   * Day notes, as a WRITE.
   *
   * `GET /api/today-notes` is deliberately not keyed on anything - it goes
   * through `authorizeMember`, so every active member can read the shared notes
   * for a day. `note.manage` is what the catalog says it is, "write and clear",
   * and only the POST asks for it. Probing the GET asserted a gate that was
   * never meant to exist.
   */
  { permission: "note.manage", method: "POST", url: "/api/today-notes" },

  // The three that hand out privilege. Administrator holds `role.assign` and
  // neither of the other two, which is precisely the distinction being drawn.
  { permission: "role.manage", method: "POST", url: "/api/access/roles" },
  { permission: "role.assign", method: "POST", url: "/api/access/assignments" }
];

/**
 * The starter roles this suite drives, by key.
 *
 * `owner` is deliberately absent and gets its own test below: the mutation
 * account IS an Owner, ranks are compared strictly, and `assertRankCeiling`
 * refuses a role at or above the actor's own - so nobody can hand out their own
 * rank. That refusal is a property worth asserting, not an obstacle to work
 * around.
 *
 * Named rather than discovered so each role gets its own test with its own name
 * in the report - a Playwright file body cannot await the role list before
 * declaring tests. The permissions behind each name are still read live.
 */
const ROLE_KEYS_UNDER_TEST = [
  "administrator",
  "event-manager",
  "kitchen-manager",
  "kitchen-staff",
  "viewer"
] as const;

async function readRoles(page: Page) {
  const payload = await readJson<{ roles: RoleSummary[] }>(
    await page.request.get("/api/access/roles"),
    "GET /api/access/roles"
  );

  return payload.roles;
}

/** The best (lowest) rank the acting account holds. */
function rankOf(member: StaffMember) {
  return Math.min(...member.assignments.map((assignment) => assignment.rank));
}

async function send(api: APIRequestContext, probe: Probe) {
  if (probe.method === "GET") return api.get(probe.url);
  if (probe.method === "PUT") return api.put(probe.url, { data: EMPTY_BODY });

  return api.post(probe.url, { data: EMPTY_BODY });
}

for (const roleKey of ROLE_KEYS_UNDER_TEST) {
  test(`the ${roleKey} role opens exactly the endpoints it grants`, async ({
    page,
    restricted
  }) => {
    const subject = await restrictedPrincipal(page);
    const roles = await readRoles(page);
    const role = roles.find((candidate) => candidate.key === roleKey);

    test.skip(
      !role,
      `This organization has no "${roleKey}" role. Run npm run db:seed-authorization if it should have one.`
    );

    /* -------------------------- put them in the role ------------------------- */

    pending.assignmentIds.push(
      await assignRole(page, subject.principalId, role!.id)
    );

    const held = new Set(role!.permissions);

    /**
     * Collected and reported together rather than asserted one at a time.
     *
     * A bare `expect` per probe stops at the first failure, and the first
     * failure is the least interesting thing a matrix can tell you - "menu is
     * wrong for Viewer" hides whether nine other endpoints are wrong the same
     * way or whether that one is a lone typo. The shape of the mistake is the
     * diagnosis.
     */
    const wrong: string[] = [];

    for (const probe of PROBES) {
      const response = await send(restricted, probe);
      const status = response.status();
      const body = (await response.json().catch(() => null)) as {
        code?: string;
      } | null;
      const refused = status === 403 && body?.code === "not_permitted";
      const where = `${probe.method} ${probe.url} (${probe.permission})`;

      if (held.has(probe.permission)) {
        if (refused) {
          wrong.push(`${where} was REFUSED, but ${roleKey} holds that key`);
          continue;
        }

        // A granted read that answers with no parameters has to actually answer.
        if (probe.strict && status !== 200) {
          wrong.push(`${where} answered ${status}, expected 200`);
        }

        continue;
      }

      if (!refused) {
        wrong.push(
          `${where} answered ${status}, but ${roleKey} does NOT hold that key - it must be a 403 not_permitted`
        );
      }
    }

    expect(
      wrong,
      `${roleKey} (rank ${role!.rank}, ${role!.permissions.length} keys) is not enforced as written:\n  - ${wrong.join("\n  - ")}\n`
    ).toEqual([]);
  });
}

/**
 * The role nobody can hand out, including the person holding it.
 *
 * Ranks are compared strictly, so equal rank denies: an Owner assigning Owner is
 * refused by the same guard that stops an Administrator assigning one. This is
 * the reason the loop above stops at five roles, and asserting it here is what
 * keeps that omission a documented property rather than a gap somebody later
 * "fixes" by widening the ceiling.
 */
test("nobody can assign a role at their own rank, Owner included", async ({
  page
}) => {
  const subject = await restrictedPrincipal(page);
  const roles = await readRoles(page);

  const actor = (await readJson<{ staff: StaffMember[] }>(
    await page.request.get("/api/staff"),
    "GET /api/staff"
  )).staff.find((member) => member.email === process.env.E2E_MUTATION_EMAIL);

  expect(actor, "the mutation account is not a member of its own organization")
    .toBeTruthy();

  const actorRank = rankOf(actor!);
  const peer = roles.find((candidate) => candidate.rank === actorRank);

  test.skip(
    !peer,
    `No role sits at the mutation account's own rank (${actorRank}), so there is nothing to refuse.`
  );

  const response = await page.request.post("/api/access/assignments", {
    data: {
      principalId: subject.principalId,
      roleId: peer!.id,
      scope: { type: "org" }
    }
  });

  expect(
    response.status(),
    `assigning "${peer!.name}" at the actor's own rank ${actorRank} has to be refused`
  ).toBe(403);

  const body = (await response.json()) as { code?: string };
  expect(body.code).toBe("rank_ceiling");
});
