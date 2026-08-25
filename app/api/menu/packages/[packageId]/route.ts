import { NextResponse } from "next/server";
import { z } from "zod";
import { readPackageItemIdsError } from "@/features/menu/server/menu-package-items";
import { menuPackageUpdateSchema } from "@/features/menu/validations/menu-package.schema";
import { authorize } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ packageId: string }> }
) {
  try {
    const actor = await authorize(request, "menu.update");
    const { packageId } = await params;
    const id = z.string().uuid().parse(packageId);
    const input = menuPackageUpdateSchema.parse(await request.json());

    if (input.includedMenuItemIds) {
      const itemIdsError = await readPackageItemIdsError(
        actor.organizationId,
        input.includedMenuItemIds
      );
      if (itemIdsError) {
        return NextResponse.json({ error: itemIdsError }, { status: 400 });
      }
    }

    const itemPackage = await prisma.eventPackage.update({
      where: { id, organizationId: actor.organizationId },
      data: input
    });
    return NextResponse.json({ package: itemPackage });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
