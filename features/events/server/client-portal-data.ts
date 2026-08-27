import "server-only";

import { prisma } from "@/lib/prisma";
import { MENU_IMAGE_BUCKET } from "@/lib/storage/buckets";
import { createSignedFileUrls } from "@/lib/storage/files";
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
 * 3. Pictures leave as expiring signed URLs, never as storage paths. A path is
 *    an address an anonymous visitor could keep and reuse; a signed URL is a
 *    view of one object that stops working on its own.
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
        // `pictureBucket` is deliberately not read: every stored picture lives
        // in MENU_IMAGE_BUCKET by construction, and the client is handed a
        // signed URL rather than a location - the same contract GET /api/menu
        // holds for the staff grid.
        select: { id: true, name: true, category: true, picturePath: true },
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
          hallIds: true,
          // Same pair as the menu items above, and dropped from the payload the
          // same way: the bucket is a constant on this side, and the path is
          // exchanged for a signed URL before anything ships.
          picturePath: true
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
  // Narrowed to this hall before signing rather than after: an add-on scoped
  // elsewhere never reaches the client, so minting a URL for its picture would
  // be a round trip for an object nobody can fetch.
  const visibleAddOns = addOns.filter((candidate) =>
    appliesTo(candidate.hallIds, event.hallId)
  );

  // One batch call for every picture on the page rather than one per card, with
  // add-ons riding along: they live in the same bucket under the same tenant
  // prefix, so splitting them out would only cost a second round trip - the
  // same trade GET /api/menu makes for the staff grid.
  //
  // Signed rather than public because the bucket is private, and signed with
  // the service client even though the caller is anonymous: `organizationId`
  // comes off the event row, so these URLs can only ever address this tenant's
  // own objects. Best effort - storage being unreachable should cost the
  // pictures, not the portal.
  let signedUrlsByPath = new Map<string, string>();
  const picturePaths = [...menuItems, ...visibleAddOns]
    .map((candidate) => candidate.picturePath)
    .filter((path): path is string => Boolean(path));

  if (picturePaths.length > 0) {
    try {
      signedUrlsByPath = await createSignedFileUrls({
        organizationId,
        bucket: MENU_IMAGE_BUCKET,
        paths: picturePaths
      });
    } catch (signingError) {
      console.error("Failed to sign client portal menu pictures", signingError);
    }
  }

  // Null on a row that stores no picture, and also on one whose object went
  // missing between the database and the bucket: `createSignedFileUrls` omits
  // the paths it could not sign, so one deleted file blanks one card instead of
  // the whole section.
  const readImageUrl = (picturePath: string | null) =>
    picturePath ? (signedUrlsByPath.get(picturePath) ?? null) : null;

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
          // EventPackage stores no picture column.
          imageUrl: null,
          selected: candidate.id === event.packageId
        })),
      menuItems: menuItems.map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        description: candidate.category,
        priceCents: null,
        imageUrl: readImageUrl(candidate.picturePath),
        selected: selectedMenuItemIds.has(candidate.id)
      })),
      tablecloths: tablecloths.map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        description: candidate.colorOrDescription,
        // TableclothOption carries no price column; the portal used to invent one.
        priceCents: null,
        // Nor a picture column.
        imageUrl: null,
        selected: candidate.id === event.tableclothId
      })),
      addOns: visibleAddOns.map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        description: candidate.notes,
        priceCents: decimalToCents(candidate.price),
        imageUrl: readImageUrl(candidate.picturePath),
        selected: selectedAddOnIds.has(candidate.id)
      })),
      totals
    }
  };
}
