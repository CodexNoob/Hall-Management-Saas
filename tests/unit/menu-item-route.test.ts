import { beforeEach, describe, expect, it, vi } from "vitest";

const storageMocks = vi.hoisted(() => ({
  remove: vi.fn(),
  from: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: vi.fn(() => ({
    storage: { from: storageMocks.from }
  }))
}));
vi.mock("@/lib/authz/authorize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authz/authorize")>()),
  authorize: vi.fn()
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    menuItem: { findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
    menuCategory: { findFirst: vi.fn(), create: vi.fn() },
    event: { findMany: vi.fn() },
    eventMenuLine: { findMany: vi.fn() },
    eventPackage: { findMany: vi.fn() },
    kitchenItemStatus: { findMany: vi.fn() }
  }
}));

import { DELETE, PATCH } from "@/app/api/menu/items/[itemId]/route";
import { authorize } from "@/lib/authz/authorize";
import { prisma } from "@/lib/prisma";
import { MENU_IMAGE_BUCKET } from "@/lib/storage/buckets";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherOrganizationId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const itemId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const packageId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const actor = {
  id: "22222222-2222-4222-8222-222222222222",
  organizationId
};

/**
 * One event holding the item, in the shape all three blocking lookups select.
 *
 * UTC midnight because `event_date` is a DATE column: Prisma reads it back that
 * way, and the label slices the ISO string rather than formatting a local date.
 */
const blockingEvent = {
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  clientName: "Cohen",
  eventDate: new Date("2026-03-04T00:00:00.000Z")
};

const params = Promise.resolve({ itemId });

function patchRequest(body: Record<string, unknown>) {
  return new Request(`http://localhost/api/menu/items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

function deleteRequest() {
  return new Request(`http://localhost/api/menu/items/${itemId}`, {
    method: "DELETE"
  });
}

describe("menu item update and delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMocks.from.mockReturnValue({ remove: storageMocks.remove });
    storageMocks.remove.mockResolvedValue({ data: [], error: null });
    vi.mocked(authorize).mockResolvedValue(actor as never);
    vi.mocked(prisma.menuItem.findFirst).mockResolvedValue({
      id: itemId,
      picturePath: null
    } as never);
    vi.mocked(prisma.menuItem.update).mockResolvedValue({
      id: itemId
    } as never);
    vi.mocked(prisma.menuItem.delete).mockResolvedValue({
      id: itemId
    } as never);
    vi.mocked(prisma.event.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.eventMenuLine.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.eventPackage.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.kitchenItemStatus.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.menuCategory.findFirst).mockResolvedValue(null);
  });

  it("answers 404 for an item belonging to another organization", async () => {
    vi.mocked(prisma.menuItem.findFirst).mockResolvedValue(null);

    const response = await PATCH(patchRequest({ name: "Renamed" }), { params });

    expect(response.status).toBe(404);
    expect(prisma.menuItem.update).not.toHaveBeenCalled();
  });

  it("rejects a picture path belonging to another tenant", async () => {
    const response = await PATCH(
      patchRequest({ picturePath: `${otherOrganizationId}/menu/stolen.jpg` }),
      { params }
    );

    expect(response.status).toBe(400);
    expect(prisma.menuItem.update).not.toHaveBeenCalled();
  });

  it("sets the bucket from the server when a new picture is stored", async () => {
    const picturePath = `${organizationId}/menu/new.jpg`;

    const response = await PATCH(
      patchRequest({
        name: "Renamed",
        picturePath,
        pictureBucket: "event-files"
      }),
      { params }
    );

    expect(response.status).toBe(200);
    expect(prisma.menuItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Renamed",
          picturePath,
          pictureBucket: MENU_IMAGE_BUCKET
        })
      })
    );
  });

  it("removes the previous object once a replacement picture is stored", async () => {
    const previousPath = `${organizationId}/menu/old.jpg`;
    vi.mocked(prisma.menuItem.findFirst).mockResolvedValue({
      id: itemId,
      picturePath: previousPath
    } as never);

    await PATCH(
      patchRequest({ picturePath: `${organizationId}/menu/new.jpg` }),
      { params }
    );

    expect(storageMocks.from).toHaveBeenCalledWith(MENU_IMAGE_BUCKET);
    expect(storageMocks.remove).toHaveBeenCalledWith([previousPath]);
  });

  it("leaves the stored picture alone when the path is not part of the edit", async () => {
    vi.mocked(prisma.menuItem.findFirst).mockResolvedValue({
      id: itemId,
      picturePath: `${organizationId}/menu/old.jpg`
    } as never);

    await PATCH(patchRequest({ name: "Renamed" }), { params });

    expect(prisma.menuItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ pictureBucket: expect.anything() })
      })
    );
    expect(storageMocks.remove).not.toHaveBeenCalled();
  });

  it("refuses to delete an item an event still references, and names it", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([
      blockingEvent
    ] as never);

    const response = await DELETE(deleteRequest(), { params });
    const payload = await response.json();

    expect(response.status).toBe(409);
    // The list is the point: "used somewhere" leaves the operator with nothing
    // to open, which is what sent them here in the first place.
    expect(payload.details).toEqual(["Event: Cohen (2026-03-04)"]);
    expect(prisma.menuItem.delete).not.toHaveBeenCalled();
  });

  it("refuses to delete an item still on an event menu", async () => {
    vi.mocked(prisma.eventMenuLine.findMany).mockResolvedValue([
      { eventMenu: { event: blockingEvent } }
    ] as never);

    const response = await DELETE(deleteRequest(), { params });

    // The foreign key would refuse this anyway; the lookup is what turns that
    // into an error the caller can read instead of a constraint violation.
    expect(response.status).toBe(409);
    expect(prisma.menuItem.delete).not.toHaveBeenCalled();
  });

  it("refuses to delete an item a package still includes", async () => {
    vi.mocked(prisma.eventPackage.findMany).mockResolvedValue([
      { id: packageId, name: "Shabbos Deluxe" }
    ] as never);

    const response = await DELETE(deleteRequest(), { params });
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.details).toEqual(["Package: Shabbos Deluxe"]);
    expect(prisma.menuItem.delete).not.toHaveBeenCalled();
  });

  it("refuses to delete an item a kitchen sheet still tracks", async () => {
    vi.mocked(prisma.kitchenItemStatus.findMany).mockResolvedValue([
      { event: blockingEvent }
    ] as never);

    const response = await DELETE(deleteRequest(), { params });

    expect(response.status).toBe(409);
    expect(prisma.menuItem.delete).not.toHaveBeenCalled();
  });

  it("names an event holding the item three ways only once", async () => {
    // A dish on a menu is normally mirrored onto the event and carries a
    // kitchen row too. Listing the same event three times would read as three
    // places to go and clear.
    vi.mocked(prisma.eventMenuLine.findMany).mockResolvedValue([
      { eventMenu: { event: blockingEvent } }
    ] as never);
    vi.mocked(prisma.event.findMany).mockResolvedValue([
      blockingEvent
    ] as never);
    vi.mocked(prisma.kitchenItemStatus.findMany).mockResolvedValue([
      { event: blockingEvent }
    ] as never);

    const payload = await (await DELETE(deleteRequest(), { params })).json();

    expect(payload.details).toEqual(["Event: Cohen (2026-03-04)"]);
  });

  it("counts the blockers it does not list", async () => {
    vi.mocked(prisma.eventPackage.findMany).mockResolvedValue(
      Array.from({ length: 11 }, (_, index) => ({
        id: `${index}`,
        name: `Package ${index}`
      })) as never
    );

    const payload = await (await DELETE(deleteRequest(), { params })).json();

    // Eight named, and the rest counted rather than dropped: a silently
    // truncated list reads as the whole list.
    expect(payload.details).toHaveLength(9);
    expect(payload.details.at(-1)).toBe("and 3 more");
  });

  it("deletes an unreferenced item and its stored picture", async () => {
    const picturePath = `${organizationId}/menu/abc.jpg`;
    vi.mocked(prisma.menuItem.findFirst).mockResolvedValue({
      id: itemId,
      picturePath
    } as never);

    const response = await DELETE(deleteRequest(), { params });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true });
    expect(prisma.menuItem.delete).toHaveBeenCalledWith({
      where: { id: itemId }
    });
    expect(storageMocks.remove).toHaveBeenCalledWith([picturePath]);
  });

  it("still reports the delete when storage cleanup fails", async () => {
    vi.mocked(prisma.menuItem.findFirst).mockResolvedValue({
      id: itemId,
      picturePath: `${organizationId}/menu/abc.jpg`
    } as never);
    storageMocks.remove.mockRejectedValue(new Error("storage down"));

    const response = await DELETE(deleteRequest(), { params });

    expect(response.status).toBe(200);
    expect(prisma.menuItem.delete).toHaveBeenCalled();
  });
});
