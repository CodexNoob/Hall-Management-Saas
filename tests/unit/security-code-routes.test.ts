import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz/authorize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authz/authorize")>()),
  authorizeMember: vi.fn()
}));
vi.mock("@/lib/security/rate-limit", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null)
}));

const mocks = vi.hoisted(() => ({
  findUniqueOrThrow: vi.fn(),
  issueSecurityCode: vi.fn(),
  withdrawSecurityCode: vi.fn(),
  verifySecurityCode: vi.fn(),
  sendSecurityEmail: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUniqueOrThrow: mocks.findUniqueOrThrow } }
}));
vi.mock("@/lib/auth/security-codes", () => ({
  issueSecurityCode: mocks.issueSecurityCode,
  withdrawSecurityCode: mocks.withdrawSecurityCode,
  verifySecurityCode: mocks.verifySecurityCode,
  maskEmail: () => "a•••@example.com"
}));
vi.mock("@/lib/auth/security-emails", () => ({
  sendSecurityEmail: mocks.sendSecurityEmail,
  enrollmentCodeEmail: ({ code }: { code: string }) => ({ subject: "code", html: code })
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getSession: async () => ({ data: { session: null }, error: null }) }
  })
}));

import { POST as send } from "@/app/api/me/security-code/send/route";
import { POST as verify } from "@/app/api/me/security-code/verify/route";
import { authorizeMember } from "@/lib/authz/authorize";
import { authzContext } from "./authz-test-helpers";

const TOKEN = `header.${Buffer.from(
  JSON.stringify({ sub: "supabase-1", session_id: "sess-1" })
).toString("base64url")}.signature`;

const post = (url: string, body: unknown, token: string | null = TOKEN) =>
  new Request(`http://localhost${url}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });

const ISSUED = {
  status: "issued",
  id: "code-row",
  code: "482913",
  expiresAt: new Date("2026-09-26T12:10:00Z"),
  resendAvailableAt: new Date("2026-09-26T12:01:00Z")
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authorizeMember).mockResolvedValue(
    authzContext({ organizationId: "org-1", userId: "user-1" })
  );
  mocks.findUniqueOrThrow.mockResolvedValue({
    email: "ada@example.com",
    name: "Ada",
    mfaEnrolledAt: null
  });
  mocks.issueSecurityCode.mockResolvedValue(ISSUED);
  mocks.sendSecurityEmail.mockResolvedValue("sent");
});

describe("POST /api/me/security-code/send", () => {
  it("emails the code to the caller's own address and never returns it", async () => {
    const response = await send(post("/api/me/security-code/send", { purpose: "MFA_ENROLLMENT" }));
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).not.toContain("482913");
    expect(JSON.parse(text)).toMatchObject({ sentTo: "a•••@example.com" });
    expect(mocks.sendSecurityEmail).toHaveBeenCalledWith(
      "mfa_enrollment_code",
      "ada@example.com",
      expect.objectContaining({ html: "482913" })
    );
    expect(mocks.issueSecurityCode).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: "user-1", sessionId: "sess-1" })
    );
  });

  it("is exempt from the two-factor check - it is how a factor is obtained", async () => {
    await send(post("/api/me/security-code/send", { purpose: "MFA_ENROLLMENT" }));

    // Device gate too: 2FA set-up happens before device confirmation.
    expect(vi.mocked(authorizeMember).mock.calls[0]?.[1]).toEqual({
      allowUnsatisfiedMfa: true,
      allowUnconfirmedDevice: true
    });
  });

  it("refuses an email address in the request - the address is never the caller's to choose", async () => {
    const response = await send(
      post("/api/me/security-code/send", { purpose: "MFA_ENROLLMENT", email: "thief@example.com" })
    );

    expect(response.status).toBe(400);
    expect(mocks.sendSecurityEmail).not.toHaveBeenCalled();
  });

  it("refuses when the account already has a trusted factor", async () => {
    mocks.findUniqueOrThrow.mockResolvedValue({
      email: "ada@example.com",
      name: "Ada",
      mfaEnrolledAt: new Date()
    });

    const response = await send(post("/api/me/security-code/send", { purpose: "MFA_ENROLLMENT" }));

    expect(response.status).toBe(409);
    expect(mocks.issueSecurityCode).not.toHaveBeenCalled();
  });

  it("refuses without a session to tie the grant to", async () => {
    const response = await send(
      post("/api/me/security-code/send", { purpose: "MFA_ENROLLMENT" }, null)
    );

    expect(response.status).toBe(400);
  });

  it("withdraws the code when the email cannot be sent", async () => {
    mocks.sendSecurityEmail.mockResolvedValue("unconfigured");

    const response = await send(post("/api/me/security-code/send", { purpose: "MFA_ENROLLMENT" }));

    expect(response.status).toBe(503);
    expect(mocks.withdrawSecurityCode).toHaveBeenCalledWith(expect.anything(), "code-row");
  });

  it("answers 429 inside the resend cooldown", async () => {
    mocks.issueSecurityCode.mockResolvedValue({
      status: "cooldown",
      resendAvailableAt: new Date("2026-09-26T12:01:00Z")
    });

    const response = await send(post("/api/me/security-code/send", { purpose: "MFA_ENROLLMENT" }));

    expect(response.status).toBe(429);
    expect(mocks.sendSecurityEmail).not.toHaveBeenCalled();
  });
});

describe("POST /api/me/security-code/verify", () => {
  const submit = (code = "482913") =>
    verify(post("/api/me/security-code/verify", { purpose: "MFA_ENROLLMENT", code }));

  it("turns a correct code into a grant for this session", async () => {
    mocks.verifySecurityCode.mockResolvedValue({
      status: "verified",
      grantExpiresAt: new Date("2026-09-26T12:15:00Z")
    });

    const response = await submit();

    expect(response.status).toBe(200);
    expect(mocks.verifySecurityCode).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: "user-1", sessionId: "sess-1", code: "482913" })
    );
  });

  it.each([
    [{ status: "invalid", attemptsLeft: 3 }, 400],
    [{ status: "locked" }, 429],
    [{ status: "expired" }, 410],
    [{ status: "missing" }, 410]
  ])("answers %o with %i", async (result, status) => {
    mocks.verifySecurityCode.mockResolvedValue(result);

    expect((await submit()).status).toBe(status);
  });

  it("refuses a code that is not six digits without checking it", async () => {
    const response = await submit("12ab");

    expect(response.status).toBe(400);
    expect(mocks.verifySecurityCode).not.toHaveBeenCalled();
  });
});
