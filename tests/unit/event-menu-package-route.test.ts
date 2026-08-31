import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/storage/files", () => ({ createSignedFileUrls: vi.fn() }));
vi.mock("@/lib/authz/authorize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authz/authorize")>()),
  assertInScope: vi.fn(),
  authorize: vi.fn()
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findFirst: vi.fn(), update: vi.fn() },
    eventPackage: { findFirst: vi.fn() },
    menuItem: { findMany: vi.fn() },
    eventMenu: {
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn()
    },
    eventMenuLine: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn()
    },
    kitchenItemStatus: { deleteMany: vi.fn() },
    $transaction: vi.fn()
  }
}));

import { DELETE, POST } from "@/app/api/events/[eventId]/menu/package/route";
import { authorize } from "@/lib/authz/authorize";
import { prisma } from "@/lib/prisma";
import { createSignedFileUrls } from "@/lib/storage/files";
import { authzContext } from "./authz-test-helpers";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const eventId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const hallId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const eventMenuId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const packageId = "11111111-1111-4111-8111-111111111111";
/** Served buffet only, so it needs no decision. */
const buffetDishId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
/** Carries both rules, so the event has to be asked which one applies. */
const bothStylesDishId = "ffffffff-ffff-4fff-8fff-ffffffffffff";

const actor = authzContext({
  organizationId,
  userId: "22222222-2222-4222-8222-222222222222"
});

const params = Promise.resolve({ eventId });

function request(method: string, body?: unknown, query = "") {
  return new Request(
    `http://localhost/api/events/${eventId}/menu/package${query}`,
    {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    }
  );
}

/** The read every write ends with, so the client never re-reads what it saved. */
function storedMenu() {
  return {
    id: eventMenuId,
    meal: "Main",
    status: "Draft",
    serviceStyle: null,
    confirmedAt: null,
    version: 3,
    confirmedBy: null,
    lines: []
  };
}

/** The gate's read of the menu header. */
function menuHeader(overrides: Record<string, unknown> = {}) {
  return {
    id: eventMenuId,
    status: "Draft",
    version: 2,
    ...overrides
  };
}

describe("event menu package route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authorize).mockResolvedValue(actor as never);
    vi.mocked(prisma.event.findFirst).mockResolvedValue({
      id: eventId,
      hallId,
      workspaceData: null,
      packageId: null
    } as never);
    vi.mocked(prisma.event.update).mockResolvedValue({ id: eventId } as never);
    vi.mocked(prisma.eventPackage.findFirst).mockResolvedValue({
      id: packageId,
      name: "Wedding Classic",
      includedMenuItemIds: [buffetDishId, bothStylesDishId]
    } as never);
    vi.mocked(prisma.menuItem.findMany).mockResolvedValue([
      { id: buffetDishId, services: [{ serviceStyle: "Buffet" }] },
      {
        id: bothStylesDishId,
        services: [{ serviceStyle: "Buffet" }, { serviceStyle: "Plated" }]
      }
    ] as never);
    vi.mocked(prisma.eventMenu.updateMany).mockResolvedValue({
      count: 1
    } as never);
    vi.mocked(prisma.eventMenu.create).mockResolvedValue({
      id: eventMenuId
    } as never);
    vi.mocked(prisma.eventMenuLine.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.eventMenuLine.deleteMany).mockResolvedValue({
      count: 0
    } as never);
    vi.mocked(prisma.kitchenItemStatus.deleteMany).mockResolvedValue({
      count: 0
    } as never);
    vi.mocked(prisma.eventMenuLine.createMany).mockResolvedValue({
      count: 2
    } as never);
    vi.mocked(createSignedFileUrls).mockResolvedValue(new Map());
    vi.mocked(prisma.$transaction).mockImplementation((async (
      argument: unknown
    ) =>
      typeof argument === "function"
        ? (argument as (tx: unknown) => Promise<unknown>)(prisma)
        : Promise.all(argument as Promise<unknown>[])) as never);
  });

  it("adds every active dish in the package and files it by its own rules", async () => {
    vi.mocked(prisma.eventMenu.findUnique)
      .mockResolvedValueOnce(menuHeader() as never)
      .mockResolvedValueOnce(storedMenu() as never);

    const response = await POST(request("POST", { version: 2, packageId }), {
      params
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.eventMenuLine.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          menuItemId: buffetDishId,
          // One rule, so the style is settled without asking.
          serviceStyle: "Buffet",
          source: "Package",
          sortOrder: 0
        }),
        expect.objectContaining({
          menuItemId: bothStylesDishId,
          // Two rules: guessing would decide the quantity the kitchen cooks.
          serviceStyle: null,
          source: "Package",
          sortOrder: 1
        })
      ]
    });
    // The columns the calendar, the kitchen board and the dining manager read.
    expect(prisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          packageId,
          packageName: "Wedding Classic"
        })
      })
    );
    expect(payload.menu.packageId).toBe(packageId);
  });

  /**
   * A package can carry the schedule it is normally run to. Applying it copies
   * those rows onto an event that has none - and never over one that has.
   */
  describe("a package with a default timeline", () => {
    const defaultTimeline = [
      { id: "row-1", time: "03:00 PM", text: "Setup begins", type: "Event" }
    ];

    function packageWithDefault() {
      vi.mocked(prisma.eventPackage.findFirst).mockResolvedValue({
        id: packageId,
        name: "Wedding Classic",
        includedMenuItemIds: [buffetDishId, bothStylesDishId],
        defaultTimeline
      } as never);
      vi.mocked(prisma.eventMenu.findUnique)
        .mockResolvedValueOnce(menuHeader() as never)
        .mockResolvedValueOnce(storedMenu() as never);
    }

    /** The event, read twice: once to load it, once inside the transaction. */
    function eventTimeline(timeline: unknown) {
      const row = {
        id: eventId,
        hallId,
        workspaceData: timeline === null ? null : { timeline },
        packageId: null
      };

      vi.mocked(prisma.event.findFirst).mockResolvedValue(row as never);
    }

    it("copies onto an event with no timeline, as an unconfirmed draft", async () => {
      packageWithDefault();
      eventTimeline(null);

      const response = await POST(request("POST", { version: 2, packageId }), {
        params
      });

      expect(response.status).toBe(200);
      expect(prisma.event.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            packageId,
            workspaceData: {
              timeline: defaultTimeline,
              // Copying a schedule is a starting point; confirming stays with
              // whoever reads it.
              timelineConfirmed: false
            }
          })
        })
      );
    });

    it("leaves a timeline somebody has already written alone", async () => {
      packageWithDefault();
      eventTimeline([
        { id: "own-1", time: "05:00 PM", text: "Chuppah", type: "Event" }
      ]);

      const response = await POST(request("POST", { version: 2, packageId }), {
        params
      });

      expect(response.status).toBe(200);
      const [[call]] = vi.mocked(prisma.event.update).mock.calls;
      expect(call).toEqual(
        expect.objectContaining({
          data: expect.not.objectContaining({
            workspaceData: expect.anything()
          })
        })
      );
    });
  });

  it("creates the menu when the package is the first thing on it", async () => {
    vi.mocked(prisma.eventMenu.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(storedMenu() as never);

    const response = await POST(request("POST", { packageId }), { params });

    expect(response.status).toBe(200);
    expect(prisma.eventMenu.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventId,
          organizationId,
          meal: "Main",
          status: "Draft"
        })
      })
    );
  });

  it("leaves a dish already on the menu alone rather than adding it twice", async () => {
    vi.mocked(prisma.eventMenu.findUnique)
      .mockResolvedValueOnce(menuHeader() as never)
      .mockResolvedValueOnce(storedMenu() as never);
    vi.mocked(prisma.eventMenuLine.findMany).mockResolvedValueOnce([
      {
        id: "line-manual",
        menuItemId: buffetDishId,
        source: "Manual",
        sortOrder: 0
      }
    ] as never);

    await POST(request("POST", { version: 2, packageId }), { params });

    // The unique on (menu, dish) makes the duplicate unstorable anyway; leaving
    // the manual line as it is means removing the package will not take it.
    expect(prisma.eventMenuLine.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ menuItemId: bothStylesDishId, sortOrder: 1 })
      ]
    });
  });

  it("leaves the count on a dish the new package also includes", async () => {
    // The kept row is never rewritten, so "2x the brisket" survives a package
    // swap along with the style it was given. Asserted rather than assumed,
    // because it holds only for as long as nothing updates that row.
    vi.mocked(prisma.eventMenu.findUnique)
      .mockResolvedValueOnce(menuHeader() as never)
      .mockResolvedValueOnce(storedMenu() as never);
    vi.mocked(prisma.eventMenuLine.findMany).mockResolvedValueOnce([
      {
        id: "line-kept",
        menuItemId: buffetDishId,
        source: "Package",
        sortOrder: 0
      }
    ] as never);

    await POST(request("POST", { version: 2, packageId }), { params });

    // The kept line is neither deleted nor rewritten - `eventMenuLine.update`
    // is not even mocked in this file, so a route that reached for it would
    // throw rather than quietly reset the count.
    expect(prisma.eventMenuLine.deleteMany).not.toHaveBeenCalled();
    // The additions get the column's default of one: a package is a list of
    // dishes and has no way to ask for two of any of them.
    expect(prisma.eventMenuLine.createMany).toHaveBeenCalledWith({
      data: [
        expect.not.objectContaining({ menuItemId: buffetDishId })
      ]
    });
  });

  it("drops the previous package's dishes but keeps hand-added ones", async () => {
    vi.mocked(prisma.eventMenu.findUnique)
      .mockResolvedValueOnce(menuHeader() as never)
      .mockResolvedValueOnce(storedMenu() as never);
    vi.mocked(prisma.eventMenuLine.findMany).mockResolvedValueOnce([
      {
        id: "line-old-package",
        menuItemId: "99999999-9999-4999-8999-999999999999",
        source: "Package",
        sortOrder: 0
      },
      {
        id: "line-manual",
        menuItemId: "88888888-8888-4888-8888-888888888888",
        source: "Manual",
        sortOrder: 1
      }
    ] as never);

    await POST(request("POST", { version: 2, packageId }), { params });

    expect(prisma.eventMenuLine.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["line-old-package"] } }
    });
  });

  it("refuses a package belonging to another organization", async () => {
    vi.mocked(prisma.eventPackage.findFirst).mockResolvedValue(null);

    const response = await POST(request("POST", { version: 2, packageId }), {
      params
    });

    expect(response.status).toBe(400);
    expect(prisma.eventMenuLine.createMany).not.toHaveBeenCalled();
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it("refuses a package whose items have all been deactivated", async () => {
    vi.mocked(prisma.menuItem.findMany).mockResolvedValue([] as never);

    const response = await POST(request("POST", { version: 2, packageId }), {
      params
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/no active menu items/i);
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it("refuses a package applied against a stale version", async () => {
    vi.mocked(prisma.eventMenu.findUnique).mockResolvedValue(
      menuHeader({ version: 7 }) as never
    );

    const response = await POST(request("POST", { version: 2, packageId }), {
      params
    });

    expect(response.status).toBe(409);
    // Nothing may be written on a conflict, or the loser silently wins.
    expect(prisma.eventMenuLine.createMany).not.toHaveBeenCalled();
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it("refuses a package on a confirmed menu", async () => {
    vi.mocked(prisma.eventMenu.findUnique).mockResolvedValue(
      menuHeader({ status: "Confirmed" }) as never
    );

    const response = await POST(request("POST", { version: 2, packageId }), {
      params
    });
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toMatch(/reopen/i);
    expect(prisma.eventMenuLine.createMany).not.toHaveBeenCalled();
  });

  it("removes only the lines the package put on the menu", async () => {
    vi.mocked(prisma.eventMenu.findUnique)
      .mockResolvedValueOnce(menuHeader() as never)
      .mockResolvedValueOnce(storedMenu() as never);
    vi.mocked(prisma.eventMenuLine.findMany).mockResolvedValueOnce([
      { menuItemId: buffetDishId, addOnId: null }
    ] as never);

    const response = await DELETE(
      request("DELETE", undefined, "?meal=Main&version=2"),
      { params }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.eventMenuLine.deleteMany).toHaveBeenCalledWith({
      where: { eventMenuId, source: "Package" }
    });
    expect(prisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ packageId: null, packageName: null })
      })
    );
    expect(prisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          menuItemIds: [buffetDishId],
          addOnIds: []
        })
      })
    );
    expect(payload.menu.packageId).toBeNull();
  });

  it("clears the event's package even when no menu has been saved", async () => {
    vi.mocked(prisma.eventMenu.findUnique).mockResolvedValue(null);

    const response = await DELETE(
      request("DELETE", undefined, "?meal=Main&version=0"),
      { params }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    // A package chosen at booking or through the portal is still on the event
    // even with nothing on its menu, and the user asked for it to go.
    expect(prisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ packageId: null, packageName: null })
      })
    );
    // No empty draft is left behind on an event nobody has touched.
    expect(prisma.eventMenu.create).not.toHaveBeenCalled();
    expect(payload.menu.version).toBe(0);
  });

  it("refuses a removal built on a stale version", async () => {
    vi.mocked(prisma.eventMenu.findUnique).mockResolvedValue(
      menuHeader({ version: 5 }) as never
    );

    const response = await DELETE(
      request("DELETE", undefined, "?meal=Main&version=2"),
      { params }
    );

    expect(response.status).toBe(409);
    expect(prisma.eventMenuLine.deleteMany).not.toHaveBeenCalled();
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it("answers 404 for an event belonging to another organization", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue(null);

    const response = await POST(request("POST", { version: 2, packageId }), {
      params
    });

    expect(response.status).toBe(404);
  });
});
