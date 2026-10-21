import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
  consumeEnrollmentGrant: vi.fn(),
  deleteFactor: vi.fn(),
  sendSecurityEmail: vi.fn(),
  recordActivity: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mfaTrustedFactor: {
      findMany: mocks.findMany,
      findUnique: mocks.findUnique,
      upsert: mocks.upsert
    }
  }
}));
vi.mock("@/lib/auth/security-codes", () => ({
  consumeEnrollmentGrant: mocks.consumeEnrollmentGrant
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: () => ({
    auth: { admin: { mfa: { deleteFactor: mocks.deleteFactor } } }
  })
}));
vi.mock("@/lib/auth/security-emails", () => ({
  sendSecurityEmail: mocks.sendSecurityEmail,
  mfaEnabledEmail: () => ({ subject: "on", html: "" }),
  untrustedFactorEmail: () => ({ subject: "alert", html: "" })
}));
vi.mock("@/lib/audit/activity-log", () => ({
  recordActivity: mocks.recordActivity
}));

import { reconcileMfaFactors } from "@/lib/auth/mfa-trust";
import { log } from "@/lib/logging/context";

const input = (
  factors: Array<{ id: string; status: string; created_at?: string }>,
  sessionId: string | null = "sess-1"
) => ({
  userId: "user-1",
  supabaseAuthId: "supabase-1",
  factors: factors.map((factor) => ({ factor_type: "totp", ...factor })),
  sessionId,
  audit: { organizationId: "org-1", userId: "user-1", actorName: "Ada" },
  owner: { email: "ada@example.com", name: "Ada" }
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findMany.mockResolvedValue([]);
  mocks.findUnique.mockResolvedValue(null);
  mocks.upsert.mockResolvedValue({});
  mocks.consumeEnrollmentGrant.mockResolvedValue(false);
  mocks.deleteFactor.mockResolvedValue({ data: {}, error: null });
  mocks.sendSecurityEmail.mockResolvedValue("sent");
  mocks.recordActivity.mockResolvedValue({});
});

describe("reconcileMfaFactors", () => {
  it("costs nothing for an account with no factor", async () => {
    const result = await reconcileMfaFactors(input([]));

    expect(result).toEqual({ verified: 0, trusted: false, newlyTrusted: 0, removedUntrusted: 0 });
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("ignores a factor that was never verified", async () => {
    const result = await reconcileMfaFactors(input([{ id: "f1", status: "unverified" }]));

    expect(result.verified).toBe(0);
    expect(mocks.deleteFactor).not.toHaveBeenCalled();
  });

  /**
   * Existing 2FA users. The migration backfills their factors as trusted, so
   * nothing about them changes: no grant needed, nothing removed.
   */
  it("keeps an already-trusted (backfilled) factor trusted", async () => {
    mocks.findMany.mockResolvedValue([{ factorId: "legacy" }]);

    const result = await reconcileMfaFactors(input([{ id: "legacy", status: "verified" }]));

    expect(result.trusted).toBe(true);
    expect(mocks.consumeEnrollmentGrant).not.toHaveBeenCalled();
    expect(mocks.deleteFactor).not.toHaveBeenCalled();
  });

  it("trusts a new factor while this session holds a live grant, and says so", async () => {
    mocks.consumeEnrollmentGrant.mockResolvedValue(true);

    const result = await reconcileMfaFactors(input([{ id: "new", status: "verified" }]));

    expect(mocks.consumeEnrollmentGrant).toHaveBeenCalledWith(expect.anything(), {
      userId: "user-1",
      sessionId: "sess-1",
      now: expect.any(Date)
    });
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ factorId: "new", source: "email_verified" })
      })
    );
    expect(result).toMatchObject({ trusted: true, newlyTrusted: 1, removedUntrusted: 0 });
    expect(mocks.sendSecurityEmail).toHaveBeenCalledWith(
      "mfa_enabled",
      "ada@example.com",
      expect.anything()
    );
    expect(mocks.recordActivity.mock.calls[0]?.[2]).toMatchObject({
      action: "auth.mfa.enabled"
    });
  });

  /** THE ATTACK: a factor attached with the password but without the inbox. */
  it("removes a new factor with no grant, alerts the owner and records it", async () => {
    const warn = vi.spyOn(log, "warn");

    const result = await reconcileMfaFactors(input([{ id: "planted", status: "verified" }]));

    expect(mocks.deleteFactor).toHaveBeenCalledWith({ id: "planted", userId: "supabase-1" });
    expect(result).toMatchObject({ trusted: false, newlyTrusted: 0, removedUntrusted: 1 });
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.sendSecurityEmail).toHaveBeenCalledWith(
      "mfa_untrusted_removed",
      "ada@example.com",
      expect.anything()
    );
    expect(mocks.recordActivity.mock.calls[0]?.[2]).toMatchObject({
      action: "auth.mfa.untrusted_removed"
    });
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", detected: 1, removed: 1 }),
      "mfa_untrusted_factor_detected"
    );
  });

  it("never applies a grant without a session to tie it to", async () => {
    await reconcileMfaFactors(input([{ id: "planted", status: "verified" }], null));

    expect(mocks.consumeEnrollmentGrant).not.toHaveBeenCalled();
    expect(mocks.deleteFactor).toHaveBeenCalled();
  });

  /**
   * Two requests reconciling at once: the other one spent the grant on THIS
   * factor. Deleting a factor that was just legitimately trusted is the worst
   * possible outcome, so it looks again before removing.
   */
  it("does not delete a factor another request just trusted", async () => {
    mocks.findUnique.mockResolvedValue({ id: "row" });

    const result = await reconcileMfaFactors(input([{ id: "new", status: "verified" }]));

    expect(mocks.deleteFactor).not.toHaveBeenCalled();
    expect(result.trusted).toBe(true);
  });

  it("spends one grant on one factor - the newest", async () => {
    mocks.consumeEnrollmentGrant.mockResolvedValue(true);

    const result = await reconcileMfaFactors(
      input([
        { id: "older", status: "verified", created_at: "2026-09-26T10:00:00Z" },
        { id: "newest", status: "verified", created_at: "2026-09-26T12:00:00Z" }
      ])
    );

    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.upsert.mock.calls[0]?.[0].create.factorId).toBe("newest");
    expect(mocks.deleteFactor).toHaveBeenCalledWith({ id: "older", userId: "supabase-1" });
    expect(result).toMatchObject({ newlyTrusted: 1, removedUntrusted: 1, trusted: true });
  });

  it("still refuses to trust a factor it could not remove", async () => {
    mocks.deleteFactor.mockResolvedValue({ data: null, error: new Error("admin down") });

    const result = await reconcileMfaFactors(input([{ id: "planted", status: "verified" }]));

    expect(result).toMatchObject({ trusted: false, removedUntrusted: 0 });
  });

  it("does not let a failed alert or audit write undo the decision", async () => {
    mocks.sendSecurityEmail.mockResolvedValue("failed");
    mocks.recordActivity.mockRejectedValue(new Error("audit down"));

    const result = await reconcileMfaFactors(input([{ id: "planted", status: "verified" }]));

    expect(result.removedUntrusted).toBe(1);
  });
});
