import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz/authorize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authz/authorize")>()),
  authorize: vi.fn(),
  authorizeMember: vi.fn()
}));
vi.mock("@/lib/security/rate-limit", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null)
}));
vi.mock("@/lib/auth/password-reset", () => ({
  sendPasswordResetEmail: vi.fn(),
  createPasswordResetLink: vi.fn()
}));
vi.mock("@/lib/authz/admin/context", () => ({
  loadActorFacts: vi.fn(),
  rankOfPrincipal: vi.fn()
}));
vi.mock("@/lib/authz/admin/audit", () => ({
  writeAudit: vi.fn(async () => undefined)
}));

const { userFindUniqueOrThrow, membershipFindFirst } = vi.hoisted(() => ({
  userFindUniqueOrThrow: vi.fn(),
  membershipFindFirst: vi.fn()
}));

vi.mock("@/lib/prisma", () => {
  const client = {
    user: { findUniqueOrThrow: userFindUniqueOrThrow },
    organizationMembership: { findFirst: membershipFindFirst }
  };

  return {
    prisma: {
      ...client,
      $transaction: async (run: (transaction: typeof client) => unknown) =>
        run(client)
    }
  };
});

import { POST as ownReset } from "@/app/api/me/password-reset/route";
import { POST as staffReset } from "@/app/api/staff/[principalId]/password-reset/route";
import {
  createPasswordResetLink,
  sendPasswordResetEmail
} from "@/lib/auth/password-reset";
import { loadActorFacts, rankOfPrincipal } from "@/lib/authz/admin/context";
import { writeAudit } from "@/lib/authz/admin/audit";
import { authorize, authorizeMember } from "@/lib/authz/authorize";
import { authzContext } from "./authz-test-helpers";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const principalId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const post = (url: string, body?: unknown) =>
  new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authorizeMember).mockResolvedValue(
    authzContext({ organizationId, userId })
  );
  vi.mocked(authorize).mockResolvedValue(
    authzContext({ organizationId, userId, permission: "staff.update" })
  );
});

describe("POST /api/me/password-reset", () => {
  it("emails the reset link to the address on the caller's own row", async () => {
    userFindUniqueOrThrow.mockResolvedValue({
      email: "ada@example.com",
      supabaseAuthId: "supabase-ada"
    });
    vi.mocked(sendPasswordResetEmail).mockResolvedValue({ error: null });

    const response = await ownReset(post("/api/me/password-reset"));

    expect(response.status).toBe(200);
    expect(userFindUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: userId } })
    );
    expect(sendPasswordResetEmail).toHaveBeenCalledWith("ada@example.com");
  });

  it("passes Supabase's refusal back rather than claiming it was sent", async () => {
    userFindUniqueOrThrow.mockResolvedValue({
      email: "ada@example.com",
      supabaseAuthId: "supabase-ada"
    });
    vi.mocked(sendPasswordResetEmail).mockResolvedValue({
      error: "For security purposes, you can only request this after 60 seconds."
    });

    const response = await ownReset(post("/api/me/password-reset"));

    expect(response.status).toBe(422);
  });
});

describe("POST /api/staff/[principalId]/password-reset", () => {
  const params = { params: Promise.resolve({ principalId }) };

  beforeEach(() => {
    membershipFindFirst.mockResolvedValue({
      isActive: true,
      user: {
        id: "user-2",
        name: "Ben Cook",
        email: "ben@example.com",
        supabaseAuthId: "supabase-ben"
      }
    });
    vi.mocked(loadActorFacts).mockResolvedValue({
      principalId: "admin-principal",
      organizationId,
      userId,
      actorName: "Admin",
      permissions: new Set(),
      rank: 200
    });
    vi.mocked(rankOfPrincipal).mockResolvedValue(500);
  });

  it("emails the reset and records who issued it", async () => {
    vi.mocked(sendPasswordResetEmail).mockResolvedValue({ error: null });

    const response = await staffReset(
      post(`/api/staff/${principalId}/password-reset`, { delivery: "email" }),
      params
    );
    const body = (await response.json()) as { emailSent: boolean; link: string | null };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ emailSent: true, link: null });
    expect(sendPasswordResetEmail).toHaveBeenCalledWith("ben@example.com");
    expect(createPasswordResetLink).not.toHaveBeenCalled();
    expect(writeAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        action: "staff.password.reset",
        subjectPrincipalId: principalId,
        detail: { delivery: "email" }
      })
    );
  });

  it("falls back to a link to share when the email is refused", async () => {
    vi.mocked(sendPasswordResetEmail).mockResolvedValue({ error: "Email rate limit exceeded" });
    vi.mocked(createPasswordResetLink).mockResolvedValue("https://app/auth/confirm?token_hash=x&type=recovery");

    const response = await staffReset(
      post(`/api/staff/${principalId}/password-reset`, { delivery: "email" }),
      params
    );
    const body = (await response.json()) as { emailSent: boolean; link: string | null };

    expect(body.emailSent).toBe(false);
    expect(body.link).toContain("type=recovery");
  });

  it("hands over a link without emailing when asked for one", async () => {
    vi.mocked(createPasswordResetLink).mockResolvedValue("https://app/auth/confirm?token_hash=y&type=recovery");

    const response = await staffReset(
      post(`/api/staff/${principalId}/password-reset`, { delivery: "link" }),
      params
    );

    expect(response.status).toBe(200);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("refuses to reset somebody who outranks the caller, and sends nothing", async () => {
    vi.mocked(rankOfPrincipal).mockResolvedValue(100);

    const response = await staffReset(
      post(`/api/staff/${principalId}/password-reset`, { delivery: "email" }),
      params
    );

    expect(response.status).toBe(403);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    expect(writeAudit).not.toHaveBeenCalled();
  });

  it("does not reach into another organization", async () => {
    membershipFindFirst.mockResolvedValue(null);

    const response = await staffReset(
      post(`/api/staff/${principalId}/password-reset`, { delivery: "email" }),
      params
    );

    expect(response.status).toBe(404);
    expect(membershipFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { principalId, organizationId } })
    );
  });

  it("sends an invitation-pending person back to the invitation", async () => {
    membershipFindFirst.mockResolvedValue({
      isActive: true,
      user: { id: "user-3", name: "New", email: "new@example.com", supabaseAuthId: null }
    });

    const response = await staffReset(
      post(`/api/staff/${principalId}/password-reset`, { delivery: "email" }),
      params
    );

    expect(response.status).toBe(409);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});
