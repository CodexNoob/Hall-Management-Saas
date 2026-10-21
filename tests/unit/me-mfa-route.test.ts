import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz/authorize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authz/authorize")>()),
  authorizeMember: vi.fn()
}));

// `vi.hoisted`, because these factories are lifted above ordinary `const`
// declarations and `authorize` imports the Prisma client at module load.
const { findUnique, update, getUser, reconcile } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  getUser: vi.fn(),
  reconcile: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique, update } } }));
vi.mock("@/lib/audit/activity-log", () => ({
  recordActivity: vi.fn(async () => ({ id: "log-1" }))
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseTokenVerifier: () => ({ auth: { getUser } }),
  createSupabaseServerClient: async () => ({
    auth: { getSession: async () => ({ data: { session: null }, error: null }) }
  })
}));
// The trust decision has its own suite (mfa-trust.test.ts). Here it is a
// stand-in, so these tests are about what the ROUTE does with its answer.
vi.mock("@/lib/auth/mfa-trust", () => ({ reconcileMfaFactors: reconcile }));

import { POST } from "@/app/api/me/mfa/route";
import { recordActivity } from "@/lib/audit/activity-log";
import { authorizeMember } from "@/lib/authz/authorize";
import { authzContext } from "./authz-test-helpers";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
/** Real-shaped, because the route reads `session_id` out of it for the grant. */
const TOKEN = `header.${Buffer.from(
  JSON.stringify({ sub: "supabase-id", session_id: "sess-1" })
).toString("base64url")}.signature`;

const request = (token: string | null = TOKEN, body?: unknown) =>
  new Request("http://localhost/api/me/mfa", {
    method: "POST",
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { "content-type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

const supabaseUser = (factors: Array<{ id?: string; status: string }>) => ({
  data: { user: { id: "supabase-id", email: "user@example.com", factors } },
  error: null
});

const trust = (trusted: boolean, removedUntrusted = 0) => ({
  verified: trusted || removedUntrusted > 0 ? 1 : 0,
  trusted,
  newlyTrusted: 0,
  removedUntrusted
});

describe("POST /api/me/mfa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authorizeMember).mockResolvedValue(
      authzContext({ organizationId, userId, actorName: "Test User" })
    );
    findUnique.mockResolvedValue({
      mfaEnrolledAt: null,
      email: "user@example.com",
      name: "Test User"
    });
    update.mockResolvedValue({});
    getUser.mockResolvedValue(supabaseUser([{ id: "f1", status: "verified" }]));
    reconcile.mockResolvedValue(trust(true));
  });

  /**
   * THE WHOLE POINT OF THIS ROUTE.
   *
   * It exists so `users.mfa_enrolled_at` - which every other request consults
   * to decide whether somebody owes a second factor - can be brought up to
   * date the moment a factor is added or removed. What it must never do is
   * take the browser's word for what changed: that would be a
   * client-controlled input to an authorization decision.
   */
  it("asks Supabase rather than believing the request body", async () => {
    getUser.mockResolvedValue(supabaseUser([]));
    reconcile.mockResolvedValue(trust(false));

    const response = await POST(request(TOKEN, { enrolled: true }));

    expect(await response.json()).toEqual({
      enrolled: false,
      trusted: false,
      removedUntrusted: 0
    });
    expect(getUser).toHaveBeenCalledWith(TOKEN);
  });

  it("hands the trust check Supabase's factors and THIS session's id", async () => {
    await POST(request());

    expect(reconcile).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        supabaseAuthId: "supabase-id",
        factors: [{ id: "f1", status: "verified" }],
        sessionId: "sess-1"
      })
    );
  });

  it("records a trusted enrolment against the user row", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: userId } })
    );
    expect(await response.json()).toMatchObject({ enrolled: true, trusted: true });
  });

  /**
   * The hole this closes: a factor verified at Supabase but attached without
   * the email-verified grant must not switch the mirror on.
   */
  it("does not count a verified factor the trust check rejected", async () => {
    reconcile.mockResolvedValue(trust(false, 1));

    const response = await POST(request());

    expect(await response.json()).toEqual({
      enrolled: false,
      trusted: false,
      removedUntrusted: 1
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("clears the mirror when the factor is gone, and records it", async () => {
    findUnique.mockResolvedValue({
      mfaEnrolledAt: new Date(),
      email: "user@example.com",
      name: "Test User"
    });
    getUser.mockResolvedValue(supabaseUser([]));
    reconcile.mockResolvedValue(trust(false));

    await POST(request());

    expect(update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { mfaEnrolledAt: null }
    });
    expect(vi.mocked(recordActivity).mock.calls[0]?.[2]).toEqual(
      expect.objectContaining({ action: "auth.mfa.disabled" })
    );
  });

  it("is exempt from the two-factor check, or enrolling would be impossible", async () => {
    // An organization that mandates a factor would otherwise refuse the one
    // call that records somebody obtaining one.
    await POST(request());

    // And from the device gate: 2FA comes before device confirmation, so this
    // must answer on a browser that is not confirmed yet.
    expect(vi.mocked(authorizeMember).mock.calls[0]?.[1]).toEqual({
      allowUnsatisfiedMfa: true,
      allowUnconfirmedDevice: true
    });
  });

  it("writes no audit row of its own when nothing actually changed", async () => {
    // "Turned on" is recorded by the trust check at the moment of trust; this
    // route only records "turned off". A no-op records nothing.
    findUnique.mockResolvedValue({
      mfaEnrolledAt: new Date(),
      email: "user@example.com",
      name: "Test User"
    });

    await POST(request());

    expect(recordActivity).not.toHaveBeenCalled();
  });

  it("refuses when no token can be read rather than guessing", async () => {
    const response = await POST(request(null));

    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("still answers when the audit write fails", async () => {
    // The factor is already gone at Supabase by this point. Failing the
    // request would misreport an outcome that already happened.
    findUnique.mockResolvedValue({
      mfaEnrolledAt: new Date(),
      email: "user@example.com",
      name: "Test User"
    });
    reconcile.mockResolvedValue(trust(false));
    vi.mocked(recordActivity).mockRejectedValueOnce(new Error("audit down"));

    const response = await POST(request());

    expect(response.status).toBe(200);
  });
});
