import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/server-auth";
import { recordPaymentWithAudit } from "@/lib/billing/record-payment";
import { createApiErrorResponse } from "@/lib/http/api-error";

const confirmationSchema = z.object({
  invoiceId: z.string().uuid().optional(),
  paymentScheduleId: z.string().uuid().optional(),
  amountCents: z.number().int().positive(),
  result: z.enum(["paid", "failed", "cancelled"]),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
  provider: z.string().trim().min(1).max(100).optional(),
  providerReference: z.string().trim().min(1).max(255).optional(),
  note: z.string().optional()
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const actor = await requirePermission(request, "canManagePayments");
    const { eventId: rawEventId } = await params;
    const eventId = z.string().uuid().parse(rawEventId);
    const input = confirmationSchema.parse(await request.json());

    const result = await recordPaymentWithAudit(actor, { eventId, ...input });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
