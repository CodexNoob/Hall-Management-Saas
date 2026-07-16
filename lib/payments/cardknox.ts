import { getEnv } from "@/lib/env";

export type PaymentConfirmationInput = {
  eventId: string;
  amountCents: number;
  result: "paid" | "failed" | "cancelled";
  note?: string;
};

export function getCardknoxPaymentLink() {
  return getEnv().CARDKNOX_PAYMENT_LINK;
}
