import { NextResponse } from "next/server";
import { z } from "zod";
import {
  discardMenuPicture,
  readPicturePathError
} from "@/features/menu/server/menu-picture";
import { menuItemUpdateSchema } from "@/features/menu/validations/menu-item.schema";
import { requirePermission } from "@/lib/auth/server-auth";
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const actor = await requirePermission(request, "canEditMenu");
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
    const actor = await requirePermission(request, "canEditMenu");
    const { itemId } = await params;
    const id = z.string().uuid().parse(itemId);

    const item = await prisma.menuItem.findFirst({
      where: { id, organizationId: actor.organizationId },
      select: {
        id: true,
        picturePath: true,
        _count: { select: { kitchenItemStatuses: true } }
      }
    });

    if (!item) {
      return NextResponse.json(
        { error: "Menu item not found." },
        { status: 404 }
      );
    }

    // `Event.menuItemIds` and `EventPackage.includedMenuItemIds` are id arrays,
    // not foreign keys, so the database would happily let this delete leave them
    // pointing at a row that no longer exists. Refuse instead, the way
    // /api/event-types does for an event type an event still references.
    // Kitchen statuses do have a foreign key, and it would raise a constraint
    // error the caller could not read - so it is counted here too.
    //
    // `menu_item_services` is deliberately NOT counted. Those rows belong to the
    // item and cascade with it; counting them would make every dish that is
    // actually served permanently undeletable.
    const [eventCount, packageCount] = await Promise.all([
      prisma.event.count({
        where: {
          organizationId: actor.organizationId,
          menuItemIds: { has: id }
        }
      }),
      prisma.eventPackage.count({
        where: {
          organizationId: actor.organizationId,
          includedMenuItemIds: { has: id }
        }
      })
    ]);

    if (
      item._count.kitchenItemStatuses > 0 ||
      eventCount > 0 ||
      packageCount > 0
    ) {
      return NextResponse.json(
        {
          error:
            "This item is still used by an event or package. Remove it there first."
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
