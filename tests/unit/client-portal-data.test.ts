import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
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

const eventId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const hallId = "11111111-1111-4111-8111-111111111111";
const otherHallId = "22222222-2222-4222-8222-222222222222";

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

  it("marks the menu locked once staff confirmed it", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue({
      ...baseEvent,
      workspaceData: { menuConfirmed: true }
    } as never);

    const portal = (await getClientPortalEvent(eventId))?.portal;

    expect(portal?.menuConfirmed).toBe(true);
  });
});
