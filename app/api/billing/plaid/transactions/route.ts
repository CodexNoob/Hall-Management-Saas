import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/server-auth";
import { prisma } from "@/lib/prisma";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { getPlaidRuntimeConfig } from "@/lib/plaid";
import { createActivityLog } from "@/lib/audit/activity-log";

type PlaidTransactionPayload = {
  transaction_id?: string;
  account_id?: string;
  name?: string;
  merchant_name?: string;
  original_description?: string;
  amount?: number;
  iso_currency_code?: string;
  date?: string;
};

export async function POST(request: Request) {
  try {
    const actor = await requirePermission(request, "canManagePayments");
    const config = getPlaidRuntimeConfig();

    if (!config.enabled) {
      return NextResponse.json(
        { error: "Plaid is not configured yet." },
        { status: 503 }
      );
    }

    const connection = await prisma.bankConnection.findFirst({
      where: { organizationId: actor.organizationId, status: "CONNECTED" },
      orderBy: { createdAt: "desc" }
    });

    if (!connection) {
      return NextResponse.json(
        { error: "No connected bank account found." },
        { status: 404 }
      );
    }

    const response = await fetch(`${config.baseUrl}/transactions/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: config.clientId,
        secret: config.secret,
        access_token: connection.plaidAccessToken
      })
    });

    const payload = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error: payload?.error_message ?? "Unable to sync Plaid transactions."
        },
        { status: 502 }
      );
    }

    const addedTransactions = Array.isArray(payload?.added)
      ? (payload.added as PlaidTransactionPayload[])
      : [];

    await prisma.$transaction(async (tx) => {
      if (addedTransactions.length > 0) {
        await tx.bankTransaction.createMany({
          data: addedTransactions.map((item) => ({
            organizationId: actor.organizationId,
            bankConnectionId: connection.id,
            plaidTransactionId: item.transaction_id,
            accountId: item.account_id,
            description:
              item.name ??
              item.merchant_name ??
              item.original_description ??
              null,
            amountCents: Math.round(Number(item.amount ?? 0) * 100),
            currency: item.iso_currency_code ?? "USD",
            transactionDate: new Date(item.date ?? new Date()),
            status: "PENDING",
            metadata: item
          }))
        });
      }

      await tx.bankConnection.update({
        where: { id: connection.id },
        data: { lastSyncedAt: new Date() }
      });

      await createActivityLog(tx, {
        organizationId: actor.organizationId,
        userId: actor.id,
        userName: actor.name,
        actionType: "plaid.sync.completed",
        message: `Synced ${addedTransactions.length} Plaid transaction(s).`,
        oldValue: { count: 0 },
        newValue: {
          count: addedTransactions.length,
          bankConnectionId: connection.id
        }
      });
    });

    return NextResponse.json({
      synced: true,
      count: addedTransactions.length,
      organizationId: actor.organizationId
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
