import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";

const timelineItemSchema = z.object({
  id: z.string().min(1).max(100),
  time: z.string().trim().min(1).max(20),
  text: z.string().trim().min(1).max(500),
  type: z.enum(["Event", "Kitchen", "Staff"])
});

const updateEventSchema = z
  .object({
    clientName: z.string().trim().min(1).max(200).optional(),
    eventType: z.string().trim().min(1).max(100).optional(),
    eventStatus: z.enum(["Confirmed", "Hold"]).optional(),
    eventDate: z.coerce.date().optional(),
    startsAt: z.coerce.date().nullable().optional(),
    couplesCount: z.number().int().min(0).optional(),
    kidsCount: z.number().int().min(0).optional(),
    menCount: z.number().int().min(0).optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
    timeline: z.array(timelineItemSchema).max(100).optional(),
    timelineConfirmed: z.boolean().optional(),
    menuConfirmed: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, "No changes supplied.");

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const actor = await requirePermission(request, "canCreateBooking");
    const { eventId } = await params;
    const id = z.string().uuid().parse(eventId);
    const input = updateEventSchema.parse(await request.json());
    const current = await prisma.event.findFirst({
      where: { id, organizationId: actor.organizationId, deleted: false },
      select: { workspaceData: true }
    });

    if (!current) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    const previousWorkspace =
      current.workspaceData &&
      typeof current.workspaceData === "object" &&
      !Array.isArray(current.workspaceData)
        ? (current.workspaceData as Record<string, unknown>)
        : {};
    const { timeline, timelineConfirmed, menuConfirmed, ...eventChanges } =
      input;
    const workspaceData =
      timeline !== undefined ||
      timelineConfirmed !== undefined ||
      menuConfirmed !== undefined
        ? ({
            ...previousWorkspace,
            ...(timeline !== undefined ? { timeline } : {}),
            ...(timelineConfirmed !== undefined ? { timelineConfirmed } : {}),
            ...(menuConfirmed !== undefined ? { menuConfirmed } : {})
          } as Prisma.InputJsonObject)
        : undefined;

    const event = await prisma.event.update({
      where: { id, organizationId: actor.organizationId },
      data: {
        ...eventChanges,
        ...(workspaceData ? { workspaceData } : {}),
        updatedById: actor.id,
        version: { increment: 1 }
      }
    });

    return NextResponse.json({ event });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
