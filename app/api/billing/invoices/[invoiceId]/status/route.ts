import { NextResponse } from "next/server";
import { z } from "zod";
import {
  invoiceStatuses,
  transitionInvoiceStatus
} from "@/features/billing/services/invoice-lifecycle.service";
import { requirePermission } from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";

const schema = z.object({
  status: z.enum(invoiceStatuses),
  reason: z.string().trim().max(500).optional()
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const actor = await requirePermission(request, "canManagePayments");
    const { invoiceId } = await params;
    const id = z.string().uuid().parse(invoiceId);
    const input = schema.parse(await request.json());
    const invoice = await transitionInvoiceStatus(
      actor,
      id,
      input.status,
      input.reason
    );
    return NextResponse.json({ invoice });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
