import "server-only";

import { prisma } from "@/lib/prisma";
import { decimalToCents } from "@/lib/ui/format-money";
import type { ClientPortalLookup } from "@/features/events/types/client-portal";

export type {
  ClientPortalEvent,
  ClientPortalLookup,
  ClientPortalOption,
  ClientPortalTotals
} from "@/features/events/types/client-portal";

/**
 * Data access for the public client portal at /client/[eventId].
 *
 * Two rules shape this module:
 *
 * 1. The organization is derived from the event row, never from the caller.
 *    The portal is unauthenticated, so `eventId` is the only input and every
 *    subsequent query is scoped by the `organizationId` it resolves to.
 * 2. It returns a minimal DTO. The portal used to render hardcoded prices next
 *    to real client data; now it renders real options, but only the fields a
 *    client is meant to see - no internal notes, costs, or staff fields.
 */

/** Empty `hallIds`/`eventTypeIds` means "applies everywhere". */
function appliesTo(scope: string[], candidate: string | null) {
  if (scope.length === 0) return true;

  return candidate !== null && scope.includes(candidate);
}

function readMenuConfirmed(workspaceData: unknown) {
  return (
    typeof workspaceData === "object" &&
    workspaceData !== null &&
    (workspaceData as { menuConfirmed?: unknown }).menuConfirmed === true
  );
}

export async function getClientPortalEvent(
  eventId: string
): Promise<ClientPortalLookup | null> {
  const event = await prisma.event.findFirst({
    where: { id: eventId, deleted: false },
    select: {
      id: true,
      organizationId: true,
      clientName: true,
      eventType: true,
      eventDate: true,
      startsAt: true,
      eventStatus: true,
      couplesCount: true,
      boysCount: true,
      girlsCount: true,
      kidsCount: true,
      hallId: true,
      eventTypeId: true,
      packageId: true,
      tableclothId: true,
      menuItemIds: true,
      addOnIds: true,
      isMemberRate: true,
      workspaceData: true,
      hall: { select: { name: true } }
    }
  });

  if (!event) return null;

  const { organizationId } = event;

  const [packages, menuItems, tablecloths, addOns, invoices] =
    await Promise.all([
      prisma.eventPackage.findMany({
        where: { organizationId, isActive: true },
        select: {
          id: true,
          name: true,
          notes: true,
          regularPrice: true,
          memberPrice: true,
          hallIds: true,
          eventTypeIds: true
        },
        orderBy: { name: "asc" }
      }),
      prisma.menuItem.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, name: true, category: true },
        orderBy: { name: "asc" }
      }),
      prisma.tableclothOption.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, name: true, colorOrDescription: true },
        orderBy: { name: "asc" }
      }),
      prisma.addOn.findMany({
        where: { organizationId, isActive: true },
        select: {
          id: true,
          name: true,
          notes: true,
          price: true,
          hallIds: true
        },
        orderBy: { name: "asc" }
      }),
      prisma.invoice.findMany({
        where: { eventId: event.id, organizationId, voidedAt: null },
        select: { totalCents: true, balanceDueCents: true, currency: true }
      })
    ]);

  const selectedMenuItemIds = new Set(event.menuItemIds);
  const selectedAddOnIds = new Set(event.addOnIds);

  const totals = invoices.length
    ? {
        currency: invoices[0].currency,
        totalCents: invoices.reduce(
          (sum, invoice) => sum + invoice.totalCents,
          0
        ),
        balanceDueCents: invoices.reduce(
          (sum, invoice) => sum + invoice.balanceDueCents,
          0
        )
      }
    : null;

  return {
    organizationId,
    portal: {
      id: event.id,
      title: `${event.clientName}${event.eventType ? ` ${event.eventType}` : ""}`,
      date: new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC"
      }).format(event.eventDate),
      time: event.startsAt
        ? new Intl.DateTimeFormat("en-US", {
            hour: "numeric",
            minute: "2-digit"
          }).format(event.startsAt)
        : "Time not set",
      room: event.hall.name,
      status: event.eventStatus.toLowerCase().includes("confirm")
        ? "Confirmed"
        : "Hold",
      couples: String(event.couplesCount),
      children: String(event.kidsCount + event.boysCount + event.girlsCount),
      menuConfirmed: readMenuConfirmed(event.workspaceData),
      packages: packages
        .filter(
          (candidate) =>
            appliesTo(candidate.hallIds, event.hallId) &&
            appliesTo(candidate.eventTypeIds, event.eventTypeId)
        )
        .map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          description: candidate.notes,
          priceCents: decimalToCents(
            event.isMemberRate
              ? (candidate.memberPrice ?? candidate.regularPrice)
              : candidate.regularPrice
          ),
          selected: candidate.id === event.packageId
        })),
      menuItems: menuItems.map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        description: candidate.category,
        priceCents: null,
        selected: selectedMenuItemIds.has(candidate.id)
      })),
      tablecloths: tablecloths.map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        description: candidate.colorOrDescription,
        // TableclothOption carries no price column; the portal used to invent one.
        priceCents: null,
        selected: candidate.id === event.tableclothId
      })),
      addOns: addOns
        .filter((candidate) => appliesTo(candidate.hallIds, event.hallId))
        .map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          description: candidate.notes,
          priceCents: decimalToCents(candidate.price),
          selected: selectedAddOnIds.has(candidate.id)
        })),
      totals
    }
  };
}
