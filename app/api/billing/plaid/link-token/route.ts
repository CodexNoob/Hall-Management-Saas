import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { getPlaidRuntimeConfig } from "@/lib/plaid";

export async function POST(request: Request) {
  try {
    const actor = await requirePermission(request, "canManagePayments");
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

    const response = await fetch(`${config.baseUrl}/link/token/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        client_id: config.clientId,
        secret: config.secret,
        user: { client_user_id: actor.id },
        client_name: "Event Core",
        products: ["transactions"],
        country_codes: ["US"],
        language: "en",
        webhook: process.env.PLAID_WEBHOOK_URL ?? undefined,
        redirect_uri: process.env.NEXT_PUBLIC_APP_URL
      })
    });

    const payload = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            payload?.error_message ?? "Unable to create a Plaid link token."
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      linkToken: payload.link_token,
      mode: config.mode,
      organizationId: actor.organizationId
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
