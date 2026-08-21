import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  prisma: {
    event: {
      findFirst: vi.fn(),
      update: vi.fn()
    },
    activityLog: {
      create: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server-auth", () => ({
  requirePermission: mocks.requirePermission
}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

import { PATCH } from "@/app/api/events/[eventId]/route";

describe("event timeline route", () => {
  const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const eventId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const actorId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const timeline = [
    {
      id: "timeline-1",
      time: "03:00 PM",
      text: "Dining room setup begins",
      type: "Event"
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({
      id: actorId,
      organizationId
    });
    mocks.prisma.event.findFirst.mockResolvedValue({
      workspaceData: {
        menuConfirmed: true
      }
    });
    mocks.prisma.event.update.mockResolvedValue({ id: eventId });
    // The update runs inside an interactive transaction, so the callback gets
    // the same doubles these tests already assert on.
    mocks.prisma.$transaction.mockImplementation((callback) =>
      callback({
        event: { update: mocks.prisma.event.update },
        activityLog: { create: mocks.prisma.activityLog.create }
      })
    );
  });

  it("saves timeline rows without confirming the timeline", async () => {
    const request = new Request(`http://localhost/api/events/${eventId}`, {
      method: "PATCH",
      body: JSON.stringify({
        timeline,
        timelineConfirmed: false
      })
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ eventId })
    });

    expect(response.status).toBe(200);
    expect(mocks.prisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceData: {
            menuConfirmed: true,
            timeline,
            timelineConfirmed: false
          },
          updatedById: actorId,
          version: { increment: 1 }
        })
      })
    );
  });

  it("confirms timeline rows and preserves existing workspace data", async () => {
    const request = new Request(`http://localhost/api/events/${eventId}`, {
      method: "PATCH",
      body: JSON.stringify({
        timeline,
        timelineConfirmed: true
      })
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ eventId })
    });

    expect(response.status).toBe(200);
    expect(mocks.prisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceData: {
            menuConfirmed: true,
            timeline,
            timelineConfirmed: true
          }
        })
      })
    );
  });

  it("updates event details without removing existing workspace data", async () => {
    const request = new Request(`http://localhost/api/events/${eventId}`, {
      method: "PATCH",
      body: JSON.stringify({
        clientName: "Updated Client",
        eventType: "Bar Mitzvah",
        eventStatus: "Confirmed",
        eventDate: "2026-09-01",
        startsAt: "2026-09-01T18:30:00.000Z",
        couplesCount: 12,
        kidsCount: 8,
        menCount: 16,
        ladiesCount: 0,
        boysCount: 0,
        girlsCount: 0,
        notes: "Updated internal event note."
      })
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ eventId })
    });

    expect(response.status).toBe(200);
    expect(mocks.prisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientName: "Updated Client",
          eventType: "Bar Mitzvah",
          eventStatus: "Confirmed",
          eventDate: new Date("2026-09-01"),
          startsAt: new Date("2026-09-01T18:30:00.000Z"),
          couplesCount: 12,
          kidsCount: 8,
          menCount: 16,
          ladiesCount: 0,
          boysCount: 0,
          girlsCount: 0,
          notes: "Updated internal event note.",
          updatedById: actorId,
          version: { increment: 1 }
        })
      })
    );
  });

  it("accepts clearing the optional event type", async () => {
    const request = new Request(`http://localhost/api/events/${eventId}`, {
      method: "PATCH",
      body: JSON.stringify({
        clientName: "Updated Client",
        eventType: "",
        eventStatus: "Confirmed",
        eventDate: "2026-09-01"
      })
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ eventId })
    });

    expect(response.status).toBe(200);
    expect(mocks.prisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: null
        })
      })
    );
  });
});
