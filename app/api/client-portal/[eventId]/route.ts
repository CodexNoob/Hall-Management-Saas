import { NextResponse } from "next/server";
import { z } from "zod";

import { getClientPortalEvent } from "@/features/events/server/client-portal-data";
import { getOrganizationPaymentLink } from "@/lib/payments/payment-settings";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { withRoute } from "@/lib/http/with-route";

/**
 * The portal DTO, for the dashboard's client-portal preview.
 *
 * Public on purpose: this returns exactly what /client/[eventId] already
 * renders to anyone holding the link, so it exposes nothing new. Serving it
 * from one place keeps the staff preview honest - before this, the preview
 * showed hardcoded prices that no client would ever see.
 */
export const GET = withRoute(
  "GET /api/client-portal/[eventId]",
  async (
  request: Request,
    context: { params: Promise<{ eventId: string }> }
  ) => {
    try {
      const limited = await enforceRateLimit(request, {
        scope: "client-portal-read",
        limit: 60,
        windowMs: 60_000
      });

      if (limited) return limited;

      const { eventId } = await context.params;

      if (!z.string().uuid().safeParse(eventId).success) {
        return NextResponse.json({ error: "Event not found." }, { status: 404 });
      }

      const lookup = await getClientPortalEvent(eventId);

      if (!lookup) {
        return NextResponse.json({ error: "Event not found." }, { status: 404 });
      }

      const paymentUrl = await getOrganizationPaymentLink(lookup.organizationId);

      return NextResponse.json({ portal: lookup.portal, paymentUrl });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);
