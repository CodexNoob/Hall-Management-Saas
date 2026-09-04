import "server-only";

import { Prisma } from "@prisma/client";
import {
  assertInScope,
  type AuthzContext
} from "@/lib/authz/authorize";
import { prisma } from "@/lib/prisma";
import { BillingError } from "@/features/billing/services/billing-error";

export type PaymentResult = "paid" | "failed" | "cancelled";

export type RecordPaymentInput = {
  eventId: string;
  invoiceId?: string;
  paymentScheduleId?: string;
  amountCents: number;
  result: PaymentResult;
  currency?: string;
  provider?: string;
  providerReference?: string;
  note?: string;
};

type PaymentActor = AuthzContext;

function centsToDecimal(cents: number) {
  return new Prisma.Decimal(cents).dividedBy(100);
}

function decimalToCents(value: Prisma.Decimal | null) {
  if (!value) return null;
  return value.times(100).toDecimalPlaces(0).toNumber();
}

export async function recordPaymentWithAudit(
  actor: PaymentActor,
  input: RecordPaymentInput
) {
  return prisma.$transaction(
    async (transaction) => {
      const currentEvent = await transaction.event.findFirstOrThrow({
        where: {
          id: input.eventId,
          organizationId: actor.organizationId,
          deleted: false
        },
        select: {
          id: true,
          hallId: true,
          clientId: true,
          amountDue: true,
          paymentStatus: true
        }
      });

      assertInScope(actor, "hall", currentEvent.hallId);

      const invoice = input.invoiceId
        ? await transaction.invoice.findFirstOrThrow({
            where: {
              id: input.invoiceId,
              organizationId: actor.organizationId,
              eventId: input.eventId
            }
          })
        : null;
      // An instalment belongs to an invoice, so naming one without naming the
      // invoice is a request that cannot be honoured. It used to be dropped in
      // silence: the payment recorded, the instalment stayed PENDING, and
      // nothing said the schedule had been ignored.
      if (input.paymentScheduleId && !invoice) {
        throw new BillingError(
          "PAYMENT_SCHEDULE_REQUIRES_INVOICE",
          "A payment schedule can only be settled against its invoice."
        );
      }

      const paymentSchedule =
        input.paymentScheduleId && invoice
          ? await transaction.invoicePaymentSchedule.findFirstOrThrow({
              where: {
                id: input.paymentScheduleId,
                organizationId: actor.organizationId,
                invoiceId: invoice.id
              }
            })
          : null;

      if (
        input.result === "paid" &&
        invoice &&
        input.amountCents > invoice.balanceDueCents
      ) {
        throw new BillingError(
          "PAYMENT_EXCEEDS_BALANCE",
          "Payment amount exceeds the remaining invoice balance."
        );
      }

      const payment = await transaction.paymentTransaction.create({
        data: {
          organizationId: actor.organizationId,
          eventId: input.eventId,
          clientId: currentEvent.clientId,
          invoiceId: invoice?.id,
          paymentScheduleId: paymentSchedule?.id,
          confirmedById: actor.userId,
          amountCents: input.amountCents,
          currency: input.currency ?? invoice?.currency ?? "USD",
          status: input.result,
          provider: input.provider,
          providerReference: input.providerReference,
          note: input.note,
          metadata: { source: "manual-confirmation" }
        }
      });

      let updatedInvoice = invoice;

      if (input.result === "paid" && invoice) {
        const nextAmountPaidCents = invoice.amountPaidCents + input.amountCents;
        const nextBalanceDueCents = Math.max(
          0,
          invoice.totalCents - nextAmountPaidCents
        );

        updatedInvoice = await transaction.invoice.update({
          where: { id: invoice.id, organizationId: actor.organizationId },
          data: {
            amountPaidCents: nextAmountPaidCents,
            balanceDueCents: nextBalanceDueCents,
            status: nextBalanceDueCents === 0 ? "Paid" : "Partially Paid",
            paidAt: nextBalanceDueCents === 0 ? new Date() : null
          }
        });

        await transaction.invoiceBalance.upsert({
          where: { invoiceId: invoice.id },
          create: {
            organizationId: actor.organizationId,
            invoiceId: invoice.id,
            subtotalCents: invoice.subtotalCents,
            discountCents: invoice.discountCents,
            taxCents: invoice.taxCents,
            totalCents: invoice.totalCents,
            paidCents: nextAmountPaidCents,
            outstandingCents: nextBalanceDueCents
          },
          update: {
            subtotalCents: invoice.subtotalCents,
            discountCents: invoice.discountCents,
            taxCents: invoice.taxCents,
            totalCents: invoice.totalCents,
            paidCents: nextAmountPaidCents,
            outstandingCents: nextBalanceDueCents
          }
        });

        if (paymentSchedule) {
          const nextSchedulePaidCents =
            paymentSchedule.paidCents + input.amountCents;
          const scheduleIsPaid =
            nextSchedulePaidCents >= paymentSchedule.amountCents;
          await transaction.invoicePaymentSchedule.update({
            where: {
              id: paymentSchedule.id,
              organizationId: actor.organizationId
            },
            data: {
              paidCents: nextSchedulePaidCents,
              status: scheduleIsPaid ? "PAID" : "PARTIALLY_PAID",
              paidAt: scheduleIsPaid ? new Date() : null
            }
          });
        }
      }

      const invoiceBalanceCents = updatedInvoice?.balanceDueCents ?? null;
      const eventBalanceBeforeCents = decimalToCents(currentEvent.amountDue);
      const eventBalanceAfterCents =
        input.result !== "paid"
          ? eventBalanceBeforeCents
          : (invoiceBalanceCents ??
            (eventBalanceBeforeCents === null
              ? 0
              : Math.max(0, eventBalanceBeforeCents - input.amountCents)));
      const eventPaymentStatus =
        input.result !== "paid"
          ? currentEvent.paymentStatus
          : eventBalanceAfterCents === 0
            ? "Paid in Full"
            : "Paid Partially";

      const event = await transaction.event.update({
        where: { id: input.eventId, organizationId: actor.organizationId },
        data: {
          paymentStatus: eventPaymentStatus,
          amountDue:
            input.result === "paid" && eventBalanceAfterCents !== null
              ? centsToDecimal(eventBalanceAfterCents)
              : undefined,
          updatedById: actor.userId
        }
      });

      const receipt =
        input.result === "paid"
          ? await transaction.paymentReceipt.create({
              data: {
                organizationId: actor.organizationId,
                invoiceId: invoice?.id,
                paymentTransactionId: payment.id,
                issuedById: actor.userId,
                receiptNumber: `RCT-${payment.id.toUpperCase()}`,
                receiptData: {
                  amountCents: input.amountCents,
                  currency: payment.currency,
                  eventId: input.eventId,
                  invoiceId: invoice?.id ?? null,
                  paymentTransactionId: payment.id
                }
              }
            })
          : null;

      const activityLog = await transaction.activityLog.create({
        data: {
          organizationId: actor.organizationId,
          eventId: input.eventId,
          clientId: currentEvent.clientId,
          userId: actor.userId,
          userName: actor.actorName,
          actionType: "Payment Confirmation",
          message: `Payment marked ${input.result}.`,
          oldValue: {
            eventPaymentStatus: currentEvent.paymentStatus,
            eventBalanceCents: eventBalanceBeforeCents,
            invoiceBalanceCents: invoice?.balanceDueCents ?? null
          },
          newValue: {
            amountCents: input.amountCents,
            result: input.result,
            note: input.note ?? null,
            paymentTransactionId: payment.id,
            receiptId: receipt?.id ?? null,
            eventPaymentStatus,
            eventBalanceCents: eventBalanceAfterCents,
            invoiceBalanceCents
          }
        }
      });

      return { event, invoice: updatedInvoice, payment, receipt, activityLog };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
