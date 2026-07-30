"use client";

import {
  ActionButton,
  LineIcon,
  type IconName
} from "@/features/events/components/event-manager-shared";
import { Field } from "@/features/events/components/event-details-panel";

function BillingStatCard({
  label,
  value,
  note,
  icon,
  emphasized = false
}: {
  label: string;
  value: string;
  note: string;
  icon: IconName;
  emphasized?: boolean;
}) {
  return (
    <article
      className={`min-h-27 rounded-lg border bg-white p-3 ${emphasized ? "border-[#1f4d73] shadow-sm shadow-[#1f4d73]/10" : "border-[#d8dde5]"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#6a7483]">
            {label}
          </p>
          <p
            className={`mt-2 text-base font-black sm:text-xl ${emphasized ? "text-[#9a5b00]" : "text-[#17202a]"}`}
          >
            {value}
          </p>
          <p className="mt-2 text-xs text-[#6a7483]">{note}</p>
        </div>
        <span className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#d8dde5] bg-[#fbfcfd] text-[#6a7483] sm:flex">
          <LineIcon name={icon} className="h-4 w-4" />
        </span>
      </div>
    </article>
  );
}

export function EventBillingContent() {
  const invoices = [
    ["INV-1028", "Open", "$48,200.00", "$18,000.00", "$30,200.00"],
    ["RET-881", "Paid", "$7,000.00", "$7,000.00", "$0.00"]
  ];

  const transactions = [
    ["Jun 24", "ACH Friedman", "$15,000.00", "Event Deposit"],
    ["Jun 25", "Premium Linen Co.", "$-1,840.00", "Linen Rental"],
    ["Jun 27", "Refund adjustment", "$-600.00", "Refund"]
  ];

  return (
    <div className="min-w-0 space-y-3 overflow-hidden">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <BillingStatCard
          label="Total event"
          value="$55,200.00"
          note="Invoice total"
          icon="document"
        />
        <BillingStatCard
          label="Open balance"
          value="$30,200.00"
          note="Click to open outstanding balance"
          icon="document"
          emphasized
        />
        <BillingStatCard
          label="Payments"
          value="$25,000.00"
          note="Recorded on event"
          icon="document"
        />
        <BillingStatCard
          label="Transactions"
          value="3"
          note="Assigned records"
          icon="files"
        />
      </div>

      <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_336px]">
        <section className="min-w-0 overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
          <header className="flex flex-col gap-3 border-b border-[#d8dde5] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <div className="flex items-center gap-2">
              <LineIcon name="document" />
              <h2 className="text-sm font-black text-[#17202a]">
                Invoices for this event
              </h2>
            </div>
            <button
              className="inline-flex h-8 shrink-0 items-center justify-center gap-2 self-end rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white hover:bg-[#15344f] sm:self-auto"
              type="button"
            >
              <LineIcon name="plus" />
              Create invoice
            </button>
          </header>
          <div className="space-y-2 p-3 md:hidden">
            {invoices.map(([invoice, status, total, paid, balance]) => (
              <article
                className="rounded-lg border border-[#d8dde5] p-3 text-sm"
                key={invoice}
              >
                <div className="flex items-center justify-between gap-3">
                  <strong>{invoice}</strong>
                  <span className="text-xs font-bold text-[#617086]">
                    {status}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-[10px] font-black uppercase text-[#6a7483]">
                      Total
                    </dt>
                    <dd className="mt-1 font-bold">{total}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-black uppercase text-[#6a7483]">
                      Paid
                    </dt>
                    <dd className="mt-1 font-bold">{paid}</dd>
                  </div>
                  <div className="text-right">
                    <dt className="text-[10px] font-black uppercase text-[#6a7483]">
                      Balance
                    </dt>
                    <dd className="mt-1 font-black">{balance}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto p-3 md:block">
            <table className="w-full min-w-130 text-left text-sm">
              <thead className="bg-[#fbfcfd] text-[11px] font-black uppercase tracking-[0.08em] text-[#6a7483]">
                <tr>
                  {["Invoice", "Status", "Total", "Paid", "Balance"].map(
                    (head) => (
                      <th
                        key={head}
                        className="border-b border-[#d8dde5] px-2 py-3"
                      >
                        {head}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {invoices.map(([invoice, status, total, paid, balance]) => (
                  <tr
                    key={invoice}
                    className="border-b border-[#d8dde5] last:border-b-0"
                  >
                    <td className="px-2 py-3 font-black text-[#17202a]">
                      {invoice}
                    </td>
                    <td className="px-2 py-3">{status}</td>
                    <td className="px-2 py-3">{total}</td>
                    <td className="px-2 py-3">{paid}</td>
                    <td className="px-2 py-3 text-right font-black">
                      {balance}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="min-w-0 rounded-lg border border-[#d8dde5] bg-white">
          <header className="flex h-11 items-center gap-2 border-b border-[#d8dde5] px-4">
            <LineIcon name="document" />
            <h2 className="text-sm font-black text-[#17202a]">Actions</h2>
          </header>
          <div className="space-y-3 p-3">
            <Field label="Payment amount">
              <input
                className="mt-1 h-9 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm font-medium text-[#17202a]"
                defaultValue="5000"
                name="paymentAmount"
              />
            </Field>
            {["Record payment", "Client statement"].map((action) => (
              <button
                key={action}
                className="flex h-12 w-full items-center gap-3 rounded-lg border border-[#d8dde5] bg-white px-3 text-left text-sm font-black text-[#17202a] hover:bg-[#eef4fa]"
                type="button"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d8dde5] bg-[#fbfcfd] text-[#1f4d73]">
                  <LineIcon name="document" />
                </span>
                <span className="min-w-0 flex-1 truncate">{action}</span>
                <LineIcon name="chevron" className="h-4 w-4 text-[#17202a]" />
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="min-w-0 overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
        <header className="flex h-11 items-center gap-2 border-b border-[#d8dde5] px-4">
          <LineIcon name="files" />
          <h2 className="text-sm font-black text-[#17202a]">
            Transaction history
          </h2>
        </header>
        <div className="space-y-2 p-3 md:hidden">
          {transactions.map(([date, source, amount, category]) => (
            <article
              className="rounded-lg border border-[#d8dde5] p-3 text-sm"
              key={`${date}-${source}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <strong className="block truncate">{source}</strong>
                  <span className="mt-1 block text-xs text-[#6a7483]">
                    {date} · {category}
                  </span>
                </div>
                <strong className="shrink-0">{amount}</strong>
              </div>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto p-3 md:block">
          <table className="w-full min-w-160 text-left text-sm">
            <thead className="bg-[#fbfcfd] text-[11px] font-black uppercase tracking-[0.08em] text-[#6a7483]">
              <tr>
                {["Date", "Source", "Amount", "Category"].map((head) => (
                  <th
                    key={head}
                    className="border-b border-[#d8dde5] px-2 py-3"
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map(([date, source, amount, category]) => (
                <tr
                  key={`${date}-${source}`}
                  className="border-b border-[#d8dde5] last:border-b-0"
                >
                  <td className="px-2 py-3">{date}</td>
                  <td className="px-2 py-3 font-black text-[#17202a]">
                    {source}
                  </td>
                  <td className="px-2 py-3 text-right font-black">{amount}</td>
                  <td className="px-2 py-3">{category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
