"use client";

import { type ReactNode } from "react";
import {
  type IconName,
  LineIcon
} from "@/features/billing/components/billing-shared";
import {
  formatTransactionCurrency as formatCurrency,
  transactionShortDate,
  type TransactionRow
} from "@/features/billing/transactions/transaction-model";

export function DesktopTransactionSidePanel({
  onCancel,
  onBack,
  onPost,
  onPrint,
  transaction
}: {
  onCancel: () => void;
  onBack: () => void;
  onPost: () => void;
  onPrint: () => void;
  transaction: TransactionRow;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 hidden md:block">
      <div className="absolute inset-0 bg-[#0f172a]/40" />
      <aside className="pointer-events-auto absolute bottom-0 right-0 top-0 flex w-[43rem] max-w-[48vw] flex-col overflow-hidden bg-white shadow-[-18px_0_42px_rgba(15,23,42,0.22)]">
        <header className="bg-[#061126] px-6 pb-4 pt-5 text-white">
          <div className="flex items-center justify-between">
            <button
              aria-label="Back to transactions"
              className="flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-white/15"
              onClick={onBack}
              type="button"
            >
              <LineIcon className="h-5 w-5" name="back" />
            </button>
            <h2 className="text-lg font-black">
              {transaction.status} transaction
            </h2>
            <button
              aria-label="Cancel transaction"
              className="flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-white/15"
              onClick={onCancel}
              type="button"
            >
              <span className="relative h-5 w-5 rounded-full border-2 border-current">
                <span className="absolute left-1/2 top-1/2 h-0.5 w-5 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-current" />
              </span>
            </button>
          </div>

          <section className="mt-4 rounded-lg bg-white p-4 text-[#001428] shadow-sm">
            <div className="grid grid-cols-[1fr_auto] gap-4">
              <div>
                <p className="text-lg font-black">{transaction.customer}</p>
                <p className="mt-1 text-xs font-semibold uppercase text-[#526274]">
                  {transaction.event}
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black">
                  {transaction.amount < 0 ? "-" : ""}
                  {formatCurrency(Math.abs(transaction.amount))}
                </p>
                <p className="text-sm font-semibold text-[#1f4d73]">
                  {transactionShortDate(transaction)}
                </p>
              </div>
            </div>
          </section>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-[#b9c2cf] text-sm font-black text-[#17202a]">
            {["Categorize", "Match", "Transfer"].map((label, index) => (
              <button
                className={`h-12 bg-white transition hover:bg-[#eef4fa] ${
                  index > 0 ? "border-l border-[#b9c2cf]" : ""
                }`}
                key={label}
                onClick={
                  label === "Match"
                    ? onPost
                    : label === "Transfer"
                      ? onPrint
                      : undefined
                }
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-5 divide-y divide-[#edf0f4]">
            <DesktopTransactionDetailRow
              icon="more"
              label="Transaction type*"
              value={
                transaction.type === "Payment" ? "Expense" : transaction.type
              }
            />
            <DesktopTransactionDetailRow
              icon="invoice"
              label="Category*"
              value={transaction.eventType || "Supplies & materials - COGS"}
            />
            <DesktopTransactionDetailRow
              icon="settings"
              label="Split transaction"
              value="Select"
            />
            <DesktopTransactionDetailRow
              icon="payment"
              label="From/To"
              value={`${transaction.customer} Corp`}
            />
            <DesktopTransactionDetailRow
              icon="upload"
              label="Billable"
              trailing={
                <span className="relative h-6 w-11 rounded-full bg-[#b9c2cf]">
                  <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow" />
                </span>
              }
              value=""
            />
            <DesktopTransactionDetailRow
              icon="bank"
              label="Customer/Project"
              value="Select a customer or project"
            />
            <DesktopTransactionDetailRow
              icon="upload"
              label="Attachment"
              value="0 attached"
            />
            <DesktopTransactionDetailRow
              icon="invoice"
              label="Memo"
              value={transaction.notes}
            />
          </div>
        </div>

        <footer className="flex items-center gap-3 border-t border-[#d8dde5] bg-white px-6 py-4">
          <button
            aria-label="Cancel"
            className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#ffb3a8] text-[#d63a2f] transition hover:bg-[#fff0ee]"
            onClick={onCancel}
            type="button"
          >
            <span className="relative h-5 w-5 rounded-full border-2 border-current">
              <span className="absolute left-1/2 top-1/2 h-0.5 w-5 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-current" />
            </span>
          </button>
          <button
            className="h-12 flex-1 rounded-lg bg-[#1f4d73] text-sm font-black text-white shadow-sm transition hover:bg-[#173a57]"
            onClick={onPost}
            type="button"
          >
            Post & next
          </button>
        </footer>
      </aside>
    </div>
  );
}

function DesktopTransactionDetailRow({
  icon,
  label,
  trailing,
  value
}: {
  icon: IconName;
  label: string;
  trailing?: ReactNode;
  value: string;
}) {
  return (
    <div className="grid w-full grid-cols-[2rem_1fr_auto] items-center gap-4 py-5 text-left">
      <LineIcon className="h-5 w-5 text-[#6a7483]" name={icon} />
      <span className="min-w-0 text-sm text-[#526274]">
        {label}
        {value ? (
          <strong className="ml-0.5 text-base text-[#001428]">{value}</strong>
        ) : null}
      </span>
      {trailing ?? (
        <LineIcon className="h-4 w-4 text-[#526274]" name="chevron" />
      )}
    </div>
  );
}

export function TransactionDetailsView({
  onCancel,
  onBack,
  onPost,
  transaction
}: {
  onCancel: () => void;
  onBack: () => void;
  onPost: () => void;
  transaction: TransactionRow;
}) {
  return (
    <div className="bg-white md:bg-[#f4f7fa] md:p-4">
      <section className="mx-auto min-h-[calc(100dvh-5.25rem)] max-w-4xl overflow-hidden bg-white md:min-h-0 md:rounded-xl md:border md:border-[#d8dde5] md:shadow-sm">
        <header className="bg-[#1f4d73] px-3 pb-12 pt-3 text-white md:px-5 md:pb-16 md:pt-5">
          <div className="flex items-center justify-between">
            <button
              aria-label="Back to transactions"
              className="flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-white/10 md:h-10 md:w-10"
              onClick={onBack}
              type="button"
            >
              <LineIcon className="h-5 w-5" name="back" />
            </button>
            <h2 className="text-sm font-black md:text-base">
              {transaction.status} transaction
            </h2>
            <button
              aria-label="Cancel transaction"
              className="flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-white/10 md:h-10 md:w-10"
              onClick={onCancel}
              type="button"
            >
              <span className="relative h-5 w-5 rounded-full border-2 border-current">
                <span className="absolute left-1/2 top-1/2 h-0.5 w-5 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-current" />
              </span>
            </button>
          </div>
        </header>

        <div className="-mt-10 px-3 md:-mt-12 md:px-6">
          <section className="rounded-lg border border-[#d8dde5] bg-white p-3 text-center shadow-md md:p-5">
            <div className="grid grid-cols-[1fr_auto] items-start gap-3 text-left">
              <div>
                <p className="text-sm font-black text-[#17202a] md:text-lg">
                  {transaction.customer}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold uppercase text-[#6a7483] md:text-xs">
                  {transaction.event}
                </p>
              </div>
              <p className="text-xs font-semibold text-[#526274] md:text-sm">
                {transaction.date.replace(", 2026", "/26")}
              </p>
            </div>
            <p
              className={`mt-1 text-3xl font-black md:text-5xl ${
                transaction.amount >= 0 ? "text-[#17202a]" : "text-[#c0392b]"
              }`}
            >
              {transaction.amount < 0 ? "-" : ""}
              {formatCurrency(Math.abs(transaction.amount))}
            </p>
          </section>
        </div>

        <div className="px-3 py-3 md:px-6 md:py-5">
          <div className="grid grid-cols-2 overflow-hidden rounded-md border border-[#b9c2cf] bg-white text-sm font-black text-[#526274] md:text-base">
            <button
              className="h-8 bg-[#f6f8fa] md:h-11"
              onClick={onPost}
              type="button"
            >
              Categorize
            </button>
            <button
              className="h-8 border-l border-[#b9c2cf] bg-white md:h-11"
              type="button"
              onClick={onPost}
            >
              Match
            </button>
          </div>

          <div className="mt-3 divide-y divide-[#edf0f4] md:mt-5 md:rounded-xl md:border md:border-[#edf0f4] md:px-4">
            <MobileTransactionDetailRow
              icon="more"
              label="Transaction type*"
              value={transaction.type}
            />
            <MobileTransactionDetailRow
              icon="invoice"
              label="Category*"
              value={transaction.eventType}
            />
            <MobileTransactionDetailRow
              icon="settings"
              label="Split transaction"
              muted
              value="Not split"
            />
            <MobileTransactionDetailRow
              icon="payment"
              label="From/To"
              value={`${transaction.customer} \u2022 ${transaction.paymentMethod}`}
            />
            <MobileTransactionDetailRow
              icon="invoice"
              label="Billable"
              trailing={
                <span className="relative h-4 w-8 rounded-full bg-[#d8dde5]">
                  <span className="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow" />
                </span>
              }
              value={transaction.venue}
            />
            <MobileTransactionDetailRow
              icon="bank"
              label="Customer/Project"
              value={transaction.event}
            />
            <MobileTransactionDetailRow
              icon="upload"
              label="Attachment"
              value="0 attached"
            />
            <MobileTransactionDetailRow
              icon="invoice"
              label="Memo"
              value={transaction.notes}
            />
          </div>

          <section className="mt-4 border-t border-[#edf0f4] pt-3 md:rounded-xl md:border md:border-[#edf0f4] md:p-4">
            <p className="text-xs font-semibold text-[#6a7483] md:text-sm">
              Full bank description
            </p>
            <p className="mt-1 text-xs font-bold leading-5 text-[#526274] md:text-sm">
              {transaction.referenceNo} {"\u2022"} {transaction.customer}{" "}
              {"\u2022"}{" "}
              {transaction.event}
            </p>
          </section>

          <button
            className="mt-4 h-11 w-full rounded-md bg-[#078342] text-sm font-black text-white shadow-sm transition hover:bg-[#056b36] md:h-12 md:text-base"
            onClick={onPost}
            type="button"
          >
            Post
          </button>
        </div>
      </section>
    </div>
  );
}

function MobileTransactionDetailRow({
  icon,
  label,
  muted = false,
  trailing,
  value
}: {
  icon: IconName;
  label: string;
  muted?: boolean;
  trailing?: ReactNode;
  value: string;
}) {
  return (
    <div className="grid w-full grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2 py-3 text-left">
      <LineIcon
        className={`h-4 w-4 ${muted ? "text-[#9aa5b3]" : "text-[#6a7483]"}`}
        name={icon}
      />
      <span className="min-w-0">
        <span
          className={`block text-xs font-semibold ${
            muted ? "text-[#a1aab6]" : "text-[#6a7483]"
          }`}
        >
          {label}
        </span>
        <span
          className={`mt-0.5 block truncate text-xs font-bold ${
            muted ? "text-[#b4bdc8]" : "text-[#526274]"
          }`}
        >
          {value}
        </span>
      </span>
      {trailing ?? (
        <LineIcon className="h-4 w-4 text-[#6a7483]" name="chevron" />
      )}
    </div>
  );
}
