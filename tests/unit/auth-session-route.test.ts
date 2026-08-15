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
  findAccess,
  createAccess,
  createActivityLog
} = vi.hoisted(() => ({
  findManyUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  createOrganization: vi.fn(),
  findMembership: vi.fn(),
  createMembership: vi.fn(),
  updateMembership: vi.fn(),
  findManyMemberships: vi.fn(),
  findAccess: vi.fn(),
  createAccess: vi.fn(),
  createActivityLog: vi.fn()
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
    userAccess: { findUnique: findAccess, create: createAccess },
    activityLog: { create: createActivityLog }
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

import { POST } from "@/app/api/auth/session/route";
import { createSupabaseTokenVerifier } from "@/lib/supabase/server";

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
  onboardingCompletedAt: new Date("2026-01-01T00:00:00.000Z")
};

const access = {
  id: "access-1",
  organizationId: ORGANIZATION_ID,
  userId: USER_ID,
  canViewCalendar: true,
  allowedHallIds: []
};

const membership = {
  id: "membership-1",
  organizationId: ORGANIZATION_ID,
  userId: USER_ID,
  role: "manager",
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
  role: "viewer",
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
  role: "manager",
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

function syncRequest() {
  return new Request("http://localhost/api/auth/session", {
    method: "POST",
    headers: { Authorization: "Bearer valid-token" }
  }) as never;
}

describe("POST /api/auth/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSupabaseTokenVerifier).mockReturnValue({
      auth: { getUser }
    } as never);
    getUser.mockResolvedValue(supabaseUser());

    findManyUsers.mockResolvedValue([
      { ...storedUser, access: [access], memberships: [membership] }
    ]);
    findMembership.mockResolvedValue(membership);
    findManyMemberships.mockResolvedValue([membership]);
    findAccess.mockResolvedValue(access);
    updateUser.mockImplementation(async ({ data }: { data: object }) => ({
      ...storedUser,
      ...data
    }));
    updateMembership.mockResolvedValue(membership);
    createActivityLog.mockResolvedValue(null);
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
    expect(body).toEqual({
      user: {
        id: USER_ID,
        email: "user@example.com",
        name: "Existing Name",
        phone: "+15551234567",
        venueName: "Main Hall",
        role: "manager",
        organizationId: ORGANIZATION_ID
      },
      access,
      mustSetPassword: false,
      mustCompleteOnboarding: false,
      activeOrganizationId: ORGANIZATION_ID,
      organizations: [
        {
          id: ORGANIZATION_ID,
          name: "Test Organization",
          slug: "test-organization",
          role: "manager",
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
    findAccess.mockResolvedValue(null);
    createOrganization.mockResolvedValue({
      ...organization,
      name: "Ada's Organization",
      subscriptionStatus: "trialing",
      onboardingCompletedAt: null
    });
    createUser.mockResolvedValue({
      ...storedUser,
      name: "Ada",
      role: "owner",
      phone: null,
      venueName: null
    });
    createAccess.mockResolvedValue(access);
    createMembership.mockResolvedValue({ ...membership, role: "owner" });
    findManyMemberships.mockResolvedValue([
      {
        ...membership,
        role: "owner",
        organization: {
          ...organization,
          name: "Ada's Organization",
          subscriptionStatus: "trialing",
          onboardingCompletedAt: null
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
    expect(body.user.role).toBe("owner");
    // The owner still has to name the organization on /dashboard/new.
    expect(body.mustCompleteOnboarding).toBe(true);
    expect(body.organizations[0].subscriptionStatus).toBe("trialing");
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
        access: [access],
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
        access: [access],
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
        access: [access],
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
        access: [access],
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
        access: [access],
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
    expect(createAccess).not.toHaveBeenCalled();
    expect(createActivityLog).not.toHaveBeenCalled();
  });

  it("logs a sign-in once per Supabase session, not once per sync", async () => {
    // Supabase reports a sign-in newer than the one on record.
    findManyUsers.mockResolvedValue([
      {
        ...storedUser,
        lastSignInAt: new Date("2026-08-14T10:00:00.000Z"),
        access: [access],
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
      { ...storedUser, access: [access], memberships: [membership] }
    ]);
    findMembership.mockResolvedValue(membership);
    findManyMemberships.mockResolvedValue([membership]);
    findAccess.mockResolvedValue(access);

    await POST(syncRequest());

    expect(createActivityLog).not.toHaveBeenCalled();
  });

  it("lists every active organization, oldest first, and starts on the primary one", async () => {
    findManyUsers.mockResolvedValue([
      {
        ...storedUser,
        access: [access],
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
        access: [access],
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
});
