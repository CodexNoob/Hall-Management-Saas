import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server-auth", () => ({
  AuthorizationError: class AuthorizationError extends Error {
    constructor(
      public readonly status: 401 | 403,
      message: string
    ) {
      super(message);
    }
  },
  assertHallAccess: vi.fn(),
  requireAnyPermission: vi.fn(),
  requirePermission: vi.fn()
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findMany: vi.fn() },
    hall: { findMany: vi.fn() },
    eventType: { findMany: vi.fn() },
    eventPackage: { findMany: vi.fn() },
    organizationSetting: { upsert: vi.fn() }
  }
}));
vi.mock("@/features/bookings/services/booking.service", () => ({
  BookingError: class BookingError extends Error {},
  createBooking: vi.fn(),
  expireOrganizationHolds: vi.fn().mockResolvedValue(0)
}));

import { GET } from "@/app/api/events/route";
import { requireAnyPermission } from "@/lib/auth/server-auth";
import { prisma } from "@/lib/prisma";

describe("event tenant isolation", () => {
  const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAnyPermission).mockResolvedValue({
      id: "22222222-2222-4222-8222-222222222222",
      organizationId,
      membership: { role: "member" },
      access: { allowedHallIds: [] }
    } as never);
    vi.mocked(prisma.event.findMany).mockResolvedValue([]);
    vi.mocked(prisma.hall.findMany).mockResolvedValue([]);
    vi.mocked(prisma.eventType.findMany).mockResolvedValue([]);
    vi.mocked(prisma.eventPackage.findMany).mockResolvedValue([]);
    vi.mocked(prisma.organizationSetting.upsert).mockResolvedValue({
      integrations: null
    } as never);
  });

  it("always scopes event reads to the verified organization", async () => {
    const request = new Request("http://localhost/api/events", {
      headers: {
        Authorization: "Bearer valid-token",
        "X-Organization-Id": organizationId
      }
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId })
      })
    );
  });
});
