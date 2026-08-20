import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server-auth", () => ({
  AuthorizationError: class AuthorizationError extends Error {
    status = 403;
  },
  assertHallAccess: vi.fn(),
  requireAnyPermission: vi.fn(),
  requirePermission: vi.fn()
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    eventMenu: { findMany: vi.fn() },
    // The menus a kitchen event can be raised against.
    eventPackage: { findMany: vi.fn() },
    // findMany twice, plus the writes: the board now reconciles Kitchen Staff
    // into the worker list on read.
    kitchenWorker: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      updateMany: vi.fn()
    },
    organizationMembership: { findMany: vi.fn() },
    menuItem: { findMany: vi.fn(), findFirst: vi.fn() },
    kitchenItemStatus: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn()
    }
  }
}));

import { GET, PATCH } from "@/app/api/kitchen/route";
import {
  assertHallAccess,
  requireAnyPermission,
  requirePermission
} from "@/lib/auth/server-auth";
import { prisma } from "@/lib/prisma";

/**
 * The kitchen board is a list of work the hall is committed to.
 *
 * These tests exist because it used to be a list of every event on the date:
 * inquiries the client had not accepted, holds that had expired and bookings
 * that were cancelled all sat in today's production list beside real work.
 *
 * The second thing they guard is newer: the board's numbers now come from
 * `EventMenuLine` through the shared sheet builder, not from the `menu_item_ids`
 * mirror, and not from string-matching dish names in the browser.
 */

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const eventId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const hallId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const menuItemId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const otherMenuItemId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const workerId = "ffffffff-ffff-4fff-8fff-ffffffffffff";

const actor = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Test Actor",
  organizationId,
  membership: { role: "OWNER" },
  access: null
};

function request(body?: unknown) {
  return new Request("http://localhost/api/kitchen", {
    method: body === undefined ? "GET" : "PATCH",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

/** The `where` the event query actually ran with. */
function eventQueryFilter() {
  return vi.mocked(prisma.event.findMany).mock.calls[0]?.[0]?.where;
}

/** 40 couples + 50 men + 45 ladies + 6 boys + 4 girls + 2 kids = 187 guests. */
function boardEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: eventId,
    hallId,
    clientName: "Gold",
    eventDate: new Date("2026-08-20T00:00:00.000Z"),
    eventType: "Wedding",
    eventStatus: "Confirmed",
    startsAt: new Date("2026-08-20T22:30:00.000Z"),
    packageName: "Package 1",
    hall: { name: "Main Hall" },
    couplesCount: 40,
    menCount: 50,
    ladiesCount: 45,
    boysCount: 6,
    girlsCount: 4,
    kidsCount: 2,
    waitersCount: 8,
    diningPlan: null,
    ...overrides
  };
}

function dishLine(overrides: Record<string, unknown> = {}) {
  return {
    id: "line-1",
    menuItemId,
    addOnId: null,
    itemName: null,
    serviceStyle: "Buffet",
    notes: null,
    sortOrder: 0,
    menuItem: {
      name: "Potato kugel",
      isActive: true,
      picturePath: null,
      services: [
        {
          serviceStyle: "Buffet",
          // A Decimal, not a number: the column is Decimal(10,3), so this is
          // what Prisma actually hands the builder.
          quantity: new Prisma.Decimal("1"),
          unit: "tray",
          per: 30,
          perBasis: "TotalGuests",
          rounding: "Up",
          minimumUnits: null
        }
      ]
    },
    addOn: null,
    ...overrides
  };
}

async function readBoard(response: Response) {
  return (await response.json()) as {
    events: Array<Record<string, unknown>>;
    workers: unknown;
    menus: Array<{ id: string; name: string; dishCount: number }>;
    permissions: Record<string, boolean>;
  };
}

describe("kitchen dashboard route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePermission).mockResolvedValue(actor as never);
    vi.mocked(requireAnyPermission).mockResolvedValue(actor as never);
    vi.mocked(prisma.event.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.eventMenu.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.kitchenItemStatus.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.kitchenWorker.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.kitchenWorker.createMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.kitchenWorker.updateMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.organizationMembership.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.eventPackage.findMany).mockResolvedValue([
    { id: "package-1", name: "Shabbos Lunch", includedMenuItemIds: ["a", "b"] }
  ] as never);
    vi.mocked(prisma.menuItem.findMany).mockResolvedValue([] as never);
  });

  it("asks only for confirmed bookings", async () => {
    await GET(request());

    expect(eventQueryFilter()).toMatchObject({
      organizationId,
      deleted: false,
      bookingStatus: "CONFIRMED"
    });
  });

  it("filters on the lifecycle column, not the free-text label", async () => {
    // `eventStatus` is rewritten to "Confirmed" or "Hold" by every details
    // save, so a cancelled event carries the label "Hold" and would come back
    // onto the board if the board trusted it.
    await GET(request());

    const filter = eventQueryFilter() as Record<string, unknown>;

    expect(filter).not.toHaveProperty("eventStatus");
  });

  it("still scopes to the organization and the date window", async () => {
    await GET(request());

    const filter = eventQueryFilter() as {
      organizationId: string;
      eventDate: { gte: Date; lt: Date };
    };

    expect(filter.organizationId).toBe(organizationId);
    expect(filter.eventDate.lt.getTime() - filter.eventDate.gte.getTime()).toBe(
      28 * 24 * 60 * 60 * 1000
    );
  });

  describe("hall scoping", () => {
    it("restricts a hall-limited member to their halls", async () => {
      vi.mocked(requirePermission).mockResolvedValue({
        ...actor,
        membership: { role: "MEMBER" },
        access: { allowedHallIds: [hallId] }
      } as never);

      await GET(request());

      expect(eventQueryFilter()).toMatchObject({ hallId: { in: [hallId] } });
    });

    it("leaves an unrestricted member seeing every hall", async () => {
      // An empty list means "not hall-restricted", so it must not become
      // `hallId: { in: [] }` - which would match nothing at all.
      vi.mocked(requirePermission).mockResolvedValue({
        ...actor,
        membership: { role: "MEMBER" },
        access: { allowedHallIds: [] }
      } as never);

      await GET(request());

      expect(eventQueryFilter()).not.toHaveProperty("hallId");
    });
  });

  describe("production numbers", () => {
    beforeEach(() => {
      vi.mocked(prisma.event.findMany).mockResolvedValue([
        boardEvent()
      ] as never);
    });

    it("counts guests server-side, leaving waiters out", async () => {
      const board = await readBoard(await GET(request()));

      // 40*2 + 50 + 45 + 6 + 4 + 2 = 187. The 8 waiters eat, but counting them
      // into a per-guest tray over-caters every staffed event.
      expect(board.events[0].counts).toMatchObject({ totalGuests: 187 });
    });

    it("summarises progress from the event's real menu lines", async () => {
      vi.mocked(prisma.eventMenu.findMany).mockResolvedValue([
        {
          eventId,
          meal: "Main",
          status: "Confirmed",
          confirmedAt: null,
          version: 2,
          lines: [
            dishLine(),
            // No style and no rule: nothing to cook to, so it needs someone to
            // go and say rather than being cooked as zero.
            dishLine({
              id: "line-2",
              menuItemId: otherMenuItemId,
              serviceStyle: null,
              menuItem: {
                name: "Israeli salad",
                isActive: true,
                picturePath: null,
                services: []
              }
            })
          ]
        }
      ] as never);
      vi.mocked(prisma.kitchenItemStatus.findMany).mockResolvedValue([
        {
          eventId,
          menuItemId,
          status: "COMPLETE",
          assignedWorker: { name: "Mendy" }
        }
      ] as never);

      const board = await readBoard(await GET(request()));

      expect(board.events[0].summary).toMatchObject({
        dishes: 2,
        complete: 1,
        pending: 0,
        notStarted: 1,
        needsAttention: 1
      });
      expect(board.events[0].menuStatus).toBe("Confirmed");
    });

    it("reads Main, and does not send dish lists or picture paths", async () => {
      const board = await readBoard(await GET(request()));

      expect(
        vi.mocked(prisma.eventMenu.findMany).mock.calls[0]?.[0]?.where
      ).toMatchObject({ meal: "Main", organizationId });
      // The card draws a ratio; the dialog fetches the dishes from the
      // per-event route, which is the one that signs their pictures.
      expect(board.events[0]).not.toHaveProperty("lines");
      expect(JSON.stringify(board)).not.toContain("picturePath");
    });

    it("batches the menu and status reads across the whole window", async () => {
      vi.mocked(prisma.event.findMany).mockResolvedValue([
        boardEvent(),
        boardEvent({ id: otherMenuItemId })
      ] as never);

      await GET(request());

      // Two queries for the window, not two per event: the board spans four
      // weeks, so per-event reads would be up to a hundred round-trips.
      expect(prisma.eventMenu.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.kitchenItemStatus.findMany).toHaveBeenCalledTimes(1);
    });

    it("no longer offers the menu library to the board", async () => {
      // It existed to fill the replacement dropdown, which is gone along with
      // the board's menu edits.
      const board = await readBoard(await GET(request()));

      expect(board).not.toHaveProperty("menuItems");
      expect(board.permissions).not.toHaveProperty("canEditMenu");
    });

    it("does offer the menu list a kitchen event is raised against", async () => {
      // Not a reversal of the assertion above: `menuItems` was the dish
      // library behind the removed replace-a-dish dropdown. This is the list
      // of menus, which is the one thing a kitchen event needs - it exists to
      // cook one, and a typed name would not tell the kitchen what to make.
      const board = await readBoard(await GET(request()));

      expect(board.menus).toEqual([
        { id: "package-1", name: "Shabbos Lunch", dishCount: 2 }
      ]);
      expect(prisma.eventPackage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true })
        })
      );
    });
  });

  describe("writes", () => {
    it("refuses a status write against a booking that is no longer confirmed", async () => {
      // The event is gone from the board, but a tab left open still has its id.
      vi.mocked(prisma.event.findFirst).mockResolvedValue(null as never);
      vi.mocked(prisma.menuItem.findFirst).mockResolvedValue({
        id: menuItemId,
        name: "Potato kugel"
      } as never);

      const response = await PATCH(
        request({ action: "status", eventId, menuItemId, status: "COMPLETE" })
      );

      expect(response.status).toBe(404);
      expect(
        vi.mocked(prisma.event.findFirst).mock.calls[0]?.[0]?.where
      ).toMatchObject({ bookingStatus: "CONFIRMED" });
      expect(prisma.kitchenItemStatus.upsert).not.toHaveBeenCalled();
    });

    it("records the status when the booking is confirmed", async () => {
      vi.mocked(prisma.event.findFirst).mockResolvedValue({
        id: eventId,
        hallId
      } as never);
      vi.mocked(prisma.menuItem.findFirst).mockResolvedValue({
        id: menuItemId,
        name: "Potato kugel"
      } as never);
      vi.mocked(prisma.kitchenItemStatus.upsert).mockResolvedValue({
        status: "COMPLETE"
      } as never);

      const response = await PATCH(
        request({ action: "status", eventId, menuItemId, status: "COMPLETE" })
      );

      expect(response.status).toBe(200);
      expect(prisma.kitchenItemStatus.upsert).toHaveBeenCalledTimes(1);
    });

    describe("assigning a worker", () => {
      beforeEach(() => {
        vi.mocked(prisma.event.findFirst).mockResolvedValue({
          id: eventId,
          hallId
        } as never);
        vi.mocked(prisma.menuItem.findFirst).mockResolvedValue({
          id: menuItemId,
          name: "Potato kugel"
        } as never);
        vi.mocked(prisma.kitchenItemStatus.findUnique).mockResolvedValue(
          null as never
        );
        vi.mocked(prisma.kitchenItemStatus.upsert).mockResolvedValue(
          {} as never
        );
      });

      it("never demotes a dish that is already complete", async () => {
        // The bug this replaces: `update` wrote "PENDING" for every action that
        // was not a status write, so putting a name against a finished dish
        // marked it unfinished.
        vi.mocked(prisma.kitchenItemStatus.findUnique).mockResolvedValue({
          id: "status-1",
          status: "COMPLETE"
        } as never);

        await PATCH(
          request({
            action: "assign-worker",
            eventId,
            menuItemId,
            assignedWorkerId: workerId
          })
        );

        const call = vi.mocked(prisma.kitchenItemStatus.upsert).mock
          .calls[0]?.[0];

        expect(call?.update).not.toHaveProperty("status");
        expect(call?.update).toMatchObject({ assignedWorkerId: workerId });
      });

      it("leaves an untouched dish not started", async () => {
        // "from nothing to pending to complete" is the card's cycle, and
        // assigning someone must not spend its first step for them.
        await PATCH(
          request({
            action: "assign-worker",
            eventId,
            menuItemId,
            assignedWorkerId: workerId
          })
        );

        expect(
          vi.mocked(prisma.kitchenItemStatus.upsert).mock.calls[0]?.[0]?.create
        ).toMatchObject({ status: null, assignedWorkerId: workerId });
      });

      it("removes a row that unassigning leaves saying nothing", async () => {
        vi.mocked(prisma.kitchenItemStatus.findUnique).mockResolvedValue({
          id: "status-1",
          status: null
        } as never);

        const response = await PATCH(
          request({
            action: "assign-worker",
            eventId,
            menuItemId,
            assignedWorkerId: null
          })
        );

        expect(response.status).toBe(200);
        expect(prisma.kitchenItemStatus.delete).toHaveBeenCalledWith({
          where: { id: "status-1" }
        });
        expect(prisma.kitchenItemStatus.upsert).not.toHaveBeenCalled();
      });

      it("keeps a row whose status still means something", async () => {
        vi.mocked(prisma.kitchenItemStatus.findUnique).mockResolvedValue({
          id: "status-1",
          status: "PENDING"
        } as never);

        await PATCH(
          request({
            action: "assign-worker",
            eventId,
            menuItemId,
            assignedWorkerId: null
          })
        );

        expect(prisma.kitchenItemStatus.delete).not.toHaveBeenCalled();
        expect(
          vi.mocked(prisma.kitchenItemStatus.upsert).mock.calls[0]?.[0]?.update
        ).toMatchObject({ assignedWorkerId: null });
      });
    });

    it("checks hall access before writing progress", async () => {
      // Scoping the GET alone would be half the fix: an event id is all it
      // takes to write against a hall this member cannot see.
      vi.mocked(prisma.event.findFirst).mockResolvedValue({
        id: eventId,
        hallId
      } as never);
      vi.mocked(prisma.menuItem.findFirst).mockResolvedValue({
        id: menuItemId,
        name: "Potato kugel"
      } as never);
      vi.mocked(prisma.kitchenItemStatus.upsert).mockResolvedValue({} as never);

      await PATCH(
        request({ action: "status", eventId, menuItemId, status: "COMPLETE" })
      );

      expect(assertHallAccess).toHaveBeenCalledWith(expect.anything(), hallId);
    });

    for (const action of ["replace-menu-item", "remove-menu-item"]) {
      it(`refuses "${action}", which only ever wrote the mirror`, async () => {
        // These wrote `Event.menuItemIds` and nothing else, so a dish swapped
        // here changed what the board showed and nothing the kitchen cooks.
        const response = await PATCH(
          request({
            action,
            eventId,
            menuItemId,
            replacementMenuItemId: otherMenuItemId
          })
        );

        expect(response.status).toBe(400);
        expect(prisma.event.update).not.toHaveBeenCalled();
      });
    }
  });
});
