import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/server-auth";
import { recordRefundWithAudit } from "@/features/billing/services/record-refund.service";
import { createApiErrorResponse } from "@/lib/http/api-error";

const refundSchema = z.object({
  paymentTransactionId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  reason: z.string().trim().min(1).max(500).optional(),
  provider: z.string().trim().min(1).max(100).optional(),
  providerReference: z.string().trim().min(1).max(255).optional()
});

export async function POST(request: Request) {
  try {
    const actor = await requirePermission(request, "canManagePayments");
    const input = refundSchema.parse(await request.json());
    const result = await recordRefundWithAudit(actor, input);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
