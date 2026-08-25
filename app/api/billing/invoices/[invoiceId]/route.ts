import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { BillingError } from "@/features/billing/services/billing-error";
import { authorize } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { centsSchema, quantitySchema } from "@/lib/validation/number";

const lineItemSchema = z.object({
  description: z.string().trim().min(1).max(255),
  quantity: quantitySchema(),
  unitAmountCents: centsSchema({ label: "Unit amount" })
});

const updateInvoiceSchema = z.object({
  clientName: z.string().trim().min(1).max(255),
  status: z.enum(["Draft", "Sent", "Open"]),
  dueDate: z.string().date().nullable(),
  notes: z.string().trim().max(4000).nullable(),
  lineItems: z.array(lineItemSchema).min(1).max(100)
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const actor = await authorize(request, "invoice.update");
    const { invoiceId: rawInvoiceId } = await params;
    const invoiceId = z.string().uuid().parse(rawInvoiceId);
    const input = updateInvoiceSchema.parse(await request.json());

    const invoice = await prisma.$transaction(
      async (transaction) => {
        const current = await transaction.invoice.findFirst({
          where: { id: invoiceId, organizationId: actor.organizationId },
          include: { lineItems: { orderBy: { sortOrder: "asc" } } }
        });

        if (!current) {
          throw new BillingError(
            "INVOICE_NOT_FOUND",
            "Invoice not found.",
            400
          );
        }
        if (current.status === "Paid" || current.status === "Cancelled") {
          throw new BillingError(
            "INVOICE_LOCKED",
            `${current.status} invoices cannot be edited.`,
            409
          );
        }

        const lineItems = input.lineItems.map((item, sortOrder) => {
          const subtotalCents = Math.round(
            item.quantity * item.unitAmountCents
          );
          return {
            ...item,
            subtotalCents,
            discountCents: 0,
            taxCents: 0,
            totalCents: subtotalCents,
            sortOrder
          };
        });
        const subtotalCents = lineItems.reduce(
          (sum, item) => sum + item.subtotalCents,
          0
        );
        const totalCents = Math.max(
          0,
          subtotalCents - current.discountCents + current.taxCents
        );

        if (totalCents < current.amountPaidCents) {
          throw new BillingError(
            "TOTAL_BELOW_PAID",
            "Invoice total cannot be lower than the amount already paid.",
            409
          );
        }

        const balanceDueCents = totalCents - current.amountPaidCents;
        await transaction.invoiceLineItem.deleteMany({
          where: { invoiceId, organizationId: actor.organizationId }
        });

        const updated = await transaction.invoice.update({
          where: { id: invoiceId, organizationId: actor.organizationId },
          data: {
            clientName: input.clientName,
            status: input.status === "Open" ? "Sent" : input.status,
            dueDate: input.dueDate
              ? new Date(`${input.dueDate}T00:00:00.000Z`)
              : null,
            notes: input.notes || null,
            issuedAt:
              input.status === "Draft"
                ? null
                : (current.issuedAt ?? new Date()),
            subtotalCents,
            totalCents,
            balanceDueCents,
            lineItems: {
              create: lineItems.map((item) => ({
                organizationId: actor.organizationId,
                ...item
              }))
            }
          },
          include: {
            event: { select: { eventDate: true, hallName: true } },
            lineItems: { orderBy: { sortOrder: "asc" } },
            discounts: true,
            taxes: true,
            paymentSchedule: { orderBy: { sortOrder: "asc" } },
            balance: true,
            receipts: { orderBy: { issuedAt: "desc" } }
          }
        });

        await transaction.invoiceBalance.upsert({
          where: { invoiceId },
          create: {
            organizationId: actor.organizationId,
            invoiceId,
            subtotalCents,
            discountCents: current.discountCents,
            taxCents: current.taxCents,
            totalCents,
            paidCents: current.amountPaidCents,
            outstandingCents: balanceDueCents
          },
          update: {
            subtotalCents,
            totalCents,
            paidCents: current.amountPaidCents,
            outstandingCents: balanceDueCents
          }
        });

        await transaction.activityLog.create({
          data: {
            organizationId: actor.organizationId,
            eventId: current.eventId,
            clientId: current.clientId,
            userId: actor.userId,
            userName: actor.actorName,
            actionType: "Invoice Updated",
            message: `Updated invoice ${current.invoiceNumber}.`,
            oldValue: {
              invoiceId,
              clientName: current.clientName,
              status: current.status,
              dueDate: current.dueDate,
              subtotalCents: current.subtotalCents,
              totalCents: current.totalCents,
              balanceDueCents: current.balanceDueCents
            },
            newValue: {
              invoiceId,
              clientName: updated.clientName,
              status: updated.status,
              dueDate: updated.dueDate,
              subtotalCents,
              totalCents,
              balanceDueCents
            }
          }
        });

        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    return NextResponse.json({ invoice });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
