import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/authz/authorize";
import { recordPaymentWithAudit } from "@/features/billing/services/record-payment.service";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { centsSchema } from "@/lib/validation/number";
import { withRoute } from "@/lib/http/with-route";

const confirmationSchema = z.object({
  invoiceId: z.string().uuid().optional(),
  paymentScheduleId: z.string().uuid().optional(),
  amountCents: centsSchema({ min: 1, label: "Amount" }),
  result: z.enum(["paid", "failed", "cancelled"]),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
  provider: z.string().trim().min(1).max(100).optional(),
  providerReference: z.string().trim().min(1).max(255).optional(),
  note: z.string().optional()
});

export const POST = withRoute(
  "POST /api/events/[eventId]/payments",
  async (
  request: Request,
    { params }: { params: Promise<{ eventId: string }> }
  ) => {
    try {
      const actor = await authorize(request, "payment.record");
      const { eventId: rawEventId } = await params;
      const eventId = z.string().uuid().parse(rawEventId);
      const input = confirmationSchema.parse(await request.json());

      const result = await recordPaymentWithAudit(actor, { eventId, ...input });

      return NextResponse.json(result, { status: 201 });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);
