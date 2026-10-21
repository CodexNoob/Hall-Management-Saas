"use client";

import { useEffect, useState } from "react";
import {
  LineIcon,
  Pill,
  type BillingResponse,
  type IconName
} from "@/features/billing/components/billing-shared";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import { useAppLanguage } from "@/components/providers/app-language-provider";
import type { MessageKey } from "@/lib/i18n/messages";

const reviewFields: Array<{
  icon: IconName;
  /** Also the row identifier this modal branches on, so it stays English. */
  label: string;
  labelKey: MessageKey;
  valueKey: MessageKey;
}> = [
  {
    icon: "invoice",
    label: "Category",
    labelKey: "common.category",
    valueKey: "billing.uncategorized"
  },
  {
    icon: "settings",
    label: "Split transaction",
    labelKey: "billing.splitTransaction",
    valueKey: "billing.oneSplitLine"
  },
  {
    icon: "payment",
    label: "Event",
    labelKey: "common.event",
    valueKey: "billing.unassigned"
  },
  {
    icon: "invoice",
    label: "Invoice",
    labelKey: "billing.invoiceLabel",
    valueKey: "billing.noInvoiceSelected"
  },
  {
    icon: "upload",
    label: "Attachment",
    labelKey: "billing.attachment",
    valueKey: "billing.noFileAttached"
  }
];

type Transaction = BillingResponse["transactions"][number];

function formatCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    currency,
    style: "currency"
  }).format(cents / 100);
}

export function PendingTransactionModal({
  onClose,
  onSaved,
  transaction
}: {
  onClose: () => void;
  onSaved: () => Promise<unknown>;
  transaction: Transaction;
}) {
  const { t } = useAppLanguage();
  const [mode, setMode] = useState<"Categorize" | "Match" | "Transfer">(
    "Categorize"
  );
  const [copied, setCopied] = useState(false);
  const [category, setCategory] = useState("Uncategorized");
  const [split, setSplit] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const reference = transaction.providerReference?.trim() || transaction.id;
  const transactionDate = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long"
  }).format(new Date(transaction.createdAt));

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function postTransaction() {
    setPosting(true);
    setError("");
    try {
      const action = split
        ? "split"
        : mode === "Match"
          ? "match"
          : "categorize";
      const half = Math.trunc(transaction.amountCents / 2);
      const body =
        action === "split"
          ? {
              action,
              splits: [
                { category, amountCents: half },
                {
                  category: "Uncategorized",
                  amountCents: transaction.amountCents - half
                }
              ]
            }
          : action === "match"
            ? { action, eventId: transaction.eventId }
            : { action, category };
      if (action === "match" && !transaction.eventId)
        throw new Error(
          t("billing.assignBeforeMatching")
        );
      const response = await authenticatedFetch(
        `/api/billing/transactions/${transaction.id}`,
        { method: "PATCH", body: JSON.stringify(body) }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload.error ?? t("billing.postFailed"));
      await onSaved();
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t("billing.postFailed")
      );
    } finally {
      setPosting(false);
    }
  }

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-100 flex items-end justify-center bg-[#17202a]/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        aria-labelledby="transaction-review-title"
        aria-modal="true"
        className="flex max-h-[calc(100dvh-12px)] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-[#d8dde5] bg-[#f5f6f8] text-[#17202a] shadow-2xl sm:max-h-[calc(100dvh-32px)] sm:rounded-2xl"
        role="dialog"
      >
        <header className="shrink-0 bg-[#061126] px-4 py-4 text-white sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
                <LineIcon className="h-5 w-5" name="payment" />
              </span>
              <div className="min-w-0">
                <h2
                  className="truncate text-base font-black sm:text-lg"
                  id="transaction-review-title"
                >
                  {t("billing.reviewRecentTransaction")}
                </h2>
                <p className="truncate text-xs font-semibold text-white/60">
                  {t("billing.confirmPosting")}
                </p>
              </div>
            </div>
            <button
              aria-label={t("billing.closeTransactionReview")}
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white transition hover:bg-white/10"
              onClick={onClose}
              type="button"
            >
              <span className="absolute h-0.5 w-5 rotate-45 rounded-full bg-current" />
              <span className="absolute h-0.5 w-5 -rotate-45 rounded-full bg-current" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
          <article className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-lg font-black sm:text-xl">
                    {transaction.event?.clientName || t("billing.unassignedTransaction")}
                  </h3>
                  <Pill tone="gold">{t("billing.needsReviewBadge")}</Pill>
                </div>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.04em] text-[#6a7483]">
                  {(
                    transaction.provider || t("billing.manualEntry")
                  ).toUpperCase()}{" "}
                  · {t("billing.bankTransaction")}
                </p>
              </div>
              <div className="shrink-0 sm:text-right">
                <p className="text-3xl font-black text-[#17202a] sm:text-4xl">
                  {formatCurrency(
                    transaction.amountCents,
                    transaction.currency
                  )}
                </p>
                <p className="mt-1 text-xs font-semibold text-[#6a7483]">
                  {transactionDate}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 border-t border-[#d8dde5] bg-[#fbfcfd] text-xs sm:grid-cols-4">
              <TransactionMeta label={t("billing.source")} value={t("billing.bankFeed")} />
              <TransactionMeta
                label={t("billing.method")}
                value={transaction.provider || "Manual"}
              />
              <TransactionMeta label={t("common.status")} value={transaction.status} />
              <div className="min-w-0 border-[#d8dde5] px-3 py-2.5 even:border-l sm:border-l">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[#6a7483]">
                    {t("billing.reference")}
                  </p>
                  <button
                    aria-label={t("billing.copyReference")}
                    className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black text-[#1f4d73] transition hover:bg-[#eef4fa]"
                    onClick={copyReference}
                    title={reference}
                    type="button"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p
                  className="mt-0.5 truncate text-xs font-black text-[#17202a]"
                  title={reference}
                >
                  {reference}
                </p>
              </div>
            </div>
          </article>

          <nav
            aria-label={t("billing.reviewAction")}
            className="mt-4 grid grid-cols-3 overflow-hidden rounded-lg border border-[#b9c2cf] bg-white"
          >
            {(["Categorize", "Match", "Transfer"] as const).map(
              (option, index) => (
                <button
                  aria-pressed={mode === option}
                  className={`h-11 text-xs font-black transition sm:text-sm ${index ? "border-l border-[#b9c2cf]" : ""} ${mode === option ? "bg-[#1f4d73] text-white" : "bg-white text-[#17202a] hover:bg-[#eef4fa]"}`}
                  key={option}
                  onClick={() => setMode(option)}
                  type="button"
                >
                  {option}
                </button>
              )
            )}
          </nav>

          <section className="mt-4 overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
            <div className="border-b border-[#d8dde5] px-4 py-3">
              <h3 className="text-sm font-black">{t("billing.postingDetails")}</h3>
              <p className="mt-0.5 text-xs text-[#6a7483]">
                {t("billing.completeRequiredFields")}
              </p>
            </div>
            <div className="divide-y divide-[#edf0f4] px-4">
              {reviewFields.map((field) => (
                <div
                  className="grid w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 py-3.5 text-left transition hover:bg-[#fbfcfd]"
                  key={field.label}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef4fa] text-[#1f4d73]">
                    <LineIcon className="h-4 w-4" name={field.icon} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-[#6a7483]">
                      {t(field.labelKey)}
                      {field.label === "Category" ? " *" : ""}
                    </span>
                    <strong className="block truncate text-sm text-[#17202a]">
                      {field.label === "Category"
                        ? category
                        : field.label === "Split transaction"
                          ? split
                            ? "2 split lines"
                            : t("billing.notSplit")
                          : t(field.valueKey)}
                    </strong>
                  </span>
                  {field.label === "Category" ? (
                    <select
                      aria-label={t("billing.transactionCategory")}
                      className="h-9 rounded-lg border border-[#b9c2cf] px-2 text-xs"
                      onChange={(event) => setCategory(event.target.value)}
                      value={category}
                    >
                      {[
                        "Uncategorized",
                        t("billing.catEventDeposit"),
                        t("billing.catFinalPayment"),
                        t("billing.catVendorCost"),
                        t("billing.catFoodPurchase"),
                        t("billing.catStaffPayroll"),
                        "Refund"
                      ].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        </div>

        <footer className="grid shrink-0 grid-cols-[auto_1fr] gap-2 border-t border-[#d8dde5] bg-white p-3 sm:flex sm:justify-end sm:px-5 sm:py-4">
          <button
            className="h-11 rounded-lg border border-[#b9c2cf] bg-white px-4 text-sm font-black text-[#17202a] transition hover:bg-[#eef4fa]"
            type="button"
            aria-pressed={split}
            onClick={() => setSplit((current) => !current)}
          >
            {split ? t("billing.removeSplit") : "Split"}
          </button>
          <button
            className="h-11 rounded-lg bg-[#1f4d73] px-6 text-sm font-black text-white shadow-md shadow-[#1f4d73]/15 transition hover:bg-[#173a57]"
            disabled={posting}
            onClick={() => void postTransaction()}
            type="button"
          >
            {posting ? t("billing.posting") : t("billing.postTransaction")}
          </button>
          {error ? (
            <p className="col-span-2 text-sm font-bold text-[#b42318] sm:w-full">
              {error}
            </p>
          ) : null}
        </footer>
      </section>
    </div>
  );
}

function TransactionMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-[#d8dde5] px-3 py-2.5 even:border-l sm:border-l sm:first:border-l-0">
      <p className="font-semibold text-[#6a7483]">{label}</p>
      <p className="mt-0.5 truncate font-black text-[#17202a]">{value}</p>
    </div>
  );
}
