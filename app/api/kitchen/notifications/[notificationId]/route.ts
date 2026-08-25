import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";

const notificationIdSchema = z.string().uuid();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  try {
    const actor = await authorize(request, "kitchen.status.update");
    const { notificationId } = await params;
    const id = notificationIdSchema.parse(notificationId);

    const updated = await prisma.kitchenNotification.updateMany({
      where: {
        id,
        organizationId: actor.organizationId,
        acknowledgedAt: null
      },
      data: {
        acknowledgedById: actor.userId,
        acknowledgedAt: new Date()
      }
    });

    if (updated.count === 0) {
      const existing = await prisma.kitchenNotification.findFirst({
        where: { id, organizationId: actor.organizationId },
        select: { id: true }
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Kitchen notification not found." },
          { status: 404 }
        );
      }
    }

    return NextResponse.json({ acknowledged: true });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
