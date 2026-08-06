import "server-only";

import { Prisma } from "@prisma/client";
import type { requirePermission } from "@/lib/auth/server-auth";
import { BillingError } from "@/features/billing/services/billing-error";
import { prisma } from "@/lib/prisma";

export type RecordRefundInput = {
  paymentTransactionId: string;
  amountCents: number;
  reason?: string;
  provider?: string;
  providerReference?: string;
};

type RefundActor = Awaited<ReturnType<typeof requirePermission>>;

function centsToDecimal(cents: number) {
  return new Prisma.Decimal(cents).dividedBy(100);
}

function decimalToCents(value: Prisma.Decimal | null) {
  if (!value) return 0;
  return value.times(100).toDecimalPlaces(0).toNumber();
}

export async function recordRefundWithAudit(
  actor: RefundActor,
  input: RecordRefundInput
) {
  return prisma.$transaction(
    async (transaction) => {
      const payment = await transaction.paymentTransaction.findFirstOrThrow({
        where: {
          id: input.paymentTransactionId,
          organizationId: actor.organizationId
        },
        include: {
          invoice: true,
          event: {
            select: {
              id: true,
              clientId: true,
              paymentStatus: true,
              amountDue: true
            }
          }
        }
      });

      if (payment.status !== "paid") {
        throw new BillingError(
          "PAYMENT_NOT_REFUNDABLE",
          "Only successful payments can be refunded."
        );
      }

      const refundableCents = payment.amountCents - payment.refundedAmountCents;

      if (input.amountCents > refundableCents) {
        throw new BillingError(
          "REFUND_AMOUNT_EXCEEDED",
          "Refund amount exceeds the remaining payment amount."
        );
      }

      const refund = await transaction.paymentRefund.create({
        data: {
          organizationId: actor.organizationId,
          invoiceId: payment.invoiceId,
          paymentTransactionId: payment.id,
          processedById: actor.id,
          amountCents: input.amountCents,
          currency: payment.currency,
          status: "succeeded",
          provider: input.provider ?? payment.provider,
          providerReference: input.providerReference,
          reason: input.reason,
          processedAt: new Date(),
          metadata: { source: "manual-refund" }
        }
      });

      await transaction.paymentTransaction.update({
        where: {
          id: payment.id,
          organizationId: actor.organizationId
        },
        data: {
          refundedAmountCents: {
            increment: input.amountCents
          }
        }
      });

      let invoiceBalanceCents: number | null = null;

      if (payment.invoice) {
        const nextAmountPaidCents = Math.max(
          0,
          payment.invoice.amountPaidCents - input.amountCents
        );
        invoiceBalanceCents = Math.max(
          0,
          payment.invoice.totalCents - nextAmountPaidCents
        );

        await transaction.invoice.update({
          where: {
            id: payment.invoice.id,
            organizationId: actor.organizationId
          },
          data: {
            amountPaidCents: nextAmountPaidCents,
            balanceDueCents: invoiceBalanceCents,
            paidAt: invoiceBalanceCents === 0 ? payment.invoice.paidAt : null,
            status:
              invoiceBalanceCents === 0
                ? "Paid"
                : nextAmountPaidCents > 0
                  ? "Partially Paid"
                  : payment.invoice.issuedAt
                    ? "Sent"
                    : "Draft"
          }
        });

        const currentBalance = await transaction.invoiceBalance.findUnique({
          where: { invoiceId: payment.invoice.id }
        });

        await transaction.invoiceBalance.upsert({
          where: { invoiceId: payment.invoice.id },
          create: {
            organizationId: actor.organizationId,
            invoiceId: payment.invoice.id,
            subtotalCents: payment.invoice.subtotalCents,
            discountCents: payment.invoice.discountCents,
            taxCents: payment.invoice.taxCents,
            totalCents: payment.invoice.totalCents,
            paidCents: nextAmountPaidCents,
            refundedCents: input.amountCents,
            outstandingCents: invoiceBalanceCents
          },
          update: {
            paidCents: nextAmountPaidCents,
            refundedCents:
              (currentBalance?.refundedCents ?? 0) + input.amountCents,
            outstandingCents: invoiceBalanceCents
          }
        });

        if (payment.paymentScheduleId) {
          const schedule = await transaction.invoicePaymentSchedule.findFirst({
            where: {
              id: payment.paymentScheduleId,
              organizationId: actor.organizationId,
              invoiceId: payment.invoice.id
            }
          });

          if (schedule) {
            const nextSchedulePaidCents = Math.max(
              0,
              schedule.paidCents - input.amountCents
            );

            await transaction.invoicePaymentSchedule.update({
              where: {
                id: schedule.id,
                organizationId: actor.organizationId
              },
              data: {
                paidCents: nextSchedulePaidCents,
                status:
                  nextSchedulePaidCents === 0 ? "PENDING" : "PARTIALLY_PAID",
                paidAt: null
              }
            });
          }
        }
      }

      const eventBalanceCents =
        invoiceBalanceCents ??
        decimalToCents(payment.event.amountDue) + input.amountCents;
      const event = await transaction.event.update({
        where: {
          id: payment.eventId,
          organizationId: actor.organizationId
        },
        data: {
          amountDue: centsToDecimal(eventBalanceCents),
          paymentStatus:
            eventBalanceCents === 0 ? "Paid in Full" : "Paid Partially",
          updatedById: actor.id
        }
      });

      const activityLog = await transaction.activityLog.create({
        data: {
          organizationId: actor.organizationId,
          eventId: payment.eventId,
          clientId: payment.event.clientId,
          userId: actor.id,
          userName: actor.name,
          actionType: "Payment Refund",
          message: `Refunded ${input.amountCents} cents from payment ${payment.id}.`,
          oldValue: {
            paymentRefundedCents: payment.refundedAmountCents,
            eventPaymentStatus: payment.event.paymentStatus,
            invoiceBalanceCents: payment.invoice?.balanceDueCents ?? null
          },
          newValue: {
            refundId: refund.id,
            amountCents: input.amountCents,
            paymentRefundedCents:
              payment.refundedAmountCents + input.amountCents,
            eventPaymentStatus: event.paymentStatus,
            invoiceBalanceCents
          }
        }
      });

      return { refund, event, activityLog };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    }
  );
}
