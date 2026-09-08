import { NextResponse } from "next/server";
import { z } from "zod";
import {
  applyPackageItemDelta,
  readPackageItemIdsError
} from "@/features/menu/server/menu-package-items";
import { menuPackageUpdateSchema } from "@/features/menu/validations/menu-package.schema";
import { recordActivity } from "@/lib/audit/activity-log";
import { authorize } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { withRoute } from "@/lib/http/with-route";

export const PATCH = withRoute(
  "PATCH /api/menu/packages/[packageId]",
  async (
  request: Request,
    { params }: { params: Promise<{ packageId: string }> }
  ) => {
    try {
      const actor = await authorize(request, "menu.update");
      const { packageId } = await params;
      const id = z.string().uuid().parse(packageId);
      const { addMenuItemIds, removeMenuItemIds, ...fields } =
        menuPackageUpdateSchema.parse(await request.json());

      // Only ids on the way in are checked. Removals are not: an id being taken
      // out does not have to still resolve, and refusing to drop one that no
      // longer does would leave a package stuck holding it.
      const arrivingItemIds = fields.includedMenuItemIds ?? addMenuItemIds;

      if (arrivingItemIds) {
        const itemIdsError = await readPackageItemIdsError(
          actor.organizationId,
          arrivingItemIds
        );
        if (itemIdsError) {
          return NextResponse.json({ error: itemIdsError }, { status: 400 });
        }
      }

      if (addMenuItemIds || removeMenuItemIds) {
        const changed = await applyPackageItemDelta({
          organizationId: actor.organizationId,
          packageId: id,
          addMenuItemIds,
          removeMenuItemIds
        });

        if (!changed) {
          return NextResponse.json(
            { error: "Requested record was not found." },
            { status: 404 }
          );
        }

        // A delta and a rename in one request is not something any caller sends
        // today - the panel writes items, the dialog writes name and price - but
        // dropping the other fields on the floor would be a silent no-op if one
        // ever did.
        const itemPackage = Object.keys(fields).length
          ? await prisma.eventPackage.update({
              where: { id, organizationId: actor.organizationId },
              data: fields
            })
          : null;

        // Outside a transaction, and this is the one branch where that is not a
        // choice: `applyPackageItemDelta` has already committed by the time the
        // route regains control. Wrapping only the entry would claim an atomicity
        // that does not exist, so it is recorded after the fact instead.
        await recordActivity(prisma, actor, {
          action: "menu.package.updated",
          message: `Changed the items in the ${
            itemPackage?.name ?? "package"
          }: ${addMenuItemIds?.length ?? 0} added, ${
            removeMenuItemIds?.length ?? 0
          } removed.`,
          changed: {
            after: {
              packageId: id,
              added: addMenuItemIds?.length ?? 0,
              removed: removeMenuItemIds?.length ?? 0,
              ...(Object.keys(fields).length
                ? { fields: Object.keys(fields) }
                : {})
            }
          }
        });

        // The stored list goes back with the answer so the caller can reconcile
        // its optimistic copy against what actually landed, rather than trusting
        // the array it sent or paying for a second round trip to read it.
        return NextResponse.json({
          package: { ...(itemPackage ?? {}), ...changed }
        });
      }

      const itemPackage = await prisma.$transaction(async (transaction) => {
        const updated = await transaction.eventPackage.update({
          where: { id, organizationId: actor.organizationId },
          data: fields
        });

        await recordActivity(transaction, actor, {
          action: "menu.package.updated",
          message: `Edited the ${updated.name} package: ${Object.keys(
            fields
          ).join(", ")}.`,
          changed: { after: { packageId: id, fields: Object.keys(fields) } }
        });

        return updated;
      });

      return NextResponse.json({ package: itemPackage });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);
