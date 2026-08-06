import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { refreshOverdueInvoices } from "@/features/billing/services/invoice-lifecycle.service";

const invoiceLineItemSchema = z.object({
  description: z.string().trim().min(1),
  quantity: z.number().positive().default(1),
  unitAmountCents: z.number().int().nonnegative(),
  discountCents: z.number().int().nonnegative().default(0),
  taxCents: z.number().int().nonnegative().default(0)
});

const invoiceSchema = z
  .object({
    eventId: z.string().uuid().optional(),
    invoiceNumber: z.string().trim().min(1).optional(),
    clientName: z.string().trim().min(1),
    status: z.enum(["Draft", "Sent", "Open"]).default("Draft"),
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((value) => value.toUpperCase())
      .default("USD"),
    dueDate: z.string().date().optional(),
    totalCents: z.number().int().nonnegative().optional(),
    lineItems: z.array(invoiceLineItemSchema).default([]),
    discounts: z
      .array(
        z.object({
          name: z.string().trim().min(1),
          discountType: z.enum(["FIXED", "PERCENTAGE"]).default("FIXED"),
          value: z.number().nonnegative(),
          amountCents: z.number().int().nonnegative(),
          reason: z.string().trim().optional()
        })
      )
      .default([]),
    taxes: z
      .array(
        z.object({
          name: z.string().trim().min(1),
          taxType: z.enum(["FIXED", "PERCENTAGE"]).default("PERCENTAGE"),
          rate: z.number().nonnegative().optional(),
          amountCents: z.number().int().nonnegative(),
          jurisdiction: z.string().trim().optional()
        })
      )
      .default([]),
    paymentSchedule: z
      .array(
        z.object({
          scheduleType: z
            .enum(["DEPOSIT", "INSTALLMENT", "FINAL"])
            .default("INSTALLMENT"),
          label: z.string().trim().min(1),
          dueDate: z.string().date(),
          amountCents: z.number().int().positive()
        })
      )
      .default([]),
    notes: z.string().trim().optional()
  })
  .refine(
    (input) => input.lineItems.length > 0 || input.totalCents !== undefined,
    {
      message: "Provide at least one line item or totalCents."
    }
  );

export async function GET(request: Request) {
  try {
    const actor = await requirePermission(request, "canViewPaymentInfo");
    await refreshOverdueInvoices(actor.organizationId);
    const [transactions, invoices, events, invoiceHistory] = await Promise.all([
      prisma.paymentTransaction.findMany({
        where: { organizationId: actor.organizationId },
        include: { event: { select: { clientName: true, eventDate: true } } },
        orderBy: { createdAt: "desc" },
        take: 50
      }),
      prisma.invoice.findMany({
        where: { organizationId: actor.organizationId },
        include: {
          event: { select: { eventDate: true, hallName: true } },
          lineItems: { orderBy: { sortOrder: "asc" } },
          discounts: true,
          taxes: true,
          paymentSchedule: { orderBy: { sortOrder: "asc" } },
          balance: true,
          receipts: { orderBy: { issuedAt: "desc" } }
        },
        orderBy: { createdAt: "desc" },
        take: 50
      }),
      prisma.event.findMany({
        where: { organizationId: actor.organizationId, deleted: false },
        select: {
          id: true,
          clientName: true,
          eventDate: true,
          finalTotal: true,
          amountDue: true,
          paymentStatus: true,
          hallName: true,
          eventType: true,
          eventStatus: true
        },
        orderBy: { eventDate: "desc" },
        take: 50
      }),
      prisma.activityLog.findMany({
        where: {
          organizationId: actor.organizationId,
          actionType: {
            in: ["Invoice Created", "Invoice Updated", "Invoice Status Changed"]
          }
        },
        select: {
          id: true,
          actionType: true,
          message: true,
          newValue: true,
          oldValue: true,
          userName: true,
          createdAt: true
        },
        orderBy: { createdAt: "desc" },
        take: 200
      })
    ]);

    const paidCents = transactions
      .filter((item) => item.status === "paid")
      .reduce(
        (sum, item) => sum + item.amountCents - item.refundedAmountCents,
        0
      );
    const openInvoiceCents = invoices.reduce(
      (sum, invoice) => sum + invoice.balanceDueCents,
      0
    );

    return NextResponse.json({
      transactions,
      invoices,
      events,
      invoiceHistory,
      summary: {
        paidCents,
        openInvoiceCents,
        openInvoices: invoices.filter((item) => item.status !== "Paid").length
      }
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermission(request, "canManagePayments");
    const input = invoiceSchema.parse(await request.json());

    const event = input.eventId
      ? await prisma.event.findFirst({
          where: { id: input.eventId, organizationId: actor.organizationId },
          select: { id: true, clientId: true }
        })
      : null;
    if (input.eventId) {
      if (!event)
        return NextResponse.json(
          { error: "Event not found." },
          { status: 404 }
        );
    }

    const computedLineItems = input.lineItems.map((lineItem, index) => {
      const subtotalCents = Math.round(
        lineItem.quantity * lineItem.unitAmountCents
      );
      return {
        ...lineItem,
        subtotalCents,
        totalCents: Math.max(
          0,
          subtotalCents - lineItem.discountCents + lineItem.taxCents
        ),
        sortOrder: index
      };
    });
    const subtotalCents =
      computedLineItems.length > 0
        ? computedLineItems.reduce(
            (sum, lineItem) => sum + lineItem.subtotalCents,
            0
          )
        : (input.totalCents ?? 0);
    const discountCents = input.discounts.reduce(
      (sum, discount) => sum + discount.amountCents,
      0
    );
    const taxCents = input.taxes.reduce((sum, tax) => sum + tax.amountCents, 0);
    const totalCents = Math.max(0, subtotalCents - discountCents + taxCents);
    const scheduledCents = input.paymentSchedule.reduce(
      (sum, schedule) => sum + schedule.amountCents,
      0
    );

    if (scheduledCents > totalCents) {
      return NextResponse.json(
        { error: "Payment schedule cannot exceed the invoice total." },
        { status: 400 }
      );
    }

    const invoice = await prisma.$transaction(async (transaction) => {
      const invoiceNumber =
        input.invoiceNumber ??
        `INV-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      const created = await transaction.invoice.create({
        data: {
          organizationId: actor.organizationId,
          eventId: input.eventId,
          clientId: event?.clientId,
          invoiceNumber,
          clientName: input.clientName,
          status: input.status === "Open" ? "Sent" : input.status,
          currency: input.currency,
          dueDate: input.dueDate
            ? new Date(`${input.dueDate}T00:00:00.000Z`)
            : undefined,
          issuedAt: input.status === "Draft" ? undefined : new Date(),
          subtotalCents,
          discountCents,
          taxCents,
          totalCents,
          balanceDueCents: totalCents,
          notes: input.notes,
          lineItems: {
            create: computedLineItems.map((lineItem) => ({
              organizationId: actor.organizationId,
              ...lineItem
            }))
          },
          discounts: {
            create: input.discounts.map((discount) => ({
              organizationId: actor.organizationId,
              ...discount
            }))
          },
          taxes: {
            create: input.taxes.map((tax) => ({
              organizationId: actor.organizationId,
              ...tax
            }))
          },
          paymentSchedule: {
            create: input.paymentSchedule.map((schedule, index) => ({
              organizationId: actor.organizationId,
              ...schedule,
              dueDate: new Date(`${schedule.dueDate}T00:00:00.000Z`),
              sortOrder: index
            }))
          },
          balance: {
            create: {
              organizationId: actor.organizationId,
              subtotalCents,
              discountCents,
              taxCents,
              totalCents,
              outstandingCents: totalCents
            }
          }
        },
        include: {
          lineItems: true,
          discounts: true,
          taxes: true,
          paymentSchedule: true,
          balance: true
        }
      });

      await transaction.activityLog.create({
        data: {
          organizationId: actor.organizationId,
          eventId: event?.id,
          clientId: event?.clientId,
          userId: actor.id,
          userName: actor.name,
          actionType: "Invoice Created",
          message: `Created invoice ${created.invoiceNumber}.`,
          newValue: {
            invoiceId: created.id,
            subtotalCents,
            discountCents,
            taxCents,
            totalCents,
            scheduledCents
          }
        }
      });

      return created;
    });
    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
