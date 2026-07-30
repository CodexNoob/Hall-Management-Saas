"use client";

import {
  LineIcon,
  Pill,
  StatCard,
  TopAction
} from "@/features/billing/components/billing-shared";

export function InvoicesTab({
  searchQuery,
  setSearchQuery
}: {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}) {
  const invoiceNames = [
    "INV-1028 - Friedman",
    "INV-1029 - Klein",
    "INV-1030 - Weiss",
    "INV-1031 - Green"
  ];
  const visibleInvoices = invoiceNames.filter((invoice) =>
    invoice.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );
  return (
    <div className="grid min-w-0 gap-4 p-2 sm:p-4 xl:grid-cols-[430px_minmax(0,1fr)]">
      <section className="min-w-0 overflow-hidden rounded-xl border border-[#d8dde5] bg-white p-3 shadow-sm sm:p-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-black">Invoices</h2>
            <p className="text-sm text-[#6a7483]">
              Draft, send, and receive payment.
            </p>
          </div>
          <TopAction label="New" />
        </div>
        <input
          className="mt-5 h-10 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm"
          name="invoiceSearch"
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Invoice, client, status"
          type="search"
          value={searchQuery}
        />
        <select
          className="mt-3 h-10 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm"
          aria-label="Invoice status filter"
          name="invoiceStatusFilter"
          title="Invoice status filter"
        >
          <option>All invoices</option>
        </select>
        <div className="mt-3 space-y-2">
          {visibleInvoices.map((invoice) => {
            const index = invoiceNames.indexOf(invoice);
            return (
              <article
                key={invoice}
                className={`rounded-lg border p-3 ${index === 1 ? "border-[#1f4d73] bg-[#eef4fa]" : "border-[#d8dde5]"}`}
              >
                <div className="flex min-w-0 flex-wrap justify-between gap-x-3 font-black">
                  <span className="min-w-0 wrap-break-word">{invoice}</span>
                  <span className="shrink-0">
                    {["$48,220", "$17,560", "$22,855", "$9,040"][index]}
                  </span>
                </div>
                <p className="text-xs text-[#6a7483]">
                  {
                    [
                      "Jun 12, 2026 - Due Jul 1, 2026",
                      "Jun 16, 2026 - Due Jul 5, 2026",
                      "Jun 20, 2026 - Due Paid",
                      "Jun 24, 2026 - Due Jul 12, 2026"
                    ][index]
                  }
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Pill
                    tone={index === 2 ? "green" : index === 3 ? "gold" : "red"}
                  >
                    {index === 2 ? "Paid" : index === 3 ? "Draft" : "Open"}
                  </Pill>
                  <Pill>
                    Balance {["$30,220", "$15,060", "$5", "$9,040"][index]}
                  </Pill>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <section className="min-w-0 overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
        <div className="flex flex-col items-stretch gap-3 border-b border-[#d8dde5] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="min-w-0">
            <h2 className="text-2xl font-black">INV-1029</h2>
            <p className="text-sm text-[#6a7483]">Klein - Sheva Brachos</p>
          </div>
          <div className="grid w-full gap-2 sm:flex sm:w-auto">
            <TopAction label="Record payment" />
            <TopAction icon="print" label="Print" />
            <TopAction label="Save invoice" tone="primary" />
          </div>
        </div>
        <div className="grid gap-2 p-4 md:grid-cols-5">
          <StatCard label="Total" value="$17,560" note="" />
          <StatCard label="Payments" value="$2,500" note="" tone="green" />
          <StatCard label="Balance" value="$15,060" note="" tone="gold" />
          <StatCard label="Status" value="Open" note="" />
          <StatCard label="Due" value="Jul 5, 2026" note="" />
        </div>
        <div className="grid gap-4 p-4 pt-0 xl:grid-cols-2">
          <article className="rounded-xl border border-[#d8dde5] p-4">
            <div className="flex justify-between">
              <h3 className="font-black">Invoice builder</h3>
              <TopAction label="Add item" />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {["Client", "Status", "Due Date", "Event"].map((label, index) => (
                <label
                  key={label}
                  className="text-xs font-black uppercase text-[#6a7483]"
                >
                  {label}
                  <input
                    className="mt-1 h-10 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm"
                    defaultValue={
                      ["Klein", "Open", "Jul 5, 2026", "Klein - Jul 11, 2026"][
                        index
                      ]
                    }
                    name={`invoice-${label.toLowerCase().replaceAll(" ", "-")}`}
                  />
                </label>
              ))}
            </div>
          </article>
          <article className="rounded-xl border border-[#d8dde5] p-4">
            <h3 className="font-black">Invoice preview</h3>
            <div className="mt-4 rounded-lg border border-[#d8dde5] p-4">
              <div className="flex justify-between">
                <strong>Event Core</strong>
                <span className="text-right font-black">
                  INV-1029
                  <br />
                  <span className="text-sm font-medium text-[#6a7483]">
                    Due Jul 5, 2026
                  </span>
                </span>
              </div>
              <div className="mt-6 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Dairy package</span>
                  <strong>$14,760</strong>
                </div>
                <div className="flex justify-between">
                  <span>Room charge</span>
                  <strong>$2,800</strong>
                </div>
              </div>
              <p className="mt-4 text-right text-2xl font-black">$17,560</p>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
