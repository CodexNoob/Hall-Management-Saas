import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { BillingError } from "@/features/billing/services/billing-error";

const schema = z.object({
  rows: z
    .array(
      z.object({
        date: z.string().date(),
        description: z.string().trim().min(1),
        amountCents: z.number().int(),
        currency: z.string().length(3).default("USD")
      })
    )
    .min(1)
    .max(5000)
});

export async function POST(request: Request) {
  try {
    const actor = await requirePermission(request, "canManagePayments");
    const input = schema.parse(await request.json());
    const connection = await prisma.bankConnection.findFirst({
      where: { organizationId: actor.organizationId, status: "CONNECTED" },
      orderBy: { updatedAt: "desc" }
    });
    if (!connection)
      throw new BillingError(
        "BANK_CONNECTION_REQUIRED",
        "Connect a bank account before importing a bank file.",
        409
      );
    const result = await prisma.bankTransaction.createMany({
      data: input.rows.map((row) => ({
        organizationId: actor.organizationId,
        bankConnectionId: connection.id,
        description: row.description,
        amountCents: row.amountCents,
        currency: row.currency.toUpperCase(),
        transactionDate: new Date(`${row.date}T00:00:00.000Z`),
        status: "PENDING",
        metadata: { source: "csv-import", importedById: actor.id }
      }))
    });
    await prisma.activityLog.create({
      data: {
        organizationId: actor.organizationId,
        userId: actor.id,
        userName: actor.name,
        actionType: "Bank File Imported",
        message: `Imported ${result.count} bank transactions.`,
        newValue: { count: result.count, bankConnectionId: connection.id }
      }
    });
    return NextResponse.json({ imported: result.count }, { status: 201 });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
