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
    menuItem: { count: vi.fn(), findMany: vi.fn() },
    addOn: { count: vi.fn() },
    eventMenu: {
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn()
    },
    eventMenuLine: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn()
    },
    kitchenItemStatus: { deleteMany: vi.fn() },
    kitchenNotification: { create: vi.fn() },
    $executeRaw: vi.fn(),
    $transaction: vi.fn()
  }
}));

import { GET, POST, PUT } from "@/app/api/events/[eventId]/menu/route";
import { authorize } from "@/lib/authz/authorize";
import { prisma } from "@/lib/prisma";
import { createSignedFileUrls } from "@/lib/storage/files";
import { authzContext } from "./authz-test-helpers";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const eventId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const hallId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const menuItemId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const otherMenuItemId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const eventMenuId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const addOnId = "12345678-1234-4234-8234-123456789012";
const dishPicturePath = `${organizationId}/menu/ribs.jpg`;
const signedUrl = "https://storage.example/signed/ribs.jpg?token=abc";

const actor = authzContext({
  organizationId,
  userId: "22222222-2222-4222-8222-222222222222"
});

const params = Promise.resolve({ eventId });

function request(method: string, body?: unknown) {
  return new Request(`http://localhost/api/events/${eventId}/menu`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

/** The shape the final read hands back after a successful write. */
function storedMenu(
  overrides: Record<string, unknown> = {},
  dishPicture: string | null = dishPicturePath
) {
  return {
    id: eventMenuId,
    meal: "Main",
    status: "Draft",
    serviceStyle: null,
    confirmedAt: null,
    version: 2,
    confirmedBy: null,
    lines: [
      {
        id: "line-1",
        menuItemId,
        addOnId: null,
        itemName: null,
        serviceStyle: "Buffet",
        notes: null,
        sortOrder: 0,
        quantityMultiplier: 1,
        source: "Manual",
        menuItem: {
          name: "Braised ribs",
          kind: "Food",
          isActive: true,
          picturePath: dishPicture,
          services: [{ serviceStyle: "Buffet" }, { serviceStyle: "Plated" }]
        },
        addOn: null
      },
      {
        id: "line-2",
        menuItemId: null,
        addOnId,
        itemName: null,
        serviceStyle: null,
        notes: null,
        sortOrder: 1,
        quantityMultiplier: 1,
        source: "Manual",
        menuItem: null,
        addOn: {
          name: "Viennese table",
          price: "850",
          isActive: true,
          // Deliberately without a picture: a menu mixes things that have one
          // with things that do not.
          picturePath: null
        }
      }
    ],
    ...overrides
  };
}

describe("event menu route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authorize).mockResolvedValue(actor);
    vi.mocked(prisma.event.findFirst).mockResolvedValue({
      id: eventId,
      hallId,
      workspaceData: null,
      packageId: null,
      eventDate: new Date("2026-08-20T00:00:00.000Z"),
      eventType: "Wedding",
      clientName: "Gold",
      hall: { name: "Main Hall" }
    } as never);
    vi.mocked(prisma.kitchenNotification.create).mockResolvedValue({} as never);
    vi.mocked(prisma.event.update).mockResolvedValue({ id: eventId } as never);
    vi.mocked(createSignedFileUrls).mockResolvedValue(
      new Map([[dishPicturePath, signedUrl]])
    );
    vi.mocked(prisma.menuItem.count).mockResolvedValue(1);
    vi.mocked(prisma.addOn.count).mockResolvedValue(1);
    vi.mocked(prisma.menuItem.findMany).mockResolvedValue([
      { id: menuItemId, services: [{ serviceStyle: "Buffet" }] }
    ] as never);
    vi.mocked(prisma.eventMenu.updateMany).mockResolvedValue({
      count: 1
    } as never);
    vi.mocked(prisma.eventMenuLine.deleteMany).mockResolvedValue({
      count: 0
    } as never);
    vi.mocked(prisma.eventMenuLine.createMany).mockResolvedValue({
      count: 1
    } as never);
    vi.mocked(prisma.eventMenuLine.updateMany).mockResolvedValue({
      count: 1
    } as never);
    // What the event still serves after the write, read back by the kitchen
    // status prune. The saved dish is on it, so nothing is pruned by default.
    vi.mocked(prisma.eventMenuLine.findMany).mockResolvedValue([
      { menuItemId }
    ] as never);
    vi.mocked(prisma.kitchenItemStatus.deleteMany).mockResolvedValue({
      count: 0
    } as never);
    // Both call styles the route uses: a callback for the guarded read-then-
    // write, and an array for the batch that follows it.
    vi.mocked(prisma.$transaction).mockImplementation((async (
      argument: unknown
    ) =>
      typeof argument === "function"
        ? (argument as (tx: unknown) => Promise<unknown>)(prisma)
        : Promise.all(argument as Promise<unknown>[])) as never);
  });

  it("answers 404 for an event belonging to another organization", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue(null);

    const response = await GET(request("GET"), { params });

    expect(response.status).toBe(404);
  });

  it("hands back an empty draft before anything is saved", async () => {
    vi.mocked(prisma.eventMenu.findUnique).mockResolvedValue(null);

    const response = await GET(request("GET"), { params });
    const payload = await response.json();

    expect(response.status).toBe(200);
    // Version 0 is what the first PUT sends, and no row is created by a read.
    expect(payload.menu).toMatchObject({
      id: null,
      status: "Draft",
      version: 0
    });
    expect(payload.menu.lines).toEqual([]);
  });

  it("presents a dish and an add-on line differently", async () => {
    vi.mocked(prisma.eventMenu.findUnique).mockResolvedValue(
      storedMenu() as never
    );

    const response = await GET(request("GET"), { params });
    const payload = await response.json();

    expect(payload.menu.lines[0]).toMatchObject({
      kind: "Dish",
      name: "Braised ribs",
      serviceStyle: "Buffet",
      // Both styles are reported so the tab can ask when one is not recorded.
      availableStyles: ["Buffet", "Plated"],
      price: null
    });
    expect(payload.menu.lines[1]).toMatchObject({
      kind: "AddOn",
      name: "Viennese table",
      serviceStyle: null,
      price: 850
    });
  });

  it("hands the tab back the count each line was saved with", async () => {
    vi.mocked(prisma.eventMenu.findUnique).mockResolvedValue(
      storedMenu({
        lines: [
          {
            ...storedMenu().lines[0],
            quantityMultiplier: 4
          }
        ]
      }) as never
    );

    const response = await GET(request("GET"), { params });
    const payload = await response.json();

    expect(payload.menu.lines[0].quantityMultiplier).toBe(4);
  });

  it("signs pictures once for the whole menu and never leaks the path", async () => {
    vi.mocked(prisma.eventMenu.findUnique).mockResolvedValue(
      storedMenu() as never
    );

    const response = await GET(request("GET"), { params });
    const payload = await response.json();

    // One request for the menu, not one per card.
    expect(createSignedFileUrls).toHaveBeenCalledTimes(1);
    expect(createSignedFileUrls).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId, paths: [dishPicturePath] })
    );
    expect(payload.menu.lines[0].pictureUrl).toBe(signedUrl);
    // An add-on with no picture is null, not a broken URL.
    expect(payload.menu.lines[1].pictureUrl).toBeNull();
    // The stored path is the one thing that would let a caller address the
    // object directly, so it must not travel with the response.
    expect(JSON.stringify(payload)).not.toContain(dishPicturePath);
  });

  it("skips signing entirely when nothing on the menu has a picture", async () => {
    vi.mocked(prisma.eventMenu.findUnique).mockResolvedValue(
      storedMenu({}, null) as never
    );

    const response = await GET(request("GET"), { params });
    const payload = await response.json();

    expect(createSignedFileUrls).not.toHaveBeenCalled();
    expect(payload.menu.lines[0].pictureUrl).toBeNull();
  });

  it("still serves the menu when signing fails", async () => {
    vi.mocked(prisma.eventMenu.findUnique).mockResolvedValue(
      storedMenu() as never
    );
    vi.mocked(createSignedFileUrls).mockRejectedValue(
      new Error("storage unreachable")
    );

    const response = await GET(request("GET"), { params });
    const payload = await response.json();

    // Storage being down costs the thumbnails, not the menu.
    expect(response.status).toBe(200);
    expect(payload.menu.lines).toHaveLength(2);
    expect(payload.menu.lines[0].pictureUrl).toBeNull();
  });

  it("mirrors the saved ids back onto the event", async () => {
    vi.mocked(prisma.eventMenu.findUnique)
      .mockResolvedValueOnce({
        id: eventMenuId,
        status: "Draft",
        version: 1
      } as never)
      .mockResolvedValueOnce(storedMenu() as never);

    const response = await PUT(
      request("PUT", {
        version: 1,
        lines: [{ menuItemId, serviceStyle: "Buffet" }, { addOnId }]
      }),
      { params }
    );

    expect(response.status).toBe(200);
    // Both mirrors keep the kitchen dashboard, the event PDF and the client
    // portal working while they still read the id arrays.
    expect(prisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          menuItemIds: [menuItemId],
          addOnIds: [addOnId]
        })
      })
    );
    expect(prisma.eventMenuLine.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          menuItemId,
          addOnId: null,
          serviceStyle: "Buffet",
          sortOrder: 0
        }),
        // An add-on is not served in a style, so the column stays null.
        expect.objectContaining({
          menuItemId: null,
          addOnId,
          serviceStyle: null,
          sortOrder: 1
        })
      ]
    });
  });

  it("drops the kitchen's rows for a dish the save took off the menu", async () => {
    vi.mocked(prisma.eventMenu.findUnique)
      .mockResolvedValueOnce({
        id: eventMenuId,
        status: "Draft",
        version: 1
      } as never)
      .mockResolvedValueOnce(storedMenu() as never);

    const response = await PUT(
      request("PUT", {
        version: 1,
        lines: [{ menuItemId, serviceStyle: "Buffet" }]
      }),
      { params }
    );

    expect(response.status).toBe(200);
    // `kitchen_item_statuses` is keyed on (event, dish) rather than on a line,
    // so nothing else would ever clear a row for a dish that just left the
    // menu - and the menu library's delete guard reads those rows.
    expect(prisma.kitchenItemStatus.deleteMany).toHaveBeenCalledWith({
      where: {
        organizationId,
        eventId,
        menuItemId: { notIn: [menuItemId] }
      }
    });
  });

  it("keeps no kitchen rows at all for an event serving nothing", async () => {
    vi.mocked(prisma.eventMenu.findUnique)
      .mockResolvedValueOnce({
        id: eventMenuId,
        status: "Draft",
        version: 1
      } as never)
      .mockResolvedValueOnce(storedMenu() as never);
    vi.mocked(prisma.eventMenuLine.findMany).mockResolvedValue([] as never);

    await PUT(request("PUT", { version: 1, lines: [] }), { params });

    // No `notIn` clause: an empty one is a no-op filter in some engines, which
    // would leave every orphan in place on the one save that clears the menu.
    expect(prisma.kitchenItemStatus.deleteMany).toHaveBeenCalledWith({
      where: { organizationId, eventId }
    });
  });

  it("rejects a line that is both a dish and an add-on", async () => {
    const response = await PUT(
      request("PUT", { version: 1, lines: [{ menuItemId, addOnId }] }),
      { params }
    );

    expect(response.status).toBe(400);
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it("rejects a line that is neither a dish nor an add-on", async () => {
    const response = await PUT(
      request("PUT", { version: 1, lines: [{ serviceStyle: "Buffet" }] }),
      { params }
    );

    expect(response.status).toBe(400);
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it("rejects a service style on an add-on", async () => {
    const response = await PUT(
      request("PUT", {
        version: 1,
        lines: [{ addOnId, serviceStyle: "Buffet" }]
      }),
      { params }
    );

    expect(response.status).toBe(400);
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it("rejects an add-on belonging to another organization", async () => {
    vi.mocked(prisma.addOn.count).mockResolvedValue(0);

    const response = await PUT(
      request("PUT", { version: 1, lines: [{ addOnId }] }),
      { params }
    );

    expect(response.status).toBe(400);
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it("refuses a save built on a stale version", async () => {
    vi.mocked(prisma.eventMenu.findUnique).mockResolvedValue({
      id: eventMenuId,
      status: "Draft",
      version: 7
    } as never);

    const response = await PUT(
      request("PUT", { version: 3, lines: [{ menuItemId }] }),
      { params }
    );

    expect(response.status).toBe(409);
    // Nothing may be written on a conflict, or the loser silently wins.
    expect(prisma.eventMenuLine.deleteMany).not.toHaveBeenCalled();
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it("refuses a save that lost a race after the version was read", async () => {
    vi.mocked(prisma.eventMenu.findUnique).mockResolvedValue({
      id: eventMenuId,
      status: "Draft",
      version: 1
    } as never);
    // Someone else committed between the read and the guarded update.
    vi.mocked(prisma.eventMenu.updateMany).mockResolvedValue({
      count: 0
    } as never);

    const response = await PUT(
      request("PUT", { version: 1, lines: [{ menuItemId }] }),
      { params }
    );

    expect(response.status).toBe(409);
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it("refuses to edit a confirmed menu", async () => {
    vi.mocked(prisma.eventMenu.findUnique).mockResolvedValue({
      id: eventMenuId,
      status: "Confirmed",
      version: 4
    } as never);

    const response = await PUT(
      request("PUT", { version: 4, lines: [{ menuItemId }] }),
      { params }
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toMatch(/reopen/i);
    expect(prisma.eventMenuLine.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects a dish belonging to another organization", async () => {
    // Only one of the two ids is owned, so the count comes up short.
    vi.mocked(prisma.menuItem.count).mockResolvedValue(1);

    const response = await PUT(
      request("PUT", {
        version: 1,
        lines: [{ menuItemId }, { menuItemId: otherMenuItemId }]
      }),
      { params }
    );

    expect(response.status).toBe(400);
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it("collapses a dish sent twice rather than failing the unique", async () => {
    vi.mocked(prisma.eventMenu.findUnique)
      .mockResolvedValueOnce({
        id: eventMenuId,
        status: "Draft",
        version: 1
      } as never)
      .mockResolvedValueOnce(storedMenu() as never);

    const response = await PUT(
      request("PUT", {
        version: 1,
        lines: [{ menuItemId }, { menuItemId }]
      }),
      { params }
    );

    expect(response.status).toBe(200);
    expect(prisma.eventMenuLine.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ menuItemId, sortOrder: 0 })]
    });
  });

  describe("more than one of the same dish", () => {
    function saving(body: Record<string, unknown>) {
      vi.mocked(prisma.eventMenu.findUnique)
        .mockResolvedValueOnce({
          id: eventMenuId,
          status: "Draft",
          version: 1
        } as never)
        .mockResolvedValueOnce(storedMenu() as never);

      return PUT(request("PUT", { version: 1, ...body }), { params });
    }

    it("stores how many of a dish the event ordered", async () => {
      const response = await saving({
        lines: [{ menuItemId, serviceStyle: "Buffet", quantityMultiplier: 3 }]
      });

      expect(response.status).toBe(200);
      expect(prisma.eventMenuLine.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ menuItemId, quantityMultiplier: 3 })]
      });
    });

    it("stores one for a line that did not name a count", async () => {
      // What an older client sends, and what the column would have defaulted
      // to anyway - written explicitly so the two cannot drift apart.
      const response = await saving({
        lines: [{ menuItemId, serviceStyle: "Buffet" }]
      });

      expect(response.status).toBe(200);
      expect(prisma.eventMenuLine.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ quantityMultiplier: 1 })]
      });
    });

    it("takes a count on an add-on, which is not served in a style", async () => {
      const response = await saving({
        lines: [{ addOnId, quantityMultiplier: 2 }]
      });

      expect(response.status).toBe(200);
      expect(prisma.eventMenuLine.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            addOnId,
            serviceStyle: null,
            quantityMultiplier: 2
          })
        ]
      });
    });

    it("refuses a count that is not a whole number of servings", async () => {
      // The same bounds as the CHECK on the column. Zero servings is spelled by
      // taking the line off the menu.
      for (const quantityMultiplier of [0, -1, 1.5, 100]) {
        const response = await PUT(
          request("PUT", {
            version: 1,
            lines: [{ menuItemId, serviceStyle: "Buffet", quantityMultiplier }]
          }),
          { params }
        );

        expect(response.status).toBe(400);
      }
    });

    it("keeps the last count when one dish arrives twice", async () => {
      // Deliberately not summed into 5: the tab sends the line set it holds,
      // which cannot carry a target twice, so a duplicate is a client bug -
      // and reading it as a deliberate "5x" would put a number in front of the
      // kitchen that looks right and nobody asked for.
      const response = await saving({
        lines: [
          { menuItemId, quantityMultiplier: 2 },
          { menuItemId, quantityMultiplier: 3 }
        ]
      });

      expect(response.status).toBe(200);
      expect(prisma.eventMenuLine.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ quantityMultiplier: 3 })]
      });
    });
  });

  it("creates the menu on the first save", async () => {
    vi.mocked(prisma.eventMenu.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(storedMenu({ version: 1 }) as never);
    vi.mocked(prisma.eventMenu.create).mockResolvedValue({
      id: eventMenuId,
      version: 1
    } as never);

    const response = await PUT(request("PUT", { lines: [{ menuItemId }] }), {
      params
    });

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

  it("freezes the line names and mirrors the flag when confirming", async () => {
    vi.mocked(prisma.eventMenu.findUnique)
      .mockResolvedValueOnce({
        id: eventMenuId,
        version: 2,
        _count: { lines: 1 }
      } as never)
      .mockResolvedValueOnce(
        storedMenu({ status: "Confirmed", version: 3 }) as never
      );

    const response = await POST(
      request("POST", { action: "confirm", version: 2 }),
      { params }
    );

    expect(response.status).toBe(200);
    // The snapshot copy is raw SQL because it is per-row from a join.
    expect(prisma.$executeRaw).toHaveBeenCalled();
    // The client portal still reads this json to lock the client out.
    expect(prisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceData: expect.objectContaining({ menuConfirmed: true })
        })
      })
    );
  });

  it("clears the snapshots when reopening", async () => {
    vi.mocked(prisma.eventMenu.findUnique)
      .mockResolvedValueOnce({
        id: eventMenuId,
        version: 3,
        _count: { lines: 1 }
      } as never)
      .mockResolvedValueOnce(storedMenu() as never);

    const response = await POST(
      request("POST", { action: "reopen", version: 3 }),
      { params }
    );

    expect(response.status).toBe(200);
    // Back to answering from the library until it is confirmed again.
    expect(prisma.eventMenuLine.updateMany).toHaveBeenCalledWith({
      where: { eventMenuId },
      data: { itemName: null }
    });
    expect(prisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceData: expect.objectContaining({ menuConfirmed: false })
        })
      })
    );
  });

  it("asks for a dish rather than reporting a conflict on a menu never saved", async () => {
    vi.mocked(prisma.eventMenu.findUnique).mockResolvedValue(null);

    const response = await POST(
      request("POST", { action: "confirm", version: 0 }),
      { params }
    );
    const payload = await response.json();

    // 409 here used to tell the user to reload a page already showing the truth.
    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/at least one/i);
  });

  it("refuses to confirm a menu with no dishes on it", async () => {
    vi.mocked(prisma.eventMenu.findUnique).mockResolvedValue({
      id: eventMenuId,
      version: 2,
      _count: { lines: 0 }
    } as never);

    const response = await POST(
      request("POST", { action: "confirm", version: 2 }),
      { params }
    );

    expect(response.status).toBe(400);
    expect(prisma.eventMenu.updateMany).not.toHaveBeenCalled();
  });

  it("keeps the timeline when it rewrites the confirmation flag", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue({
      id: eventId,
      hallId,
      workspaceData: { timeline: [{ id: "t1" }], timelineConfirmed: true },
      packageId: null,
      eventDate: new Date("2026-08-20T00:00:00.000Z"),
      eventType: "Wedding",
      clientName: "Gold",
      hall: { name: "Main Hall" }
    } as never);
    vi.mocked(prisma.eventMenu.findUnique)
      .mockResolvedValueOnce({
        id: eventMenuId,
        version: 2,
        _count: { lines: 1 }
      } as never)
      .mockResolvedValueOnce(
        storedMenu({ status: "Confirmed", version: 3 }) as never
      );

    await POST(request("POST", { action: "confirm", version: 2 }), { params });

    expect(prisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceData: {
            timeline: [{ id: "t1" }],
            timelineConfirmed: true,
            menuConfirmed: true
          }
        })
      })
    );
  });
});
