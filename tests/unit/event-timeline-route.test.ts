import { beforeEach, describe, expect, it, vi } from "vitest";
import { authzContext } from "@/tests/unit/authz-test-helpers";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
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
vi.mock("@/lib/authz/authorize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authz/authorize")>()),
  authorize: mocks.authorize
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
    mocks.authorize.mockResolvedValue(authzContext({
      userId: actorId,
      organizationId
    }));
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

  it("saves a cue row that waits on a course instead of a clock", async () => {
    const cueTimeline = [
      ...timeline,
      {
        id: "timeline-2",
        // Blank, because the cue is what places this row.
        time: "",
        cue: "After the soup is served",
        text: "Waiters bring in the beer",
        type: "Kitchen"
      }
    ];
    const request = new Request(`http://localhost/api/events/${eventId}`, {
      method: "PATCH",
      body: JSON.stringify({
        timeline: cueTimeline,
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
          workspaceData: expect.objectContaining({ timeline: cueTimeline })
        })
      })
    );
  });

  // An empty cue still marks the row as cue-driven, so it has to survive the
  // save rather than being dropped and read back as a midnight time row.
  it("keeps a cue that has not been filled in yet", async () => {
    const request = new Request(`http://localhost/api/events/${eventId}`, {
      method: "PATCH",
      body: JSON.stringify({
        timeline: [
          {
            id: "timeline-2",
            time: "",
            cue: "",
            text: "Waiters bring in the beer",
            type: "Kitchen"
          }
        ],
        timelineConfirmed: false
      })
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ eventId })
    });

    expect(response.status).toBe(200);

    const [[call]] = mocks.prisma.event.update.mock.calls;

    expect(call.data.workspaceData.timeline[0]).toHaveProperty("cue", "");
  });

  // Confirming is what publishes the sheet to staff and ticks "Timeline ready",
  // so it needs rows to publish. The card disables its own button, but the
  // route is what makes it true for a request that skips the card.
  it("refuses to confirm a timeline with no rows", async () => {
    const request = new Request(`http://localhost/api/events/${eventId}`, {
      method: "PATCH",
      body: JSON.stringify({
        timeline: [],
        timelineConfirmed: true
      })
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ eventId })
    });

    expect(response.status).toBe(400);
    expect(mocks.prisma.event.update).not.toHaveBeenCalled();
  });

  // Confirming can arrive without rows beside it, and the stored sheet is then
  // the one being confirmed - an event that never had one still has nothing.
  it("refuses to confirm when the stored timeline is empty", async () => {
    const request = new Request(`http://localhost/api/events/${eventId}`, {
      method: "PATCH",
      body: JSON.stringify({ timelineConfirmed: true })
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ eventId })
    });

    expect(response.status).toBe(400);
    expect(mocks.prisma.event.update).not.toHaveBeenCalled();
  });

  it("confirms a stored timeline when no rows are sent with it", async () => {
    mocks.prisma.event.findFirst.mockResolvedValue({
      workspaceData: { menuConfirmed: true, timeline }
    });

    const request = new Request(`http://localhost/api/events/${eventId}`, {
      method: "PATCH",
      body: JSON.stringify({ timelineConfirmed: true })
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
