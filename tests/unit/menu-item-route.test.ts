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
    event: { count: vi.fn() },
    eventMenuLine: { count: vi.fn() },
    eventPackage: { count: vi.fn() }
  }
}));

import { DELETE, PATCH } from "@/app/api/menu/items/[itemId]/route";
import { authorize } from "@/lib/authz/authorize";
import { prisma } from "@/lib/prisma";
import { MENU_IMAGE_BUCKET } from "@/lib/storage/buckets";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherOrganizationId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const itemId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const actor = {
  id: "22222222-2222-4222-8222-222222222222",
  organizationId
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
      picturePath: null,
      _count: { kitchenItemStatuses: 0 }
    } as never);
    vi.mocked(prisma.menuItem.update).mockResolvedValue({
      id: itemId
    } as never);
    vi.mocked(prisma.menuItem.delete).mockResolvedValue({
      id: itemId
    } as never);
    vi.mocked(prisma.event.count).mockResolvedValue(0);
    vi.mocked(prisma.eventMenuLine.count).mockResolvedValue(0);
    vi.mocked(prisma.eventPackage.count).mockResolvedValue(0);
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

  it("refuses to delete an item an event still references", async () => {
    vi.mocked(prisma.event.count).mockResolvedValue(1);

    const response = await DELETE(deleteRequest(), { params });

    expect(response.status).toBe(409);
    expect(prisma.menuItem.delete).not.toHaveBeenCalled();
  });

  it("refuses to delete an item still on an event menu", async () => {
    vi.mocked(prisma.eventMenuLine.count).mockResolvedValue(1);

    const response = await DELETE(deleteRequest(), { params });

    // The foreign key would refuse this anyway; the count is what turns that
    // into an error the caller can read instead of a constraint violation.
    expect(response.status).toBe(409);
    expect(prisma.menuItem.delete).not.toHaveBeenCalled();
  });

  it("refuses to delete an item a package still includes", async () => {
    vi.mocked(prisma.eventPackage.count).mockResolvedValue(2);

    const response = await DELETE(deleteRequest(), { params });

    expect(response.status).toBe(409);
    expect(prisma.menuItem.delete).not.toHaveBeenCalled();
  });

  it("refuses to delete an item a kitchen sheet still tracks", async () => {
    vi.mocked(prisma.menuItem.findFirst).mockResolvedValue({
      id: itemId,
      picturePath: null,
      _count: { kitchenItemStatuses: 3 }
    } as never);

    const response = await DELETE(deleteRequest(), { params });

    expect(response.status).toBe(409);
    expect(prisma.menuItem.delete).not.toHaveBeenCalled();
  });

  it("deletes an unreferenced item and its stored picture", async () => {
    const picturePath = `${organizationId}/menu/abc.jpg`;
    vi.mocked(prisma.menuItem.findFirst).mockResolvedValue({
      id: itemId,
      picturePath,
      _count: { kitchenItemStatuses: 0 }
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
      picturePath: `${organizationId}/menu/abc.jpg`,
      _count: { kitchenItemStatuses: 0 }
    } as never);
    storageMocks.remove.mockRejectedValue(new Error("storage down"));

    const response = await DELETE(deleteRequest(), { params });

    expect(response.status).toBe(200);
    expect(prisma.menuItem.delete).toHaveBeenCalled();
  });
});
