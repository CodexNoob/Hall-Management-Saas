import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz/authorize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authz/authorize")>()),
  assertInScope: vi.fn(),
  authorize: vi.fn(),
  // The board asks three further questions of the resolver after the door
  // check. Those live in their own suites; here they are dialled per test.
  hasPermission: vi.fn()
}));
// The swap itself is tested against its own module; here the question is only
// whether the route reaches it and what it answers with.
vi.mock("@/features/kitchen/server/kitchen-dish-replacement", () => ({
  replaceKitchenDish: vi.fn()
}));
// Reconciling Kitchen Staff into the worker list is its own module with its own
// suite. The board only has to reach it and render what it answers.
vi.mock("@/features/kitchen/server/kitchen-staff-workers", () => ({
  loadKitchenStaffWorkers: vi.fn()
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
      // The caller's own roster row, which is what scopes a cook to their own
      // dishes. Null in these cases unless one says otherwise.
      findFirst: vi.fn(),
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
    },
    // Production with no booking behind it, and its own progress rows. These
    // are read in the same `Promise.all` as the booking-backed ones, so
    // leaving them off the mock did not fail where they are used - it left
    // every later slot of the destructured array undefined and took the whole
    // board's numbers down with it.
    kitchenStandaloneEvent: { findMany: vi.fn(), findFirst: vi.fn() },
    kitchenStandaloneItemStatus: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn()
    },
    kitchenNotification: {
      findMany: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

import { GET, PATCH } from "@/app/api/kitchen/route";
import { replaceKitchenDish } from "@/features/kitchen/server/kitchen-dish-replacement";
import { loadKitchenStaffWorkers } from "@/features/kitchen/server/kitchen-staff-workers";
import { assertInScope, authorize, hasPermission } from "@/lib/authz/authorize";
import { prisma } from "@/lib/prisma";
import { authzContext, hallScopedContext } from "./authz-test-helpers";

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

const actor = authzContext({
  organizationId,
  userId: "22222222-2222-4222-8222-222222222222",
  actorName: "Test Actor"
});

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

/**
 * The board makes two `eventMenu.findMany` calls and they want different
 * answers: the `Main` menu it draws, and the meals it cannot draw.
 *
 * Discriminated on the `where` - `meal: "Main"` against `meal: { not: "Main" }`
 * - rather than on call order, so a test setting one up does not silently
 * answer the other, which is exactly how a spurious "meals not shown" would get
 * into a test about something else.
 */
function mockMenus({
  main = [],
  other = []
}: {
  main?: Array<Record<string, unknown>>;
  other?: Array<Record<string, unknown>>;
} = {}) {
  vi.mocked(prisma.eventMenu.findMany).mockImplementation((({
    where
  }: {
    where: { meal?: unknown };
  }) =>
    Promise.resolve(typeof where.meal === "object" ? other : main)) as never);
}

async function readBoard(response: Response) {
  return (await response.json()) as {
    events: Array<Record<string, unknown>>;
    workers: unknown;
    currentWorkerId: string | null;
    menus: Array<{ id: string; name: string; dishCount: number }>;
    menuItems: Array<{
      id: string;
      name: string;
      category: string | null;
      kind: string;
    }>;
    permissions: Record<string, boolean>;
  };
}

describe("kitchen dashboard route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authorize).mockResolvedValue(actor);
    vi.mocked(hasPermission).mockResolvedValue(true);
    // Including `kitchen.read.all` by way of the line above: these cases are
    // about what the board computes, not who may see it, so the caller is
    // unscoped unless a case dials `hasPermission` down. The scoping rules have
    // their own suite in kitchen-visibility.test.ts.
    vi.mocked(prisma.kitchenWorker.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.event.findMany).mockResolvedValue([] as never);
    mockMenus();
    vi.mocked(prisma.kitchenItemStatus.findMany).mockResolvedValue([] as never);
    vi.mocked(loadKitchenStaffWorkers).mockResolvedValue([]);
    vi.mocked(prisma.kitchenWorker.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.kitchenWorker.createMany).mockResolvedValue({
      count: 0
    } as never);
    vi.mocked(prisma.kitchenWorker.updateMany).mockResolvedValue({
      count: 0
    } as never);
    vi.mocked(prisma.organizationMembership.findMany).mockResolvedValue(
      [] as never
    );
    vi.mocked(prisma.eventPackage.findMany).mockResolvedValue([
      {
        id: "package-1",
        name: "Shabbos Lunch",
        includedMenuItemIds: ["a", "b"]
      }
    ] as never);
    vi.mocked(prisma.menuItem.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.kitchenStandaloneEvent.findMany).mockResolvedValue(
      [] as never
    );
    vi.mocked(prisma.kitchenStandaloneItemStatus.findMany).mockResolvedValue(
      [] as never
    );
    vi.mocked(prisma.kitchenNotification.findMany).mockResolvedValue(
      [] as never
    );
    vi.mocked(prisma.$transaction).mockImplementation((async (
      run: (transaction: typeof prisma) => unknown
    ) => run(prisma)) as never);
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

  it("loads a requested historical window for previous navigation", async () => {
    await GET(new Request("http://localhost/api/kitchen?start=2026-07-01"));

    const filter = eventQueryFilter() as {
      eventDate: { gte: Date; lt: Date };
    };

    expect(filter.eventDate.gte.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(filter.eventDate.lt.toISOString()).toBe("2026-07-29T00:00:00.000Z");
  });

  describe("hall scoping", () => {
    it("restricts a hall-limited member to their halls", async () => {
      vi.mocked(authorize).mockResolvedValue(
        hallScopedContext([hallId], { organizationId })
      );

      await GET(request());

      expect(eventQueryFilter()).toMatchObject({ hallId: { in: [hallId] } });
    });

    it("leaves an unrestricted member seeing every hall", async () => {
      // "all" means not hall-restricted, so it must not become
      // `hallId: { in: [] }` - which would match nothing at all.
      await GET(request());

      expect(eventQueryFilter()).not.toHaveProperty("hallId");
    });

    it("shows a member scoped to no hall nothing at all", async () => {
      // The inverse of the case above, and the reason "all" cannot be spelled
      // as an empty list: an empty scope is a real answer, not an absent one.
      vi.mocked(authorize).mockResolvedValue(
        hallScopedContext([], { organizationId })
      );

      await GET(request());

      expect(eventQueryFilter()).toMatchObject({ hallId: { in: [] } });
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
      mockMenus({
        main: [
          {
            eventId,
            meal: "Main",
            status: "Confirmed",
            confirmedAt: null,
            version: 2,
            lines: [
              dishLine(),
              // No style and no rule: nothing to cook to, so it needs someone
              // to go and say rather than being cooked as zero.
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
        ]
      });
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

    it("marks the current worker's assigned dish count", async () => {
      mockMenus({
        main: [
          {
            eventId,
            meal: "Main",
            status: "Draft",
            confirmedAt: null,
            version: 1,
            lines: [
              dishLine(),
              dishLine({
                id: "line-2",
                menuItemId: otherMenuItemId,
                menuItem: {
                  name: "Israeli salad",
                  isActive: true,
                  picturePath: null,
                  services: []
                }
              })
            ]
          }
        ]
      });
      vi.mocked(loadKitchenStaffWorkers).mockResolvedValue([
        {
          id: workerId,
          name: "Test Actor",
          userId: actor.userId,
          isStaff: true
        }
      ]);
      vi.mocked(prisma.kitchenItemStatus.findMany).mockResolvedValue([
        {
          eventId,
          menuItemId,
          status: null,
          assignedWorkerId: workerId,
          assignedWorker: { name: "Test Actor" }
        },
        {
          eventId,
          menuItemId: otherMenuItemId,
          status: null,
          assignedWorkerId: "99999999-9999-4999-8999-999999999999",
          assignedWorker: { name: "Someone Else" }
        }
      ] as never);

      const board = await readBoard(await GET(request()));

      expect(board.currentWorkerId).toBe(workerId);
      expect(board.workers).toEqual([
        { id: workerId, name: "Test Actor", isStaff: true }
      ]);
      expect(board.events[0].summary).toMatchObject({
        assigned: 2,
        assignedToCurrentWorker: 1
      });
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

      // Three queries for the window, not three per event: the board spans four
      // weeks, so per-event reads would be up to a hundred round-trips. The
      // menu count is two of them - the Main menu it draws, and the meals it
      // cannot - and neither grows with the number of events.
      expect(prisma.eventMenu.findMany).toHaveBeenCalledTimes(2);
      expect(prisma.kitchenItemStatus.findMany).toHaveBeenCalledTimes(1);
    });

    it("names the meals the board is not showing", async () => {
      // The board draws `Main` and nothing else. An event serving three meals
      // would otherwise report its Main menu as the whole job - "8/8 done" over
      // a quarter of the cooking, with no error and no empty state.
      mockMenus({
        other: [
          { eventId, meal: "ShabbosDay" },
          { eventId, meal: "FridayNight" }
        ]
      });

      const board = await readBoard(await GET(request()));

      expect(board.events[0].otherMeals).toEqual(["ShabbosDay", "FridayNight"]);
      expect(
        vi.mocked(prisma.eventMenu.findMany).mock.calls[1]?.[0]?.where
      ).toMatchObject({ meal: { not: "Main" }, organizationId });
    });

    it("reports no other meals for an event serving only Main", async () => {
      const board = await readBoard(await GET(request()));

      expect(board.events[0].otherMeals).toEqual([]);
    });

    it("offers active menu library items for kitchen-only events", async () => {
      vi.mocked(prisma.menuItem.findMany).mockImplementation((async ({
        select
      }: {
        select?: Record<string, unknown>;
      }) => {
        if (select?.categoryRef) {
          return [
            {
              id: menuItemId,
              name: "Potato kugel",
              category: "Sides",
              kind: "Food",
              categoryRef: null
            }
          ];
        }

        return [];
      }) as never);

      const board = await readBoard(await GET(request()));

      expect(board.menuItems).toEqual([
        {
          id: menuItemId,
          name: "Potato kugel",
          category: "Sides",
          kind: "Food"
        }
      ]);
      expect(board.permissions).not.toHaveProperty("canEditMenu");
    });

    it("does offer the menu list a kitchen event is raised against", async () => {
      // Menu templates are still package-backed shortcuts. Individual
      // `menuItems` are now exposed separately for one-off kitchen events.
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
        hallId,
        eventDate: new Date("2099-08-20T00:00:00.000Z")
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

    it("keeps a past event read-only", async () => {
      vi.mocked(prisma.event.findFirst).mockResolvedValue({
        id: eventId,
        hallId,
        eventDate: new Date("2020-08-20T00:00:00.000Z")
      } as never);
      vi.mocked(prisma.menuItem.findFirst).mockResolvedValue({
        id: menuItemId,
        name: "Potato kugel"
      } as never);

      const response = await PATCH(
        request({ action: "status", eventId, menuItemId, status: "COMPLETE" })
      );

      expect(response.status).toBe(409);
      expect(prisma.kitchenItemStatus.upsert).not.toHaveBeenCalled();
    });

    describe("assigning a worker", () => {
      beforeEach(() => {
        vi.mocked(prisma.event.findFirst).mockResolvedValue({
          id: eventId,
          hallId,
          eventDate: new Date("2099-08-20T00:00:00.000Z")
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
        hallId,
        eventDate: new Date("2099-08-20T00:00:00.000Z")
      } as never);
      vi.mocked(prisma.menuItem.findFirst).mockResolvedValue({
        id: menuItemId,
        name: "Potato kugel"
      } as never);
      vi.mocked(prisma.kitchenItemStatus.upsert).mockResolvedValue({} as never);

      await PATCH(
        request({ action: "status", eventId, menuItemId, status: "COMPLETE" })
      );

      expect(assertInScope).toHaveBeenCalledWith(
        expect.anything(),
        "hall",
        hallId
      );
    });

    it('refuses "remove-menu-item", which only ever wrote the mirror', async () => {
      // It wrote `Event.menuItemIds` and nothing else, so a dish taken off here
      // changed what the board showed and nothing the kitchen cooks. Unlike a
      // swap, it has not come back: a dish nobody cooks is a promise to the
      // client that somebody has to unmake.
      const response = await PATCH(
        request({ action: "remove-menu-item", eventId, menuItemId })
      );

      expect(response.status).toBe(400);
      expect(prisma.event.update).not.toHaveBeenCalled();
    });

    describe("replacing a dish", () => {
      beforeEach(() => {
        vi.mocked(prisma.event.findFirst).mockResolvedValue({
          id: eventId,
          hallId,
          eventDate: new Date("2099-08-20T00:00:00.000Z")
        } as never);
        vi.mocked(prisma.menuItem.findFirst).mockResolvedValue({
          id: menuItemId,
          name: "Potato kugel"
        } as never);
      });

      it("sends the swap to the line writer rather than the mirror", async () => {
        vi.mocked(replaceKitchenDish).mockResolvedValue({
          outcome: "replaced",
          name: "Roast chicken",
          serviceStyle: "Buffet"
        });

        const response = await PATCH(
          request({
            action: "replace-menu-item",
            eventId,
            menuItemId,
            replacementMenuItemId: otherMenuItemId
          })
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
          replaced: {
            from: "Potato kugel",
            to: "Roast chicken",
            serviceStyle: "Buffet"
          }
        });
        expect(replaceKitchenDish).toHaveBeenCalledWith(
          expect.objectContaining({
            eventId,
            menuItemId,
            replacementMenuItemId: otherMenuItemId,
            organizationId
          })
        );
      });

      it("checks hall access before swapping anything", async () => {
        vi.mocked(replaceKitchenDish).mockResolvedValue({
          outcome: "replaced",
          name: "Roast chicken",
          serviceStyle: "Buffet"
        });

        await PATCH(
          request({
            action: "replace-menu-item",
            eventId,
            menuItemId,
            replacementMenuItemId: otherMenuItemId
          })
        );

        expect(assertInScope).toHaveBeenCalledWith(
          expect.anything(),
          "hall",
          hallId
        );
      });

      it("answers 409 when the dish is already on this menu", async () => {
        // `(menu, dish)` is unique, so this is unstorable rather than merely
        // unwanted - and the person needs to hear which of the two it was.
        vi.mocked(replaceKitchenDish).mockResolvedValue({
          outcome: "already-on-menu",
          name: "Roast chicken"
        });

        const response = await PATCH(
          request({
            action: "replace-menu-item",
            eventId,
            menuItemId,
            replacementMenuItemId: otherMenuItemId
          })
        );

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({
          error: "Roast chicken is already on this menu."
        });
      });

      it("answers 409 when the menu moved on underneath the board", async () => {
        vi.mocked(replaceKitchenDish).mockResolvedValue({
          outcome: "conflict"
        });

        const response = await PATCH(
          request({
            action: "replace-menu-item",
            eventId,
            menuItemId,
            replacementMenuItemId: otherMenuItemId
          })
        );

        expect(response.status).toBe(409);
      });

      it("refuses the swap without permission to update kitchen status", async () => {
        // Assigning workers is a different job from deciding what is cooked.
        vi.mocked(hasPermission).mockImplementation(
          async (_context, key) => key !== "kitchen.status.update"
        );

        const response = await PATCH(
          request({
            action: "replace-menu-item",
            eventId,
            menuItemId,
            replacementMenuItemId: otherMenuItemId
          })
        );

        expect(response.status).toBe(403);
        expect(replaceKitchenDish).not.toHaveBeenCalled();
      });
    });
  });
});
