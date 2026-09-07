import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { getPlaidRuntimeConfig } from "@/lib/plaid";
import { createActivityLog } from "@/lib/audit/activity-log";
import { withRoute } from "@/lib/http/with-route";
import { trackedFetch } from "@/lib/logging/outbound";

const exchangeSchema = z.object({
  publicToken: z.string().min(1),
  institutionName: z.string().optional(),
  institutionId: z.string().optional(),
  metadata: z
    .object({
      accountId: z.string().optional(),
      accountName: z.string().optional(),
      accountType: z.string().optional()
    })
    .optional()
});

export const POST = withRoute(
  "POST /api/billing/plaid/exchange",
  async (request: Request) => {
    try {
      const actor = await authorize(request, "bank.connect");
      const input = exchangeSchema.parse(await request.json());
      const config = getPlaidRuntimeConfig();

      if (!config.enabled) {
        return NextResponse.json(
          {
            error:
              "Plaid is not configured yet. Add PLAID_CLIENT_ID and PLAID_SECRET to enable live connections."
          },
          { status: 503 }
        );
      }

      const response = await trackedFetch(
        { vendor: "plaid", operation: "item/public_token/exchange" },
        `${config.baseUrl}/item/public_token/exchange`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            client_id: config.clientId,
            secret: config.secret,
            public_token: input.publicToken
          })
        }
      );

      const payload = await response.json();

      if (!response.ok) {
        return NextResponse.json(
          {
            error:
              payload?.error_message ??
              "Unable to exchange the Plaid public token."
          },
          { status: 502 }
        );
      }

      const connection = await prisma.$transaction(async (transaction) => {
        const created = await transaction.bankConnection.create({
          data: {
            organizationId: actor.organizationId,
            userId: actor.userId,
            plaidItemId: payload.item_id,
            plaidAccessToken: payload.access_token,
            institutionId: input.institutionId,
            institutionName: input.institutionName,
            accountId: input.metadata?.accountId,
            accountName: input.metadata?.accountName,
            accountType: input.metadata?.accountType,
            status: "CONNECTED"
          }
        });

        await createActivityLog(transaction, {
          organizationId: actor.organizationId,
          userId: actor.userId,
          userName: actor.actorName,
          actionType: "plaid.connection.created",
          message: `Connected a Plaid bank account for ${input.institutionName ?? "the selected institution"}.`,
          newValue: {
            bankConnectionId: created.id,
            institutionName: input.institutionName ?? null,
            accountName: input.metadata?.accountName ?? null,
            accountType: input.metadata?.accountType ?? null
          }
        });

        return created;
      });

      return NextResponse.json({
        connection,
        organizationId: actor.organizationId
      });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);
