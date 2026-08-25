import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz/authorize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authz/authorize")>()),
  authorize: vi.fn()
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    menuItem: { count: vi.fn() },
    eventPackage: { update: vi.fn() }
  }
}));

import { PATCH } from "@/app/api/menu/packages/[packageId]/route";
import { authorize } from "@/lib/authz/authorize";
import { prisma } from "@/lib/prisma";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const packageId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const itemId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const otherItemId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const actor = {
  id: "22222222-2222-4222-8222-222222222222",
  organizationId
};

const params = Promise.resolve({ packageId });

function patchRequest(body: Record<string, unknown>) {
  return new Request(`http://localhost/api/menu/packages/${packageId}`, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

/**
 * `packages.included_menu_item_ids` is a uuid[] and not a foreign key, so these
 * cover the integrity the database cannot: what goes into that column has to be
 * this organization's menu items, and each of them once.
 */
describe("package item membership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authorize).mockResolvedValue(actor as never);
    vi.mocked(prisma.eventPackage.update).mockResolvedValue({
      id: packageId
    } as never);
  });

  it("requires permission to edit the menu", async () => {
    vi.mocked(prisma.menuItem.count).mockResolvedValue(1);

    await PATCH(patchRequest({ includedMenuItemIds: [itemId] }), { params });

    expect(authorize).toHaveBeenCalledWith(expect.anything(), "menu.update");
  });

  it("stores the items and scopes the write to the acting organization", async () => {
    vi.mocked(prisma.menuItem.count).mockResolvedValue(2);

    const response = await PATCH(
      patchRequest({ includedMenuItemIds: [itemId, otherItemId] }),
      { params }
    );

    expect(response.status).toBe(200);
    expect(prisma.eventPackage.update).toHaveBeenCalledWith({
      where: { id: packageId, organizationId },
      data: { includedMenuItemIds: [itemId, otherItemId] }
    });
  });

  it("refuses an item that is not in this organization's menu", async () => {
    // One id sent, nothing matched: the item belongs to another tenant, or to
    // no row at all.
    vi.mocked(prisma.menuItem.count).mockResolvedValue(0);

    const response = await PATCH(
      patchRequest({ includedMenuItemIds: [otherItemId] }),
      { params }
    );

    expect(response.status).toBe(400);
    expect(prisma.menuItem.count).toHaveBeenCalledWith({
      where: { organizationId, id: { in: [otherItemId] } }
    });
    expect(prisma.eventPackage.update).not.toHaveBeenCalled();
  });

  it("refuses the whole list when only some of the ids resolve", async () => {
    vi.mocked(prisma.menuItem.count).mockResolvedValue(1);

    const response = await PATCH(
      patchRequest({ includedMenuItemIds: [itemId, otherItemId] }),
      { params }
    );

    expect(response.status).toBe(400);
    expect(prisma.eventPackage.update).not.toHaveBeenCalled();
  });

  it("collapses a repeated id so the package cannot include it twice", async () => {
    vi.mocked(prisma.menuItem.count).mockResolvedValue(1);

    const response = await PATCH(
      patchRequest({ includedMenuItemIds: [itemId, itemId] }),
      { params }
    );

    // The count of 1 has to be enough for the two ids that were sent, which it
    // only is because they were deduplicated before the lookup.
    expect(response.status).toBe(200);
    expect(prisma.eventPackage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { includedMenuItemIds: [itemId] } })
    );
  });

  it("empties a package without looking anything up", async () => {
    const response = await PATCH(patchRequest({ includedMenuItemIds: [] }), {
      params
    });

    expect(response.status).toBe(200);
    expect(prisma.menuItem.count).not.toHaveBeenCalled();
    expect(prisma.eventPackage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { includedMenuItemIds: [] } })
    );
  });

  it("leaves the stored items alone when the edit does not mention them", async () => {
    const response = await PATCH(patchRequest({ name: "Renamed" }), { params });

    expect(response.status).toBe(200);
    expect(prisma.menuItem.count).not.toHaveBeenCalled();
    expect(prisma.eventPackage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: "Renamed" } })
    );
  });

  it("rejects an id that is not a uuid before it reaches the database", async () => {
    const response = await PATCH(
      patchRequest({ includedMenuItemIds: ["not-a-uuid"] }),
      { params }
    );

    expect(response.status).toBe(400);
    expect(prisma.menuItem.count).not.toHaveBeenCalled();
    expect(prisma.eventPackage.update).not.toHaveBeenCalled();
  });
});
