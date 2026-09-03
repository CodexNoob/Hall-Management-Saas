import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PAYLOAD CONTRACT for POST /api/auth/session.
 *
 * These assert the response body and the writes, never the internals, so the
 * provisioning modules underneath can be reshaped without touching this file.
 * That is the whole point - before this existed the route was the only
 * provisioning logic in the app and had no test of any kind.
 */

vi.mock("server-only", () => ({}));

// Hoisted so the vi.mock factory below - which vitest lifts to the top of the
// file - can close over these without touching an uninitialised binding.
const {
  findManyUsers,
  createUser,
  updateUser,
  createOrganization,
  findMembership,
  createMembership,
  updateMembership,
  findManyMemberships,
  createActivityLog,
  createPrincipal,
  findManyRoles,
  createManyAndReturnRoles,
  createManyRolePermissions,
  findManyPermissions,
  createManyPrincipalRoles,
  findManyPrincipalRoles,
  findManyPrincipalPermissions,
  findManyBetaRequests,
  upsertBetaRequest,
  updateBetaRequest
} = vi.hoisted(() => ({
  findManyUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  createOrganization: vi.fn(),
  findMembership: vi.fn(),
  createMembership: vi.fn(),
  updateMembership: vi.fn(),
  findManyMemberships: vi.fn(),
  createActivityLog: vi.fn(),
  createPrincipal: vi.fn(),
  findManyRoles: vi.fn(),
  createManyAndReturnRoles: vi.fn(),
  createManyRolePermissions: vi.fn(),
  findManyPermissions: vi.fn(),
  createManyPrincipalRoles: vi.fn(),
  findManyPrincipalRoles: vi.fn(),
  findManyPrincipalPermissions: vi.fn(),
  findManyBetaRequests: vi.fn(),
  upsertBetaRequest: vi.fn(),
  updateBetaRequest: vi.fn()
}));

vi.mock("@/lib/prisma", () => {
  const client = {
    user: { findMany: findManyUsers, create: createUser, update: updateUser },
    organization: { create: createOrganization },
    organizationMembership: {
      findFirst: findMembership,
      create: createMembership,
      update: updateMembership,
      findMany: findManyMemberships
    },
    activityLog: { create: createActivityLog },
    // The privilege tables. A membership is now a principal plus rows in
    // `principal_roles`, so provisioning materializes the starter set and the
    // resolver reads it back.
    principal: { create: createPrincipal },
    // The starter set is materialized in ONE statement, not a role at a time -
    // the loop it replaced put eleven sequential round trips inside the sign-up
    // transaction. Doubling `create` here instead would leave the route calling
    // undefined and every assertion below reading a 500.
    role: {
      findMany: findManyRoles,
      createManyAndReturn: createManyAndReturnRoles
    },
    rolePermission: { createMany: createManyRolePermissions },
    permission: { findMany: findManyPermissions },
    principalRole: {
      createMany: createManyPrincipalRoles,
      findMany: findManyPrincipalRoles
    },
    principalPermission: { findMany: findManyPrincipalPermissions },
    // The beta queue. Provisioning consults it before it may create anything,
    // so without these doubles every registration test below would fail on an
    // undefined call rather than on what it actually asserts.
    betaAccessRequest: {
      findMany: findManyBetaRequests,
      upsert: upsertBetaRequest,
      update: updateBetaRequest
    }
  };

  return {
    prisma: {
      ...client,
      // Interactive transactions run the callback against the same doubles, so
      // a test asserting "no writes" covers both paths.
      $transaction: (run: (tx: unknown) => Promise<unknown>) => run(client)
    }
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseTokenVerifier: vi.fn()
}));

vi.mock("@/lib/security/rate-limit", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null)
}));

// Whether the team is emailed is beta-access.test.ts's question. Stubbed here
// so these tests never reach Brevo and never depend on which mail variables
// happen to be set in the environment they run in.
vi.mock("@/features/beta-access/server/beta-access-notifications", () => ({
  notifyBetaAccessRequested: vi.fn().mockResolvedValue(false)
}));

import { POST } from "@/app/api/auth/session/route";
import { createSupabaseTokenVerifier } from "@/lib/supabase/server";
import { clearAccessCache } from "@/lib/authz/decide";
import {
  DEFAULT_MEMBERSHIP_ROLE_KEY,
  FOUNDING_OWNER_ROLE_KEY
} from "@/lib/authz/starter-roles";

const getUser = vi.fn();

const ORGANIZATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const AUTH_ID = "11111111-1111-4111-8111-111111111111";
const SIGNED_IN_AT = "2026-08-15T10:00:00.000Z";

const organization = {
  id: ORGANIZATION_ID,
  name: "Test Organization",
  slug: "test-organization",
  isActive: true,
  trialStartedAt: null,
  trialEndsAt: null,
  subscriptionStatus: "active",
  subscriptionPlan: null,
  subscriptionStartedAt: null,
  subscriptionEndsAt: null,
  onboardingCompletedAt: new Date("2026-01-01T00:00:00.000Z"),
  // The resolver's cache key. Every response carries it so the browser can
  // notice it is behind and refetch.
  permissionsEpoch: BigInt(1)
};

const PRINCIPAL_ID = "33333333-3333-4333-8333-333333333333";

const membership = {
  id: "membership-1",
  organizationId: ORGANIZATION_ID,
  userId: USER_ID,
  principalId: PRINCIPAL_ID,
  isActive: true,
  // Real rows always carry this and the fast path sorts on it. Omitting it
  // here would leave the sort untested - Array#sort skips the comparator
  // entirely for a single-element list.
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  organization
};

const secondOrganization = {
  ...organization,
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  name: "Second Organization",
  slug: "second-organization"
};

const secondMembership = {
  ...membership,
  id: "membership-2",
  organizationId: secondOrganization.id,
  principalId: "44444444-4444-4444-8444-444444444444",
  createdAt: new Date("2026-02-01T00:00:00.000Z"),
  organization: secondOrganization
};

const storedUser = {
  id: USER_ID,
  organizationId: ORGANIZATION_ID,
  supabaseAuthId: AUTH_ID,
  name: "Existing Name",
  email: "user@example.com",
  phone: "+15551234567",
  venueName: "Main Hall",
  title: "Team member",
  isActive: true,
  passwordSetAt: new Date("2026-01-01T00:00:00.000Z"),
  lastSignInAt: new Date(SIGNED_IN_AT)
};

/** Shapes a Supabase `auth.getUser()` result for the token the request carries. */
function supabaseUser(
  overrides: {
    user_metadata?: Record<string, unknown>;
    app_metadata?: Record<string, unknown>;
    email?: string;
    last_sign_in_at?: string;
  } = {}
) {
  return {
    data: {
      user: {
        id: AUTH_ID,
        email: overrides.email ?? storedUser.email,
        user_metadata: overrides.user_metadata ?? {},
        app_metadata: overrides.app_metadata ?? { providers: ["email"] },
        last_sign_in_at: overrides.last_sign_in_at ?? SIGNED_IN_AT
      }
    },
    error: null
  };
}

/** One row of the beta queue, as the module underneath provisioning reads it. */
function betaRequest(status: "PENDING" | "APPROVED" | "REJECTED") {
  return {
    email: storedUser.email,
    status,
    signupMethod: "email_password",
    requestedAt: new Date("2026-09-01T00:00:00.000Z"),
    supabaseAuthId: AUTH_ID
  };
}

function syncRequest() {
  return new Request("http://localhost/api/auth/session", {
    method: "POST",
    headers: { Authorization: "Bearer valid-token" }
  }) as never;
}

describe("POST /api/auth/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The resolver caches on (principal, organization, epoch), so without this
    // the first test in the file decides the verdict for every one after it -
    // and their mocked rows are never read at all.
    clearAccessCache();
    vi.mocked(createSupabaseTokenVerifier).mockReturnValue({
      auth: { getUser }
    } as never);
    getUser.mockResolvedValue(supabaseUser());

    findManyUsers.mockResolvedValue([
      { ...storedUser, memberships: [membership] }
    ]);
    findMembership.mockResolvedValue(membership);
    findManyMemberships.mockResolvedValue([membership]);
    // The resolver's two reads. A principal holding one role that grants one
    // key is enough: what the fold does with more is authz-resolver's question.
    findManyPrincipalRoles.mockResolvedValue([
      {
        scopeType: "org",
        scopeId: ORGANIZATION_ID,
        expiresAt: null,
        role: { rolePermissions: [{ permission: { key: "calendar.read" } }] }
      }
    ]);
    findManyPrincipalPermissions.mockResolvedValue([]);
    findManyRoles.mockResolvedValue([]);
    findManyPermissions.mockResolvedValue([]);
    createPrincipal.mockResolvedValue({ id: PRINCIPAL_ID });
    createManyAndReturnRoles.mockImplementation(
      async ({ data }: { data: Array<{ key: string }> }) =>
        data.map((role) => ({ id: `role-${role.key}`, key: role.key }))
    );
    createManyRolePermissions.mockResolvedValue({ count: 0 });
    createManyPrincipalRoles.mockResolvedValue({ count: 1 });
    updateUser.mockImplementation(async ({ data }: { data: object }) => ({
      ...storedUser,
      ...data
    }));
    updateMembership.mockResolvedValue(membership);
    createActivityLog.mockResolvedValue(null);
    // Approved by default, so the tests that are about PROVISIONING stay about
    // provisioning. The gate has its own block at the bottom of this file.
    findManyBetaRequests.mockResolvedValue([betaRequest("APPROVED")]);
    upsertBetaRequest.mockResolvedValue(betaRequest("PENDING"));
    updateBetaRequest.mockResolvedValue(betaRequest("PENDING"));
  });

  it("rejects a request with no bearer token", async () => {
    const response = await POST(
      new Request("http://localhost/api/auth/session", {
        method: "POST"
      }) as never
    );

    expect(response.status).toBe(401);
  });

  it("rejects a token Supabase will not verify", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("bad")
    });

    const response = await POST(syncRequest());

    expect(response.status).toBe(401);
  });

  it("returns the full payload for an already-provisioned user", async () => {
    const response = await POST(syncRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    // No `role` anywhere - not on the user, not on the organization. The
    // browser reads keys (INV-1).
    expect(body).toEqual({
      user: {
        id: USER_ID,
        email: "user@example.com",
        name: "Existing Name",
        phone: "+15551234567",
        venueName: "Main Hall",
        title: "Team member",
        organizationId: ORGANIZATION_ID
      },
      permissions: ["calendar.read"],
      scope: { hallIds: "all", eventTypeIds: "all" },
      epoch: 1,
      mustSetPassword: false,
      mustCompleteOnboarding: false,
      activeOrganizationId: ORGANIZATION_ID,
      organizations: [
        {
          id: ORGANIZATION_ID,
          name: "Test Organization",
          slug: "test-organization",
          trialStartedAt: null,
          trialEndsAt: null,
          subscriptionStatus: "active",
          subscriptionPlan: null,
          subscriptionStartedAt: null,
          subscriptionEndsAt: null,
          onboardingCompletedAt: "2026-01-01T00:00:00.000Z"
        }
      ]
    });
  });

  it("provisions an organization and an owner for a new sign-up", async () => {
    findManyUsers.mockResolvedValue([]);
    findMembership.mockResolvedValue(null);
    createOrganization.mockResolvedValue({
      ...organization,
      name: "Ada's Organization",
      subscriptionStatus: "trialing",
      onboardingCompletedAt: null
    });
    createUser.mockResolvedValue({
      ...storedUser,
      name: "Ada",
      phone: null,
      venueName: null
    });
    createMembership.mockResolvedValue(membership);
    findManyMemberships.mockResolvedValue([
      {
        ...membership,
        organization: {
          ...organization,
          name: "Ada's Organization",
          subscriptionStatus: "trialing",
          onboardingCompletedAt: null
        }
      }
    ]);
    // What the founder's new assignment resolves to. `settings.update` is the
    // key that gates naming the organization, so onboarding is decided by what
    // they may DO rather than by what their role is called.
    findManyPrincipalRoles.mockResolvedValue([
      {
        scopeType: "org",
        scopeId: ORGANIZATION_ID,
        expiresAt: null,
        role: {
          rolePermissions: [{ permission: { key: "settings.update" } }]
        }
      }
    ]);
    getUser.mockResolvedValue(
      supabaseUser({
        user_metadata: { full_name: "Ada", account_type: "organization_owner" }
      })
    );

    const response = await POST(syncRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(createOrganization).toHaveBeenCalledTimes(1);
    // What makes them the owner is an assignment, not a column: the starter set
    // is materialized and the founder gets the top role organization-wide.
    // Without it the sign-up completes and the new owner can do nothing.
    expect(createManyAndReturnRoles).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ key: FOUNDING_OWNER_ROLE_KEY })
        ])
      })
    );
    expect(createManyPrincipalRoles).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            principalId: PRINCIPAL_ID,
            roleId: `role-${FOUNDING_OWNER_ROLE_KEY}`,
            scopeType: "org"
          })
        ]
      })
    );
    // The owner still has to name the organization on /dashboard/new.
    expect(body.mustCompleteOnboarding).toBe(true);
    expect(body.organizations[0].subscriptionStatus).toBe("trialing");
  });

  it("does not claim a Google owner has a password", async () => {
    // /auth/callback stamps `account_type` after the OAuth return, because
    // signInWithOAuth cannot carry metadata through the provider - so this is
    // exactly what the session route sees for a social sign-up.
    findManyUsers.mockResolvedValue([]);
    getUser.mockResolvedValue(
      supabaseUser({
        user_metadata: { full_name: "Ada", account_type: "organization_owner" },
        app_metadata: { providers: ["google"] }
      })
    );

    const response = await POST(syncRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(createOrganization).toHaveBeenCalledTimes(1);
    // The account has no password and never chose one. Stamping passwordSetAt
    // here would tell the security panel otherwise.
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passwordSetAt: null })
      })
    );
    // ...and they must not be pushed into /set-password for one either.
    expect(body.mustSetPassword).toBe(false);
  });

  it("refuses to provision an unknown email that is not an owner sign-up", async () => {
    findManyUsers.mockResolvedValue([]);
    getUser.mockResolvedValue(
      supabaseUser({ email: "stranger@example.com", user_metadata: {} })
    );

    const response = await POST(syncRequest());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toMatch(/invitation/i);
    expect(createOrganization).not.toHaveBeenCalled();
    expect(createUser).not.toHaveBeenCalled();
  });

  it("keeps the administrator-set profile of invited staff who carry no metadata", async () => {
    getUser.mockResolvedValue(supabaseUser({ user_metadata: {} }));

    const response = await POST(syncRequest());
    const body = await response.json();

    expect(body.user.name).toBe("Existing Name");
    expect(body.user.venueName).toBe("Main Hall");
    expect(body.user.phone).toBe("+15551234567");
  });

  it("does not ask an OAuth-only user to set a password", async () => {
    findManyUsers.mockResolvedValue([
      {
        ...storedUser,
        passwordSetAt: null,
        memberships: [membership]
      }
    ]);
    getUser.mockResolvedValue(
      supabaseUser({ app_metadata: { providers: ["google"] } })
    );

    const response = await POST(syncRequest());

    expect((await response.json()).mustSetPassword).toBe(false);
  });

  it("asks a password user with no password on record to set one", async () => {
    findManyUsers.mockResolvedValue([
      {
        ...storedUser,
        passwordSetAt: null,
        memberships: [membership]
      }
    ]);
    getUser.mockResolvedValue(
      supabaseUser({ app_metadata: { providers: ["email"] } })
    );

    const response = await POST(syncRequest());

    expect((await response.json()).mustSetPassword).toBe(true);
  });

  /**
   * The bug this refactor exists to kill, split into its two independent
   * guards. DELETE /api/staff clears BOTH flags, so a test that deactivates
   * both cannot tell which guard fired - remove either one and it still passes.
   * Each case below leaves the other flag alone and asserts the specific copy,
   * so both guards are pinned separately.
   */
  it("refuses a deactivated user even while their membership is intact", async () => {
    findManyUsers.mockResolvedValue([
      {
        ...storedUser,
        isActive: false,
        memberships: [membership]
      }
    ]);

    const response = await POST(syncRequest());

    expect(response.status).toBe(403);
    expect((await response.json()).error).toMatch(
      /account has been deactivated/i
    );
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("refuses a user whose only membership has been revoked", async () => {
    findManyUsers.mockResolvedValue([
      {
        ...storedUser,
        memberships: [{ ...membership, isActive: false }]
      }
    ]);
    findManyMemberships.mockResolvedValue([]);

    const response = await POST(syncRequest());

    expect(response.status).toBe(403);
    expect((await response.json()).error).toMatch(
      /access .* has been removed/i
    );
    expect(updateMembership).not.toHaveBeenCalled();
    expect(createMembership).not.toHaveBeenCalled();
  });

  /** The state DELETE /api/staff actually leaves behind. */
  it("does not reinstate a removed employee who signs in again", async () => {
    findManyUsers.mockResolvedValue([
      {
        ...storedUser,
        isActive: false,
        memberships: [{ ...membership, isActive: false }]
      }
    ]);

    const response = await POST(syncRequest());

    expect(response.status).toBe(403);
    expect(updateUser).not.toHaveBeenCalled();
    expect(updateMembership).not.toHaveBeenCalled();
    expect(createMembership).not.toHaveBeenCalled();
  });

  it("writes nothing when the user is already in sync", async () => {
    await POST(syncRequest());

    expect(updateUser).not.toHaveBeenCalled();
    expect(createUser).not.toHaveBeenCalled();
    expect(updateMembership).not.toHaveBeenCalled();
    expect(createMembership).not.toHaveBeenCalled();
    expect(createActivityLog).not.toHaveBeenCalled();
  });

  it("logs a sign-in once per Supabase session, not once per sync", async () => {
    // Supabase reports a sign-in newer than the one on record.
    findManyUsers.mockResolvedValue([
      {
        ...storedUser,
        lastSignInAt: new Date("2026-08-14T10:00:00.000Z"),
        memberships: [membership]
      }
    ]);

    await POST(syncRequest());

    expect(createActivityLog).toHaveBeenCalledTimes(1);
    expect(createActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actionType: "auth.login.success" })
      })
    );

    // A second sync for the same session is a no-op.
    vi.clearAllMocks();
    findManyUsers.mockResolvedValue([
      { ...storedUser, memberships: [membership] }
    ]);
    findMembership.mockResolvedValue(membership);
    findManyMemberships.mockResolvedValue([membership]);

    await POST(syncRequest());

    expect(createActivityLog).not.toHaveBeenCalled();
  });

  it("lists every active organization, oldest first, and starts on the primary one", async () => {
    findManyUsers.mockResolvedValue([
      {
        ...storedUser,
        // Deliberately out of order, and carrying one revoked membership.
        memberships: [
          secondMembership,
          membership,
          {
            ...secondMembership,
            id: "membership-3",
            organizationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            isActive: false
          }
        ]
      }
    ]);

    const body = await (await POST(syncRequest())).json();

    expect(body.organizations.map((entry: { id: string }) => entry.id)).toEqual(
      [ORGANIZATION_ID, secondOrganization.id]
    );
    expect(body.activeOrganizationId).toBe(ORGANIZATION_ID);
  });

  it("claims a legacy user who has no supabaseAuthId yet", async () => {
    findManyUsers.mockResolvedValue([
      {
        ...storedUser,
        supabaseAuthId: null,
        memberships: [membership]
      }
    ]);

    await POST(syncRequest());

    expect(updateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ supabaseAuthId: AUTH_ID })
      })
    );
  });

  it("mirrors a changed Supabase display name onto the user", async () => {
    getUser.mockResolvedValue(
      supabaseUser({ user_metadata: { full_name: "Renamed Person" } })
    );

    await POST(syncRequest());

    expect(updateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Renamed Person" })
      })
    );
  });

  /**
   * THE BETA GATE.
   *
   * `provisionOwner` is the only code in the application that may create an
   * organization from nothing, and everything else - every API route, the whole
   * dashboard - needs a `users` row that only it writes. So these are not "one
   * of the places an applicant is refused"; they are the place.
   *
   * A new registration is one with no user row at all, so each case clears
   * `findManyUsers` and supplies the owner flag Supabase would carry.
   */
  describe("beta access", () => {
    function newRegistration(providers = ["email"]) {
      findManyUsers.mockResolvedValue([]);
      findMembership.mockResolvedValue(null);
      getUser.mockResolvedValue(
        supabaseUser({
          user_metadata: {
            full_name: "Ada",
            account_type: "organization_owner"
          },
          app_metadata: { providers }
        })
      );
    }

    /** Nothing at all was created for this identity. */
    function expectNothingProvisioned() {
      expect(createOrganization).not.toHaveBeenCalled();
      expect(createUser).not.toHaveBeenCalled();
      expect(createMembership).not.toHaveBeenCalled();
      expect(createManyPrincipalRoles).not.toHaveBeenCalled();
    }

    it("records a request for a first-time email/password registration", async () => {
      newRegistration();
      findManyBetaRequests.mockResolvedValue([]);
      upsertBetaRequest.mockResolvedValue(betaRequest("PENDING"));

      const response = await POST(syncRequest());

      expect(upsertBetaRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            email: storedUser.email,
            status: "PENDING",
            signupMethod: "email_password",
            supabaseAuthId: AUTH_ID
          })
        })
      );
      expect(response.status).toBe(403);
      expectNothingProvisioned();
    });

    it("records a Google registration as one", async () => {
      // The half the public form cannot cover: an OAuth round trip has no
      // client-side registration moment, so this path is the only thing that
      // ever queues a Google applicant.
      newRegistration(["google"]);
      findManyBetaRequests.mockResolvedValue([]);
      upsertBetaRequest.mockResolvedValue(betaRequest("PENDING"));

      await POST(syncRequest());

      expect(upsertBetaRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ signupMethod: "google" })
        })
      );
    });

    it("opens no second request for somebody who registered already", async () => {
      newRegistration();
      findManyBetaRequests.mockResolvedValue([betaRequest("PENDING")]);

      const response = await POST(syncRequest());

      expect(upsertBetaRequest).not.toHaveBeenCalled();
      expect(response.status).toBe(403);
    });

    it("refuses a pending applicant with a code the browser can route on", async () => {
      newRegistration();
      findManyBetaRequests.mockResolvedValue([betaRequest("PENDING")]);

      const response = await POST(syncRequest());
      const body = await response.json();

      expect(response.status).toBe(403);
      // The code is what sends them to /beta-pending rather than to a sign-in
      // form with a red message on it.
      expect(body.code).toBe("beta_access_pending");
      expect(body.error).toMatch(/beta access request has been received/i);
      // 403 matters as much as the code: `isTerminalAuthSessionError` keys off
      // the status to end the Supabase session, and without that the applicant
      // holds a live session proxy.ts will not let them leave.
      expectNothingProvisioned();
    });

    it("refuses a rejected applicant, and says something different", async () => {
      newRegistration();
      findManyBetaRequests.mockResolvedValue([betaRequest("REJECTED")]);

      const response = await POST(syncRequest());
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.code).toBe("beta_access_rejected");
      // Not the pending copy: telling somebody who was turned down that we will
      // reach out leaves them waiting for a message that is not coming.
      expect(body.error).not.toMatch(/reach out/i);
      expectNothingProvisioned();
    });

    it("provisions the organization, membership and trial once approved", async () => {
      newRegistration();
      findManyBetaRequests.mockResolvedValue([betaRequest("APPROVED")]);
      createOrganization.mockResolvedValue({
        ...organization,
        subscriptionStatus: "trialing",
        onboardingCompletedAt: null
      });
      createUser.mockResolvedValue(storedUser);
      createMembership.mockResolvedValue(membership);
      findManyMemberships.mockResolvedValue([
        {
          ...membership,
          organization: {
            ...organization,
            subscriptionStatus: "trialing",
            onboardingCompletedAt: null
          }
        }
      ]);
      findManyPrincipalRoles.mockResolvedValue([
        {
          scopeType: "org",
          scopeId: ORGANIZATION_ID,
          expiresAt: null,
          role: {
            rolePermissions: [{ permission: { key: "settings.update" } }]
          }
        }
      ]);

      const response = await POST(syncRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      // Approval grants access to the EXISTING flow rather than replacing it:
      // the same organization, the same founding role, the same trial, and the
      // same trip through /dashboard/new.
      expect(createOrganization).toHaveBeenCalledTimes(1);
      expect(createMembership).toHaveBeenCalledTimes(1);
      expect(createManyPrincipalRoles).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [
            expect.objectContaining({
              roleId: `role-${FOUNDING_OWNER_ROLE_KEY}`
            })
          ]
        })
      );
      expect(body.mustCompleteOnboarding).toBe(true);
      expect(body.organizations[0].subscriptionStatus).toBe("trialing");
    });

    /**
     * Invited staff must not be treated as owner applicants.
     *
     * They cannot be, by construction: POST /api/staff writes their `users` row
     * at invite time, so `findUserForProfile` matches them and `reconcile` runs
     * - `provisionOwner`, and therefore the gate, is never reached. This pins
     * it, because the property is invisible in the gate's own code.
     */
    it("lets invited staff sign in without touching the beta queue", async () => {
      // The default `findManyUsers` in beforeEach IS an invited-then-provisioned
      // employee: a user row that already exists.
      getUser.mockResolvedValue(supabaseUser({ user_metadata: {} }));

      const response = await POST(syncRequest());

      expect(response.status).toBe(200);
      expect(findManyBetaRequests).not.toHaveBeenCalled();
      expect(upsertBetaRequest).not.toHaveBeenCalled();
    });

    it("still refuses a stranger who is not registering at all", async () => {
      // The pre-existing invitation refusal comes first and is unchanged: they
      // never asked to open an organization, so they do not belong in the queue.
      findManyUsers.mockResolvedValue([]);
      getUser.mockResolvedValue(
        supabaseUser({ email: "stranger@example.com", user_metadata: {} })
      );

      const response = await POST(syncRequest());

      expect((await response.json()).code).toBe("invitation_required");
      expect(findManyBetaRequests).not.toHaveBeenCalled();
    });
  });

  /**
   * C2 regression. Provisioning used to repair an active membership's role from
   * the global `users.role` column whenever the two disagreed - and
   * POST /api/staff let any organization write that column for any email. So
   * inviting your own address at "owner" from a throwaway tenant promoted you
   * inside somebody else's tenant at your next sign-in.
   *
   * The column is gone and privilege is `principal_roles`. What has to stay
   * true is the property the column made false: SIGNING IN NEVER CHANGES WHAT
   * ANYONE MAY DO.
   */
  describe("signing in never changes what anyone may do (C2)", () => {
    it("touches no privilege row for a member who already has one", async () => {
      const response = await POST(syncRequest());

      expect(response.status).toBe(200);
      expect(updateMembership).not.toHaveBeenCalled();
      // The three writes that could raise somebody: a new assignment, a new
      // role, or a change to what an existing role grants.
      expect(createManyPrincipalRoles).not.toHaveBeenCalled();
      expect(createManyAndReturnRoles).not.toHaveBeenCalled();
      expect(createManyRolePermissions).not.toHaveBeenCalled();
    });

    it("creates an invented membership at the lowest privilege there is", async () => {
      // Inventing a membership is already a guess. It gets the bottom role, and
      // an administrator raises it deliberately from the access screen.
      findManyUsers.mockResolvedValue([{ ...storedUser, memberships: [] }]);
      findMembership.mockResolvedValue(null);
      findManyMemberships.mockResolvedValue([membership]);

      await POST(syncRequest());

      expect(createManyPrincipalRoles).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [
            expect.objectContaining({
              roleId: `role-${DEFAULT_MEMBERSHIP_ROLE_KEY}`
            })
          ]
        })
      );
      expect(createManyPrincipalRoles).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: [
            expect.objectContaining({
              roleId: `role-${FOUNDING_OWNER_ROLE_KEY}`
            })
          ]
        })
      );
    });
  });
});
