import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { BillingError } from "@/features/billing/services/billing-error";
import { stripeRequest } from "@/features/billing/services/stripe.service";
import { enforceRateLimit } from "@/lib/security/rate-limit";

const schema = z.object({
  invoiceId: z.string().uuid(),
  amountCents: z.number().int().positive().optional(),
  customerEmail: z.string().email().optional()
});
type CheckoutSession = { id: string; url: string | null };

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit(request, {
      scope: "stripe-payment-checkout",
      limit: 10,
      windowMs: 60 * 1000
    });
    if (limited) return limited;

    const actor = await requirePermission(request, "canManagePayments");
    const input = schema.parse(await request.json());
    const invoice = await prisma.invoice.findFirst({
      where: { id: input.invoiceId, organizationId: actor.organizationId },
      include: { event: { select: { id: true, clientId: true } } }
    });
    if (!invoice)
      throw new BillingError("INVOICE_NOT_FOUND", "Invoice not found.", 404);
    if (!invoice.event)
      throw new BillingError(
        "INVOICE_EVENT_REQUIRED",
        "Stripe checkout requires an invoice linked to an event.",
        409
      );
    if (["Draft", "Cancelled", "Paid"].includes(invoice.status))
      throw new BillingError(
        "INVOICE_NOT_PAYABLE",
        `${invoice.status} invoices cannot be paid online.`,
        409
      );
    const amountCents = input.amountCents ?? invoice.balanceDueCents;
    if (amountCents <= 0 || amountCents > invoice.balanceDueCents)
      throw new BillingError(
        "INVALID_PAYMENT_AMOUNT",
        "Payment must be within the outstanding invoice balance."
      );

    const pending = await prisma.paymentTransaction.create({
      data: {
        organizationId: actor.organizationId,
        eventId: invoice.event.id,
        clientId: invoice.event.clientId,
        invoiceId: invoice.id,
        confirmedById: actor.id,
        amountCents,
        currency: invoice.currency,
        status: "pending",
        provider: "stripe",
        providerReference: `pending_${crypto.randomUUID()}`,
        note: `Stripe checkout for ${invoice.invoiceNumber}`,
        metadata: { source: "stripe-checkout" }
      }
    });
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const session = await stripeRequest<CheckoutSession>("checkout/sessions", {
      mode: "payment",
      success_url: `${origin}/dashboard/billing?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard/billing?stripe=cancelled`,
      customer_email: input.customerEmail,
      "line_items[0][quantity]": 1,
      "line_items[0][price_data][currency]": invoice.currency.toLowerCase(),
      "line_items[0][price_data][unit_amount]": amountCents,
      "line_items[0][price_data][product_data][name]": `Invoice ${invoice.invoiceNumber}`,
      "metadata[organizationId]": actor.organizationId,
      "metadata[invoiceId]": invoice.id,
      "metadata[transactionId]": pending.id,
      "payment_intent_data[metadata][organizationId]": actor.organizationId,
      "payment_intent_data[metadata][invoiceId]": invoice.id,
      "payment_intent_data[metadata][transactionId]": pending.id
    });
    await prisma.paymentTransaction.update({
      where: { id: pending.id, organizationId: actor.organizationId },
      data: {
        providerReference: session.id,
        metadata: { source: "stripe-checkout", checkoutSessionId: session.id }
      }
    });
    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
