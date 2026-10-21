"use client";

import {
  cashMovementBars,
  StatCard,
  TopAction,
  type BillingResponse,
  type BillingTab
} from "@/features/billing/components/billing-shared";
import { useAppLanguage } from "@/components/providers/app-language-provider";

export function BillingDashboardTab({
  setActiveTab,
  data
}: {
  setActiveTab: (tab: BillingTab) => void;
  data: BillingResponse;
}) {
  const { t } = useAppLanguage();
  const currency = (cents: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(cents / 100);
  const transactions = data.transactions.map((transaction) => [
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
      new Date(transaction.createdAt)
    ),
    transaction.provider,
    transaction.status,
    transaction.event?.clientName ?? "Unassigned",
    currency(transaction.amountCents),
    transaction.status === "paid" ? "green" : "red"
  ]);

  return (
    <div className="max-w-full min-w-0 space-y-4 overflow-x-hidden p-2 sm:p-4">
      <div className="grid min-w-0 grid-cols-1 gap-3 min-[380px]:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label={t("billing.paidIncome")}
          value={currency(data.summary.paidCents)}
          note={t("billing.paidTransactions")}
          tone="green"
        />
        <StatCard
          label={t("billing.transactions")}
          value={String(data.transactions.length)}
          note={t("billing.importedOrRecorded")}
        />
        <StatCard
          label={t("billing.invoices")}
          value={String(data.invoices.length)}
          note={t("billing.allInvoiceRecords")}
        />
        <StatCard
          label={t("billing.openInvoices")}
          value={currency(data.summary.openInvoiceCents)}
          note={`${data.summary.openInvoices} invoices`}
          tone="gold"
        />
        <StatCard
          label={t("billing.needsReview")}
          value={String(
            data.transactions.filter((item) => item.status !== "paid").length
          )}
          note={t("billing.pendingTransactions")}
        />
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
        <section className="min-w-0 overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
          <div className="flex flex-col items-stretch gap-3 border-b border-[#d8dde5] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div className="min-w-0">
              <h2 className="font-black text-[#17202a]">{t("billing.dashboard")}</h2>
              <p className="text-sm text-[#6a7483]">
                {t("billing.dashboardBlurb")}
              </p>
            </div>
            <TopAction
              label={t("billing.reviewTransactions")}
              onClick={() => setActiveTab("Transactions")}
            />
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-3">
            {[
              t("billing.assignCardBatch"),
              data.summary.openInvoices === 1
                ? t("billing.oneInvoiceOpen")
                : t("billing.invoicesOpen", {
                    count: data.summary.openInvoices
                  }),
              t("billing.reviewPayroll")
            ].map((text, index) => (
              <article
                key={text}
                className="rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-4"
              >
                <h3 className="font-black text-[#17202a]">
                  {[t("billing.nextAction"), t("billing.invoiceAction"), t("billing.profitCheck")][index]}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#17202a]">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="min-w-0 overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
          <div className="flex flex-col items-stretch gap-3 border-b border-[#d8dde5] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div className="min-w-0">
              <h2 className="font-black text-[#17202a]">{t("billing.cashMovement")}</h2>
              <p className="text-sm text-[#6a7483]">{t("billing.sampleWeekly")}</p>
            </div>
            <button
              className="rounded-lg border border-[#b9c2cf] px-4 py-2 text-sm font-black"
              type="button"
              onClick={() => setActiveTab("Event Billing")}
            >
              {t("billing.openEventBilling")}
            </button>
          </div>
          <div className="flex h-52 min-w-0 items-end gap-2 p-3 sm:gap-3 sm:p-6">
            {cashMovementBars.map((bar) => (
              <div
                key={bar.day}
                className="flex flex-1 flex-col items-center gap-2"
              >
                <span className="text-xs font-black">{bar.label}</span>
                <div className={`w-full rounded-t-md ${bar.className}`} />
                <span className="text-xs text-[#6a7483]">{bar.day}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
        <section className="min-w-0 overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
          <div className="border-b border-[#d8dde5] p-4">
            <h2 className="font-black text-[#17202a]">
              {t("billing.recentBankTransactions")}
            </h2>
            <p className="text-sm text-[#6a7483]">
              {t("billing.importedFrom")}
            </p>
          </div>
          <div className="max-w-full overflow-x-auto p-3 sm:p-4">
            <table className="w-full min-w-160 text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.08em] text-[#6a7483]">
                <tr>
                  {["Date", "Transaction", "Category", "Event", "Amount"].map(
                    (head) => (
                      <th key={head} className="border-b border-[#d8dde5] py-3">
                        {head}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {transactions.map(
                  ([date, name, category, event, amount, tone], index) => (
                    <tr
                      key={`${date}-${name}-${category}-${event}-${amount}-${index}`}
                      className="border-b border-[#d8dde5]"
                    >
                      <td className="py-3">{date}</td>
                      <td className="font-black">{name}</td>
                      <td>{category}</td>
                      <td>{event}</td>
                      <td
                        className={`text-right font-black ${tone === "green" ? "text-[#146c43]" : "text-[#a62b24]"}`}
                      >
                        {amount}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="min-w-0 overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
          <div className="flex flex-col items-stretch gap-3 border-b border-[#d8dde5] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div className="min-w-0">
              <h2 className="font-black text-[#17202a]">{t("billing.openBalances")}</h2>
              <p className="text-sm text-[#6a7483]">
                {t("billing.invoicesNeedPayment")}
              </p>
            </div>
            <button
              className="rounded-lg border border-[#b9c2cf] px-4 py-2 text-sm font-black"
              type="button"
              onClick={() => setActiveTab("Invoices")}
            >
              {t("billing.openInvoices")}
            </button>
          </div>
          <div className="space-y-3 p-4">
            {data.invoices
              .filter((invoice) => invoice.status !== "Paid")
              .map((invoice) => (
                <article
                  key={invoice.id}
                  className="rounded-lg border border-[#d8dde5] p-4"
                >
                  <h3 className="font-black">
                    {invoice.invoiceNumber} - {invoice.clientName}
                  </h3>
                  <p className="text-sm text-[#6a7483]">
                    {currency(
                      Math.max(0, invoice.totalCents - invoice.amountPaidCents)
                    )}{" "}
                    open
                    {invoice.dueDate
                      ? `, due ${new Intl.DateTimeFormat("en-US").format(new Date(invoice.dueDate))}`
                      : ""}
                    .
                  </p>
                </article>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
