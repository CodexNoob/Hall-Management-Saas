import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/storage/files", () => ({ createSignedFileUrls: vi.fn() }));
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
    event: { findFirst: vi.fn() },
    // `findMany` is the meals this sheet is not showing, asked for alongside
    // the one it is.
    eventMenu: { findUnique: vi.fn(), findMany: vi.fn() },
    kitchenItemStatus: { findMany: vi.fn() }
  }
}));

import { GET } from "@/app/api/events/[eventId]/kitchen/route";
import type { EventKitchenResponse } from "@/features/events/components/event-manager-shared";
import { requireAnyPermission } from "@/lib/auth/server-auth";
import { prisma } from "@/lib/prisma";
import { createSignedFileUrls } from "@/lib/storage/files";

/**
 * The arithmetic on this route is what the kitchen cooks off, so the cases that
 * matter are the ones where it must refuse to produce a number rather than
 * produce a wrong one.
 */

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const eventId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const hallId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const menuItemId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const addOnId = "12345678-1234-4234-8234-123456789012";
const dishPicturePath = `${organizationId}/menu/ribs.jpg`;
const signedUrl = "https://storage.example/signed/ribs.jpg?token=abc";

const actor = {
  id: "22222222-2222-4222-8222-222222222222",
  organizationId,
  membership: { role: "OWNER" },
  access: null
};

const params = Promise.resolve({ eventId });

function request(search = "") {
  return new Request(`http://localhost/api/events/${eventId}/kitchen${search}`);
}

/** 40 couples + 50 men + 45 ladies + 6 boys + 4 girls + 2 kids = 187 guests. */
function eventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: eventId,
    hallId,
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

function serviceRule(overrides: Record<string, unknown> = {}) {
  const { quantity = 1, ...rest } = overrides;

  return {
    serviceStyle: "Buffet",
    // A Decimal, not a number: the column is Decimal(10,3), so this is what
    // Prisma actually hands the route. With a plain number here the route's
    // Number() conversion is a no-op and its removal passes the whole suite -
    // while in production every rule fails the rule schema, which wants a
    // number, and every dish comes back with no quantity at all.
    quantity: new Prisma.Decimal(String(quantity)),
    unit: "tray",
    per: 30,
    perBasis: "TotalGuests",
    rounding: "Up",
    minimumUnits: null,
    ...rest
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
      name: "Braised ribs",
      isActive: true,
      picturePath: null,
      services: [serviceRule()]
    },
    addOn: null,
    ...overrides
  };
}

function storedMenu(
  lines: Array<Record<string, unknown>>,
  overrides: Record<string, unknown> = {}
) {
  return {
    meal: "Main",
    status: "Draft",
    confirmedAt: null,
    version: 1,
    lines,
    ...overrides
  };
}

async function readSheet(response: Response) {
  const body = (await response.json()) as EventKitchenResponse;

  return body.kitchen;
}

describe("event kitchen route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAnyPermission).mockResolvedValue(actor as never);
    vi.mocked(createSignedFileUrls).mockResolvedValue(
      new Map<string, string>() as never
    );
    vi.mocked(prisma.event.findFirst).mockResolvedValue(eventRow() as never);
    vi.mocked(prisma.eventMenu.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.eventMenu.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.kitchenItemStatus.findMany).mockResolvedValue([] as never);
  });

  it("answers 404 for an event belonging to another organization", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue(null as never);

    const response = await GET(request(), { params });

    expect(response.status).toBe(404);
    expect(prisma.eventMenu.findUnique).not.toHaveBeenCalled();
  });

  it("answers an empty sheet, not a 404, before any menu is saved", async () => {
    const sheet = await readSheet(await GET(request(), { params }));

    expect(sheet.menuStatus).toBe("Draft");
    expect(sheet.lines).toEqual([]);
    expect(sheet.summary.dishes).toBe(0);
    // The head counts are the event's, whether or not a menu exists yet.
    expect(sheet.counts.totalGuests).toBe(187);
  });

  it("works out a tray count from the dish's buffet rule", async () => {
    vi.mocked(prisma.eventMenu.findUnique).mockResolvedValue(
      storedMenu([dishLine()]) as never
    );

    const sheet = await readSheet(await GET(request(), { params }));

    expect(sheet.lines[0].countState).toBe("Counted");
    expect(sheet.lines[0].quantities).toEqual([
      { unit: "tray", units: 7, raw: 6.233333 }
    ]);
    expect(sheet.summary.needsAttention).toBe(0);
  });

  it("reports Tables as unresolved rather than cooking none", async () => {
    vi.mocked(prisma.eventMenu.findUnique).mockResolvedValue(
      storedMenu([
        dishLine({
          menuItem: {
            name: "Dips",
            isActive: true,
            picturePath: null,
            services: [serviceRule({ unit: "set", per: 1, perBasis: "Tables" })]
          }
        })
      ]) as never
    );

    const sheet = await readSheet(await GET(request(), { params }));

    expect(sheet.lines[0].quantities).toEqual([]);
    expect(sheet.lines[0].unresolvedBases).toEqual(["Tables"]);
    expect(sheet.lines[0].countState).toBe("Unresolved");
    expect(sheet.summary.unresolvedBases).toEqual(["Tables"]);
    expect(sheet.counts.tables).toBeNull();
  });

  it("treats a dining plan with no tables drawn as unanswerable, not as zero", async () => {
    // The dining page saves a plan as soon as anyone edits the counts beside
    // it, so `tables: []` is the ordinary state of a plan nobody has drawn yet.
    vi.mocked(prisma.event.findFirst).mockResolvedValue(
      eventRow({ diningPlan: { tables: [] } }) as never
    );
    vi.mocked(prisma.eventMenu.findUnique).mockResolvedValue(
      storedMenu([
        dishLine({
          menuItem: {
            name: "Dips",
            isActive: true,
            picturePath: null,
            services: [serviceRule({ unit: "set", per: 1, perBasis: "Tables" })]
          }
        })
      ]) as never
    );

    const sheet = await readSheet(await GET(request(), { params }));

    expect(sheet.counts.tables).toBeNull();
    expect(sheet.lines[0].quantities).toEqual([]);
    expect(sheet.lines[0].countState).toBe("Unresolved");
    expect(sheet.summary.needsAttention).toBe(1);
  });

  it("counts only the seating tables on the dining plan", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue(
      eventRow({
        diningPlan: {
          tables: [
            { id: "t1", number: 1, seats: 10, side: "men" },
            { id: "t2", number: 2, seats: 10, side: "men", isSeating: false },
            { id: "t3", number: 3, seats: 0, side: "women" },
            { notATable: true }
          ]
        }
      }) as never
    );
    vi.mocked(prisma.eventMenu.findUnique).mockResolvedValue(
      storedMenu([
        dishLine({
          menuItem: {
            name: "Dips",
            isActive: true,
            picturePath: null,
            services: [serviceRule({ unit: "set", per: 1, perBasis: "Tables" })]
          }
        })
      ]) as never
    );

    const sheet = await readSheet(await GET(request(), { params }));

    expect(sheet.counts.tables).toBe(1);
    expect(sheet.lines[0].quantities).toEqual([
      { unit: "set", units: 1, raw: 1 }
    ]);
  });

  it("marks a dish served both ways as needing a service style", async () => {
    vi.mocked(prisma.eventMenu.findUnique).mockResolvedValue(
      storedMenu([
        dishLine({
          serviceStyle: null,
          menuItem: {
            name: "Chicken",
            isActive: true,
            picturePath: null,
            services: [
              serviceRule(),
              serviceRule({
                serviceStyle: "Plated",
                unit: "plate",
                per: 1,
                rounding: "Exact"
              })
            ]
          }
        })
      ]) as never
    );

    const sheet = await readSheet(await GET(request(), { params }));

    expect(sheet.lines[0].countState).toBe("NeedsStyle");
    expect(sheet.lines[0].availableStyles).toEqual(["Buffet", "Plated"]);
    expect(sheet.lines[0].quantities).toEqual([]);
    expect(sheet.summary.needsAttention).toBe(1);
  });

  it("marks a dish with no rule for the style it is served in", async () => {
    vi.mocked(prisma.eventMenu.findUnique).mockResolvedValue(
      storedMenu([
        dishLine({
          serviceStyle: "Plated",
          menuItem: {
            name: "Kugel",
            isActive: true,
            picturePath: null,
            services: [serviceRule()]
          }
        })
      ]) as never
    );

    const sheet = await readSheet(await GET(request(), { params }));

    expect(sheet.lines[0].countState).toBe("NoRule");
    expect(sheet.lines[0].quantities).toEqual([]);
  });

  it("leaves add-ons uncounted and statusless", async () => {
    vi.mocked(prisma.eventMenu.findUnique).mockResolvedValue(
      storedMenu([
        {
          id: "line-addon",
          menuItemId: null,
          addOnId,
          itemName: null,
          serviceStyle: null,
          notes: null,
          sortOrder: 0,
          menuItem: null,
          addOn: { name: "Viennese table", isActive: true, picturePath: null }
        }
      ]) as never
    );

    const sheet = await readSheet(await GET(request(), { params }));

    expect(sheet.lines[0].kind).toBe("AddOn");
    expect(sheet.lines[0].countState).toBe("NotCounted");
    expect(sheet.lines[0].status).toBeNull();
    expect(sheet.summary.addOns).toBe(1);
    expect(sheet.summary.dishes).toBe(0);
  });

  it("reads status and worker from the kitchen item status row", async () => {
    vi.mocked(prisma.eventMenu.findUnique).mockResolvedValue(
      storedMenu([dishLine()]) as never
    );
    vi.mocked(prisma.kitchenItemStatus.findMany).mockResolvedValue([
      {
        menuItemId,
        status: "COMPLETE",
        assignedWorker: { name: "Chaim" }
      }
    ] as never);

    const sheet = await readSheet(await GET(request(), { params }));

    expect(sheet.lines[0].status).toBe("COMPLETE");
    expect(sheet.lines[0].assignedWorkerName).toBe("Chaim");
    expect(sheet.summary.complete).toBe(1);
    expect(sheet.summary.notStarted).toBe(0);
  });

  it("reports a status it does not recognise as pending, not as complete", async () => {
    // The column is a bare String guarded only by the board's zod enum, so a
    // value written by an older or newer build must read as "started but not
    // finished". Reading it as complete would tell the kitchen an uncooked dish
    // is done.
    vi.mocked(prisma.eventMenu.findUnique).mockResolvedValue(
      storedMenu([dishLine()]) as never
    );
    vi.mocked(prisma.kitchenItemStatus.findMany).mockResolvedValue([
      { menuItemId, status: "IN_PROGRESS", assignedWorker: null }
    ] as never);

    const sheet = await readSheet(await GET(request(), { params }));

    expect(sheet.lines[0].status).toBe("PENDING");
    expect(sheet.summary.pending).toBe(1);
    expect(sheet.summary.complete).toBe(0);
  });

  it("carries a pending status through to the summary", async () => {
    vi.mocked(prisma.eventMenu.findUnique).mockResolvedValue(
      storedMenu([dishLine()]) as never
    );
    vi.mocked(prisma.kitchenItemStatus.findMany).mockResolvedValue([
      { menuItemId, status: "PENDING", assignedWorker: { name: "Chaim" } }
    ] as never);

    const sheet = await readSheet(await GET(request(), { params }));

    expect(sheet.lines[0].status).toBe("PENDING");
    expect(sheet.summary.pending).toBe(1);
    expect(sheet.summary.complete).toBe(0);
    expect(sheet.summary.notStarted).toBe(0);
  });

  it("reports a dish with no status row as not started", async () => {
    vi.mocked(prisma.eventMenu.findUnique).mockResolvedValue(
      storedMenu([dishLine()]) as never
    );

    const sheet = await readSheet(await GET(request(), { params }));

    expect(sheet.lines[0].status).toBeNull();
    expect(sheet.lines[0].assignedWorkerName).toBeNull();
    expect(sheet.summary.notStarted).toBe(1);
  });

  it("answers a confirmed line from its frozen name, not the renamed library row", async () => {
    vi.mocked(prisma.eventMenu.findUnique).mockResolvedValue(
      storedMenu([dishLine({ itemName: "Braised short ribs" })], {
        status: "Confirmed",
        confirmedAt: new Date("2026-08-01T12:00:00.000Z")
      }) as never
    );

    const sheet = await readSheet(await GET(request(), { params }));

    expect(sheet.menuStatus).toBe("Confirmed");
    expect(sheet.lines[0].name).toBe("Braised short ribs");
  });

  it("signs pictures once for the whole sheet and never leaks a path", async () => {
    vi.mocked(createSignedFileUrls).mockResolvedValue(
      new Map([[dishPicturePath, signedUrl]]) as never
    );
    vi.mocked(prisma.eventMenu.findUnique).mockResolvedValue(
      storedMenu([
        dishLine({
          menuItem: {
            name: "Braised ribs",
            isActive: true,
            picturePath: dishPicturePath,
            services: [serviceRule()]
          }
        }),
        dishLine({
          id: "line-2",
          menuItem: {
            name: "Soup",
            isActive: true,
            picturePath: dishPicturePath,
            services: [serviceRule()]
          }
        })
      ]) as never
    );

    const response = await GET(request(), { params });
    const raw = await response.clone().text();
    const sheet = await readSheet(response);

    expect(createSignedFileUrls).toHaveBeenCalledTimes(1);
    expect(sheet.lines[0].pictureUrl).toBe(signedUrl);
    expect(raw).not.toContain("picturePath");
    expect(raw).not.toContain(dishPicturePath);
  });

  it("still serves the sheet when signing throws", async () => {
    vi.mocked(createSignedFileUrls).mockRejectedValue(
      new Error("storage unreachable")
    );
    vi.mocked(prisma.eventMenu.findUnique).mockResolvedValue(
      storedMenu([
        dishLine({
          menuItem: {
            name: "Braised ribs",
            isActive: true,
            picturePath: dishPicturePath,
            services: [serviceRule()]
          }
        })
      ]) as never
    );

    const sheet = await readSheet(await GET(request(), { params }));

    expect(sheet.lines[0].pictureUrl).toBeNull();
    expect(sheet.lines[0].quantities).toHaveLength(1);
  });

  it("excludes waiters from the guest total", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue(
      eventRow({ waitersCount: 40 }) as never
    );
    vi.mocked(prisma.eventMenu.findUnique).mockResolvedValue(
      storedMenu([dishLine()]) as never
    );

    const sheet = await readSheet(await GET(request(), { params }));

    expect(sheet.counts.totalGuests).toBe(187);
    expect(sheet.counts.waiters).toBe(40);
    expect(sheet.lines[0].quantities[0].units).toBe(7);
  });

  it("reads the meal named on the query string", async () => {
    await GET(request("?meal=ShabbosDay"), { params });

    expect(prisma.eventMenu.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId_meal: { eventId, meal: "ShabbosDay" } }
      })
    );
  });

  it("names the meals this sheet is not showing", async () => {
    vi.mocked(prisma.eventMenu.findMany).mockResolvedValue([
      { meal: "FridayNight" },
      { meal: "ShabbosDay" }
    ] as never);

    const sheet = await readSheet(await GET(request(), { params }));

    expect(sheet.otherMeals).toEqual(["FridayNight", "ShabbosDay"]);
  });

  it("counts the other meals against the meal that was asked for", async () => {
    // Not against `Main`. This route already takes `?meal=`, so keying the
    // exclusion off the request is what stops the notice going stale the day
    // something calls it with a meal picker behind it.
    await GET(request("?meal=ShabbosDay"), { params });

    expect(prisma.eventMenu.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ meal: { not: "ShabbosDay" } })
      })
    );
  });

  it("reports no other meals for an event serving only Main", async () => {
    const sheet = await readSheet(await GET(request(), { params }));

    expect(sheet.otherMeals).toEqual([]);
  });
});
