import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { changedFields, recordActivity } from "@/lib/audit/activity-log";
import { assertInScope, authorize } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { countSchema } from "@/lib/validation/number";
import { requiredPhoneSchema } from "@/lib/validation/phone";
import { assertHallCapacity } from "@/features/bookings/services/booking.service";
import {
  dailyEventLimitFromIntegrations,
  hallDayRefusal,
  hallDayStatus
} from "@/lib/bookings/hall-day-availability";
import { timelineSchema } from "@/features/events/validations/timeline.schema";
import { withRoute } from "@/lib/http/with-route";

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

/**
 * Names the day a refused move was aimed at.
 *
 * Fixed to UTC because `Event.eventDate` is a bare date column, read back as
 * midnight UTC: formatting it in the server's own zone would name the day
 * before for anywhere west of Greenwich.
 */
const movedDateLabelFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "long",
  day: "numeric",
  year: "numeric"
});

const updateEventSchema = z
  .object({
    clientName: z.string().trim().min(1).max(200).optional(),
    // `Event.phone` is not nullable, so a supplied number has to be a real one.
    // Same parser the forms run, so a number cannot be accepted in the browser
    // and refused here.
    phone: requiredPhoneSchema({ label: "Phone number" }).optional(),
    // Nullable where the phone is not: `Event.email` has always been optional,
    // and clearing the box has to be a way of saying the client did not give
    // one - otherwise an address typed by mistake can never be taken back off.
    email: z
      .string()
      .trim()
      .max(200)
      .email("Enter a valid email address.")
      .nullable()
      .optional(),
    // The membership, checked below against this organization. Nullable so an
    // event can be handed back to nobody.
    coordinatorMembershipId: z.string().uuid().nullable().optional(),
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
    timeline: timelineSchema.optional(),
    timelineConfirmed: z.boolean().optional(),
    menuConfirmed: z.boolean().optional(),
    menuItemIds: z.array(z.string().uuid()).max(500).optional()
  })
  .refine((value) => Object.keys(value).length > 0, "No changes supplied.");

export const PATCH = withRoute(
  "PATCH /api/events/[eventId]",
  async (
  request: Request,
    { params }: { params: Promise<{ eventId: string }> }
  ) => {
    try {
      const actor = await authorize(request, "event.update");
      const { eventId } = await params;
      const id = z.string().uuid().parse(eventId);
      const input = updateEventSchema.parse(await request.json());
      if (input.hallId) {
        assertInScope(actor, "hall", input.hallId);
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

      // Proved to belong to this organization, the same way the hall and the
      // event type are. A membership id is guessable in the sense that any uuid
      // is, and without this an event could be assigned to somebody in another
      // tenant - which would then read their name back out of the coordinator
      // join on every load of this event.
      //
      // `null` skips the check on purpose: it is the un-assign, and there is
      // nothing to prove about nobody.
      if (input.coordinatorMembershipId) {
        const membership = await prisma.organizationMembership.findFirst({
          where: {
            id: input.coordinatorMembershipId,
            organizationId: actor.organizationId,
            isActive: true
          },
          select: { id: true }
        });

        if (!membership) {
          return NextResponse.json(
            { error: "Selected coordinator was not found." },
            { status: 404 }
          );
        }
      }

      const current = await prisma.event.findFirst({
        where: { id, organizationId: actor.organizationId, deleted: false },
        select: {
          // Read for the date-move check below: it has to know whether the date
          // or the hall is actually moving, and which hall to measure.
          eventDate: true,
          hallId: true,
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
          // The rest of what the details panel can edit, read so the activity
          // entry can say which fields actually MOVED. The panel posts every
          // field on every save, so "was it supplied" would record a change on
          // a save that changed nothing - the same trap `movedCounts` avoids
          // below. `phone` and `email` are read for the comparison only; their
          // VALUES never reach the log, see the entry itself.
          phone: true,
          email: true,
          coordinatorMembershipId: true,
          eventTypeId: true,
          eventType: true,
          eventStatus: true,
          startsAt: true,
          setupTime: true,
          washingTime: true,
          tableclothName: true,
          memberShulName: true,
          notes: true,
          daveningNote: true,
          hall: { select: { name: true, capacity: true } }
        }
      });

      if (!current) {
        return NextResponse.json({ error: "Event not found." }, { status: 404 });
      }

      /*
       * A move onto a day the hall cannot take.
       *
       * The event-details picker already offers only open days, but it decided
       * that from a snapshot: a hold placed while the panel sat open would
       * otherwise be overwritten by a save from a tab that never saw it. Checked
       * here against the same rule the picker builds its list from.
       *
       * Only when the event is actually moving - the same reasoning as the
       * capacity check below. An event that already shares its day with a hold is
       * not asked to justify itself on a notes-only save, and gating every PATCH
       * on that would leave such an event uneditable with no way to recover.
       */
      const targetHallId = input.hallId ?? current.hallId;
      const movesToAnotherDay =
        (input.eventDate !== undefined &&
          input.eventDate.getTime() !== current.eventDate.getTime()) ||
        targetHallId !== current.hallId;

      if (movesToAnotherDay) {
        const targetDate = input.eventDate ?? current.eventDate;
        const [targetHall, settings, blockedDate, bookingsThatDay] =
          await Promise.all([
            prisma.hall.findFirst({
              where: { id: targetHallId, organizationId: actor.organizationId },
              select: { name: true, dailyEventLimit: true }
            }),
            prisma.organizationSetting.findUnique({
              where: { organizationId: actor.organizationId },
              select: { integrations: true }
            }),
            // Only ranges that close the hall this event is moving into. A null
            // hall is a range saved before ranges named one, which closed the
            // whole venue and still does.
            prisma.holidayBlockedDate.findFirst({
              where: {
                organizationId: actor.organizationId,
                isBlocked: true,
                OR: [{ hallId: targetHallId }, { hallId: null }],
                startDate: { lte: targetDate },
                endDate: { gte: targetDate }
              },
              select: { id: true }
            }),
            // This event is excluded: it is the one being moved, and counting it
            // where it already sits would refuse to leave it there.
            prisma.event.findMany({
              where: {
                organizationId: actor.organizationId,
                deleted: false,
                id: { not: id },
                hallId: targetHallId,
                eventDate: targetDate,
                bookingStatus: { in: ["TENTATIVE_HOLD", "CONFIRMED"] }
              },
              select: { bookingStatus: true }
            })
          ]);

        const refusal = hallDayRefusal(
          hallDayStatus({
            isBlocked: Boolean(blockedDate),
            holdCount: bookingsThatDay.filter(
              (booking) => booking.bookingStatus === "TENTATIVE_HOLD"
            ).length,
            activeCount: bookingsThatDay.length,
            dailyEventLimit:
              targetHall?.dailyEventLimit ??
              dailyEventLimitFromIntegrations(settings?.integrations)
          }),
          {
            hallName: targetHall?.name ?? "This hall",
            // The column is a bare date, so it is read back at UTC midnight -
            // formatting it in the server's own zone would name the day before.
            dateLabel: movedDateLabelFormatter.format(targetDate)
          }
        );

        if (refusal) {
          return NextResponse.json({ error: refusal }, { status: 409 });
        }
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

      // Confirming hands the sheet to staff and the kitchen as the thing to
      // follow on the day, so there has to be a sheet. An empty one confirmed
      // reports "Timeline ready" on the readiness list while saying nothing about
      // what anybody is meant to do.
      //
      // Checked against the stored rows when the request carries none, because
      // confirming and saving are separate calls and either one can arrive alone.
      if (timelineConfirmed === true) {
        const confirmedRows = timeline ?? previousWorkspace.timeline;

        if (!Array.isArray(confirmedRows) || confirmedRows.length === 0) {
          return NextResponse.json(
            {
              error: "Add at least one timeline instruction before confirming it."
            },
            { status: 400 }
          );
        }
      }

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

      // The non-count columns that actually moved, for the general entry below.
      // `eventChanges` is what is about to be written, minus the workspace JSON
      // that `workspaceData` handles; the counts are excluded because they get
      // an entry of their own.
      const movedFields = changedFields(
        current as Record<string, unknown>,
        eventChanges as Record<string, unknown>
      ).filter((field) => !loggedCountFields.includes(field as CountField));

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
            updatedById: actor.userId,
            version: { increment: 1 }
          }
        });

        // Head counts are what the kitchen sheet cuts every quantity from, so a
        // count that moves after the food is planned is the change most worth
        // being able to trace back to a person. In the same transaction as the
        // update: a lost log entry would leave the numbers changed with nothing
        // saying so, which is the state this exists to end.
        //
        // Its own entry rather than a line in the general one below, so the
        // Activity screen can filter for it: "who changed the numbers" is the
        // question this trail gets asked most.
        if (movedCounts.length > 0) {
          await recordActivity(transaction, actor, {
            action: "event.guest_counts.updated",
            eventId: id,
            clientId: current.clientId,
            message: `Changed guest counts for ${current.clientName}: ${movedCounts
              .map(
                (field) =>
                  `${countLabels[field]} ${current[field]} to ${input[field]}`
              )
              .join(", ")}.`,
            changed: {
              before: Object.fromEntries(
                movedCounts.map((field) => [field, current[field]])
              ),
              after: Object.fromEntries(
                movedCounts.map((field) => [field, input[field] ?? null])
              )
            }
          });
        }

        // The day-of schedule, which lives in `workspaceData` rather than in a
        // column - so it is invisible to the field diff above and needs saying
        // separately. Confirming it is what tells staff to follow it on the day,
        // which is the half worth being able to trace.
        if (timeline !== undefined || timelineConfirmed !== undefined) {
          await recordActivity(transaction, actor, {
            action: "event.timeline.updated",
            eventId: id,
            clientId: current.clientId,
            message:
              timelineConfirmed === true
                ? `Confirmed the timeline for ${current.clientName}.`
                : timelineConfirmed === false
                  ? `Reopened the timeline for ${current.clientName}.`
                  : `Edited the timeline for ${current.clientName}: ${timeline?.length ?? 0} row(s).`,
            changed: {
              after: {
                ...(timeline !== undefined ? { rows: timeline.length } : {}),
                ...(timelineConfirmed !== undefined
                  ? { confirmed: timelineConfirmed }
                  : {})
              }
            }
          });
        }

        // Everything else the panel can edit.
        //
        // FIELD NAMES ONLY, NO VALUES. `phone` and `email` are in this set and
        // are personal data; `activity_logs` has no redaction and this row is
        // read back on the Activity screen. "Somebody changed the phone number
        // at 14:12" is the whole answer an operator needs, and the current value
        // is on the screen they are already looking at. See the payload note in
        // lib/audit/activity-log.
        if (movedFields.length > 0) {
          await recordActivity(transaction, actor, {
            action: "event.updated",
            eventId: id,
            clientId: current.clientId,
            message: `Edited ${current.clientName}'s event: ${movedFields.join(", ")}.`,
            changed: { after: { fields: movedFields } }
          });
        }

        return updated;
      });

      return NextResponse.json({ event });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);
