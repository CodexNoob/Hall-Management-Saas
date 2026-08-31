import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz/authorize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authz/authorize")>()),
  assertInScope: vi.fn(),
  authorize: vi.fn()
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findMany: vi.fn() },
    hall: { findMany: vi.fn() },
    eventType: { findMany: vi.fn() },
    eventPackage: { findMany: vi.fn() },
    organizationMembership: { findMany: vi.fn() },
    organizationSetting: { upsert: vi.fn() },
    activityLog: { findMany: vi.fn() },
    $queryRaw: vi.fn()
  }
}));
vi.mock("@/features/bookings/services/booking.service", () => ({
  BookingError: class BookingError extends Error {},
  // `createApiErrorResponse` reaches for this on every error path, so leaving
  // it off the mock turns any failure into an unrelated "no export" crash.
  isWriteConflictError: vi.fn(() => false),
  createBooking: vi.fn(),
  expireOrganizationHolds: vi.fn().mockResolvedValue(0)
}));

import { GET } from "@/app/api/events/route";
import { authorize } from "@/lib/authz/authorize";
import { prisma } from "@/lib/prisma";
import { authzContext } from "./authz-test-helpers";

describe("event tenant isolation", () => {
  const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authorize).mockResolvedValue(
      authzContext({
        organizationId,
        userId: "22222222-2222-4222-8222-222222222222"
      })
    );
    vi.mocked(prisma.event.findMany).mockResolvedValue([]);
    vi.mocked(prisma.hall.findMany).mockResolvedValue([]);
    vi.mocked(prisma.eventType.findMany).mockResolvedValue([]);
    vi.mocked(prisma.eventPackage.findMany).mockResolvedValue([]);
    vi.mocked(prisma.organizationMembership.findMany).mockResolvedValue([]);
    vi.mocked(prisma.organizationSetting.upsert).mockResolvedValue({
      integrations: null
    } as never);
    vi.mocked(prisma.activityLog.findMany).mockResolvedValue([]);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([]);
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

  it("returns Dining Manager notes with each event", async () => {
    const eventId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    vi.mocked(prisma.event.findMany).mockResolvedValue([
      {
        id: eventId,
        organizationId,
        clientName: "Charles",
        eventDate: new Date("2026-08-12T00:00:00.000Z"),
        eventType: "Wedding",
        eventStatus: "Confirmed",
        bookingStatus: "CONFIRMED",
        startsAt: null,
        endsAt: null,
        setupStartsAt: null,
        cleanupEndsAt: null,
        holdExpiresAt: null,
        version: 1,
        paymentStatus: null,
        packageName: null,
        couplesCount: 0,
        menCount: 0,
        ladiesCount: 0,
        boysCount: 0,
        girlsCount: 0,
        kidsCount: 0,
        notes: null,
        phone: "Not provided",
        email: null,
        workspaceData: null,
        hall: { id: "hall-1", name: "Hall 1" },
        package: null,
        client: null
      }
    ] as never);
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([
        {
          eventId,
          specialNotes: "VIP table beside stage."
        }
      ])
      .mockResolvedValueOnce([
        {
          eventId,
          hallMapPresetId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          hallMapPresetName: "Wedding Layout",
          hallMapPresetObjects: [
            {
              id: "table-1",
              type: "round-table",
              name: "VIP Table",
              x: 80,
              y: 90,
              width: 80,
              height: 80,
              rotation: 0,
              seats: 10,
              seatingUse: "adult"
            }
          ]
        }
      ]);

    const response = await GET(new Request("http://localhost/api/events"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.events[0].diningManagerNotes).toBe(
      "VIP table beside stage."
    );
    expect(body.events[0].diningHallMapPreset).toMatchObject({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      name: "Wedding Layout",
      objects: [
        expect.objectContaining({
          id: "table-1",
          name: "VIP Table"
        })
      ]
    });
    expect(prisma.activityLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId,
          eventId: { in: [eventId] }
        }
      })
    );
  });
});
