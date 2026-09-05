import "server-only";

import { prisma } from "@/lib/prisma";
import {
  MENU_IMAGE_BUCKET,
  ORGANIZATION_LOGO_BUCKET
} from "@/lib/storage/buckets";
import { createSignedFileUrl, createSignedFileUrls } from "@/lib/storage/files";
import { decimalToCents } from "@/lib/ui/format-money";
import { resolvePortalHeaderColor } from "@/lib/ui/portal-header-theme";
import { isDrinkKind } from "@/features/menu/lib/service-style";
import type { ClientPortalLookup } from "@/features/events/types/client-portal";

export type {
  ClientPortalEvent,
  ClientPortalLookup,
  ClientPortalOption,
  ClientPortalTotals
} from "@/features/events/types/client-portal";
import { log } from "@/lib/logging/context";

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

/**
 * What the header needs out of `integrations.controlCenter.general`: the logo
 * uploaded in Settings > General, and the background chosen beside it.
 *
 * Narrow and local, the way /api/kitchen reads its own slice of the same
 * document: importing the settings route's zod schema here would drag a
 * request handler into the portal's data layer, and a settings document written
 * before either field existed simply has neither to find.
 */
function readHeaderBranding(integrations: unknown) {
  const general =
    integrations && typeof integrations === "object"
      ? (integrations as { controlCenter?: { general?: unknown } })
          .controlCenter?.general
      : undefined;
  const generalRecord =
    general && typeof general === "object"
      ? (general as {
          logoPath?: unknown;
          portalHeader?: {
            style?: unknown;
            color?: unknown;
            imagePath?: unknown;
          };
        })
      : {};
  const portalHeader = generalRecord.portalHeader ?? {};
  const readPath = (value: unknown) =>
    typeof value === "string" && value ? value : null;

  return {
    logoPath: readPath(generalRecord.logoPath),
    // The colour is painted whatever the style is: it is what sits behind an
    // image that has not finished loading, and what is left if signing it fails.
    color: resolvePortalHeaderColor(portalHeader.color),
    imagePath:
      portalHeader.style === "image" ? readPath(portalHeader.imagePath) : null
  };
}

/**
 * Every menu picture on the page in one call, or an empty map.
 *
 * Best effort: storage being unreachable should cost the pictures, not the
 * portal, so a failure is logged and the cards fall back to their placeholder.
 */
async function signMenuPictures(organizationId: string, paths: string[]) {
  if (paths.length === 0) return new Map<string, string>();

  try {
    return await createSignedFileUrls({
      organizationId,
      bucket: MENU_IMAGE_BUCKET,
      paths
    });
  } catch (signingError) {
    log.error(
      { count: paths.length, err: String(signingError) },
      "client_portal_menu_picture_signing_failed"
    );
    return new Map<string, string>();
  }
}

/**
 * One of the venue's branding images, signed on its own because they live in
 * their own bucket - batching them with the menu pictures above is not
 * possible, so all of them run side by side instead.
 *
 * Best effort for the same reason, and for one more: an image that cannot be
 * signed - an object removed behind the settings document, a path saved before
 * the current validation - must cost the header its picture and nothing else.
 */
async function signBrandingImage(
  organizationId: string,
  path: string | null,
  subject: string
) {
  if (!path) return null;

  try {
    return await createSignedFileUrl({
      organizationId,
      bucket: ORGANIZATION_LOGO_BUCKET,
      path
    });
  } catch (signingError) {
    log.error(
      { subject, err: String(signingError) },
      "client_portal_branding_signing_failed"
    );
    return null;
  }
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

  const [packages, menuItems, tablecloths, addOns, invoices, organization] =
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
        // `kind` splits the one query into the portal's two lists below; a
        // second round trip for drinks would read the same rows again.
        select: {
          id: true,
          name: true,
          category: true,
          kind: true,
          picturePath: true
        },
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
      }),
      // The venue's own name and logo, so the client can see whose portal this
      // is. The settings row is joined rather than read separately: it exists
      // only once /api/settings has been opened, and an organization that never
      // saved its settings still has a name to show.
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true, settings: { select: { integrations: true } } }
      })
    ]);

  const selectedMenuItemIds = new Set(event.menuItemIds);
  const selectedAddOnIds = new Set(event.addOnIds);
  const visiblePackages = packages.filter(
    (candidate) =>
      candidate.id === event.packageId &&
      appliesTo(candidate.hallIds, event.hallId) &&
      appliesTo(candidate.eventTypeIds, event.eventTypeId)
  );
  const visibleMenuItems = menuItems.filter((candidate) =>
    selectedMenuItemIds.has(candidate.id)
  );
  // Narrowed to this hall before signing rather than after: an add-on scoped
  // elsewhere never reaches the client, so minting a URL for its picture would
  // be a round trip for an object nobody can fetch.
  const visibleAddOns = addOns.filter(
    (candidate) =>
      selectedAddOnIds.has(candidate.id) &&
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
  // own objects.
  const picturePaths = [...visibleMenuItems, ...visibleAddOns]
    .map((candidate) => candidate.picturePath)
    .filter((path): path is string => Boolean(path));

  // Two buckets, so more than one call - but nothing on the page waits for
  // another.
  const headerBranding = readHeaderBranding(
    organization?.settings?.integrations
  );
  const [signedUrlsByPath, logoUrl, headerImageUrl] = await Promise.all([
    signMenuPictures(organizationId, picturePaths),
    signBrandingImage(organizationId, headerBranding.logoPath, "venue logo"),
    signBrandingImage(
      organizationId,
      headerBranding.imagePath,
      "header background"
    )
  ]);

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
      // Pinned to UTC like the date above: `startsAt` is a wall-clock time
      // anchored to UTC, and this string is rendered on the server, so an
      // unpinned formatter reads the HOST's zone - the client would be told a
      // time that depends on where the deployment runs.
      time: event.startsAt
        ? new Intl.DateTimeFormat("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "UTC"
          }).format(event.startsAt)
        : "Time not set",
      room: event.hall.name,
      // Empty only if the event outlived its organization row, which the
      // foreign key does not allow - the fallback is here so a null lookup
      // cannot take down the portal.
      venueName: organization?.name ?? "",
      logoUrl,
      headerColor: headerBranding.color,
      headerImageUrl,
      status: event.eventStatus.toLowerCase().includes("confirm")
        ? "Confirmed"
        : "Hold",
      couples: String(event.couplesCount),
      children: String(event.kidsCount + event.boysCount + event.girlsCount),
      menuConfirmed: readMenuConfirmed(event.workspaceData),
      packages: visiblePackages.map((candidate) => ({
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
        selected: true
      })),
      // Split by kind rather than served as one list. A guest choosing food and
      // a guest choosing what to drink are two questions, and the staff menu
      // has asked them separately since drinks got their own tab. Both halves
      // are still menu items, so a selection from either goes back in
      // `menuItemIds` and nothing downstream has to learn a new id list.
      menuItems: visibleMenuItems
        .filter((candidate) => !isDrinkKind(candidate.kind))
        .map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          description: candidate.category,
          priceCents: null,
          imageUrl: readImageUrl(candidate.picturePath),
          selected: true
        })),
      drinks: visibleMenuItems
        .filter((candidate) => isDrinkKind(candidate.kind))
        .map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          description: candidate.category,
          priceCents: null,
          imageUrl: readImageUrl(candidate.picturePath),
          selected: true
        })),
      tablecloths: tablecloths
        .filter((candidate) => candidate.id === event.tableclothId)
        .map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          description: candidate.colorOrDescription,
          // TableclothOption carries no price column; the portal used to invent one.
          priceCents: null,
          // Nor a picture column.
          imageUrl: null,
          selected: true
        })),
      addOns: visibleAddOns.map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        description: candidate.notes,
        priceCents: decimalToCents(candidate.price),
        imageUrl: readImageUrl(candidate.picturePath),
        selected: true
      })),
      totals
    }
  };
}
