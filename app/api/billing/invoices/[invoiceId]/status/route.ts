import { NextResponse } from "next/server";
import { z } from "zod";
import {
  invoiceStatuses,
  transitionInvoiceStatus
} from "@/features/billing/services/invoice-lifecycle.service";
import { authorize, requireUserActor } from "@/lib/authz/authorize";
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
    const actor = await authorize(request, "invoice.update");
    const { invoiceId } = await params;
    const id = z.string().uuid().parse(invoiceId);
    const input = schema.parse(await request.json());
    const invoice = await transitionInvoiceStatus(
      { id: requireUserActor(actor), name: actor.actorName, organizationId: actor.organizationId },
      id,
      input.status,
      input.reason
    );
    return NextResponse.json({ invoice });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
