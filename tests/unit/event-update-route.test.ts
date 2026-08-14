import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    event: {
      findFirst: vi.fn(),
      update: vi.fn()
    },
    menuItem: {
      count: vi.fn()
    }
  },
  requirePermission: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
// The real AuthorizationError and BookingError classes are needed:
// createApiErrorResponse checks both with `instanceof`.
vi.mock("@/lib/auth/server-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/server-auth")>()),
  requirePermission: mocks.requirePermission
}));

import { PATCH } from "@/app/api/events/[eventId]/route";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const eventId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function patch(body: Record<string, unknown>) {
  return PATCH(
    new Request(`http://localhost/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }),
    { params: Promise.resolve({ eventId }) }
  );
}

function storedEvent(overrides: Record<string, unknown> = {}) {
  return {
    workspaceData: {},
    couplesCount: 10,
    menCount: 0,
    ladiesCount: 0,
    boysCount: 0,
    girlsCount: 0,
    kidsCount: 0,
    hall: { name: "Grand Ballroom", capacity: 100 },
    ...overrides
  };
}

describe("PATCH /api/events/[eventId] guest counts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ id: "user-1", organizationId });
    mocks.prisma.event.findFirst.mockResolvedValue(storedEvent());
    mocks.prisma.event.update.mockResolvedValue({ id: eventId });
    mocks.prisma.menuItem.count.mockResolvedValue(0);
  });

  it("rejects a count larger than the 32-bit column instead of 500ing", async () => {
    // Previously `.min(0)` with no `.max()`: the value passed Zod and then blew
    // up at the Postgres driver as an unhandled 500.
    const response = await patch({ couplesCount: 99_999_999_999 });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Couples");
    expect(mocks.prisma.event.update).not.toHaveBeenCalled();
  });

  it("rejects fractional and negative counts", async () => {
    expect((await patch({ kidsCount: 2.5 })).status).toBe(400);
    expect((await patch({ menCount: -1 })).status).toBe(400);
    expect(mocks.prisma.event.update).not.toHaveBeenCalled();
  });

  it("re-runs the hall capacity check the create path enforces", async () => {
    // 60 couples is 120 attendees against a 100-seat hall.
    const response = await patch({ couplesCount: 60 });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("CAPACITY_EXCEEDED");
    expect(body.error).toContain("Grand Ballroom");
    expect(mocks.prisma.event.update).not.toHaveBeenCalled();
  });

  it("counts a couple as two attendees and merges over the stored counts", async () => {
    // 40 couples = 80, plus the 20 kids already stored = exactly 100.
    mocks.prisma.event.findFirst.mockResolvedValue(
      storedEvent({ kidsCount: 20 })
    );

    const response = await patch({ couplesCount: 40 });

    expect(response.status).toBe(200);
    expect(mocks.prisma.event.update).toHaveBeenCalled();
  });

  it("allows an update that stays within capacity", async () => {
    const response = await patch({ couplesCount: 25, kidsCount: 10 });

    expect(response.status).toBe(200);
    expect(mocks.prisma.event.update.mock.calls[0][0].data).toMatchObject({
      couplesCount: 25,
      kidsCount: 10
    });
  });

  it("lets unrelated saves through on an already-over-capacity event", async () => {
    // A hall's capacity can be lowered after an event is booked, and events
    // booked while it was null were never checked - so an event can sit over
    // capacity through no fault of the current request. Gating every PATCH on
    // that would block the timeline and menu saves, which send no counts at
    // all, and leave no way to recover.
    mocks.prisma.event.findFirst.mockResolvedValue(
      storedEvent({ couplesCount: 100 })
    );

    expect(
      (await patch({ timeline: [], timelineConfirmed: true })).status
    ).toBe(200);
    expect((await patch({ menuConfirmed: true })).status).toBe(200);
    expect((await patch({ notes: "Call the florist." })).status).toBe(200);
    expect((await patch({ clientName: "Jane Doe" })).status).toBe(200);
  });

  it("still blocks a count change on an already-over-capacity event", async () => {
    mocks.prisma.event.findFirst.mockResolvedValue(
      storedEvent({ couplesCount: 100 })
    );

    const response = await patch({ kidsCount: 1 });

    expect(response.status).toBe(409);
    expect(mocks.prisma.event.update).not.toHaveBeenCalled();
  });

  it("skips the capacity check when the hall has no limit set", async () => {
    mocks.prisma.event.findFirst.mockResolvedValue(
      storedEvent({ hall: { name: "Flexible Room", capacity: null } })
    );

    expect((await patch({ couplesCount: 5000 })).status).toBe(200);
  });

  it("saves menu selections that belong to the organization", async () => {
    const menuItemId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    mocks.prisma.menuItem.count.mockResolvedValue(1);

    const response = await patch({
      menuItemIds: [menuItemId, menuItemId],
      menuConfirmed: true
    });

    expect(response.status).toBe(200);
    expect(mocks.prisma.event.update.mock.calls[0][0].data).toMatchObject({
      menuItemIds: [menuItemId]
    });
  });

  it("rejects menu selections from outside the organization", async () => {
    const response = await patch({
      menuItemIds: ["cccccccc-cccc-4ccc-8ccc-cccccccccccc"]
    });

    expect(response.status).toBe(400);
    expect(mocks.prisma.event.update).not.toHaveBeenCalled();
  });
});
