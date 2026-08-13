import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { BillingError } from "@/features/billing/services/billing-error";
import { MAX_MONEY, centsSchema } from "@/lib/validation/number";

const updateSchema = z.object({
  action: z.enum(["categorize", "match", "split", "cancel"]),
  category: z.string().trim().min(1).max(100).optional(),
  eventId: z.string().uuid().optional(),
  note: z.string().trim().max(1000).optional(),
  splits: z
    .array(
      z.object({
        category: z.string().trim().min(1),
        // Splits mirror the parent transaction, which can be signed.
        amountCents: centsSchema({
          min: -MAX_MONEY * 100,
          label: "Split amount"
        })
      })
    )
    .min(2)
    .optional()
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const actor = await requirePermission(request, "canManagePayments");
    const { transactionId } = await params;
    const id = z.string().uuid().parse(transactionId);
    const input = updateSchema.parse(await request.json());

    const payment = await prisma.$transaction(async (transaction) => {
      const current = await transaction.paymentTransaction.findFirst({
        where: { id, organizationId: actor.organizationId }
      });
      if (!current)
        throw new BillingError(
          "TRANSACTION_NOT_FOUND",
          "Transaction not found.",
          404
        );
      if (input.action === "cancel" && current.status === "paid") {
        throw new BillingError(
          "PAID_TRANSACTION_LOCKED",
          "Paid transactions must be refunded, not cancelled.",
          409
        );
      }

      let eventId = current.eventId;
      let clientId = current.clientId;
      if (input.action === "match") {
        if (!input.eventId)
          throw new BillingError("EVENT_REQUIRED", "Choose an event to match.");
        const event = await transaction.event.findFirst({
          where: {
            id: input.eventId,
            organizationId: actor.organizationId,
            deleted: false
          },
          select: { id: true, clientId: true }
        });
        if (!event)
          throw new BillingError("EVENT_NOT_FOUND", "Event not found.", 404);
        eventId = event.id;
        clientId = event.clientId;
      }

      const previousMetadata =
        current.metadata &&
        typeof current.metadata === "object" &&
        !Array.isArray(current.metadata)
          ? current.metadata
          : {};
      const updated = await transaction.paymentTransaction.update({
        where: { id, organizationId: actor.organizationId },
        data: {
          eventId,
          clientId,
          status: input.action === "cancel" ? "cancelled" : current.status,
          note: input.note ?? current.note,
          metadata: {
            ...previousMetadata,
            category:
              input.category ??
              (previousMetadata as Record<string, unknown>).category,
            matchedAt:
              input.action === "match"
                ? new Date().toISOString()
                : (previousMetadata as Record<string, unknown>).matchedAt,
            matchedById:
              input.action === "match"
                ? actor.id
                : (previousMetadata as Record<string, unknown>).matchedById,
            cancelledAt:
              input.action === "cancel"
                ? new Date().toISOString()
                : (previousMetadata as Record<string, unknown>).cancelledAt,
            splits:
              input.action === "split"
                ? input.splits
                : (previousMetadata as Record<string, unknown>).splits
          } as Prisma.InputJsonObject
        }
      });
      await transaction.activityLog.create({
        data: {
          organizationId: actor.organizationId,
          eventId,
          clientId,
          userId: actor.id,
          userName: actor.name,
          actionType: `Billing Transaction ${input.action}`,
          message: `${input.action} transaction ${current.providerReference ?? current.id}.`,
          oldValue: {
            eventId: current.eventId,
            status: current.status,
            metadata: current.metadata
          },
          newValue: {
            eventId: updated.eventId,
            status: updated.status,
            metadata: updated.metadata
          }
        }
      });
      return updated;
    });
    return NextResponse.json({ transaction: payment });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
