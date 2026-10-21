import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn() },
    serviceAccount: { findUnique: vi.fn() },
    $transaction: vi.fn()
  },
  tx: {
    user: { findUniqueOrThrow: vi.fn(), update: vi.fn() }
  },
  recordActivity: vi.fn(),
  resolveAuthIdentity: vi.fn(),
  cookies: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("next/headers", () => ({ cookies: () => mocks.cookies() }));
vi.mock("@/lib/security/rate-limit", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null)
}));
vi.mock("@/lib/audit/activity-log", () => ({
  recordActivity: mocks.recordActivity
}));
vi.mock("@/lib/auth/identity", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/identity")>()),
  resolveAuthIdentity: (...args: unknown[]) => mocks.resolveAuthIdentity(...args)
}));

import { POST } from "@/app/api/auth/password-set/route";
import { authorizeMember } from "@/lib/authz/authorize";

/**
 * INVITE AND RECOVERY ARE NOT DEVICE CONFIRMATION - AND MUST NOT BE TRAPPED
 * BEHIND IT.
 *
 * An invitee's browser is always new, and a recovery link is often opened on
 * one. Supabase saves the password first; this route only records that it did.
 * If it were refused, `passwordSetAt` would stay empty and the dashboard would
 * send the person back to /set-password before it could show the 2FA or device
 * step - a loop with no way out. These run the REAL authorize layer.
 */

const ORGANIZATION = "11111111-1111-4111-8111-111111111111";
const USER = "33333333-3333-4333-8333-333333333333";

function account(input: {
  mfaEnrolledAt: Date | null;
  twoFactorRequired: boolean;
}) {
  return {
    id: USER,
    name: "Invited Person",
    email: "invited@example.com",
    isActive: true,
    organizationId: ORGANIZATION,
    mfaEnrolledAt: input.mfaEnrolledAt,
    sessions: [],
    // A browser this account has never confirmed.
    devices: [],
    memberships: [
      {
        isActive: true,
        principalId: "22222222-2222-4222-8222-222222222222",
        organizationId: ORGANIZATION,
        organization: {
          id: ORGANIZATION,
          name: "Venue",
          slug: "venue",
          isActive: true,
          subscriptionPlan: null,
          subscriptionStatus: "active",
          permissionsEpoch: BigInt(1),
          settings: {
            twoFactorRequired: input.twoFactorRequired,
            sessionTimeoutMinutes: 0
          }
        },
        principal: { isActive: true }
      }
    ]
  };
}

const request = () =>
  new Request("http://localhost/api/auth/password-set", { method: "POST" });

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.DEVICE_CONFIRMATION;
  mocks.cookies.mockResolvedValue({ get: () => undefined });
  mocks.resolveAuthIdentity.mockResolvedValue({
    id: "supabase-id",
    email: "invited@example.com",
    assuranceLevel: "aal1",
    sessionId: "sess-1"
  });
  mocks.prisma.$transaction.mockImplementation(
    (run: (tx: unknown) => Promise<unknown>) => run(mocks.tx)
  );
  mocks.tx.user.findUniqueOrThrow.mockResolvedValue({ passwordSetAt: null });
  mocks.tx.user.update.mockResolvedValue({});
  mocks.recordActivity.mockResolvedValue(undefined);
});

describe("POST /api/auth/password-set", () => {
  it("records an invitee's password on a browser that is not confirmed yet", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(
      account({ mfaEnrolledAt: null, twoFactorRequired: false })
    );

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.tx.user.update).toHaveBeenCalledWith({
      where: { id: USER },
      data: { passwordSetAt: expect.any(Date) }
    });
  });

  it("records it where the organization requires 2FA the invitee has not set up", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(
      account({ mfaEnrolledAt: null, twoFactorRequired: true })
    );

    expect((await POST(request())).status).toBe(200);
  });

  /** Recovery for somebody with an authenticator: the link gives `aal1`. */
  it("records a recovered password before the authenticator code is entered", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(
      account({ mfaEnrolledAt: new Date(), twoFactorRequired: false })
    );
    mocks.tx.user.findUniqueOrThrow.mockResolvedValue({
      passwordSetAt: new Date("2026-01-01T00:00:00Z")
    });

    expect((await POST(request())).status).toBe(200);
    expect(mocks.recordActivity).toHaveBeenCalledWith(
      mocks.tx,
      expect.anything(),
      expect.objectContaining({ message: "Account password was changed." })
    );
  });

  /**
   * The exemption is for THIS bookkeeping only. A data route on the same
   * session is still refused - the gates stand where organization data is.
   */
  it("leaves the gates standing on every other route", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(
      account({ mfaEnrolledAt: null, twoFactorRequired: false })
    );

    await expect(authorizeMember(request())).rejects.toMatchObject({
      code: "device_confirmation_required"
    });

    mocks.prisma.user.findUnique.mockResolvedValue(
      account({ mfaEnrolledAt: null, twoFactorRequired: true })
    );

    await expect(authorizeMember(request())).rejects.toMatchObject({
      code: "mfa_enrollment_required"
    });
  });
});
