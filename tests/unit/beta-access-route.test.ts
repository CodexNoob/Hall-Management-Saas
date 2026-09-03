// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/beta-access/requests.
 *
 * The endpoint the sign-up form calls between `supabase.auth.signUp` and email
 * confirmation, when no session exists yet. It records and notifies; it decides
 * nothing, and it CANNOT approve anything - the only writer of APPROVED is the
 * approval script.
 *
 * The property pinned hardest is the last block: it answers identically for
 * every address, so it cannot be used to ask whether somebody has an account.
 */

vi.mock("server-only", () => ({}));

const { recordAndNotifyBetaAccessRequest } = vi.hoisted(() => ({
  recordAndNotifyBetaAccessRequest: vi.fn()
}));

vi.mock("@/features/beta-access/server/beta-access", () => ({
  recordAndNotifyBetaAccessRequest
}));

const { enforceRateLimit } = vi.hoisted(() => ({ enforceRateLimit: vi.fn() }));

vi.mock("@/lib/security/rate-limit", () => ({ enforceRateLimit }));

// `withRoute` pulls in the API error mapper, which reaches the booking service
// and through it a real Prisma client. The route never touches the database
// itself - the module that does is mocked above.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

vi.mock("@/lib/logging/context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/logging/context")>()),
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() }
}));

import { POST } from "@/app/api/beta-access/requests/route";

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/beta-access/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }) as never
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  enforceRateLimit.mockResolvedValue(null);
  recordAndNotifyBetaAccessRequest.mockResolvedValue({
    email: "applicant@example.com",
    status: "PENDING",
    signupMethod: "email_password",
    requestedAt: new Date(),
    isNew: true
  });
});

describe("POST /api/beta-access/requests", () => {
  it("records the request and accepts it", async () => {
    const response = await post({ email: "Applicant@Example.com" });

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ status: "received" });
    expect(recordAndNotifyBetaAccessRequest).toHaveBeenCalledWith({
      email: "Applicant@Example.com",
      signupMethod: "email_password"
    });
  });

  it("refuses an address that is not one", async () => {
    const response = await post({ email: "not-an-address" });

    expect(response.status).toBe(400);
    expect(recordAndNotifyBetaAccessRequest).not.toHaveBeenCalled();
  });

  it("refuses a filled honeypot without writing anything", async () => {
    const response = await post({
      email: "applicant@example.com",
      website: "http://spam.example"
    });

    expect(response.status).toBe(400);
    expect(recordAndNotifyBetaAccessRequest).not.toHaveBeenCalled();
  });

  it("cannot be talked into setting a status", async () => {
    // `.strict()`. There is no approval endpoint, and this is the closest thing
    // to one that exists - so nothing may smuggle a status through it.
    const response = await post({
      email: "applicant@example.com",
      status: "APPROVED"
    });

    expect(response.status).toBe(400);
    expect(recordAndNotifyBetaAccessRequest).not.toHaveBeenCalled();
  });

  it("preserves the existing rate limiting", async () => {
    enforceRateLimit.mockResolvedValue(
      new Response("Too many requests", { status: 429 })
    );

    const response = await post({ email: "applicant@example.com" });

    expect(response.status).toBe(429);
    expect(recordAndNotifyBetaAccessRequest).not.toHaveBeenCalled();
  });

  it("does not leak a recording failure as a sign-up failure", async () => {
    recordAndNotifyBetaAccessRequest.mockRejectedValue(new Error("db down"));

    const response = await post({ email: "applicant@example.com" });

    expect(response.status).toBe(500);
    expect((await response.json()).error).not.toMatch(/db down/);
  });

  /**
   * The endpoint is unauthenticated, so if it answered differently for a known
   * address it would be an account oracle for anyone holding a list of emails.
   */
  describe("never reveals whether an address already has an account", () => {
    it("answers identically for every outcome", async () => {
      const outcomes = [
        { status: "PENDING", isNew: true },
        { status: "PENDING", isNew: false },
        { status: "REJECTED", isNew: false },
        { status: "APPROVED", isNew: false }
      ];
      const responses = [];

      for (const outcome of outcomes) {
        recordAndNotifyBetaAccessRequest.mockResolvedValue({
          email: "applicant@example.com",
          signupMethod: "email_password",
          requestedAt: new Date(),
          ...outcome
        });

        const response = await post({ email: "applicant@example.com" });
        responses.push({ status: response.status, body: await response.json() });
      }

      const [first, ...rest] = responses;

      expect(first).toEqual({ status: 202, body: { status: "received" } });
      for (const response of rest) expect(response).toEqual(first);
    });
  });
});
