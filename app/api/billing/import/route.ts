import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { BillingError } from "@/features/billing/services/billing-error";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { MAX_MONEY, centsSchema } from "@/lib/validation/number";
import { withRoute } from "@/lib/http/with-route";

const schema = z.object({
  rows: z
    .array(
      z.object({
        date: z.string().date(),
        description: z.string().trim().min(1),
        // Imported rows are signed - a debit is negative - so bound the
        // magnitude in both directions rather than requiring a positive value.
        amountCents: centsSchema({
          min: -MAX_MONEY * 100,
          label: "Amount"
        }),
        currency: z.string().length(3).default("USD")
      })
    )
    .min(1)
    .max(5000)
});

export const POST = withRoute(
  "POST /api/billing/import",
  async (request: Request) => {
    try {
      const limited = await enforceRateLimit(request, {
        scope: "billing-import",
        limit: 5,
        windowMs: 10 * 60 * 1000
      });
      if (limited) return limited;

      const actor = await authorize(request, "bank.connect");
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
          metadata: { source: "csv-import", importedById: actor.userId }
        }))
      });
      await prisma.activityLog.create({
        data: {
          organizationId: actor.organizationId,
          userId: actor.userId,
          userName: actor.actorName,
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
);
