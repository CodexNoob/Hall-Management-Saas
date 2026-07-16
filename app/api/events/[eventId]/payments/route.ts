import { NextResponse } from "next/server";
import { z } from "zod";
import { assertHallAccess, requirePermission } from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";

const confirmationSchema = z.object({
  amountCents: z.number().int().positive(),
  result: z.enum(["paid", "failed", "cancelled"]),
  note: z.string().optional()
});

const paymentStatusByResult = {
  paid: "Paid in Full",
  failed: "Paid Partially",
  cancelled: "Paid Partially"
} as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const actor = await requirePermission(request, "canManagePayments");
    const { eventId: rawEventId } = await params;
    const eventId = z.string().uuid().parse(rawEventId);
    const input = confirmationSchema.parse(await request.json());

    const result = await prisma.$transaction(async (transaction) => {
      const currentEvent = await transaction.event.findUniqueOrThrow({
        where: { id: eventId, organizationId: actor.organizationId },
        select: { hallId: true }
      });

      assertHallAccess(actor, currentEvent.hallId);

      const event = await transaction.event.update({
        where: { id: eventId, organizationId: actor.organizationId },
        data: {
          paymentStatus: paymentStatusByResult[input.result],
          amountDue: input.result === "paid" ? 0 : undefined,
          updatedById: actor.id
        }
      });

      const activityLog = await transaction.activityLog.create({
        data: {
          organizationId: actor.organizationId,
          eventId,
          clientId: event.clientId,
          userId: actor.id,
          userName: actor.name,
          actionType: "Payment Confirmation",
          message: `Payment marked ${input.result}.`,
          newValue: {
            amountCents: input.amountCents,
            result: input.result,
            note: input.note
          }
        }
      });

      await transaction.paymentTransaction.create({
        data: {
          organizationId: actor.organizationId,
          eventId,
          clientId: event.clientId,
          confirmedById: actor.id,
          amountCents: input.amountCents,
          status: input.result,
          note: input.note,
          metadata: { source: "manual-confirmation" }
        }
      });

      return { event, activityLog };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
