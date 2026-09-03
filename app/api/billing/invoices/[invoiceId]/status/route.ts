import { NextResponse } from "next/server";
import { z } from "zod";
import {
  invoiceStatuses,
  transitionInvoiceStatus
} from "@/features/billing/services/invoice-lifecycle.service";
import {
  assertPermission,
  authorize,
  requireUserActor
} from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { withRoute } from "@/lib/http/with-route";

const schema = z.object({
  status: z.enum(invoiceStatuses),
  reason: z.string().trim().max(500).optional()
});

export const PATCH = withRoute(
  "PATCH /api/billing/invoices/[invoiceId]/status",
  async (
  request: Request,
    { params }: { params: Promise<{ invoiceId: string }> }
  ) => {
    try {
      const actor = await authorize(request, "invoice.update");
      const { invoiceId } = await params;
      const id = z.string().uuid().parse(invoiceId);
      const input = schema.parse(await request.json());

      // Cancelling stamps `voidedAt` - it reverses a billed amount without moving
      // cash, which is the accounting-side twin of a refund. Every other
      // transition is ordinary invoice bookkeeping, so the door asks for what
      // every caller needs and this one branch asks again for the dangerous key.
      if (input.status === "Cancelled") {
        await assertPermission(actor, "invoice.void");
      }

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
);
