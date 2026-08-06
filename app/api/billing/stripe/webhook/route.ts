import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { verifyStripeSignature } from "@/features/billing/services/stripe.service";

type StripeEvent = {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      payment_intent?: string | null;
      payment_status?: string;
      metadata?: Record<string, string>;
    };
  };
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyStripeSignature(rawBody, request.headers.get("stripe-signature")))
    return NextResponse.json(
      { error: "Invalid Stripe signature." },
      { status: 400 }
    );
  const event = JSON.parse(rawBody) as StripeEvent;
  const object = event.data.object;
  const organizationId = object.metadata?.organizationId;
  const transactionId = object.metadata?.transactionId;
  const subscriptionPlan = object.metadata?.subscriptionPlan;
  if (!organizationId) return NextResponse.json({ received: true });

  try {
    await prisma.$transaction(
      async (transaction) => {
        const existing =
          await transaction.paymentProviderWebhookEvent.findUnique({
            where: {
              organizationId_provider_externalEventId: {
                organizationId,
                provider: "stripe",
                externalEventId: event.id
              }
            }
          });
        if (existing?.status === "PROCESSED") return;
        const stored =
          existing ??
          (await transaction.paymentProviderWebhookEvent.create({
            data: {
              organizationId,
              provider: "stripe",
              externalEventId: event.id,
              eventType: event.type,
              signatureDigest: createHash("sha256")
                .update(rawBody)
                .digest("hex"),
              payload: JSON.parse(rawBody),
              paymentTransactionId: transactionId
            }
          }));
        if (
          transactionId &&
          [
            "checkout.session.completed",
            "checkout.session.async_payment_succeeded"
          ].includes(event.type)
        ) {
          const payment = await transaction.paymentTransaction.findFirst({
            where: { id: transactionId, organizationId },
            include: { invoice: true, event: true }
          });
          if (payment && payment.status !== "paid") {
            const invoice = payment.invoice;
            await transaction.paymentTransaction.update({
              where: { id: payment.id, organizationId },
              data: {
                status: "paid",
                processedAt: new Date(),
                providerReference: object.payment_intent ?? object.id
              }
            });
            if (invoice) {
              const paid = Math.min(
                invoice.totalCents,
                invoice.amountPaidCents + payment.amountCents
              );
              const balance = Math.max(0, invoice.totalCents - paid);
              await transaction.invoice.update({
                where: { id: invoice.id, organizationId },
                data: {
                  amountPaidCents: paid,
                  balanceDueCents: balance,
                  status: balance === 0 ? "Paid" : "Partially Paid",
                  paidAt: balance === 0 ? new Date() : null
                }
              });
              await transaction.invoiceBalance.upsert({
                where: { invoiceId: invoice.id },
                create: {
                  organizationId,
                  invoiceId: invoice.id,
                  subtotalCents: invoice.subtotalCents,
                  discountCents: invoice.discountCents,
                  taxCents: invoice.taxCents,
                  totalCents: invoice.totalCents,
                  paidCents: paid,
                  outstandingCents: balance
                },
                update: { paidCents: paid, outstandingCents: balance }
              });
            }
            await transaction.paymentReceipt.upsert({
              where: { paymentTransactionId: payment.id },
              create: {
                organizationId,
                invoiceId: payment.invoiceId,
                paymentTransactionId: payment.id,
                receiptNumber: `RCT-${payment.id.toUpperCase()}`,
                receiptData: {
                  provider: "stripe",
                  paymentIntentId: object.payment_intent ?? null,
                  amountCents: payment.amountCents
                }
              },
              update: {
                receiptData: {
                  provider: "stripe",
                  paymentIntentId: object.payment_intent ?? null,
                  amountCents: payment.amountCents
                }
              }
            });
            await transaction.activityLog.create({
              data: {
                organizationId,
                eventId: payment.eventId,
                clientId: payment.clientId,
                actionType: "Stripe Payment Succeeded",
                message: `Stripe payment received for ${payment.amountCents} cents.`,
                newValue: {
                  transactionId: payment.id,
                  invoiceId: payment.invoiceId,
                  paymentIntentId: object.payment_intent ?? null
                }
              }
            });
          }
        } else if (
          transactionId &&
          [
            "checkout.session.expired",
            "checkout.session.async_payment_failed"
          ].includes(event.type)
        ) {
          await transaction.paymentTransaction.updateMany({
            where: { id: transactionId, organizationId, status: "pending" },
            data: {
              status: event.type.endsWith("expired") ? "cancelled" : "failed"
            }
          });
        }
        if (
          subscriptionPlan &&
          event.type === "checkout.session.completed" &&
          ["starter", "professional", "enterprise"].includes(subscriptionPlan)
        ) {
          await transaction.organization.update({
            where: { id: organizationId },
            data: {
              subscriptionPlan,
              subscriptionStatus: "active",
              subscriptionStartedAt: new Date(),
              subscriptionEndsAt: null
            }
          });
          await transaction.activityLog.create({
            data: {
              organizationId,
              actionType: "Subscription Activated",
              message: `${subscriptionPlan} subscription activated through Stripe.`,
              newValue: { plan: subscriptionPlan, checkoutSessionId: object.id }
            }
          });
        }
        await transaction.paymentProviderWebhookEvent.update({
          where: { id: stored.id },
          data: {
            status: "PROCESSED",
            processedAt: new Date(),
            processingAttempts: { increment: 1 }
          }
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Webhook processing failed."
      },
      { status: 500 }
    );
  }
}
