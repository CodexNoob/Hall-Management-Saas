import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { resolveKitchenNotificationAudience } from "@/features/kitchen/server/kitchen-notifications";
import { resolveKitchenVisibility } from "@/features/kitchen/server/kitchen-visibility-resolve";
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

    // Ids travel in the URL, so a cook who cannot READ a colleague's
    // notification could otherwise acknowledge it by sending its id - and the
    // event manager waiting on that acknowledgment would be told the kitchen
    // had seen a change nobody who works on that event ever saw.
    const audience = await resolveKitchenNotificationAudience(
      actor.organizationId,
      await resolveKitchenVisibility(actor)
    );

    if (!audience) {
      return NextResponse.json(
        { error: "Kitchen notification not found." },
        { status: 404 }
      );
    }

    const updated = await prisma.kitchenNotification.updateMany({
      where: {
        id,
        organizationId: actor.organizationId,
        ...audience.where,
        acknowledgedAt: null
      },
      data: {
        acknowledgedById: actor.userId,
        acknowledgedAt: new Date()
      }
    });

    if (updated.count === 0) {
      const existing = await prisma.kitchenNotification.findFirst({
        // Scoped as well, so a notification this caller may not read answers
        // 404 exactly as a missing one does. A separate 403 would let a cook
        // map the feed they are not allowed to see.
        where: { id, organizationId: actor.organizationId, ...audience.where },
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
