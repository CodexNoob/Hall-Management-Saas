import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/storage/files", () => ({ createSignedFileUrls: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findFirst: vi.fn() },
    eventPackage: { findMany: vi.fn() },
    menuItem: { findMany: vi.fn() },
    tableclothOption: { findMany: vi.fn() },
    addOn: { findMany: vi.fn() },
    invoice: { findMany: vi.fn() }
  }
}));

import { getClientPortalEvent } from "@/features/events/server/client-portal-data";
import { prisma } from "@/lib/prisma";
import { MENU_IMAGE_BUCKET } from "@/lib/storage/buckets";
import { createSignedFileUrls } from "@/lib/storage/files";

const eventId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const hallId = "11111111-1111-4111-8111-111111111111";
const otherHallId = "22222222-2222-4222-8222-222222222222";
const dishPicturePath = `${organizationId}/menu/brisket.jpg`;
const signedUrl = "https://storage.example/signed/brisket.jpg?token=abc";
const addOnPicturePath = `${organizationId}/menu/coffee-station.jpg`;
const addOnSignedUrl =
  "https://storage.example/signed/coffee-station.jpg?token=def";

const baseEvent = {
  id: eventId,
  organizationId,
  clientName: "Charles",
  eventType: "Wedding",
  eventDate: new Date("2026-08-12T00:00:00.000Z"),
  startsAt: null,
  eventStatus: "Confirmed",
  couplesCount: 2,
  boysCount: 1,
  girlsCount: 1,
  kidsCount: 3,
  hallId,
  eventTypeId: null,
  packageId: null,
  tableclothId: null,
  menuItemIds: [],
  addOnIds: [],
  isMemberRate: false,
  workspaceData: null,
  hall: { name: "Main Hall" }
};

describe("client portal data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.event.findFirst).mockResolvedValue(baseEvent as never);
    vi.mocked(prisma.eventPackage.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.menuItem.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.tableclothOption.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.addOn.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([] as never);
    vi.mocked(createSignedFileUrls).mockResolvedValue(
      new Map([
        [dishPicturePath, signedUrl],
        [addOnPicturePath, addOnSignedUrl]
      ])
    );
  });

  it("returns null for an unknown event", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue(null);

    await expect(getClientPortalEvent(eventId)).resolves.toBeNull();
  });

  it("keeps the tenant id out of the portal payload", async () => {
    const lookup = await getClientPortalEvent(eventId);

    // The portal object ships to unauthenticated browsers, so the tenant id is
    // returned alongside it rather than inside it.
    expect(lookup?.organizationId).toBe(organizationId);
    expect(lookup?.portal).not.toHaveProperty("organizationId");
  });

  it("scopes every option lookup to the organization on the event row", async () => {
    await getClientPortalEvent(eventId);

    for (const model of [
      prisma.eventPackage.findMany,
      prisma.menuItem.findMany,
      prisma.tableclothOption.findMany,
      prisma.addOn.findMany
    ]) {
      expect(model).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId, isActive: true })
        })
      );
    }
  });

  it("excludes options scoped to a different hall", async () => {
    vi.mocked(prisma.addOn.findMany).mockResolvedValue([
      {
        id: "add-on-here",
        name: "Coffee station",
        notes: null,
        price: "350.00",
        hallIds: [hallId]
      },
      {
        id: "add-on-elsewhere",
        name: "Other hall only",
        notes: null,
        price: "100.00",
        hallIds: [otherHallId]
      },
      {
        id: "add-on-everywhere",
        name: "Applies anywhere",
        notes: null,
        price: "50.00",
        hallIds: []
      }
    ] as never);

    const portal = (await getClientPortalEvent(eventId))?.portal;

    expect(portal?.addOns.map((option) => option.id)).toEqual([
      "add-on-here",
      "add-on-everywhere"
    ]);
    expect(portal?.addOns[0].priceCents).toBe(35_000);
  });

  it("uses the member price only for member-rate events", async () => {
    vi.mocked(prisma.eventPackage.findMany).mockResolvedValue([
      {
        id: "package-1",
        name: "Gold dinner",
        notes: null,
        regularPrice: "3500.00",
        memberPrice: "3000.00",
        hallIds: [],
        eventTypeIds: []
      }
    ] as never);

    const regular = (await getClientPortalEvent(eventId))?.portal;
    expect(regular?.packages[0].priceCents).toBe(350_000);

    vi.mocked(prisma.event.findFirst).mockResolvedValue({
      ...baseEvent,
      isMemberRate: true
    } as never);

    const member = (await getClientPortalEvent(eventId))?.portal;
    expect(member?.packages[0].priceCents).toBe(300_000);
  });

  it("reports no price for tablecloths, which carry none in the schema", async () => {
    vi.mocked(prisma.tableclothOption.findMany).mockResolvedValue([
      { id: "linen-1", name: "Ivory linen", colorOrDescription: "Ivory" }
    ] as never);

    const portal = (await getClientPortalEvent(eventId))?.portal;

    expect(portal?.tablecloths[0]).toMatchObject({
      name: "Ivory linen",
      priceCents: null
    });
  });

  it("omits totals when the event has no invoice rather than inventing one", async () => {
    const portal = (await getClientPortalEvent(eventId))?.portal;

    expect(portal?.totals).toBeNull();
  });

  it("sums non-void invoices for the total and balance", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      { totalCents: 500_000, balanceDueCents: 200_000, currency: "USD" },
      { totalCents: 52_000, balanceDueCents: 0, currency: "USD" }
    ] as never);

    const portal = (await getClientPortalEvent(eventId))?.portal;

    expect(portal?.totals).toEqual({
      currency: "USD",
      totalCents: 552_000,
      balanceDueCents: 200_000
    });
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId, voidedAt: null })
      })
    );
  });

  it("signs every picture on the page in one call", async () => {
    vi.mocked(prisma.menuItem.findMany).mockResolvedValue([
      {
        id: "dish-with-picture",
        name: "Brisket",
        category: "Main",
        picturePath: dishPicturePath
      },
      {
        id: "dish-without-picture",
        name: "Garden salad",
        category: "Starter",
        picturePath: null
      }
    ] as never);
    vi.mocked(prisma.addOn.findMany).mockResolvedValue([
      {
        id: "add-on-with-picture",
        name: "Coffee station",
        notes: null,
        price: "350.00",
        hallIds: [],
        picturePath: addOnPicturePath
      },
      {
        id: "add-on-without-picture",
        name: "Extra hour",
        notes: null,
        price: "100.00",
        hallIds: [],
        picturePath: null
      }
    ] as never);

    const portal = (await getClientPortalEvent(eventId))?.portal;

    // Dishes and add-ons share the bucket and the tenant prefix, so they are one
    // request, not two. Scoped to the organization off the event row - the
    // portal is unauthenticated, so nothing here comes from a caller.
    expect(createSignedFileUrls).toHaveBeenCalledTimes(1);
    expect(createSignedFileUrls).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        bucket: MENU_IMAGE_BUCKET,
        paths: [dishPicturePath, addOnPicturePath]
      })
    );
    expect(portal?.menuItems[0].imageUrl).toBe(signedUrl);
    expect(portal?.addOns[0].imageUrl).toBe(addOnSignedUrl);
    // A row with no picture is null, not a broken URL.
    expect(portal?.menuItems[1].imageUrl).toBeNull();
    expect(portal?.addOns[1].imageUrl).toBeNull();
    // The stored paths are the one value that would let an anonymous visitor
    // address the objects directly, so they must not travel with the payload.
    expect(JSON.stringify(portal)).not.toContain(dishPicturePath);
    expect(JSON.stringify(portal)).not.toContain(addOnPicturePath);
  });

  it("does not sign a picture on an add-on scoped to another hall", async () => {
    vi.mocked(prisma.addOn.findMany).mockResolvedValue([
      {
        id: "add-on-elsewhere",
        name: "Other hall only",
        notes: null,
        price: "100.00",
        hallIds: [otherHallId],
        picturePath: addOnPicturePath
      }
    ] as never);

    const portal = (await getClientPortalEvent(eventId))?.portal;

    // The add-on never reaches this client, so its picture is not worth a round
    // trip to storage.
    expect(createSignedFileUrls).not.toHaveBeenCalled();
    expect(portal?.addOns).toHaveLength(0);
  });

  it("skips signing entirely when nothing on the page has a picture", async () => {
    vi.mocked(prisma.menuItem.findMany).mockResolvedValue([
      {
        id: "dish-without-picture",
        name: "Garden salad",
        category: "Starter",
        picturePath: null
      }
    ] as never);

    const portal = (await getClientPortalEvent(eventId))?.portal;

    expect(createSignedFileUrls).not.toHaveBeenCalled();
    expect(portal?.menuItems[0].imageUrl).toBeNull();
  });

  it("still serves the portal when signing fails", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.menuItem.findMany).mockResolvedValue([
      {
        id: "dish-with-picture",
        name: "Brisket",
        category: "Main",
        picturePath: dishPicturePath
      }
    ] as never);
    vi.mocked(createSignedFileUrls).mockRejectedValue(
      new Error("storage unreachable")
    );

    const portal = (await getClientPortalEvent(eventId))?.portal;

    // Storage being down costs the pictures, not the client's ability to pick
    // a menu.
    expect(portal?.menuItems).toHaveLength(1);
    expect(portal?.menuItems[0].imageUrl).toBeNull();
    expect(logged).toHaveBeenCalled();

    logged.mockRestore();
  });

  it("reports no picture for the models that store none", async () => {
    // Packages and tablecloths have no picture column in the schema, so their
    // options report null rather than being left undefined for the card to
    // guess at.
    vi.mocked(prisma.tableclothOption.findMany).mockResolvedValue([
      { id: "linen-1", name: "Ivory linen", colorOrDescription: "Ivory" }
    ] as never);
    vi.mocked(prisma.eventPackage.findMany).mockResolvedValue([
      {
        id: "package-1",
        name: "Gold dinner",
        notes: null,
        regularPrice: "3500.00",
        memberPrice: null,
        hallIds: [],
        eventTypeIds: []
      }
    ] as never);

    const portal = (await getClientPortalEvent(eventId))?.portal;

    expect(portal?.packages[0].imageUrl).toBeNull();
    expect(portal?.tablecloths[0].imageUrl).toBeNull();
  });

  it("marks the menu locked once staff confirmed it", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue({
      ...baseEvent,
      workspaceData: { menuConfirmed: true }
    } as never);

    const portal = (await getClientPortalEvent(eventId))?.portal;

    expect(portal?.menuConfirmed).toBe(true);
  });
});
