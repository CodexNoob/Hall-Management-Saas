import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz/authorize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authz/authorize")>()),
  authorize: vi.fn()
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    menuItem: { count: vi.fn() },
    eventPackage: { update: vi.fn() },
    $queryRaw: vi.fn()
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
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { id: packageId, includedMenuItemIds: [itemId] }
    ] as never);
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

/**
 * The other way to write the column: name the one item that moved and let the
 * database apply it to whatever is stored.
 *
 * This is what stops one click from undoing another. The whole-list form above
 * is built from a copy the caller fetched earlier, so of two that overlap in
 * time the second overwrites the first - on the same screen, or on someone
 * else's. What is asserted here is that the delta never reads the row first and
 * never falls back to replacing the list.
 */
describe("package item changes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authorize).mockResolvedValue(actor as never);
    vi.mocked(prisma.eventPackage.update).mockResolvedValue({
      id: packageId,
      name: "Renamed"
    } as never);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { id: packageId, includedMenuItemIds: [itemId, otherItemId] }
    ] as never);
  });

  it("adds one item without replacing the stored list", async () => {
    vi.mocked(prisma.menuItem.count).mockResolvedValue(1);

    const response = await PATCH(patchRequest({ addMenuItemIds: [itemId] }), {
      params
    });

    expect(response.status).toBe(200);
    expect(prisma.$queryRaw).toHaveBeenCalled();
    // The whole-list write is what loses a concurrent add; a delta must not
    // reach for it.
    expect(prisma.eventPackage.update).not.toHaveBeenCalled();
  });

  it("answers with the list the database ended up holding", async () => {
    vi.mocked(prisma.menuItem.count).mockResolvedValue(1);

    const response = await PATCH(patchRequest({ addMenuItemIds: [itemId] }), {
      params
    });

    // Not the id that was sent: the answer carries the other item too, which is
    // how a caller learns about the add that landed beside its own.
    await expect(response.json()).resolves.toEqual({
      package: { id: packageId, includedMenuItemIds: [itemId, otherItemId] }
    });
  });

  it("writes one statement, against the acting organization's row", async () => {
    vi.mocked(prisma.menuItem.count).mockResolvedValue(1);

    await PATCH(patchRequest({ addMenuItemIds: [itemId] }), { params });

    const [fragments] = vi.mocked(prisma.$queryRaw).mock
      .calls[0] as unknown as [string[]];
    const sql = fragments.join(" ");

    // Asserted as text because a mocked client cannot run it: what matters is
    // that the new value is computed inside the UPDATE - `array_cat` for the
    // additions, `EXCEPT` for the removals and the repeats - rather than
    // handed in from outside it.
    expect(sql).toContain("UPDATE");
    expect(sql).toContain("array_cat");
    expect(sql).toContain("EXCEPT");
    expect(sql).toContain("organization_id");
  });

  it("types the ids as the column does, which is text and not uuid", async () => {
    vi.mocked(prisma.menuItem.count).mockResolvedValue(1);

    await PATCH(
      patchRequest({
        addMenuItemIds: [itemId],
        removeMenuItemIds: [otherItemId]
      }),
      { params }
    );

    // `included_menu_item_ids` is `String[]` with no `@db.Uuid`, so Postgres
    // stores text. These ids look like uuids and are validated as such, which
    // is exactly why casting them to `uuid[]` here is an easy mistake - and one
    // no mocked client can catch except by reading the fragment back.
    const [, ...values] = vi.mocked(prisma.$queryRaw).mock
      .calls[0] as unknown as [string[], ...{ strings?: string[] }[]];
    const arrayFragments = values
      .filter((value) => Array.isArray(value?.strings))
      .map((value) => value.strings!.join(""));

    expect(arrayFragments.length).toBeGreaterThan(0);
    for (const fragment of arrayFragments) {
      expect(fragment).toContain("text[]");
      expect(fragment).not.toContain("uuid[]");
    }
  });

  it("checks an added id against this organization's menu", async () => {
    vi.mocked(prisma.menuItem.count).mockResolvedValue(0);

    const response = await PATCH(
      patchRequest({ addMenuItemIds: [otherItemId] }),
      { params }
    );

    expect(response.status).toBe(400);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("does not check the ids on the way out", async () => {
    const response = await PATCH(
      patchRequest({ removeMenuItemIds: [itemId] }),
      { params }
    );

    // An item being dropped need not still resolve. Refusing one that does not
    // would leave the package permanently holding it.
    expect(response.status).toBe(200);
    expect(prisma.menuItem.count).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it("answers 404 when no row of this organization's matched", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);

    const response = await PATCH(
      patchRequest({ removeMenuItemIds: [itemId] }),
      { params }
    );

    expect(response.status).toBe(404);
  });

  it("refuses a whole list and a change in the same request", async () => {
    const response = await PATCH(
      patchRequest({
        includedMenuItemIds: [itemId],
        addMenuItemIds: [otherItemId]
      }),
      { params }
    );

    // Either order of applying the two is a guess at what was meant.
    expect(response.status).toBe(400);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.eventPackage.update).not.toHaveBeenCalled();
  });

  it("still saves the other columns when a rename arrives with a change", async () => {
    const response = await PATCH(
      patchRequest({ name: "Renamed", removeMenuItemIds: [itemId] }),
      { params }
    );

    expect(response.status).toBe(200);
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.eventPackage.update).toHaveBeenCalledWith({
      where: { id: packageId, organizationId },
      data: { name: "Renamed" }
    });
  });
});
