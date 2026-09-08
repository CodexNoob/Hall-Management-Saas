import { beforeEach, describe, expect, it, vi } from "vitest";
import { authzContext } from "@/tests/unit/authz-test-helpers";

const mocks = vi.hoisted(() => ({
  prisma: {
    event: {
      findFirst: vi.fn(),
      update: vi.fn()
    },
    menuItem: {
      count: vi.fn()
    },
    organizationMembership: {
      findFirst: vi.fn()
    },
    activityLog: {
      create: vi.fn()
    },
    $transaction: vi.fn()
  },
  authorize: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
// The real AuthorizationError and BookingError classes are needed:
// createApiErrorResponse checks both with `instanceof`.
vi.mock("@/lib/authz/authorize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authz/authorize")>()),
  authorize: mocks.authorize
}));

import { PATCH } from "@/app/api/events/[eventId]/route";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const eventId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const coordinatorMembershipId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

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
    waitersCount: 0,
    clientId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    clientName: "Charles Duot",
    hall: { name: "Grand Ballroom", capacity: 100 },
    ...overrides
  };
}

/**
 * The entries written for one request, by action.
 *
 * A save can now write more than one: head counts get their own key so the
 * Activity screen can filter for them, the timeline gets another because it
 * lives in `workspaceData` where a column diff cannot see it, and everything
 * else lands in one `event.updated`. Selecting by action rather than by call
 * index is what keeps each assertion about the entry it means.
 */
function loggedEntries(action: string) {
  return mocks.prisma.activityLog.create.mock.calls
    .map((call) => call[0].data)
    .filter((data: { actionType: string }) => data.actionType === action);
}

/** The single entry for one action, or a failure naming the count. */
function loggedEntry(action = "event.guest_counts.updated") {
  const entries = loggedEntries(action);
  expect(entries).toHaveLength(1);
  return entries[0];
}

describe("PATCH /api/events/[eventId] guest counts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue(authzContext({
      userId: "user-1",
      actorName: "Sarah Klein",
      organizationId
    }));
    mocks.prisma.event.findFirst.mockResolvedValue(storedEvent());
    mocks.prisma.event.update.mockResolvedValue({ id: eventId });
    mocks.prisma.menuItem.count.mockResolvedValue(0);
    mocks.prisma.organizationMembership.findFirst.mockResolvedValue({
      id: coordinatorMembershipId
    });
    // Interactive transactions run the callback against the same doubles, so
    // asserting on `event.update` covers the transactional path too.
    mocks.prisma.$transaction.mockImplementation((callback) =>
      callback({
        event: { update: mocks.prisma.event.update },
        activityLog: { create: mocks.prisma.activityLog.create }
      })
    );
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
      (
        await patch({
          // A row, not an empty sheet: confirming an empty timeline is refused
          // on its own merits, which would say nothing about capacity.
          timeline: [
            { id: "row-1", time: "18:00", text: "Chuppah", type: "Event" }
          ],
          timelineConfirmed: true
        })
      ).status
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

  describe("activity log", () => {
    it("records who moved a count, and both values", async () => {
      const response = await patch({ couplesCount: 25 });

      expect(response.status).toBe(200);
      expect(loggedEntry()).toMatchObject({
        organizationId,
        eventId,
        userId: "user-1",
        userName: "Sarah Klein",
        actionType: "event.guest_counts.updated",
        message: "Changed guest counts for Charles Duot: couples 10 to 25.",
        oldValue: { couplesCount: 10 },
        newValue: { couplesCount: 25 }
      });
    });

    it("writes one entry naming every count that moved", async () => {
      await patch({ couplesCount: 25, kidsCount: 4, menCount: 3 });

      const entry = loggedEntry();

      expect(entry.message).toBe(
        "Changed guest counts for Charles Duot: couples 10 to 25, men 0 to 3, kids 0 to 4."
      );
      expect(entry.oldValue).toEqual({
        couplesCount: 10,
        menCount: 0,
        kidsCount: 0
      });
      expect(entry.newValue).toEqual({
        couplesCount: 25,
        menCount: 3,
        kidsCount: 4
      });
    });

    it("carries the client so the entry reaches the Clients page", async () => {
      await patch({ kidsCount: 6 });

      expect(loggedEntry().clientId).toBe(
        "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
      );
    });

    it("logs waiters, which the capacity check ignores", async () => {
      // Waiters are staff rather than attendees, so they are outside the
      // capacity check - but the kitchen sheet reads them like every other
      // count, so moving them moves production quantities.
      await patch({ waitersCount: 4 });

      expect(loggedEntry().message).toBe(
        "Changed guest counts for Charles Duot: waiters 0 to 4."
      );
    });

    it("stays quiet when the counts are resent unchanged", async () => {
      // The details panel submits every count on every save, so a note-only
      // edit arrives carrying all six. Logging on "was it supplied" would
      // record a change that never happened.
      const response = await patch({
        couplesCount: 10,
        menCount: 0,
        ladiesCount: 0,
        boysCount: 0,
        girlsCount: 0,
        kidsCount: 0,
        notes: "Call the florist."
      });

      expect(response.status).toBe(200);
      expect(mocks.prisma.event.update).toHaveBeenCalled();
      expect(loggedEntries("event.guest_counts.updated")).toEqual([]);
      // The notes DID move, so the general entry fires - and names only the
      // field, never its text.
      expect(loggedEntry("event.updated")).toMatchObject({
        message: "Edited Charles Duot's event: notes.",
        newValue: { fields: ["notes"] }
      });
    });

    it("stays quiet for a save that touches no count at all", async () => {
      await patch({ clientName: "Jane Doe" });

      expect(loggedEntries("event.guest_counts.updated")).toEqual([]);
      expect(loggedEntry("event.updated").newValue).toEqual({
        fields: ["clientName"]
      });
    });

    it("records nothing at all for a save that changes nothing", async () => {
      // Both halves of the same rule: the panel posts every field on every
      // save, and neither entry may fire on a request that moved nothing.
      await patch({ clientName: "Charles Duot", couplesCount: 10 });

      expect(mocks.prisma.activityLog.create).not.toHaveBeenCalled();
    });

    it("names a changed phone or email without recording the value", async () => {
      // Both are personal data and `activity_logs` carries no redaction, so the
      // entry says WHICH field moved and stops there.
      await patch({ email: "client@example.com" });

      const entry = loggedEntry("event.updated");

      expect(entry.newValue).toEqual({ fields: ["email"] });
      expect(JSON.stringify(entry)).not.toContain("client@example.com");
    });

    it("writes nothing when the update itself fails", async () => {
      // The point of the shared transaction: a count must not move with
      // nothing saying so, and a log must not claim a move that rolled back.
      mocks.prisma.event.update.mockRejectedValue(new Error("write conflict"));

      const response = await patch({ couplesCount: 25 });

      expect(response.status).toBe(500);
      expect(mocks.prisma.activityLog.create).not.toHaveBeenCalled();
    });
  });

  describe("client contact", () => {
    it("stores an email, and clears one that was entered by mistake", async () => {
      await patch({ email: "client@example.com" });

      expect(mocks.prisma.event.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: "client@example.com" })
        })
      );

      vi.clearAllMocks();
      mocks.prisma.event.findFirst.mockResolvedValue(storedEvent());
      mocks.prisma.$transaction.mockImplementation((callback) =>
        callback({
          event: { update: mocks.prisma.event.update },
          activityLog: { create: mocks.prisma.activityLog.create }
        })
      );

      await patch({ email: null });

      expect(mocks.prisma.event.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: null })
        })
      );
    });

    it("refuses an address that is not one, rather than storing it", async () => {
      const response = await patch({ email: "not-an-address" });

      expect(response.status).toBe(400);
      expect(mocks.prisma.event.update).not.toHaveBeenCalled();
    });

    it("assigns a coordinator from this organization", async () => {
      await patch({ coordinatorMembershipId });

      expect(
        mocks.prisma.organizationMembership.findFirst
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId, isActive: true })
        })
      );
      expect(mocks.prisma.event.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ coordinatorMembershipId })
        })
      );
    });

    it("refuses a coordinator from another organization", async () => {
      // The tenant check is the whole point: without it an event could name
      // somebody in another organization, whose name the coordinator join
      // would then read back out on every load of this event.
      mocks.prisma.organizationMembership.findFirst.mockResolvedValue(null);

      const response = await patch({
        coordinatorMembershipId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
      });

      expect(response.status).toBe(404);
      expect(mocks.prisma.event.update).not.toHaveBeenCalled();
    });

    it("hands the event back to nobody without checking anybody", async () => {
      await patch({ coordinatorMembershipId: null });

      expect(
        mocks.prisma.organizationMembership.findFirst
      ).not.toHaveBeenCalled();
      expect(mocks.prisma.event.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ coordinatorMembershipId: null })
        })
      );
    });
  });
});
