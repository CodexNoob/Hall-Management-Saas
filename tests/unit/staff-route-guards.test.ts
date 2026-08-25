import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The privilege-escalation guards on /api/staff (P0-A).
 *
 * Before this suite there was no unit test anywhere exercising these handlers,
 * which is why C2 and C3 survived. Guards without tests are guards that get
 * refactored away.
 */

const mocks = vi.hoisted(() => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    organizationMembership: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    userAccess: {
      upsert: vi.fn(),
      findUnique: vi.fn()
    },
    organizationSetting: {
      findUnique: vi.fn(),
      upsert: vi.fn()
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn()
  },
  requirePermission: vi.fn(),
  requireAnyPermission: vi.fn(),
  enforceRateLimit: vi.fn(),
  sendStaffInvitations: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
// Must re-export the REAL AuthorizationError: the handlers now throw a 404
// through it and `createApiErrorResponse` classifies by `instanceof`. A bare
// stub turns that throw into a TypeError and the 404 assertions into 500s.
vi.mock("@/lib/auth/server-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/server-auth")>()),
  requirePermission: mocks.requirePermission,
  requireAnyPermission: mocks.requireAnyPermission
}));
vi.mock("@/lib/security/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: () => ({ auth: { admin: {} } })
}));
vi.mock("@/features/administration/server/staff-invitations", () => ({
  sendStaffInvitations: mocks.sendStaffInvitations,
  staffInviteRedirectTo: () => "http://localhost/auth/callback"
}));
vi.mock("@/lib/env", () => ({
  getEnv: () => ({ NEXT_PUBLIC_APP_URL: "http://localhost" })
}));

import { DELETE, PATCH, POST } from "@/app/api/staff/route";

const organizationId = "11111111-1111-4111-8111-111111111111";
const ACTOR_ID = "actor-1";
const TARGET_ID = "target-1";

function actor(role: string, id = ACTOR_ID) {
  return { id, organizationId, membership: { role } };
}

function patch(body: Record<string, unknown>) {
  return PATCH(
    new Request("http://localhost/api/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
  );
}

function post(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
  );
}

function del(id: string) {
  return DELETE(
    new Request(`http://localhost/api/staff?id=${id}`, { method: "DELETE" })
  );
}

/** A membership row as the handlers read it, with its user included. */
function membershipRow(role: string, userId = TARGET_ID) {
  return {
    id: `membership-${userId}`,
    organizationId,
    userId,
    role,
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    user: {
      id: userId,
      name: "Target Person",
      email: "target@example.com",
      phone: null,
      venueName: "General",
      role: "member",
      isActive: true
    }
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enforceRateLimit.mockResolvedValue(null);
  mocks.sendStaffInvitations.mockResolvedValue([]);
  mocks.requirePermission.mockResolvedValue(actor("owner"));
  mocks.requireAnyPermission.mockResolvedValue(actor("owner"));
  mocks.prisma.$transaction.mockImplementation(
    async (run: (transaction: typeof mocks.prisma) => unknown) =>
      run(mocks.prisma)
  );
  mocks.prisma.organizationMembership.update.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      ...membershipRow("viewer"),
      ...data
    })
  );
  mocks.prisma.organizationMembership.upsert.mockResolvedValue(
    membershipRow("viewer")
  );
  mocks.prisma.user.update.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      ...membershipRow("viewer").user,
      ...data
    })
  );
  mocks.prisma.user.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: "created-user",
      ...data
    })
  );
  mocks.prisma.userAccess.upsert.mockResolvedValue({ id: "access-1" });
  mocks.prisma.userAccess.findUnique.mockResolvedValue({ id: "access-1" });
});

describe("PATCH /api/staff - role ceiling (C3)", () => {
  it("refuses self-promotion to owner", async () => {
    mocks.requirePermission.mockResolvedValue(actor("manager"));
    mocks.prisma.organizationMembership.findFirst.mockResolvedValue({
      ...membershipRow("manager", ACTOR_ID)
    });

    const response = await patch({ id: ACTOR_ID, role: "owner" });

    expect(response.status).toBe(403);
    expect(mocks.prisma.organizationMembership.update).not.toHaveBeenCalled();
  });

  it("refuses assigning a role at or above the actor's own", async () => {
    mocks.requirePermission.mockResolvedValue(actor("admin"));
    mocks.prisma.organizationMembership.findFirst.mockResolvedValue(
      membershipRow("viewer")
    );

    const response = await patch({ id: TARGET_ID, role: "admin" });

    expect(response.status).toBe(403);
    expect(mocks.prisma.organizationMembership.update).not.toHaveBeenCalled();
  });

  it("refuses acting on a member at or above the actor's own rank", async () => {
    mocks.requirePermission.mockResolvedValue(actor("admin"));
    mocks.prisma.organizationMembership.findFirst.mockResolvedValue(
      membershipRow("owner")
    );

    const response = await patch({ id: TARGET_ID, role: "viewer" });

    expect(response.status).toBe(403);
  });

  it("applies the target check to status transitions too", async () => {
    mocks.requirePermission.mockResolvedValue(actor("admin"));
    mocks.prisma.organizationMembership.findFirst.mockResolvedValue(
      membershipRow("owner")
    );

    const response = await patch({ id: TARGET_ID, status: "Inactive" });

    expect(response.status).toBe(403);
  });
});

describe("PATCH /api/staff - profile edits still work", () => {
  it("does not write role when the submitted role matches the stored one", async () => {
    mocks.requirePermission.mockResolvedValue(actor("owner"));
    mocks.prisma.organizationMembership.findFirst.mockResolvedValue(
      membershipRow("owner")
    );

    // The edit dialog posts `role` on every save, including a phone-only edit.
    const response = await patch({
      id: TARGET_ID,
      role: "owner",
      phone: ""
    });

    expect(response.status).toBe(200);
    const updateArgs =
      mocks.prisma.organizationMembership.update.mock.calls[0][0];
    expect(updateArgs.data).not.toHaveProperty("role");
  });

  it("never writes role or isActive onto the shared user row", async () => {
    mocks.requirePermission.mockResolvedValue(actor("owner"));
    mocks.prisma.organizationMembership.findFirst.mockResolvedValue(
      membershipRow("viewer")
    );

    await patch({ id: TARGET_ID, role: "manager", name: "Renamed" });

    const userUpdate = mocks.prisma.user.update.mock.calls[0]?.[0];
    expect(userUpdate?.data).not.toHaveProperty("role");
    expect(userUpdate?.data).not.toHaveProperty("isActive");
  });

  it("returns a real 404 rather than a 500 for a non-member", async () => {
    mocks.prisma.organizationMembership.findFirst.mockResolvedValue(null);

    const response = await patch({ id: "someone-else", role: "viewer" });

    expect(response.status).toBe(404);
  });

  it("survives an Assign-role submission that carries no profile fields", async () => {
    mocks.requirePermission.mockResolvedValue(actor("owner"));
    mocks.prisma.organizationMembership.findFirst.mockResolvedValue(
      membershipRow("viewer")
    );

    const response = await patch({ id: TARGET_ID, role: "manager" });
    const body = await response.json();

    expect(response.status).toBe(200);
    // Regression: without `include: { user: true }` this shipped `undefined`
    // with a 200 and broke the dialog.
    expect(body.staff.id).toBe(TARGET_ID);
  });
});

describe("POST /api/staff - invite is not a demotion primitive (C2)", () => {
  it("refuses inviting at a role at or above the actor's own", async () => {
    mocks.requirePermission.mockResolvedValue(actor("admin"));

    const response = await post({ email: "new@example.com", role: "owner" });

    expect(response.status).toBe(403);
    expect(mocks.prisma.user.create).not.toHaveBeenCalled();
  });

  it("refuses re-inviting an existing owner at a lower role", async () => {
    mocks.requirePermission.mockResolvedValue(actor("admin"));
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: TARGET_ID,
      name: "Existing Owner"
    });
    mocks.prisma.organizationMembership.findUnique.mockResolvedValue(
      membershipRow("owner")
    );

    const response = await post({ email: "owner@example.com", role: "viewer" });

    expect(response.status).toBe(403);
    expect(mocks.prisma.organizationMembership.upsert).not.toHaveBeenCalled();
  });

  it("never overwrites an existing user's global row", async () => {
    mocks.requirePermission.mockResolvedValue(actor("owner"));
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: TARGET_ID,
      name: "Existing Person",
      phone: "+15550001111",
      venueName: "Kitchen"
    });
    mocks.prisma.organizationMembership.findUnique.mockResolvedValue(null);

    const response = await post({ email: "existing@example.com", role: "viewer" });

    expect(response.status).toBe(200);
    // The old handler rewrote name/phone/venueName/role/isActive here - and
    // since the invite dialog collects no phone, it wiped the number.
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });

  it("writes a placeholder, not an authority, into users.role on create", async () => {
    mocks.requirePermission.mockResolvedValue(actor("owner"));
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    mocks.prisma.organizationMembership.findUnique.mockResolvedValue(null);

    await post({ email: "brand-new@example.com", role: "manager" });

    expect(mocks.prisma.user.create.mock.calls[0][0].data.role).toBe("member");
    // The real role lands on the membership, which is per-tenant.
    expect(mocks.prisma.organizationMembership.upsert.mock.calls[0][0].create.role).toBe(
      "manager"
    );
  });
});

describe("DELETE /api/staff - scoped, and no global write (C3)", () => {
  it("404s for a user outside the organization and touches nothing", async () => {
    mocks.prisma.organizationMembership.findFirst.mockResolvedValue(null);

    const response = await del("user-in-another-org");

    expect(response.status).toBe(404);
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
    expect(mocks.prisma.organizationMembership.update).not.toHaveBeenCalled();
  });

  it("deactivates the membership and leaves users.is_active alone", async () => {
    mocks.prisma.organizationMembership.findFirst.mockResolvedValue(
      membershipRow("viewer")
    );

    const response = await del(TARGET_ID);

    expect(response.status).toBe(200);
    expect(mocks.prisma.organizationMembership.update).toHaveBeenCalledWith({
      where: { id: `membership-${TARGET_ID}` },
      data: { isActive: false }
    });
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });

  it("refuses removing a member at or above the actor's own rank", async () => {
    mocks.requirePermission.mockResolvedValue(actor("admin"));
    mocks.prisma.organizationMembership.findFirst.mockResolvedValue(
      membershipRow("owner")
    );

    const response = await del(TARGET_ID);

    expect(response.status).toBe(403);
    expect(mocks.prisma.organizationMembership.update).not.toHaveBeenCalled();
  });
});
