import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/security/rate-limit", () => ({ enforceRateLimit: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findFirst: vi.fn(), update: vi.fn() },
    eventPackage: { findFirst: vi.fn() },
    tableclothOption: { findFirst: vi.fn() },
    menuItem: { count: vi.fn(), findMany: vi.fn() },
    addOn: { count: vi.fn() },
    activityLog: { create: vi.fn() },
    eventMenu: { upsert: vi.fn() },
    eventMenuLine: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn()
    },
    kitchenItemStatus: { deleteMany: vi.fn() },
    $transaction: vi.fn()
  }
}));

import { POST } from "@/app/api/client-portal/[eventId]/selections/route";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/security/rate-limit";

const eventId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const packageId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const menuItemId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const addOnId = "99999999-9999-4999-8999-999999999999";
const eventMenuId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function post(body: unknown, id = eventId) {
  return POST(
    new Request(`http://localhost/api/client-portal/${id}/selections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }),
    { params: Promise.resolve({ eventId: id }) }
  );
}

describe("public client portal selections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(enforceRateLimit).mockResolvedValue(null);
    vi.mocked(prisma.event.findFirst).mockResolvedValue({
      id: eventId,
      organizationId,
      packageId,
      tableclothId: null,
      menuItemIds: [menuItemId],
      addOnIds: [],
      workspaceData: null
    } as never);
    vi.mocked(prisma.event.update).mockResolvedValue({
      id: eventId,
      packageId,
      tableclothId: null,
      menuItemIds: [menuItemId],
      addOnIds: []
    } as never);
    vi.mocked(prisma.activityLog.create).mockResolvedValue({} as never);
    vi.mocked(prisma.eventMenu.upsert).mockResolvedValue({
      id: eventMenuId
    } as never);
    vi.mocked(prisma.menuItem.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.eventMenuLine.deleteMany).mockResolvedValue({
      count: 0
    } as never);
    vi.mocked(prisma.eventMenuLine.findMany).mockResolvedValue([
      { menuItemId }
    ] as never);
    vi.mocked(prisma.kitchenItemStatus.deleteMany).mockResolvedValue({
      count: 0
    } as never);
    vi.mocked(prisma.eventMenuLine.createMany).mockResolvedValue({
      count: 0
    } as never);
    vi.mocked(prisma.$transaction).mockImplementation((async (
      callback: (tx: unknown) => Promise<unknown>
    ) => callback(prisma)) as never);
  });

  it("rejects a package belonging to another organization", async () => {
    // The id is well-formed but not this organization's, so the ownership
    // lookup finds nothing.
    vi.mocked(prisma.eventPackage.findFirst).mockResolvedValue(null);

    const response = await post({ packageId });

    expect(response.status).toBe(400);
    expect(prisma.eventPackage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: packageId, organizationId })
      })
    );
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it("rejects a package that was not published on this event", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue({
      id: eventId,
      organizationId,
      packageId: null,
      tableclothId: null,
      menuItemIds: [],
      addOnIds: [],
      workspaceData: null
    } as never);

    const response = await post({ packageId });

    expect(response.status).toBe(400);
    expect(prisma.eventPackage.findFirst).not.toHaveBeenCalled();
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it("rejects menu items that are not all owned and active", async () => {
    vi.mocked(prisma.menuItem.count).mockResolvedValue(0);

    const response = await post({ menuItemIds: [menuItemId] });

    expect(response.status).toBe(400);
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it("refuses edits once the venue has confirmed the menu", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue({
      id: eventId,
      organizationId,
      packageId: null,
      tableclothId: null,
      menuItemIds: [],
      addOnIds: [],
      workspaceData: { menuConfirmed: true }
    } as never);

    const response = await post({ menuItemIds: [menuItemId] });

    expect(response.status).toBe(409);
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it("passes the rate limiter's rejection straight through", async () => {
    vi.mocked(enforceRateLimit).mockResolvedValue(
      new Response(null, { status: 429 }) as never
    );

    const response = await post({ menuItemIds: [] });

    expect(response.status).toBe(429);
    expect(prisma.event.findFirst).not.toHaveBeenCalled();
  });

  it("404s for a malformed event id without touching the database", async () => {
    const response = await post({ menuItemIds: [] }, "not-a-uuid");

    expect(response.status).toBe(404);
    expect(prisma.event.findFirst).not.toHaveBeenCalled();
  });

  it("rejects unknown fields rather than silently ignoring them", async () => {
    const response = await post({ organizationId: "hijacked" });

    expect(response.status).toBe(400);
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it("saves owned selections and appends one activity log entry", async () => {
    vi.mocked(prisma.eventPackage.findFirst).mockResolvedValue({
      id: packageId,
      name: "Gold dinner"
    } as never);
    vi.mocked(prisma.menuItem.count).mockResolvedValue(1);

    const response = await post({ packageId, menuItemIds: [menuItemId] });

    expect(response.status).toBe(200);
    expect(prisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: eventId, organizationId },
        data: expect.objectContaining({
          packageId,
          packageName: "Gold dinner",
          menuItemIds: [menuItemId]
        })
      })
    );
    expect(prisma.activityLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId, eventId })
      })
    );
  });

  it("writes the client's picks onto the event menu, not only the id array", async () => {
    vi.mocked(prisma.menuItem.count).mockResolvedValue(1);

    const response = await post({ menuItemIds: [menuItemId] });

    expect(response.status).toBe(200);
    // Without this the client's choices reach the mirrored array but never the
    // menu document, so staff open the menu tab and see nothing.
    expect(prisma.eventMenu.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId_meal: { eventId, meal: "Main" } },
        update: expect.objectContaining({ status: "ClientSubmitted" })
      })
    );
    expect(prisma.eventMenuLine.deleteMany).toHaveBeenCalledWith({
      where: { eventMenuId }
    });
    expect(prisma.eventMenuLine.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          eventMenuId,
          menuItemId,
          sortOrder: 0,
          source: "ClientPortal"
        })
      ]
    });
  });

  it("turns the client's add-ons into lines beside the dishes", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue({
      id: eventId,
      organizationId,
      packageId,
      tableclothId: null,
      menuItemIds: [menuItemId],
      addOnIds: [addOnId],
      workspaceData: null
    } as never);
    vi.mocked(prisma.addOn.count).mockResolvedValue(1);

    const response = await post({ addOnIds: [addOnId] });

    expect(response.status).toBe(200);
    expect(prisma.eventMenuLine.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            addOnId,
            sortOrder: 1,
            source: "ClientPortal"
          })
        ])
      })
    );
  });

  it("rejects add-ons that were not published on this event", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue({
      id: eventId,
      organizationId,
      packageId,
      tableclothId: null,
      menuItemIds: [menuItemId],
      addOnIds: [],
      workspaceData: null
    } as never);

    const response = await post({ addOnIds: [addOnId] });

    expect(response.status).toBe(400);
    expect(prisma.addOn.count).not.toHaveBeenCalled();
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it("rejects menu items that were not published on this event", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue({
      id: eventId,
      organizationId,
      packageId,
      tableclothId: null,
      menuItemIds: [],
      addOnIds: [],
      workspaceData: null
    } as never);

    const response = await post({ menuItemIds: [menuItemId] });

    expect(response.status).toBe(400);
    expect(prisma.menuItem.count).not.toHaveBeenCalled();
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  describe("counts staff set, across the client's replace", () => {
    it("carries a quantity onto the row that replaces the line", async () => {
      // The portal deletes every line and rebuilds from two id arrays, and its
      // body cannot carry a count - the client is never asked one. Without the
      // carry-over, a client tapping Save on picks they did not change silently
      // undoes "2x the brisket".
      vi.mocked(prisma.menuItem.count).mockResolvedValue(1);
      vi.mocked(prisma.eventMenuLine.findMany).mockResolvedValue([
        { menuItemId, addOnId: null, quantityMultiplier: 3 }
      ] as never);

      const response = await post({ menuItemIds: [menuItemId] });

      expect(response.status).toBe(200);
      expect(prisma.eventMenuLine.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ menuItemId, quantityMultiplier: 3 })]
      });
    });

    it("carries an add-on's quantity too", async () => {
      vi.mocked(prisma.event.findFirst).mockResolvedValue({
        id: eventId,
        organizationId,
        packageId,
        tableclothId: null,
        menuItemIds: [],
        addOnIds: [addOnId],
        workspaceData: null
      } as never);
      vi.mocked(prisma.addOn.count).mockResolvedValue(1);
      vi.mocked(prisma.eventMenuLine.findMany).mockResolvedValue([
        { menuItemId: null, addOnId, quantityMultiplier: 2 }
      ] as never);

      const response = await post({ addOnIds: [addOnId] });

      expect(response.status).toBe(200);
      expect(prisma.eventMenuLine.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ addOnId, quantityMultiplier: 2 })]
      });
    });

    it("starts a published dish without an existing line at one", async () => {
      vi.mocked(prisma.menuItem.count).mockResolvedValue(1);
      vi.mocked(prisma.eventMenuLine.findMany).mockResolvedValue([
        // A different dish carried the count; the one being added did not.
        { menuItemId: "other", addOnId: null, quantityMultiplier: 4 }
      ] as never);

      const response = await post({ menuItemIds: [menuItemId] });

      expect(response.status).toBe(200);
      expect(prisma.eventMenuLine.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ menuItemId, quantityMultiplier: 1 })]
      });
    });
  });

  it("keeps the dishes when the client only changes add-ons", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue({
      id: eventId,
      organizationId,
      packageId: null,
      tableclothId: null,
      menuItemIds: [menuItemId],
      addOnIds: [addOnId],
      workspaceData: null
    } as never);
    vi.mocked(prisma.addOn.count).mockResolvedValue(1);

    await post({ addOnIds: [addOnId] });

    // The lines are replaced wholesale, so a request carrying only one of the
    // two lists has to rebuild the other from what the event already had or it
    // would silently wipe it.
    expect(prisma.eventMenuLine.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ menuItemId, sortOrder: 0 }),
        expect.objectContaining({
          addOnId,
          sortOrder: 1,
          source: "ClientPortal"
        })
      ]
    });
  });

  it("leaves the event menu alone when the client sends no menu items", async () => {
    vi.mocked(prisma.eventPackage.findFirst).mockResolvedValue({
      id: packageId,
      name: "Gold dinner"
    } as never);

    const response = await post({ packageId });

    expect(response.status).toBe(200);
    // A tablecloth or package change must not wipe the menu lines.
    expect(prisma.eventMenu.upsert).not.toHaveBeenCalled();
    expect(prisma.eventMenuLine.deleteMany).not.toHaveBeenCalled();
  });
});
