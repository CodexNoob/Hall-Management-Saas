import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { stripeRequest } from "@/features/billing/services/stripe.service";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { MVP_LANDING_ROUTE } from "@/lib/ui/mvp-features";

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
    const limited = await enforceRateLimit(request, {
      scope: "stripe-subscription-checkout",
      limit: 5,
      windowMs: 5 * 60 * 1000
    });
    if (limited) return limited;

    const actor = await authorize(request, "settings.update");
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
    // Stripe sends the customer back here itself, so these have to name a page
    // that exists. They pointed at /dashboard/settings until that route was
    // deleted, which would have returned everyone who just paid to a 404. The
    // query stays on the URL even though nothing reads it yet - it costs
    // nothing and is the only record of how the customer arrived.
    const session = await stripeRequest<CheckoutSession>("checkout/sessions", {
      mode: "subscription",
      success_url: `${origin}${MVP_LANDING_ROUTE}?subscription=success`,
      cancel_url: `${origin}${MVP_LANDING_ROUTE}?subscription=cancelled`,
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
