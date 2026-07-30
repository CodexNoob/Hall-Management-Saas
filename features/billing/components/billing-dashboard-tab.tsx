"use client";

import {
  cashMovementBars,
  LineIcon,
  StatCard,
  TopAction,
  type BillingResponse,
  type BillingTab
} from "@/features/billing/components/billing-shared";

export function BillingDashboardTab({
  setActiveTab,
  data
}: {
  setActiveTab: (tab: BillingTab) => void;
  data: BillingResponse;
}) {
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
          label="Paid Income"
          value={currency(data.summary.paidCents)}
          note="Paid transactions"
          tone="green"
        />
        <StatCard
          label="Transactions"
          value={String(data.transactions.length)}
          note="Imported or recorded"
        />
        <StatCard
          label="Invoices"
          value={String(data.invoices.length)}
          note="All invoice records"
        />
        <StatCard
          label="Open Invoices"
          value={currency(data.summary.openInvoiceCents)}
          note={`${data.summary.openInvoices} invoices`}
          tone="gold"
        />
        <StatCard
          label="Needs Review"
          value={String(
            data.transactions.filter((item) => item.status !== "paid").length
          )}
          note="Pending transactions"
        />
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
        <section className="min-w-0 overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
          <div className="flex flex-col items-stretch gap-3 border-b border-[#d8dde5] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div className="min-w-0">
              <h2 className="font-black text-[#17202a]">Billing dashboard</h2>
              <p className="text-sm text-[#6a7483]">
                Daily office view for the finance team.
              </p>
            </div>
            <TopAction label="Review transactions" />
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-3">
            {[
              "Assign card batch payout to the correct events or split it across events.",
              "Friedman and Klein have open balances before event week.",
              "Review payroll and linen transactions before closing the week."
            ].map((text, index) => (
              <article
                key={text}
                className="rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-4"
              >
                <h3 className="font-black text-[#17202a]">
                  {["Next action", "Invoice action", "Profit check"][index]}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#17202a]">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="min-w-0 overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
          <div className="flex flex-col items-stretch gap-3 border-b border-[#d8dde5] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div className="min-w-0">
              <h2 className="font-black text-[#17202a]">Cash movement</h2>
              <p className="text-sm text-[#6a7483]">Sample weekly activity.</p>
            </div>
            <button
              className="rounded-lg border border-[#b9c2cf] px-4 py-2 text-sm font-black"
              type="button"
              onClick={() => setActiveTab("Event Billing")}
            >
              Open event billing
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
              Recent bank transactions
            </h2>
            <p className="text-sm text-[#6a7483]">
              Imported from connected bank or file upload.
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
              <h2 className="font-black text-[#17202a]">Open balances</h2>
              <p className="text-sm text-[#6a7483]">
                Invoices that still need payment.
              </p>
            </div>
            <button
              className="rounded-lg border border-[#b9c2cf] px-4 py-2 text-sm font-black"
              type="button"
              onClick={() => setActiveTab("Invoices")}
            >
              Open invoices
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
