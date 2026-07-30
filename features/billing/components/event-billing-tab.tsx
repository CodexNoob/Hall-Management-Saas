"use client";

import {
  LineIcon,
  Pill,
  StatCard,
  TopAction
} from "@/features/billing/components/billing-shared";

export function EventBillingTab({
  searchQuery,
  setSearchQuery
}: {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}) {
  const eventNames = ["Friedman", "Klein", "Weiss", "Green"];
  const visibleEventNames = eventNames.filter((name) =>
    name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );
  return (
    <div className="grid min-w-0 gap-4 p-2 sm:p-4 xl:grid-cols-[430px_minmax(0,1fr)]">
      <section className="min-w-0 overflow-hidden rounded-xl border border-[#d8dde5] bg-white p-3 shadow-sm sm:p-4">
        <h2 className="font-black">Event Billing</h2>
        <p className="text-sm text-[#6a7483]">
          Open a specific event billing workspace.
        </p>
        <input
          className="mt-5 h-10 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm"
          name="eventBillingSearch"
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Client, hall, date, status"
          type="search"
          value={searchQuery}
        />
        <select
          className="mt-3 h-10 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm"
          aria-label="Event billing balance filter"
          name="eventBalanceFilter"
          title="Event billing balance filter"
        >
          <option>Open balance</option>
        </select>
        <div className="mt-3 wrap-break-word rounded-lg border border-[#9a5b00] bg-[#fbfcfd] p-3 text-sm text-[#9a5b00]">
          Events highlighted here have open invoice balances.
        </div>
        <div className="mt-3 space-y-2">
          {visibleEventNames.map((name) => {
            const index = eventNames.indexOf(name);
            return (
              <article
                key={name}
                className="rounded-lg border border-[#9a5b00] bg-[#fbfcfd] p-3"
              >
                <div className="flex min-w-0 flex-wrap justify-between gap-x-3 font-black">
                  <span className="min-w-0 wrap-break-word">{name}</span>
                  <span className="shrink-0">
                    {["$29,320", "$15,060", "$22,855", "$9,040"][index]}
                  </span>
                </div>
                <p className="text-xs text-[#6a7483]">
                  {
                    [
                      "Jul 8, 2026 - Wedding - Grand Hall",
                      "Jul 11, 2026 - Sheva Brachos - Nachlas Yehuda A",
                      "Jul 14, 2026 - Bar Mitzvah - Terrace Room",
                      "Jul 20, 2026 - Dinner - Small Hall"
                    ][index]
                  }
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Pill tone="gold">Open balance</Pill>
                  <Pill>
                    {index === 1
                      ? "Hold"
                      : index === 3
                        ? "Proposal"
                        : "Confirmed"}
                  </Pill>
                  {index < 3 ? <Pill tone="gold">Needs review</Pill> : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <section className="min-w-0 overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
        <div className="flex flex-col items-stretch gap-3 border-b border-[#d8dde5] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="min-w-0">
            <h2 className="text-2xl font-black">Friedman</h2>
            <p className="text-sm text-[#6a7483]">
              Wedding - Jul 8, 2026 - Grand Hall
            </p>
          </div>
          <div className="grid w-full gap-2 sm:flex sm:w-auto">
            <TopAction label="Create invoice" />
            <TopAction label="Record payment" />
            <TopAction icon="print" label="Print statement" tone="primary" />
          </div>
        </div>
        <div className="grid gap-2 p-4 md:grid-cols-5">
          <StatCard label="Invoices" value="$48,220" note="" />
          <StatCard label="Paid" value="$18,900" note="" tone="green" />
          <StatCard label="Open Balance" value="$29,320" note="" tone="gold" />
          <StatCard label="Expenses" value="$7,640" note="" tone="red" />
          <StatCard label="Profit" value="$11,260" note="" />
        </div>
        <div className="grid gap-4 p-4 pt-0 xl:grid-cols-2">
          <article className="rounded-xl border border-[#d8dde5] p-4">
            <h3 className="font-black">Event billing summary</h3>
            <dl className="mt-4 grid grid-cols-[140px_1fr] gap-3 text-sm">
              <dt className="font-black uppercase text-[#6a7483]">Client</dt>
              <dd className="font-black">Friedman</dd>
              <dt className="font-black uppercase text-[#6a7483]">Status</dt>
              <dd className="font-black">Confirmed</dd>
              <dt className="font-black uppercase text-[#6a7483]">Package</dt>
              <dd className="font-black">Gold Dinner</dd>
              <dt className="font-black uppercase text-[#6a7483]">
                Coordinator
              </dt>
              <dd className="font-black">M. Stern</dd>
              <dt className="font-black uppercase text-[#6a7483]">Due Date</dt>
              <dd className="font-black">Jul 1, 2026</dd>
            </dl>
          </article>
          <article className="rounded-xl border border-[#d8dde5] p-4">
            <h3 className="font-black">Billing actions</h3>
            <div className="mt-4 space-y-3">
              {[
                "Create invoice for this event",
                "Make payment / record payment",
                "Assign bank transactions",
                "Client statement"
              ].map((action) => (
                <button
                  key={action}
                  className="h-10 w-full rounded-lg border border-[#b9c2cf] font-black"
                  type="button"
                >
                  {action}
                </button>
              ))}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
