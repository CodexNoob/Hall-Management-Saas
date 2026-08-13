import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertHallAccess, requirePermission } from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { countSchema } from "@/lib/validation/number";
import { assertHallCapacity } from "@/features/bookings/services/booking.service";

const timelineItemSchema = z.object({
  id: z.string().min(1).max(100),
  time: z.string().trim().min(1).max(20),
  text: z.string().trim().min(1).max(500),
  type: z.enum(["Event", "Kitchen", "Staff"])
});

const countFields = [
  "couplesCount",
  "kidsCount",
  "menCount",
  "ladiesCount",
  "boysCount",
  "girlsCount"
] as const;

const updateEventSchema = z
  .object({
    clientName: z.string().trim().min(1).max(200).optional(),
    eventType: z
      .string()
      .trim()
      .max(100)
      .transform((value) => value || null)
      .optional(),
    eventStatus: z.enum(["Confirmed", "Hold"]).optional(),
    eventDate: z.coerce.date().optional(),
    hallId: z.string().uuid().optional(),
    startsAt: z.coerce.date().nullable().optional(),
    // Bounded on purpose: these are Postgres `Int` columns, so an unbounded
    // value passed Zod and then failed at the driver as an unhandled 500.
    couplesCount: countSchema({ label: "Couples" }).optional(),
    kidsCount: countSchema({ label: "Kids" }).optional(),
    menCount: countSchema({ label: "Men" }).optional(),
    ladiesCount: countSchema({ label: "Ladies" }).optional(),
    boysCount: countSchema({ label: "Boys" }).optional(),
    girlsCount: countSchema({ label: "Girls" }).optional(),
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
    if (input.hallId) {
      assertHallAccess(actor, input.hallId);
      const hall = await prisma.hall.findFirst({
        where: {
          id: input.hallId,
          organizationId: actor.organizationId,
          isActive: true
        },
        select: { id: true }
      });

      if (!hall) {
        return NextResponse.json(
          { error: "Selected hall was not found." },
          { status: 404 }
        );
      }
    }

    const current = await prisma.event.findFirst({
      where: { id, organizationId: actor.organizationId, deleted: false },
      select: {
        workspaceData: true,
        couplesCount: true,
        menCount: true,
        ladiesCount: true,
        boysCount: true,
        girlsCount: true,
        kidsCount: true,
        hall: { select: { name: true, capacity: true } }
      }
    });

    if (!current) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    // The create path enforces hall capacity; without the same check here an
    // event could simply be edited past the limit it was booked under. Counts
    // arrive one at a time, so merge them over what is already stored.
    //
    // Only checked when the request actually touches a count. An event can
    // legitimately be over capacity already - a hall's capacity can be lowered
    // after the fact, and events booked while it was null were never checked -
    // and gating every PATCH on that would block unrelated saves such as the
    // timeline and the menu confirmation, with no way to recover.
    const touchesCounts = countFields.some(
      (field) => input[field] !== undefined
    );

    if (current.hall && touchesCounts) {
      assertHallCapacity(current.hall, {
        couplesCount: input.couplesCount ?? current.couplesCount,
        menCount: input.menCount ?? current.menCount,
        ladiesCount: input.ladiesCount ?? current.ladiesCount,
        boysCount: input.boysCount ?? current.boysCount,
        girlsCount: input.girlsCount ?? current.girlsCount,
        kidsCount: input.kidsCount ?? current.kidsCount
      });
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
