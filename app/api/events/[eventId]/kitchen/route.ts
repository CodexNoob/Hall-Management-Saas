import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildKitchenSheet,
  collectPicturePaths,
  eventSelect,
  kitchenMenuSelect,
  mealSchema,
  statusSelect,
  type KitchenLineRow
} from "@/features/kitchen/server/kitchen-sheet";
import { assertInScope, authorize } from "@/lib/authz/authorize";
import { resolveKitchenVisibility } from "@/features/kitchen/server/kitchen-visibility-resolve";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { MENU_IMAGE_BUCKET } from "@/lib/storage/buckets";
import { createSignedFileUrls } from "@/lib/storage/files";
import { listKitchenNotificationsForEvent } from "@/features/kitchen/server/kitchen-notifications";

/**
 * What the kitchen has to cook for one event, and how far along it is.
 *
 * Read-only, and deliberately a second route rather than more fields on
 * `GET /api/events/[eventId]/menu`: the menu tab needs style *names* to offer a
 * choice, while this needs the whole `MenuItemService` rule to run the
 * arithmetic, plus the kitchen statuses the menu tab has no use for.
 *
 * The numbers are worked out server-side because the counts they divide do not
 * exist on the client: `EventFile` collapses the seven head counts into display
 * strings, and the table count lives in `DiningPlan.tables`, which is
 * server-side json.
 *
 * The arithmetic itself lives in `features/kitchen/server/kitchen-sheet.ts`,
 * which the kitchen board also calls. Both views read `EventMenuLine`, so a
 * dish's quantity is the same number wherever it is shown - which is the point
 * of the sheet being one function rather than two.
 */

const eventIdSchema = z.string().uuid();

/**
 * One signing request for the whole sheet rather than one per row, copying what
 * the menu route does. The 300s default outlives the 2 minute client query
 * cache, so a cached response never holds an expired URL, and storage being
 * unreachable costs the thumbnails rather than the sheet.
 */
async function signLinePictures(
  lines: KitchenLineRow[],
  organizationId: string
) {
  const picturePaths = collectPicturePaths(lines);

  if (picturePaths.length === 0) return new Map<string, string>();

  try {
    return await createSignedFileUrls({
      organizationId,
      bucket: MENU_IMAGE_BUCKET,
      paths: picturePaths
    });
  } catch (signingError) {
    console.error("Failed to sign event kitchen pictures", signingError);

    return new Map<string, string>();
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    // The menu tab's pair, plus the board's own permission. Not
    // canViewEventManager alone: a manager who can already see and edit these
    // dishes one tab across must not be 403'd here, and neither must a kitchen
    // member, whose board opens this route for the dish list behind an event
    // card. All three are reads of the same sheet.
    const actor = await authorize(request, "kitchen.read");
    const { eventId } = await params;
    const id = eventIdSchema.parse(eventId);
    const meal = mealSchema.parse(
      new URL(request.url).searchParams.get("meal") ?? undefined
    );

    const event = await prisma.event.findFirst({
      where: {
        id,
        organizationId: actor.organizationId,
        deleted: false
      },
      select: eventSelect
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    assertInScope(actor, "hall", event.hallId);

    // Resolved before the reads rather than after them, because the feed below
    // is scoped by it now as well as the sheet.
    const visibility = await resolveKitchenVisibility(actor);

    const [menu, otherMeals, statuses, notifications] = await Promise.all([
      prisma.eventMenu.findUnique({
        where: { eventId_meal: { eventId: id, meal } },
        select: kitchenMenuSelect
      }),
      // Keyed off the meal that was asked for rather than `Main`, so the day
      // this route is called with `?meal=ShabbosDay` the answer is still the
      // meals that sheet is not showing.
      prisma.eventMenu.findMany({
        where: {
          eventId: id,
          organizationId: actor.organizationId,
          meal: { not: meal }
        },
        select: { meal: true }
      }),
      prisma.kitchenItemStatus.findMany({
        where: { eventId: id, organizationId: actor.organizationId },
        select: statusSelect
      }),
      listKitchenNotificationsForEvent({
        eventId: id,
        organizationId: actor.organizationId,
        visibility
      })
    ]);

    const signedUrlsByPath = await signLinePictures(
      menu?.lines ?? [],
      actor.organizationId
    );

    // The board withholds a scoped cook's colleagues' dishes; this route is the
    // other way into the same sheet, so it has to withhold them too. Without
    // this, opening an event card would hand back everything the board had just
    // filtered out.
    return NextResponse.json({
      kitchen: buildKitchenSheet({
        event,
        meal,
        menu,
        otherMeals: otherMeals.map((row) => row.meal),
        statuses,
        visibility,
        signedUrlsByPath
      }),
      notifications: notifications.notifications,
      // Whether this event has older change notifications than the ones sent,
      // so the panel can say so rather than reporting a count that is short.
      notificationsHasMore: notifications.hasMore
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
