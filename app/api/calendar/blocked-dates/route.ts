import { NextResponse } from "next/server";
import { z } from "zod";

import { assertInScope, authorize, tenant } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { withRoute } from "@/lib/http/with-route";

const blockedDateSchema = z
  .object({
    // Required: a range closes one hall, and a range that named none would
    // close the whole venue - which is what this column exists to stop being
    // the only option.
    hallId: z.string().uuid("Select the hall this range closes."),
    startDate: z.string().date(),
    endDate: z.string().date(),
    label: z.string().trim().min(1).max(160),
    reason: z.string().trim().max(500).optional()
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "End date must be on or after the start date.",
    path: ["endDate"]
  });

export const POST = withRoute(
  "POST /api/calendar/blocked-dates",
  async (request: Request) => {
    try {
      const actor = await authorize(request, "settings.update");
      const input = blockedDateSchema.parse(await request.json());
      // Proved to belong to this organization rather than taken on trust: a uuid
      // is guessable in the sense that any uuid is, and a range pointing at
      // another tenant's hall would close a date this organization does not own.
      assertInScope(actor, "hall", input.hallId);
      const hall = await prisma.hall.findFirst({
        where: { id: input.hallId, ...tenant(actor), isActive: true },
        select: { id: true }
      });

      if (!hall) {
        return NextResponse.json(
          { error: "Selected hall was not found." },
          { status: 404 }
        );
      }

      const blockedDate = await prisma.holidayBlockedDate.create({
        data: {
          organizationId: actor.organizationId,
          hallId: input.hallId,
          startDate: new Date(`${input.startDate}T00:00:00.000Z`),
          endDate: new Date(`${input.endDate}T00:00:00.000Z`),
          label: input.label,
          reason: input.reason
        }
      });
      return NextResponse.json({ blockedDate }, { status: 201 });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);

export const DELETE = withRoute(
  "DELETE /api/calendar/blocked-dates",
  async (request: Request) => {
    try {
      const actor = await authorize(request, "settings.update");
      const { id } = z
        .object({ id: z.string().uuid() })
        .parse(await request.json());
      const result = await prisma.holidayBlockedDate.deleteMany({
        where: { id, ...tenant(actor) }
      });
      if (!result.count) {
        return NextResponse.json(
          { error: "Blocked date was not found." },
          { status: 404 }
        );
      }
      return NextResponse.json({ deleted: true });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);
