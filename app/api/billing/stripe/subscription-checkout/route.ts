import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { stripeRequest } from "@/features/billing/services/stripe.service";

const schema = z.object({
  planId: z.enum(["starter", "professional", "enterprise"])
});
type CheckoutSession = { id: string; url: string | null };

const priceVariables = {
  starter: "STRIPE_STARTER_PRICE_ID",
  professional: "STRIPE_PROFESSIONAL_PRICE_ID",
  enterprise: "STRIPE_ENTERPRISE_PRICE_ID"
} as const;

export async function POST(request: Request) {
  try {
    const actor = await requirePermission(request, "canEditSettings");
    const { planId } = schema.parse(await request.json());
    const priceId = process.env[priceVariables[planId]];
    if (!priceId) {
      return NextResponse.json(
        { error: `${priceVariables[planId]} is not configured.` },
        { status: 503 }
      );
    }
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const session = await stripeRequest<CheckoutSession>("checkout/sessions", {
      mode: "subscription",
      success_url: `${origin}/dashboard/settings?subscription=success`,
      cancel_url: `${origin}/dashboard/settings?subscription=cancelled`,
      "line_items[0][quantity]": 1,
      "line_items[0][price]": priceId,
      "metadata[organizationId]": actor.organizationId,
      "metadata[subscriptionPlan]": planId,
      "subscription_data[metadata][organizationId]": actor.organizationId,
      "subscription_data[metadata][subscriptionPlan]": planId
    });
    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
