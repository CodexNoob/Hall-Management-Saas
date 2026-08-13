import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/server-auth";
import { recordRefundWithAudit } from "@/features/billing/services/record-refund.service";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { stripeRequest } from "@/features/billing/services/stripe.service";
import { prisma } from "@/lib/prisma";
import { centsSchema } from "@/lib/validation/number";

const refundSchema = z.object({
  paymentTransactionId: z.string().uuid(),
  amountCents: centsSchema({ min: 1, label: "Amount" }),
  reason: z.string().trim().min(1).max(500).optional(),
  provider: z.string().trim().min(1).max(100).optional(),
  providerReference: z.string().trim().min(1).max(255).optional()
});

export async function POST(request: Request) {
  try {
    const actor = await requirePermission(request, "canManagePayments");
    let input = refundSchema.parse(await request.json());
    const payment = await prisma.paymentTransaction.findFirst({
      where: {
        id: input.paymentTransactionId,
        organizationId: actor.organizationId
      },
      select: { provider: true, providerReference: true }
    });
    if (payment?.provider === "stripe" && payment.providerReference) {
      const stripeRefund = await stripeRequest<{ id: string; status: string }>(
        "refunds",
        {
          payment_intent: payment.providerReference,
          amount: input.amountCents,
          reason: "requested_by_customer",
          "metadata[organizationId]": actor.organizationId,
          "metadata[paymentTransactionId]": input.paymentTransactionId
        }
      );
      input = {
        ...input,
        provider: "stripe",
        providerReference: stripeRefund.id
      };
    }
    const result = await recordRefundWithAudit(actor, input);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
