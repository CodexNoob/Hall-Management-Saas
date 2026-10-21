import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz/authorize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authz/authorize")>()),
  authorizeMember: vi.fn(),
  effectiveAccessOf: vi.fn()
}));
vi.mock("@/lib/security/rate-limit", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null)
}));
vi.mock("@/lib/audit/activity-log", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/audit/activity-log")>()),
  recordActivity: vi.fn(async () => ({ id: "log-1" }))
}));
vi.mock("@/lib/authz/admin/assignments", () => ({
  listAssignments: vi.fn()
}));

const {
  userFindUniqueOrThrow,
  userUpdate,
  organizationFindUnique,
  preferenceUpsert,
  signInWithPassword,
  adminSignOut,
  updateUserById
} = vi.hoisted(() => ({
  userFindUniqueOrThrow: vi.fn(),
  userUpdate: vi.fn(),
  organizationFindUnique: vi.fn(),
  preferenceUpsert: vi.fn(),
  signInWithPassword: vi.fn(),
  adminSignOut: vi.fn(),
  updateUserById: vi.fn()
}));

vi.mock("@/lib/prisma", () => {
  const client = {
    user: { findUniqueOrThrow: userFindUniqueOrThrow, update: userUpdate },
    organization: { findUnique: organizationFindUnique },
    notificationPreference: { upsert: preferenceUpsert }
  };

  return {
    prisma: {
      ...client,
      $transaction: async (run: (transaction: typeof client) => unknown) =>
        run(client)
    }
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseTokenVerifier: () => ({ auth: { signInWithPassword } }),
  createSupabaseServiceClient: () => ({
    auth: { admin: { signOut: adminSignOut, updateUserById } }
  })
}));

import { GET as getAccess } from "@/app/api/me/access/route";
import { PATCH as patchNotifications } from "@/app/api/me/notifications/route";
import { POST as changePassword } from "@/app/api/me/password/route";
import { PATCH as patchProfile } from "@/app/api/me/profile/route";
import { recordActivity } from "@/lib/audit/activity-log";
import { listAssignments } from "@/lib/authz/admin/assignments";
import { authorizeMember, effectiveAccessOf } from "@/lib/authz/authorize";
import { authzContext } from "./authz-test-helpers";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const principalId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const jsonRequest = (url: string, method: string, body?: unknown) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authorizeMember).mockResolvedValue(
    authzContext({ organizationId, userId, principalId })
  );
  organizationFindUnique.mockResolvedValue({ name: "Grand Hall" });
});

describe("PATCH /api/me/profile", () => {
  beforeEach(() => {
    userFindUniqueOrThrow.mockResolvedValue({ name: "Ada", phone: null });
    userUpdate.mockImplementation(async ({ data }) => ({
      name: data.name ?? "Ada",
      email: "ada@example.com",
      phone: data.phone ?? null,
      venueName: "Kitchen",
      title: "Cook"
    }));
  });

  it("updates the caller's own name and nobody else's", async () => {
    const response = await patchProfile(
      jsonRequest("/api/me/profile", "PATCH", { name: "Ada Lovelace" })
    );

    expect(response.status).toBe(200);
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: userId },
        data: { name: "Ada Lovelace" }
      })
    );
    expect(recordActivity).toHaveBeenCalledOnce();
  });

  it.each([
    ["a job title", { title: "Head Chef" }],
    ["a department", { department: "Management" }],
    ["roles", { roleIds: ["dddddddd-dddd-4ddd-8ddd-dddddddddddd"] }],
    ["another user's id", { userId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" }]
  ])("refuses %s outright instead of quietly dropping it", async (_label, body) => {
    const response = await patchProfile(
      jsonRequest("/api/me/profile", "PATCH", { name: "Ada", ...body })
    );

    expect(response.status).toBe(400);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("records nothing when nothing actually changed", async () => {
    await patchProfile(jsonRequest("/api/me/profile", "PATCH", { name: "Ada" }));

    expect(recordActivity).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/me/notifications", () => {
  it("writes the caller's own row in the caller's own organization", async () => {
    preferenceUpsert.mockResolvedValue({
      emailNotifications: false,
      eventConfirmations: true,
      billingAlerts: true,
      systemAnnouncements: false
    });

    const response = await patchNotifications(
      jsonRequest("/api/me/notifications", "PATCH", { emailNotifications: false })
    );

    expect(response.status).toBe(200);
    expect(preferenceUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId_userId: { organizationId, userId } },
        update: { emailNotifications: false }
      })
    );
  });

  it("refuses fields that are not a notification switch", async () => {
    const response = await patchNotifications(
      jsonRequest("/api/me/notifications", "PATCH", { twoFactorRequired: false })
    );

    expect(response.status).toBe(400);
    expect(preferenceUpsert).not.toHaveBeenCalled();
  });
});

describe("POST /api/me/password", () => {
  beforeEach(() => {
    userFindUniqueOrThrow.mockResolvedValue({
      email: "ada@example.com",
      supabaseAuthId: "supabase-ada"
    });
    signInWithPassword.mockResolvedValue({
      data: {
        user: { id: "supabase-ada" },
        session: { access_token: "proof-token" }
      },
      error: null
    });
    adminSignOut.mockResolvedValue({ data: null, error: null });
    updateUserById.mockResolvedValue({ data: {}, error: null });
    userUpdate.mockResolvedValue({});
  });

  const submit = (currentPassword: string, newPassword: string) =>
    changePassword(
      jsonRequest("/api/me/password", "POST", { currentPassword, newPassword })
    );

  it("changes the password once the current one is proved, and ends the proof session", async () => {
    const response = await submit("oldPass123", "newPass456");

    expect(response.status).toBe(200);
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "ada@example.com",
      password: "oldPass123"
    });
    expect(adminSignOut).toHaveBeenCalledWith("proof-token", "local");
    expect(updateUserById).toHaveBeenCalledWith("supabase-ada", {
      password: "newPass456"
    });
    expect(recordActivity).toHaveBeenCalledOnce();
  });

  it("refuses a wrong current password and changes nothing", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials" }
    });

    const response = await submit("wrongPass1", "newPass456");

    expect(response.status).toBe(400);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("does not accept a proof that belongs to a different account", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { id: "someone-else" }, session: null },
      error: null
    });

    const response = await submit("oldPass123", "newPass456");

    expect(response.status).toBe(400);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("applies the password rules before asking Supabase anything", async () => {
    const response = await submit("oldPass123", "short");

    expect(response.status).toBe(400);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});

describe("GET /api/me/access", () => {
  it("answers for the caller's own principal only", async () => {
    vi.mocked(listAssignments).mockResolvedValue(
      new Map([
        [
          principalId,
          [
            {
              id: "assignment-1",
              roleId: "role-1",
              roleName: "Kitchen Staff",
              roleKey: "kitchen-staff",
              rank: 500,
              scopeType: "org",
              scopeId: organizationId,
              scopeLabel: null,
              expiresAt: null,
              grantedByName: "Owner",
              source: "manual",
              createdAt: "2026-09-01T00:00:00.000Z"
            }
          ]
        ]
      ]) as Awaited<ReturnType<typeof listAssignments>>
    );
    vi.mocked(effectiveAccessOf).mockResolvedValue({
      permissions: new Map([["kitchen.read", { hallIds: "all", eventTypeIds: "all" }]])
    } as unknown as Awaited<ReturnType<typeof effectiveAccessOf>>);

    const response = await getAccess(jsonRequest("/api/me/access", "GET"));
    const body = (await response.json()) as {
      roles: Array<{ roleName: string }>;
      permissionGroups: Array<{ permissions: Array<{ key: string }> }>;
    };

    expect(listAssignments).toHaveBeenCalledWith(organizationId, [principalId]);
    expect(body.roles.map((role) => role.roleName)).toEqual(["Kitchen Staff"]);
    expect(
      body.permissionGroups.flatMap((group) => group.permissions.map((p) => p.key))
    ).toEqual(["kitchen.read"]);
  });
});
