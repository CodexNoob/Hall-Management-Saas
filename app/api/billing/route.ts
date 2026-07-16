import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";

const invoiceSchema = z.object({
  eventId: z.string().uuid().optional(),
  invoiceNumber: z.string().trim().min(1),
  clientName: z.string().trim().min(1),
  status: z.enum(["Draft", "Open", "Paid", "Overdue"]).default("Draft"),
  dueDate: z.string().date().optional(),
  totalCents: z.number().int().nonnegative(),
  notes: z.string().trim().optional()
});

export async function GET(request: Request) {
  try {
    const actor = await requirePermission(request, "canViewPaymentInfo");
    const [transactions, invoices, events] = await Promise.all([
      prisma.paymentTransaction.findMany({
        where: { organizationId: actor.organizationId },
        include: { event: { select: { clientName: true, eventDate: true } } },
        orderBy: { createdAt: "desc" },
        take: 50
      }),
      prisma.invoice.findMany({
        where: { organizationId: actor.organizationId },
        include: { event: { select: { eventDate: true, hallName: true } } },
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
          paymentStatus: true
        },
        orderBy: { eventDate: "desc" },
        take: 50
      })
    ]);

    const paidCents = transactions
      .filter((item) => item.status === "paid")
      .reduce((sum, item) => sum + item.amountCents, 0);
    const openInvoiceCents = invoices.reduce(
      (sum, invoice) =>
        sum + Math.max(0, invoice.totalCents - invoice.amountPaidCents),
      0
    );

    return NextResponse.json({
      transactions,
      invoices,
      events,
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

    const invoice = await prisma.invoice.create({
      data: {
        organizationId: actor.organizationId,
        clientId: event?.clientId,
        ...input,
        dueDate: input.dueDate
          ? new Date(`${input.dueDate}T00:00:00.000Z`)
          : undefined
      }
    });
    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
