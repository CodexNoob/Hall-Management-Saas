import type {
  BillingResponse,
  IconName
} from "@/features/billing/components/billing-shared";
import type { MessageKey } from "@/lib/i18n/messages";

export type SortKey = "date" | "amount" | "customer" | "status";
export type ReviewFilter = "All" | "Needs review" | "Matched" | "Paid";
export type TransactionStatus =
  | "Pending"
  | "Confirmed"
  | "Paid"
  | "Cancelled"
  | "Refunded";

export type TransactionRow = {
  id: string;
  bookingId: string;
  customer: string;
  email: string;
  phone: string;
  event: string;
  eventType: string;
  venue: string;
  venueLocation: string;
  venueCapacity: string;
  type: string;
  date: string;
  dateValue: number;
  startTime: string;
  endTime: string;
  amount: number;
  paidAmount: number;
  paymentMethod: string;
  referenceNo: string;
  status: TransactionStatus;
  notes: string;
  activity: Array<{
    actor: string;
    description: string;
    time: string;
    title: string;
  }>;
};

export const transactionStatusTone: Record<
  TransactionStatus,
  "blue" | "green" | "gold" | "red" | "gray"
> = {
  Cancelled: "red",
  Confirmed: "blue",
  Paid: "green",
  Pending: "gold",
  Refunded: "gray"
};

export function formatTransactionCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    style: "currency"
  }).format(amount);
}

function normalizeTransactionStatus(status: string): TransactionStatus {
  const normalized = status.toLowerCase();
  if (normalized.includes("cancel")) return "Cancelled";
  if (normalized.includes("refund")) return "Refunded";
  if (normalized.includes("paid")) return "Paid";
  if (normalized.includes("confirm")) return "Confirmed";
  return "Pending";
}

export type BillingTranslate = (
  key: MessageKey,
  values?: Record<string, string | number>
) => string;

export function buildTransactionRows(
  data: BillingResponse,
  t?: BillingTranslate
): TransactionRow[] {
  return data.transactions.map((transaction, index) => {
    const amount = transaction.amountCents / 100;
    const createdAt = new Date(transaction.createdAt);
    const customer =
      transaction.event?.clientName ||
      (t ? t("billing.unassignedCustomer") : "Unassigned customer");
    const status = normalizeTransactionStatus(transaction.status);
    const eventDate = transaction.event?.eventDate
      ? new Date(transaction.event.eventDate)
      : null;

    return {
      id: transaction.id,
      bookingId: `BK-${String(index + 1).padStart(4, "0")}`,
      customer,
      email: "",
      phone: "",
      event: transaction.event?.clientName
        ? `${transaction.event.clientName} Event`
        : t
          ? t("billing.unassignedEvent")
          : "Unassigned event",
      eventType:
        amount < 0
          ? (t ? t("billing.refundLabel") : "Refund")
          : (t ? t("billing.eventPayment") : "Event payment"),
      venue: t ? t("billing.notLinked") : "Not linked",
      venueLocation: "",
      venueCapacity: "",
      type: amount < 0 ? "Refund" : "Payment",
      date: createdAt.toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric"
      }),
      dateValue: createdAt.getTime(),
      startTime: eventDate
        ? eventDate.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit"
          })
        : "",
      endTime: "",
      amount,
      paidAmount: status === "Paid" ? amount : 0,
      paymentMethod:
        transaction.provider || (t ? t("billing.manualEntry") : "Manual entry"),
      referenceNo: transaction.providerReference || transaction.id,
      status,
      notes:
        transaction.note ||
        (t ? t("billing.noTransactionNote") : "No transaction note."),
      activity: [
        {
          actor: "Event Core",
          description: t
            ? t("billing.recordedWithStatus", { status })
            : `Transaction recorded with status ${status}.`,
          time: createdAt.toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short"
          }),
          title: t ? t("billing.transactionRecorded") : "Transaction recorded"
        }
      ]
    };
  });
}

export function transactionIconName(row: TransactionRow): IconName {
  if (row.type.toLowerCase().includes("invoice")) return "invoice";
  if (row.type.toLowerCase().includes("refund")) return "back";
  if (row.status === "Pending") return "more";
  return "payment";
}

export function transactionMonthLabel(row?: TransactionRow) {
  if (!row) return "";
  return new Date(row.dateValue).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric"
  });
}

export function transactionShortDate(row: TransactionRow) {
  return new Date(row.dateValue).toLocaleDateString("en-US", {
    day: "numeric",
    month: "numeric",
    year: "2-digit"
  });
}
