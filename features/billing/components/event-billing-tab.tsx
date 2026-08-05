"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Pill,
  StatCard,
  TopAction,
  type BillingResponse
} from "@/features/billing/components/billing-shared";

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(cents / 100);
}

export function EventBillingTab({
  data,
  onCreateInvoice,
  searchQuery,
  setSearchQuery
}: {
  data: BillingResponse;
  onCreateInvoice: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}) {
  const [balanceFilter, setBalanceFilter] = useState("All events");
  const [selectedId, setSelectedId] = useState(data.events[0]?.id ?? "");
  const eventBalances = useMemo(
    () =>
      new Map(
        data.events.map((event) => [
          event.id,
          data.invoices
            .filter((invoice) => invoice.eventId === event.id)
            .reduce((sum, invoice) => sum + invoice.balanceDueCents, 0)
        ])
      ),
    [data.events, data.invoices]
  );
  const visibleEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return data.events.filter((event) => {
      const matches =
        !query ||
        [
          event.clientName,
          event.hallName,
          event.eventType,
          event.eventStatus
        ].some((value) => value.toLowerCase().includes(query));
      return (
        matches &&
        (balanceFilter === "All events" ||
          (eventBalances.get(event.id) ?? 0) > 0)
      );
    });
  }, [balanceFilter, data.events, eventBalances, searchQuery]);
  const selected =
    data.events.find((event) => event.id === selectedId) ??
    visibleEvents[0] ??
    null;

  useEffect(() => {
    if (!data.events.some((event) => event.id === selectedId))
      setSelectedId(data.events[0]?.id ?? "");
  }, [data.events, selectedId]);

  const selectedInvoices = selected
    ? data.invoices.filter((invoice) => invoice.eventId === selected.id)
    : [];
  const invoicedCents = selectedInvoices.reduce(
    (sum, invoice) => sum + invoice.totalCents,
    0
  );
  const paidCents = selectedInvoices.reduce(
    (sum, invoice) => sum + invoice.amountPaidCents,
    0
  );
  const balanceCents = selectedInvoices.reduce(
    (sum, invoice) => sum + invoice.balanceDueCents,
    0
  );

  return (
    <div className="grid min-w-0 gap-4 p-2 sm:p-4 xl:grid-cols-[430px_minmax(0,1fr)]">
      <section className="min-w-0 rounded-xl border border-[#d8dde5] bg-white p-3 shadow-sm sm:p-4">
        <h2 className="font-black">Event Billing</h2>
        <p className="text-sm text-[#6a7483]">
          Open a specific event billing workspace.
        </p>
        <input
          className="mt-5 h-10 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm"
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Client, hall, date, status"
          type="search"
          value={searchQuery}
        />
        <select
          aria-label="Event billing balance filter"
          className="mt-3 h-10 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm"
          onChange={(event) => setBalanceFilter(event.target.value)}
          value={balanceFilter}
        >
          <option>All events</option>
          <option>Open balance</option>
        </select>
        <div className="mt-3 space-y-2">
          {!visibleEvents.length ? (
            <div className="rounded-xl border border-dashed border-[#b9c2cf] p-8 text-center">
              <p className="font-black">
                {data.events.length ? "No matching events" : "No events yet"}
              </p>
              <p className="mt-1 text-sm text-[#6a7483]">
                Event billing becomes available after an event is created.
              </p>
            </div>
          ) : (
            visibleEvents.map((event) => {
              const balance = eventBalances.get(event.id) ?? 0;
              return (
                <button
                  className={`block w-full rounded-lg border p-3 text-left ${selected?.id === event.id ? "border-[#1f4d73] bg-[#eef4fa]" : "border-[#d8dde5]"}`}
                  key={event.id}
                  onClick={() => setSelectedId(event.id)}
                  type="button"
                >
                  <div className="flex justify-between gap-3 font-black">
                    <span className="truncate">{event.clientName}</span>
                    <span>{money(balance)}</span>
                  </div>
                  <p className="text-xs text-[#6a7483]">
                    {new Date(event.eventDate).toLocaleDateString()} ·{" "}
                    {event.eventType || "Event"} · {event.hallName || "No hall"}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Pill tone={balance > 0 ? "gold" : "green"}>
                      {balance > 0 ? "Open balance" : "No balance"}
                    </Pill>
                    <Pill>{event.eventStatus}</Pill>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>
      {selected ? (
        <section className="min-w-0 overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#d8dde5] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-black">{selected.clientName}</h2>
              <p className="text-sm text-[#6a7483]">
                {selected.eventType || "Event"} ·{" "}
                {new Date(selected.eventDate).toLocaleDateString()} ·{" "}
                {selected.hallName || "No hall"}
              </p>
            </div>
            <TopAction label="Create invoice" onClick={onCreateInvoice} />
          </div>
          <div className="grid gap-2 p-4 sm:grid-cols-3">
            <StatCard
              label="Invoices"
              value={money(invoicedCents)}
              note={`${selectedInvoices.length} invoice records`}
            />
            <StatCard
              label="Paid"
              value={money(paidCents)}
              note="Recorded payments"
              tone="green"
            />
            <StatCard
              label="Open Balance"
              value={money(balanceCents)}
              note="Amount outstanding"
              tone="gold"
            />
          </div>
          <div className="p-4 pt-0">
            <article className="rounded-xl border border-[#d8dde5] p-4">
              <h3 className="font-black">Event billing summary</h3>
              <dl className="mt-4 grid grid-cols-[140px_1fr] gap-3 text-sm">
                <dt className="font-black uppercase text-[#6a7483]">Client</dt>
                <dd className="font-black">{selected.clientName}</dd>
                <dt className="font-black uppercase text-[#6a7483]">Status</dt>
                <dd className="font-black">{selected.eventStatus}</dd>
                <dt className="font-black uppercase text-[#6a7483]">Payment</dt>
                <dd className="font-black">{selected.paymentStatus}</dd>
                <dt className="font-black uppercase text-[#6a7483]">
                  Amount due
                </dt>
                <dd className="font-black">
                  {money(Math.round(Number(selected.amountDue) * 100))}
                </dd>
              </dl>
            </article>
          </div>
        </section>
      ) : (
        <section className="flex min-h-80 items-center justify-center rounded-xl border border-[#d8dde5] bg-white p-8 text-center">
          <div>
            <h2 className="font-black">Select an event</h2>
            <p className="text-sm text-[#6a7483]">
              Billing details will appear here.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
