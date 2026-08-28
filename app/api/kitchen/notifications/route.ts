import { NextResponse } from "next/server";

import { authorize } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  try {
    const actor = await authorize(request, "kitchen.status.update");
    const result = await prisma.kitchenNotification.updateMany({
      where: {
        organizationId: actor.organizationId,
        requiresAcknowledgment: true,
        acknowledgedAt: null
      },
      data: {
        acknowledgedById: actor.userId,
        acknowledgedAt: new Date()
      }
    });

    return NextResponse.json({ acknowledgedCount: result.count });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await authorize(request, "kitchen.status.update");
    const result = await prisma.kitchenNotification.deleteMany({
      where: { organizationId: actor.organizationId }
    });

    return NextResponse.json({ deletedCount: result.count });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
