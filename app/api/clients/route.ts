import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { phoneSchema } from "@/lib/validation/phone";

const clientInputSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().email().optional(),
  phone: phoneSchema({ label: "Client phone" }),
  status: z.enum(["Active", "Inactive", "Lead"]).default("Active"),
  tags: z.array(z.string().trim().min(1)).default([]),
  notes: z.string().trim().optional()
});

const clientUpdateSchema = clientInputSchema
  .partial()
  .extend({ id: z.string().uuid() });

export async function GET(request: Request) {
  try {
    const actor = await authorize(request, "client.read");
    const clients = await prisma.client.findMany({
      where: { organizationId: actor.organizationId },
      orderBy: { name: "asc" },
      include: {
        events: {
          where: { deleted: false },
          orderBy: { eventDate: "desc" },
          select: {
            id: true,
            clientName: true,
            eventDate: true,
            eventType: true,
            eventStatus: true,
            hallName: true,
            finalTotal: true,
            amountDue: true
          }
        },
        invoices: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            totalCents: true,
            amountPaidCents: true,
            balanceDueCents: true,
            dueDate: true
          }
        },
        paymentTransactions: {
          where: { status: "paid" },
          select: { amountCents: true }
        },
        storedFiles: { select: { id: true } },
        activityLogs: {
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { id: true, actionType: true, message: true, createdAt: true }
        }
      },
      take: 100
    });

    return NextResponse.json({
      clients: clients.map((client) => ({
        ...client,
        totalBilledCents: client.invoices.reduce(
          (sum, invoice) => sum + invoice.totalCents,
          0
        ),
        totalPaidCents: client.paymentTransactions.reduce(
          (sum, payment) => sum + payment.amountCents,
          0
        ),
        outstandingCents: client.invoices.reduce(
          (sum, invoice) => sum + invoice.balanceDueCents,
          0
        ),
        fileCount: client.storedFiles.length,
        paymentTransactions: undefined,
        storedFiles: undefined
      }))
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await authorize(request, "client.create");
    const input = clientInputSchema.parse(await request.json());
    const client = await prisma.$transaction(async (transaction) => {
      const created = await transaction.client.create({
        data: { organizationId: actor.organizationId, ...input }
      });
      await transaction.activityLog.create({
        data: {
          organizationId: actor.organizationId,
          clientId: created.id,
          userId: actor.userId,
          userName: actor.actorName,
          actionType: "Client Created",
          message: `Created client ${created.name}.`
        }
      });
      return created;
    });
    return NextResponse.json({ client }, { status: 201 });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await authorize(request, "client.update");
    const { id, ...input } = clientUpdateSchema.parse(await request.json());
    const existing = await prisma.client.findFirst({
      where: { id, organizationId: actor.organizationId },
      select: { id: true, name: true }
    });
    if (!existing)
      return NextResponse.json({ error: "Client not found." }, { status: 404 });

    const client = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.client.update({
        where: { id },
        data: input
      });
      await transaction.activityLog.create({
        data: {
          organizationId: actor.organizationId,
          clientId: id,
          userId: actor.userId,
          userName: actor.actorName,
          actionType: "Client Updated",
          message: `Updated client ${updated.name}.`
        }
      });
      return updated;
    });
    return NextResponse.json({ client });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
