import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn()
    }
  }
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: vi.fn()
}));

import {
  AuthorizationError,
  requireAuthenticatedUser,
  requirePermission
} from "@/lib/auth/server-auth";
import { prisma } from "@/lib/prisma";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const getUser = vi.fn();
const organization = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Test Organization",
  slug: "test-organization",
  isActive: true
};
const activeUser = {
  id: "22222222-2222-4222-8222-222222222222",
  organizationId: organization.id,
  name: "Test User",
  email: "user@example.com",
  role: "user",
  isActive: true,
  memberships: [
    {
      organizationId: organization.id,
      role: "member",
      isActive: true,
      organization
    }
  ],
  access: [
    {
      organizationId: organization.id,
      canCreateBooking: true,
      allowedHallIds: []
    }
  ]
};

function authenticatedRequest() {
  return new Request("http://localhost/api/events", {
    headers: { Authorization: "Bearer valid-token" }
  });
}

describe("server authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSupabaseServiceClient).mockReturnValue({
      auth: { getUser }
    } as never);
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "11111111-1111-4111-8111-111111111111",
          email: activeUser.email
        }
      },
      error: null
    });
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser as never);
  });

  it("rejects requests without a bearer token", async () => {
    await expect(
      requireAuthenticatedUser(new Request("http://localhost/api/events"))
    ).rejects.toMatchObject({
      status: 401
    });
    expect(createSupabaseServiceClient).not.toHaveBeenCalled();
  });

  it("rejects invalid Supabase sessions", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("invalid")
    });

    await expect(
      requireAuthenticatedUser(authenticatedRequest())
    ).rejects.toMatchObject({ status: 401 });
  });

  it("rejects inactive database users", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...activeUser,
      isActive: false
    } as never);

    await expect(
      requireAuthenticatedUser(authenticatedRequest())
    ).rejects.toMatchObject({ status: 403 });
  });

  it("enforces database-backed permissions", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...activeUser,
      access: [
        {
          organizationId: organization.id,
          canCreateBooking: false,
          allowedHallIds: []
        }
      ]
    } as never);

    await expect(
      requirePermission(authenticatedRequest(), "canCreateBooking")
    ).rejects.toEqual(
      new AuthorizationError(
        403,
        "You do not have permission to perform this action."
      )
    );
  });

  it("returns an authorized user with the required permission", async () => {
    await expect(
      requirePermission(authenticatedRequest(), "canCreateBooking")
    ).resolves.toMatchObject({
      id: activeUser.id
    });
  });

  it("allows members to view office pages but rejects office edits", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...activeUser,
      access: [
        {
          organizationId: organization.id,
          canViewSettings: true,
          canEditSettings: false,
          allowedHallIds: []
        }
      ]
    } as never);

    await expect(
      requirePermission(authenticatedRequest(), "canViewSettings")
    ).resolves.toMatchObject({ id: activeUser.id });
    await expect(
      requirePermission(authenticatedRequest(), "canEditSettings")
    ).rejects.toMatchObject({ status: 403 });
  });

  it("allows organization owners without an individual permission flag", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...activeUser,
      memberships: [
        {
          organizationId: organization.id,
          role: "owner",
          isActive: true,
          organization
        }
      ],
      access: []
    } as never);

    await expect(
      requirePermission(authenticatedRequest(), "canManagePayments")
    ).resolves.toMatchObject({
      organizationId: organization.id
    });
  });

  it("normalizes legacy super-admin membership roles", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...activeUser,
      memberships: [
        {
          organizationId: organization.id,
          role: "Super Admin",
          isActive: true,
          organization
        }
      ],
      access: []
    } as never);

    await expect(
      requirePermission(authenticatedRequest(), "canViewPaymentInfo")
    ).resolves.toMatchObject({ organizationId: organization.id });
  });

  it("rejects a requested organization the user has not joined", async () => {
    const request = new Request("http://localhost/api/events", {
      headers: {
        Authorization: "Bearer valid-token",
        "X-Organization-Id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
      }
    });

    await expect(requireAuthenticatedUser(request)).rejects.toMatchObject({
      status: 403
    });
  });
});
