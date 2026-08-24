import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertHallAccess, requirePermission } from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { countSchema } from "@/lib/validation/number";
import { requiredPhoneSchema } from "@/lib/validation/phone";
import { assertHallCapacity } from "@/features/bookings/services/booking.service";

const timelineItemSchema = z.object({
  id: z.string().min(1).max(100),
  // No longer required: a cue row is placed by what happens before it rather
  // than by the clock, and sends this blank.
  time: z.string().trim().max(20).optional(),
  // Sent only by a cue row, and sent even when still empty - its presence is
  // what marks the row as sequence-driven, so a cue the manager has not typed
  // yet has to come back as a cue row rather than as a midnight time row.
  cue: z.string().trim().max(200).optional(),
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

/**
 * The counts the kitchen cooks from, and what to call each one in a log entry.
 *
 * Deliberately wider than `countFields`: that list drives the hall capacity
 * check, and waiters are staff rather than attendees, so they do not belong in
 * it - but `readHeadCounts` reads all seven, so all seven move production
 * quantities and all seven are worth recording.
 */
const countLabels = {
  couplesCount: "couples",
  menCount: "men",
  ladiesCount: "ladies",
  boysCount: "boys",
  girlsCount: "girls",
  kidsCount: "kids",
  waitersCount: "waiters"
} as const;

type CountField = keyof typeof countLabels;

const loggedCountFields = Object.keys(countLabels) as CountField[];

const updateEventSchema = z
  .object({
    clientName: z.string().trim().min(1).max(200).optional(),
    // `Event.phone` is not nullable, so a supplied number has to be a real one.
    // Same parser the forms run, so a number cannot be accepted in the browser
    // and refused here.
    phone: requiredPhoneSchema({ label: "Phone number" }).optional(),
    eventType: z
      .string()
      .trim()
      .max(100)
      .transform((value) => value || null)
      .optional(),
    // The id, not the name. The event carries both columns and the name is a
    // copy of the row's, so it is resolved below rather than trusted from the
    // client - otherwise the two drift the moment a type is renamed.
    eventTypeId: z.string().uuid().optional(),
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
    daveningNote: z.string().trim().max(5000).nullable().optional(),
    setupTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .nullable()
      .optional(),
    washingTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .nullable()
      .optional(),
    tableclothName: z.string().trim().max(100).nullable().optional(),
    waitersCount: z.number().int().min(0).max(10000).optional(),
    memberShulName: z.string().trim().max(200).nullable().optional(),
    sideBoxes: z.string().trim().max(5000).nullable().optional(),
    shabbosSetup: z.string().trim().max(5000).nullable().optional(),
    timeline: z.array(timelineItemSchema).max(100).optional(),
    timelineConfirmed: z.boolean().optional(),
    menuConfirmed: z.boolean().optional(),
    menuItemIds: z.array(z.string().uuid()).max(500).optional()
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

    // Looked up rather than taken on trust: it proves the type belongs to this
    // organization, and gives the name that is stored alongside the id.
    const eventType = input.eventTypeId
      ? await prisma.eventType.findFirst({
          where: {
            id: input.eventTypeId,
            organizationId: actor.organizationId
          },
          select: { id: true, name: true }
        })
      : null;

    if (input.eventTypeId && !eventType) {
      return NextResponse.json(
        { error: "Selected event type was not found." },
        { status: 404 }
      );
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
        // Read for the activity entry rather than the capacity check.
        // `waitersCount` because the kitchen reads it like the rest; the client
        // columns because the Clients page lists activity by client, and an
        // entry with no `clientId` never reaches it.
        waitersCount: true,
        clientId: true,
        clientName: true,
        hall: { select: { name: true, capacity: true } }
      }
    });

    if (!current) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    if (input.menuItemIds !== undefined) {
      const uniqueMenuItemIds = [...new Set(input.menuItemIds)];
      const ownedMenuItemCount = await prisma.menuItem.count({
        where: {
          id: { in: uniqueMenuItemIds },
          organizationId: actor.organizationId
        }
      });

      if (ownedMenuItemCount !== uniqueMenuItemIds.length) {
        return NextResponse.json(
          { error: "One or more selected menu items were not found." },
          { status: 400 }
        );
      }

      input.menuItemIds = uniqueMenuItemIds;
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
    const {
      timeline,
      timelineConfirmed,
      menuConfirmed,
      sideBoxes,
      shabbosSetup,
      ...eventChanges
    } = input;
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

    // Compared against what is stored rather than merely "was it supplied":
    // the details panel sends every count on every save, so a notes-only edit
    // arrives carrying all six and would otherwise log a change that never
    // happened.
    const movedCounts = loggedCountFields.filter(
      (field) => input[field] !== undefined && input[field] !== current[field]
    );

    const event = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.event.update({
        where: { id, organizationId: actor.organizationId },
        data: {
          ...eventChanges,
          ...(eventType ? { eventType: eventType.name } : {}),
          ...(sideBoxes !== undefined
            ? { sideBoxes: sideBoxes ?? Prisma.JsonNull }
            : {}),
          ...(shabbosSetup !== undefined
            ? { shabbosSetup: shabbosSetup ?? Prisma.JsonNull }
            : {}),
          ...(workspaceData ? { workspaceData } : {}),
          updatedById: actor.id,
          version: { increment: 1 }
        }
      });

      // Head counts are what the kitchen sheet cuts every quantity from, so a
      // count that moves after the food is planned is the change most worth
      // being able to trace back to a person. In the same transaction as the
      // update: a lost log entry would leave the numbers changed with nothing
      // saying so, which is the state this exists to end.
      if (movedCounts.length > 0) {
        await transaction.activityLog.create({
          data: {
            organizationId: actor.organizationId,
            eventId: id,
            clientId: current.clientId,
            userId: actor.id,
            userName: actor.name,
            actionType: "Guest Counts Changed",
            message: `Changed guest counts for ${current.clientName}: ${movedCounts
              .map(
                (field) =>
                  `${countLabels[field]} ${current[field]} to ${input[field]}`
              )
              .join(", ")}.`,
            oldValue: Object.fromEntries(
              movedCounts.map((field) => [field, current[field]])
            ),
            newValue: Object.fromEntries(
              movedCounts.map((field) => [field, input[field]])
            )
          }
        });
      }

      return updated;
    });

    return NextResponse.json({ event });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
