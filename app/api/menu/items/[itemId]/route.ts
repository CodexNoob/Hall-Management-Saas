import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveMenuCategoryId } from "@/features/menu/server/menu-categories";
import {
  discardMenuPicture,
  readPicturePathError
} from "@/features/menu/server/menu-picture";
import { menuItemUpdateSchema } from "@/features/menu/validations/menu-item.schema";
import { authorize } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { MENU_IMAGE_BUCKET } from "@/lib/storage/buckets";

// Never read back to the client, for the same reason GET /api/menu hides them:
// these two columns are the only thing that would let a caller address the
// stored object directly instead of through a short-lived signed URL.
const hidePictureLocation = {
  pictureBucket: true,
  picturePath: true,
  // Superseded by the `services` rows; kept as a column only as a migration
  // safety net, so no handler hands it back.
  countingRules: true
} as const;

/** How many blocking events and packages a refusal names before it counts the rest. */
const MAX_LISTED_BLOCKERS = 8;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const actor = await authorize(request, "menu.update");
    const { itemId } = await params;
    const id = z.string().uuid().parse(itemId);
    const input = menuItemUpdateSchema.parse(await request.json());

    if (typeof input.picturePath === "string") {
      const picturePathError = readPicturePathError(
        actor.organizationId,
        input.picturePath
      );
      if (picturePathError) {
        return NextResponse.json({ error: picturePathError }, { status: 400 });
      }
    }

    // Read first rather than relying on the update's where clause: the previous
    // path is needed to clean up after a replacement, and a miss has to answer
    // 404 rather than surface as a Prisma error.
    const current = await prisma.menuItem.findFirst({
      where: { id, organizationId: actor.organizationId },
      select: { id: true, picturePath: true }
    });

    if (!current) {
      return NextResponse.json(
        { error: "Menu item not found." },
        { status: 404 }
      );
    }

    // Pulled out of the spread because service rules are their own rows, not a
    // column, and an omitted key has to leave them alone.
    const { services, ...fields } = input;

    const item = await prisma.menuItem.update({
      where: { id: current.id },
      data: {
        ...fields,
        // Kept in step with the free-text column above it. An omitted
        // `category` leaves both alone; re-filing a dish moves it to the tab
        // that now matches, creating that course if it is a new one.
        ...(fields.category !== undefined
          ? {
              categoryId: await resolveMenuCategoryId(
                actor.organizationId,
                fields.category
              )
            }
          : {}),
        // The bucket follows the path instead of being accepted from the
        // request, exactly as it does on create.
        ...(input.picturePath !== undefined
          ? { pictureBucket: input.picturePath ? MENU_IMAGE_BUCKET : null }
          : {}),
        // Replaced wholesale rather than reconciled per style: a service row
        // owns nothing, so deleting and rewriting is both simpler and the only
        // way an unchecked style actually goes away. Nested writes run in one
        // transaction, so the item never briefly exists with no rules.
        ...(services !== undefined
          ? {
              services: {
                deleteMany: {},
                create: services.map((service) => ({
                  organizationId: actor.organizationId,
                  ...service
                }))
              }
            }
          : {})
      },
      omit: hidePictureLocation,
      include: { services: true }
    });

    if (
      input.picturePath !== undefined &&
      current.picturePath &&
      current.picturePath !== input.picturePath
    ) {
      await discardMenuPicture(actor.organizationId, current.picturePath);
    }

    return NextResponse.json({ item });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const actor = await authorize(request, "menu.delete");
    const { itemId } = await params;
    const id = z.string().uuid().parse(itemId);

    const item = await prisma.menuItem.findFirst({
      where: { id, organizationId: actor.organizationId },
      select: { id: true, picturePath: true }
    });

    if (!item) {
      return NextResponse.json(
        { error: "Menu item not found." },
        { status: 404 }
      );
    }

    // `event_menu_lines` has a real foreign key with ON DELETE RESTRICT, so a
    // dish still on a menu cannot be deleted whatever this route does. It is
    // checked anyway, because the constraint error it would otherwise raise is
    // not something the caller could read.
    //
    // `EventPackage.includedMenuItemIds` is still a bare id array with no
    // foreign key behind it, so that lookup is doing real work rather than
    // duplicating a guarantee. `Event.menuItemIds` is checked too while it is
    // still written as a mirror - it should never disagree with the line table,
    // and if it ever does, refusing is the safe direction.
    //
    // Kitchen statuses have a foreign key of their own, for the same reason.
    //
    // `menu_item_services` is deliberately NOT checked. Those rows belong to the
    // item and cascade with it; counting them would make every dish that is
    // actually served permanently undeletable.
    //
    // Rows rather than counts, because "still used somewhere" is not something
    // the operator can act on: they have to be told which event or package to
    // open. The three event sources overlap by design - a dish on a menu is
    // normally mirrored onto `menu_item_ids` and may have a kitchen status too -
    // so they are merged by event id below rather than listed three times.
    const eventFields = {
      id: true,
      clientName: true,
      eventDate: true
    } as const;

    const [menuLines, mirroredEvents, packages, kitchenStatuses] =
      await Promise.all([
        prisma.eventMenuLine.findMany({
          where: { organizationId: actor.organizationId, menuItemId: id },
          select: { eventMenu: { select: { event: { select: eventFields } } } }
        }),
        prisma.event.findMany({
          where: {
            organizationId: actor.organizationId,
            menuItemIds: { has: id }
          },
          select: eventFields
        }),
        prisma.eventPackage.findMany({
          where: {
            organizationId: actor.organizationId,
            includedMenuItemIds: { has: id }
          },
          select: { id: true, name: true }
        }),
        prisma.kitchenItemStatus.findMany({
          where: { organizationId: actor.organizationId, menuItemId: id },
          select: { event: { select: eventFields } }
        })
      ]);

    const blockingEvents = new Map<string, string>();

    for (const event of [
      ...menuLines.map((line) => line.eventMenu.event),
      ...mirroredEvents,
      ...kitchenStatuses.map((status) => status.event)
    ]) {
      // `event_date` is a DATE column, so Prisma hands back UTC midnight and
      // slicing the ISO string cannot land on the day before.
      blockingEvents.set(
        event.id,
        `Event: ${event.clientName} (${event.eventDate.toISOString().slice(0, 10)})`
      );
    }

    const blockers = [
      ...blockingEvents.values(),
      ...packages.map((eventPackage) => `Package: ${eventPackage.name}`)
    ];

    if (blockers.length > 0) {
      // Capped so a dish on a season of events does not return a dialog the
      // operator has to scroll. The remainder is counted rather than dropped
      // silently - a truncated list reads as the whole list.
      const listed = blockers.slice(0, MAX_LISTED_BLOCKERS);
      const hidden = blockers.length - listed.length;

      return NextResponse.json(
        {
          // Unchanged: the sentence is the summary, and the list underneath it
          // is what the operator actually acts on.
          error:
            "This item is still used by an event or package. Remove it there first.",
          details: hidden > 0 ? [...listed, `and ${hidden} more`] : listed
        },
        { status: 409 }
      );
    }

    await prisma.menuItem.delete({ where: { id: item.id } });
    // After the row is gone: a storage failure should not undo a delete the
    // caller has already been told nothing about.
    await discardMenuPicture(actor.organizationId, item.picturePath);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
