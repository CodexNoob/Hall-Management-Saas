import { NextResponse } from "next/server";
import { authorize } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { withRoute } from "@/lib/http/with-route";

export const GET = withRoute(
  "GET /api/billing/plaid/connection",
  async (request: Request) => {
    try {
      const actor = await authorize(request, "bank.connect");
      const connection = await prisma.bankConnection.findFirst({
        where: { organizationId: actor.organizationId, status: "CONNECTED" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          institutionName: true,
          accountName: true,
          accountType: true,
          status: true,
          lastSyncedAt: true
        }
      });

      return NextResponse.json({
        connected: Boolean(connection),
        connection
      });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);
