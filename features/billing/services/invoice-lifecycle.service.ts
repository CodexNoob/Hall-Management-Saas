import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BillingError } from "@/features/billing/services/billing-error";

export const invoiceStatuses = [
  "Draft",
  "Sent",
  "Partially Paid",
  "Paid",
  "Overdue",
  "Cancelled"
] as const;

export type InvoiceStatus = (typeof invoiceStatuses)[number];

const transitions: Record<InvoiceStatus, InvoiceStatus[]> = {
  Draft: ["Sent", "Cancelled"],
  Sent: ["Partially Paid", "Paid", "Overdue", "Cancelled"],
  "Partially Paid": ["Paid", "Overdue", "Cancelled"],
  Paid: [],
  Overdue: ["Partially Paid", "Paid", "Cancelled"],
  Cancelled: []
};

type BillingActor = {
  id: string;
  name?: string | null;
  organizationId: string;
};

export async function transitionInvoiceStatus(
  actor: BillingActor,
  invoiceId: string,
  nextStatus: InvoiceStatus,
  reason?: string
) {
  return prisma.$transaction(
    async (transaction) => {
      const invoice = await transaction.invoice.findFirst({
        where: { id: invoiceId, organizationId: actor.organizationId }
      });
      if (!invoice)
        throw new BillingError("INVOICE_NOT_FOUND", "Invoice not found.", 404);

      const currentStatus = invoice.status as InvoiceStatus;
      if (currentStatus === nextStatus) return invoice;
      if (!transitions[currentStatus]?.includes(nextStatus)) {
        throw new BillingError(
          "INVALID_INVOICE_TRANSITION",
          `Invoice cannot move from ${currentStatus} to ${nextStatus}.`,
          409
        );
      }
      if (nextStatus === "Paid" && invoice.balanceDueCents > 0) {
        throw new BillingError(
          "INVOICE_BALANCE_REMAINS",
          "Record the remaining payment before marking this invoice paid.",
          409
        );
      }

      const now = new Date();
      const updated = await transaction.invoice.update({
        where: { id: invoice.id, organizationId: actor.organizationId },
        data: {
          status: nextStatus,
          issuedAt:
            nextStatus === "Sent" ? (invoice.issuedAt ?? now) : undefined,
          paidAt: nextStatus === "Paid" ? (invoice.paidAt ?? now) : undefined,
          voidedAt: nextStatus === "Cancelled" ? now : undefined
        }
      });

      await transaction.activityLog.create({
        data: {
          organizationId: actor.organizationId,
          eventId: invoice.eventId,
          clientId: invoice.clientId,
          userId: actor.id,
          userName: actor.name,
          actionType: "Invoice Status Changed",
          message: `Invoice ${invoice.invoiceNumber} changed from ${currentStatus} to ${nextStatus}.`,
          oldValue: { invoiceId, status: currentStatus },
          newValue: { invoiceId, status: nextStatus, reason: reason ?? null }
        }
      });
      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function refreshOverdueInvoices(organizationId: string) {
  const now = new Date();
  const candidates = await prisma.invoice.findMany({
    where: {
      organizationId,
      dueDate: { lt: now },
      balanceDueCents: { gt: 0 },
      status: { in: ["Sent", "Partially Paid"] }
    },
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      eventId: true,
      clientId: true
    }
  });
  if (!candidates.length) return 0;

  await prisma.$transaction(async (transaction) => {
    for (const invoice of candidates) {
      await transaction.invoice.update({
        where: { id: invoice.id, organizationId },
        data: { status: "Overdue" }
      });
      await transaction.activityLog.create({
        data: {
          organizationId,
          eventId: invoice.eventId,
          clientId: invoice.clientId,
          actionType: "Invoice Status Changed",
          message: `Invoice ${invoice.invoiceNumber} became overdue.`,
          oldValue: { invoiceId: invoice.id, status: invoice.status },
          newValue: {
            invoiceId: invoice.id,
            status: "Overdue",
            reason: "Due date passed"
          }
        }
      });
    }
  });
  return candidates.length;
}
