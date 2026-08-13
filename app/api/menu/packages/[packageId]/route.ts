import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { moneySchema } from "@/lib/validation/number";

const schema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  regularPrice: moneySchema({ label: "Regular price" }).optional(),
  includedMenuItemIds: z.array(z.string().uuid()).optional()
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ packageId: string }> }
) {
  try {
    const actor = await requirePermission(request, "canEditMenu");
    const { packageId } = await params;
    const id = z.string().uuid().parse(packageId);
    const input = schema.parse(await request.json());
    const itemPackage = await prisma.eventPackage.update({
      where: { id, organizationId: actor.organizationId },
      data: input
    });
    return NextResponse.json({ package: itemPackage });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
