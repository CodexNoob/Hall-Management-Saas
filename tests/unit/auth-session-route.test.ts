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
  updateBetaRequest,
  findOrganizationSetting,
  upsertUserSession
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
  updateBetaRequest: vi.fn(),
  findOrganizationSetting: vi.fn(),
  upsertUserSession: vi.fn()
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
    },
    // The dashboard language. The route reads it on every successful sign-in,
    // so without this double each assertion below fails on an undefined call
    // rather than on what it is actually checking.
    organizationSetting: { findUnique: findOrganizationSetting },
    // The Security screen's session list is written from here and nowhere
    // else, so this double is what proves the rows ever get created.
    userSession: { upsert: upsertUserSession }
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

// Device sightings have their own suite (device-trust.test.ts). Here the
// question is what the ROUTE does with the answer: where the secret goes, and
// exactly when device trust may and may not touch the 2FA obligation.
const {
  registerDeviceSighting,
  findCurrentDevice,
  recordDeviceMfaVerified,
  reconcileMfaFactors
} = vi.hoisted(() => ({
  registerDeviceSighting: vi.fn(),
  findCurrentDevice: vi.fn(),
  recordDeviceMfaVerified: vi.fn(),
  reconcileMfaFactors: vi.fn()
}));
const DEVICE_SECRET = "d".repeat(43);

vi.mock("@/lib/auth/device-trust", () => ({
  registerDeviceSighting,
  findCurrentDevice,
  recordDeviceMfaVerified
}));
vi.mock("@/lib/auth/mfa-trust", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/mfa-trust")>();
  reconcileMfaFactors.mockImplementation(actual.reconcileMfaFactors);
  return { reconcileMfaFactors };
});

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

/**
 * A token shaped like a real one, because the session record is keyed on the
 * `session_id` claim inside it. `syncRequest` above deliberately is not - most
 * of this file has no interest in the claim, and a route that started
 * depending on it would be a change worth noticing here.
 */
function syncRequestFromDevice(sessionId: string) {
  const payload = Buffer.from(
    JSON.stringify({ sub: AUTH_ID, session_id: sessionId })
  ).toString("base64url");

  return new Request("http://localhost/api/auth/session", {
    method: "POST",
    headers: {
      Authorization: `Bearer header.${payload}.signature`,
      "user-agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      "x-forwarded-for": "203.0.113.7, 70.41.3.18"
    }
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
    findOrganizationSetting.mockResolvedValue(null);
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
    registerDeviceSighting.mockResolvedValue({
      device: {
        id: "device-1",
        known: false,
        primary: true,
        confirmed: false,
        trusted: false,
        pendingConfirmation: true
      },
      newSecret: DEVICE_SECRET
    });
    // No device row before this request unless a test says otherwise.
    findCurrentDevice.mockResolvedValue(null);
    recordDeviceMfaVerified.mockResolvedValue(true);
  });

  const DAY_MS = 24 * 60 * 60_000;
  const daysFromNow = (days: number) => new Date(Date.now() + days * DAY_MS);

  /** THIS browser's row as it stood before the request. */
  function priorDevice(input: { mfaVerifiedAt: Date | null; expired?: boolean }) {
    return {
      id: "device-1",
      isPrimary: true,
      confirmedAt: daysFromNow(input.expired ? -31 : -1),
      revokedAt: null,
      trustExpiresAt: daysFromNow(input.expired ? -1 : 29),
      mfaVerifiedAt: input.mfaVerifiedAt
    };
  }

  const trustedSighting = {
    device: {
      id: "device-1",
      known: true,
      primary: true,
      confirmed: true,
      trusted: true,
      pendingConfirmation: false
    },
    newSecret: null
  };

  /** An account whose authenticator this app trusts, enrolled ten days ago. */
  function withAuthenticator() {
    findManyUsers.mockResolvedValue([
      {
        ...storedUser,
        mfaEnrolledAt: daysFromNow(-10),
        memberships: [membership]
      }
    ]);
    reconcileMfaFactors.mockResolvedValueOnce({
      verified: 1,
      trusted: true,
      newlyTrusted: 0,
      removedUntrusted: 0
    });
  }

  /** The verified `aal` claim the route reads through `getClaims`. */
  function sessionAt(aal: "aal1" | "aal2") {
    vi.mocked(createSupabaseTokenVerifier).mockReturnValue({
      auth: {
        getUser,
        getClaims: vi.fn().mockResolvedValue({
          data: { claims: { aal } },
          error: null
        })
      }
    } as never);
  }

  describe("trusted devices", () => {
    it("plants a new device secret only in an httpOnly cookie, never in the body", async () => {
      const response = await POST(syncRequest());
      const text = await response.text();
      const cookie = response.headers.get("set-cookie") ?? "";

      expect(text).not.toContain(DEVICE_SECRET);
      expect(cookie).toContain(`event-core.device=${DEVICE_SECRET}`);
      expect(cookie.toLowerCase()).toContain("httponly");
      expect(cookie.toLowerCase()).toContain("samesite=lax");
    });

    it("reports only four booleans about the device - no id, no hash", async () => {
      const body = await (await POST(syncRequest())).json();

      expect(body.device).toEqual({
        known: false,
        trusted: false,
        pendingConfirmation: true,
        confirmationRequired: true
      });
    });

    it("does not require confirmation for a trusted device", async () => {
      registerDeviceSighting.mockResolvedValue({
        device: {
          id: "device-1",
          known: true,
          primary: true,
          confirmed: true,
          trusted: true,
          pendingConfirmation: false
        },
        newSecret: null
      });

      const body = await (await POST(syncRequest())).json();

      expect(body.device.confirmationRequired).toBe(false);
    });

    /** Confirmed once, but the trust period ended: gated like a new device. */
    it("requires confirmation again for a device whose trust expired", async () => {
      registerDeviceSighting.mockResolvedValue({
        device: {
          id: "device-2",
          known: true,
          primary: false,
          confirmed: true,
          trusted: false,
          pendingConfirmation: true
        },
        newSecret: null
      });

      const body = await (await POST(syncRequest())).json();

      expect(body.device).toMatchObject({
        trusted: false,
        confirmationRequired: true
      });
    });

    it("does not require confirmation for a trusted secondary device", async () => {
      registerDeviceSighting.mockResolvedValue({
        ...trustedSighting,
        device: { ...trustedSighting.device, id: "device-2", primary: false }
      });

      const body = await (await POST(syncRequest())).json();

      expect(body.device).toMatchObject({
        trusted: true,
        confirmationRequired: false
      });
    });

    /**
     * Password, then 2FA, then device. While the session still owes a factor,
     * the device is recorded but no confirmation email is allowed yet.
     */
    it("holds the confirmation email until the second factor is satisfied", async () => {
      reconcileMfaFactors.mockResolvedValueOnce({
        verified: 1,
        trusted: true,
        newlyTrusted: 0,
        removedUntrusted: 0
      });

      await POST(syncRequest());

      expect(registerDeviceSighting).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ notify: false })
      );
    });

    it("allows the confirmation email once nothing is owed", async () => {
      await POST(syncRequest());

      expect(registerDeviceSighting).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ notify: true })
      );
    });

    it("sets no cookie when the browser already has its identity", async () => {
      registerDeviceSighting.mockResolvedValue({
        device: {
          id: "device-1",
          known: true,
          primary: true,
          confirmed: true,
          trusted: true,
          pendingConfirmation: false
        },
        newSecret: null
      });

      const response = await POST(syncRequest());

      expect(response.headers.get("set-cookie") ?? "").not.toContain(
        "event-core.device"
      );
    });

    /**
     * A trusted device on which the authenticator was never entered does not
     * skip it: trust from the email code alone is not a second factor.
     */
    it("does not let email trust alone skip the 2FA challenge", async () => {
      registerDeviceSighting.mockResolvedValue(trustedSighting);
      findCurrentDevice.mockResolvedValue(priorDevice({ mfaVerifiedAt: null }));
      withAuthenticator();

      const body = await (await POST(syncRequest())).json();

      expect(body.device.trusted).toBe(true);
      expect(body.mfa).toMatchObject({
        enrolled: true,
        obligation: "challenge"
      });
    });

    it("skips the code on a trusted device that remembers it", async () => {
      registerDeviceSighting.mockResolvedValue(trustedSighting);
      findCurrentDevice.mockResolvedValue(
        priorDevice({ mfaVerifiedAt: daysFromNow(-1) })
      );
      withAuthenticator();

      const body = await (await POST(syncRequest())).json();

      expect(body.mfa).toMatchObject({ enrolled: true, obligation: "satisfied" });
      expect(body.device.confirmationRequired).toBe(false);
    });

    it("never skips the code where the organization requires 2FA", async () => {
      registerDeviceSighting.mockResolvedValue(trustedSighting);
      findCurrentDevice.mockResolvedValue(
        priorDevice({ mfaVerifiedAt: daysFromNow(-1) })
      );
      findOrganizationSetting.mockResolvedValue({ twoFactorRequired: true });
      withAuthenticator();

      const body = await (await POST(syncRequest())).json();

      expect(body.mfa).toMatchObject({
        requiredByOrganization: true,
        obligation: "challenge"
      });
      // The device email waits for the factor, as on any device.
      expect(registerDeviceSighting).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ notify: false })
      );
    });

    it("asks for the code again once the trust period has ended", async () => {
      findCurrentDevice.mockResolvedValue(
        priorDevice({ mfaVerifiedAt: daysFromNow(-31), expired: true })
      );
      withAuthenticator();

      const body = await (await POST(syncRequest())).json();

      expect(body.mfa.obligation).toBe("challenge");
    });

    /**
     * 2FA set up after this browser was confirmed: once the code is entered
     * here, the device remembers it - without extending its trust period.
     */
    it("remembers the code entered on an already-trusted device", async () => {
      registerDeviceSighting.mockResolvedValue(trustedSighting);
      findCurrentDevice.mockResolvedValue(priorDevice({ mfaVerifiedAt: null }));
      withAuthenticator();
      sessionAt("aal2");

      const body = await (await POST(syncRequest())).json();

      expect(body.mfa.obligation).toBe("satisfied");
      expect(recordDeviceMfaVerified).toHaveBeenCalledWith(expect.anything(), {
        userId: USER_ID,
        deviceId: "device-1",
        now: expect.any(Date)
      });
    });

    it("does not rewrite a memory that is already current", async () => {
      registerDeviceSighting.mockResolvedValue(trustedSighting);
      findCurrentDevice.mockResolvedValue(
        priorDevice({ mfaVerifiedAt: daysFromNow(-1) })
      );
      withAuthenticator();
      sessionAt("aal2");

      await POST(syncRequest());

      expect(recordDeviceMfaVerified).not.toHaveBeenCalled();
    });

    it("never remembers the code on an untrusted device", async () => {
      // New browser: the code is remembered by `confirmDevice` instead, and
      // only once the emailed code has been entered too.
      withAuthenticator();
      sessionAt("aal2");

      await POST(syncRequest());

      expect(recordDeviceMfaVerified).not.toHaveBeenCalled();
    });

    it("asks for the code when the device row cannot be read", async () => {
      registerDeviceSighting.mockResolvedValue(trustedSighting);
      findCurrentDevice.mockRejectedValue(new Error("devices table down"));
      withAuthenticator();

      const response = await POST(syncRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.mfa.obligation).toBe("challenge");
    });

    it("answers when recording the device fails - and still requires confirmation", async () => {
      registerDeviceSighting.mockRejectedValue(new Error("devices table down"));

      const response = await POST(syncRequest());
      const body = await response.json();

      // The sync never fails over a device row, but it does not pretend the
      // device is fine either: the API would refuse it, so the gate shows.
      expect(response.status).toBe(200);
      expect(body.device).toMatchObject({
        trusted: false,
        confirmationRequired: true
      });
    });
  });

  it("rejects a request with no bearer token", async () => {
    const response = await POST(
      new Request("http://localhost/api/auth/session", {
        method: "POST"
      }) as never
    );

    expect(response.status).toBe(401);
  });

  /**
   * A hall's language is a default, not a decree.
   *
   * It used to be the only one there was, which meant a Spanish-reading cook
   * and an English-reading manager in the same venue could not both be served -
   * and the person who would have had to arbitrate is the one with
   * `settings.update`, which neither of them may hold. The session resolves the
   * two so that nothing downstream has to.
   */
  it("prefers the person's own language over the organization's", async () => {
    findOrganizationSetting.mockResolvedValue({ language: "he-IL" });
    findManyUsers.mockResolvedValue([
      { ...storedUser, language: "es-US", memberships: [membership] }
    ]);

    const body = await (await POST(syncRequest())).json();

    expect(body.language).toBe("es-US");
    // The raw preference travels too, so the picker can tell a chosen "es-US"
    // apart from one inherited from the hall.
    expect(body.user.language).toBe("es-US");
  });

  it("falls back to the organization when the person has chosen nothing", async () => {
    findOrganizationSetting.mockResolvedValue({ language: "he-IL" });

    const body = await (await POST(syncRequest())).json();

    expect(body.language).toBe("he-IL");
    expect(body.user.language).toBeNull();
  });

  it("ignores a stored language this build does not ship", async () => {
    // Both columns are plain `String`, so a value written by a newer build - or
    // a language since withdrawn - arrives here as ordinary text. Rendering it
    // would mean looking up a catalog column that does not exist.
    findOrganizationSetting.mockResolvedValue({ language: "fr-CA" });
    findManyUsers.mockResolvedValue([
      { ...storedUser, language: "klingon", memberships: [membership] }
    ]);

    const body = await (await POST(syncRequest())).json();

    expect(body.language).toBe("en-US");
    expect(body.user.language).toBeNull();
  });

  /**
   * The Security screen's session list exists only because this runs. Supabase
   * has no endpoint that enumerates sessions, so a row written here is the only
   * record that a device was ever signed in - and nothing else in the app would
   * notice if this stopped happening.
   */
  it("records the device this session is running on", async () => {
    await POST(syncRequestFromDevice("sess-phone"));

    expect(upsertUserSession).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionId: "sess-phone" },
        create: expect.objectContaining({
          sessionId: "sess-phone",
          userId: USER_ID,
          deviceId: "device-1",
          // The leftmost entry of `x-forwarded-for`; the rest are proxies.
          ipAddress: "203.0.113.7"
        })
      })
    );
    expect(upsertUserSession.mock.calls[0]?.[0]).toMatchObject({
      update: { deviceId: "device-1" }
    });
  });

  it("updates the row it already has rather than adding a second", async () => {
    await POST(syncRequestFromDevice("sess-phone"));
    await POST(syncRequestFromDevice("sess-phone"));

    // Two syncs, two upserts, both keyed on the same session - which is what
    // keeps the list a list of devices rather than a log of page loads.
    expect(upsertUserSession).toHaveBeenCalledTimes(2);
    for (const call of vi.mocked(upsertUserSession).mock.calls) {
      expect(call[0]).toMatchObject({ where: { sessionId: "sess-phone" } });
    }
  });

  /**
   * A token with no `session_id` - an older one, or a custom JWT setup. Writing
   * a row anyway would need an invented key, and a fresh key per request turns
   * the list into a log of every page load.
   */
  it("records nothing when the token carries no session id", async () => {
    await POST(syncRequest());

    expect(upsertUserSession).not.toHaveBeenCalled();
  });

  /**
   * The list is a display. A dashboard that will not load because a display
   * table would not write is an outage; a stale list is cosmetic.
   */
  it("still signs in when the session row cannot be written", async () => {
    upsertUserSession.mockRejectedValue(new Error("relation does not exist"));

    const response = await POST(syncRequestFromDevice("sess-phone"));

    expect(response.status).toBe(200);
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
        // No personal preference recorded, so the organization's language is
        // the one that applies below.
        language: null,
        title: "Team member",
        organizationId: ORGANIZATION_ID
      },
      permissions: ["calendar.read"],
      scope: { hallIds: "all", eventTypeIds: "all" },
      epoch: 1,
      // The dashboard's language, so the shell can render in it on the first
      // paint rather than flipping out of English once settings load.
      language: "en-US",
      mustSetPassword: false,
      mustCompleteOnboarding: false,
      // What this session still owes on a second factor. This route is the
      // only one that reports it, because it is the only one exempt from the
      // check that refuses everything else - a person who owes a factor has to
      // be told so by something that will still answer them.
      mfa: {
        enrolled: false,
        requiredByOrganization: false,
        obligation: "satisfied"
      },
      // How this organization writes a date and a time. On the session rather
      // than behind `/api/settings`, because that endpoint needs
      // `settings.read` and kitchen staff do not hold it - dates would have
      // formatted one way for managers and another for cooks on the same
      // screen. Resolved server-side for the authenticated organization; the
      // browser never says which organization's settings it wants.
      regional: {
        locale: "en-US",
        timeZone: "America/New_York",
        dateFormat: "MMM d, yyyy",
        timeFormat: "12-hour"
      },
      // The inactivity policy, for the browser's countdown - a hint, never the
      // control. `resolveUserActor` refuses an idle session on its own
      // authority, so a browser that never receives this is still signed out.
      inactivity: { timeoutMinutes: 480, sharedDevice: false },
      // This browser's standing, as two booleans - a hint for the confirm
      // banner, never the device secret or its hash.
      device: {
        known: false,
        trusted: false,
        pendingConfirmation: true,
        confirmationRequired: true
      },
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
