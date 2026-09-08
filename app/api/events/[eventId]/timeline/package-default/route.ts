import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { timelineSchema } from "@/features/events/validations/timeline.schema";
import { recordActivity } from "@/lib/audit/activity-log";
import { assertInScope, authorize } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { withRoute } from "@/lib/http/with-route";

/**
 * Saves one event's day-of schedule onto the package that event is on, as the
 * schedule that package is normally run to.
 *
 * A venue selling the same package fifty times a year types the same timeline
 * fifty times. This keeps the answer somebody already worked out: applying the
 * package to an event with no timeline of its own copies these rows across.
 *
 * Under the event rather than under the package, because the event is what the
 * caller is looking at and what proves which package to write to - the browser
 * never names the package, so it cannot aim this at one the event is not on.
 *
 * `menu.update` is the permission, not `event.update`: this writes to the menu
 * catalog, and the change outlives the event it was saved from. Somebody who may
 * edit one event's schedule is not thereby entitled to change what every future
 * booking of that package starts from.
 */
const saveDefaultSchema = z.object({
  // At least one row: an empty default is indistinguishable from no default at
  // the point of use, and saving one would quietly clear a package's schedule
  // through a button labelled "save".
  timeline: timelineSchema.min(1, "Add at least one timeline instruction.")
});

export const POST = withRoute(
  "POST /api/events/[eventId]/timeline/package-default",
  async (
  request: Request,
    { params }: { params: Promise<{ eventId: string }> }
  ) => {
    try {
      const actor = await authorize(request, "menu.update");
      const { eventId } = await params;
      const id = z.string().uuid().parse(eventId);
      const input = saveDefaultSchema.parse(await request.json());

      const event = await prisma.event.findFirst({
        where: { id, organizationId: actor.organizationId, deleted: false },
        select: { hallId: true, packageId: true, packageName: true }
      });

      if (!event) {
        return NextResponse.json({ error: "Event not found." }, { status: 404 });
      }

      assertInScope(actor, "hall", event.hallId);

      if (!event.packageId) {
        return NextResponse.json(
          {
            error:
              "This event is not on a package. Add one from the Menu tab first."
          },
          { status: 400 }
        );
      }

      const packageId = event.packageId;

      // updateMany rather than update: it carries the organization in the filter,
      // so a package belonging to another tenant matches nothing and reports back
      // as not found instead of being written to.
      const saved = await prisma.$transaction(async (transaction) => {
        const written = await transaction.eventPackage.updateMany({
          where: { id: packageId, organizationId: actor.organizationId },
          data: { defaultTimeline: input.timeline as Prisma.InputJsonValue }
        });

        if (written.count === 0) return written;

        // `menu.package.updated`, not an event key, and the route's own
        // docstring is why: this writes to the menu catalog and the change
        // outlives the event it was saved from. Filing it under Events would put
        // it on one event's history when what it actually changed is what every
        // future booking of the package starts from. `eventId` is still stamped,
        // because "saved from here" is worth being able to trace back.
        await recordActivity(transaction, actor, {
          action: "menu.package.updated",
          eventId: id,
          message: `Saved a ${input.timeline.length}-row default schedule onto the ${
            event.packageName ?? "selected"
          } package.`,
          changed: {
            after: { packageId, defaultTimelineRows: input.timeline.length }
          }
        });

        return written;
      });

      if (saved.count === 0) {
        return NextResponse.json(
          { error: "That package was not found." },
          { status: 404 }
        );
      }

      return NextResponse.json({
        packageName: event.packageName,
        rows: input.timeline.length
      });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);
