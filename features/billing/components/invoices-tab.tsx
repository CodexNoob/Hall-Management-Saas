"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Pill,
  StatCard,
  TopAction,
  type BillingResponse
} from "@/features/billing/components/billing-shared";

type Invoice = BillingResponse["invoices"][number];

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    cents / 100
  );
}

function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
        new Date(value)
      )
    : "Not set";
}

function statusTone(status: string) {
  if (status === "Paid") return "green" as const;
  if (status === "Open") return "red" as const;
  return "gold" as const;
}

export function InvoicesTab({
  data,
  onNewInvoice,
  searchQuery,
  setSearchQuery
}: {
  data: BillingResponse;
  onNewInvoice: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}) {
  const [status, setStatus] = useState("All invoices");
  const [selectedId, setSelectedId] = useState(data.invoices[0]?.id ?? "");
  const visibleInvoices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return data.invoices.filter((invoice) => {
      const matchesQuery =
        !query ||
        [invoice.invoiceNumber, invoice.clientName, invoice.status].some(
          (value) => value.toLowerCase().includes(query)
        );
      return (
        matchesQuery && (status === "All invoices" || invoice.status === status)
      );
    });
  }, [data.invoices, searchQuery, status]);
  const selected =
    data.invoices.find((invoice) => invoice.id === selectedId) ??
    visibleInvoices[0] ??
    null;

  useEffect(() => {
    if (
      selectedId &&
      data.invoices.some((invoice) => invoice.id === selectedId)
    )
      return;
    setSelectedId(data.invoices[0]?.id ?? "");
  }, [data.invoices, selectedId]);

  return (
    <div className="grid min-w-0 gap-4 p-2 sm:p-4 xl:grid-cols-[430px_minmax(0,1fr)]">
      <section className="min-w-0 overflow-hidden rounded-xl border border-[#d8dde5] bg-white p-3 shadow-sm sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-black">Invoices</h2>
            <p className="text-sm text-[#6a7483]">
              Draft, issue, and track payment.
            </p>
          </div>
          <TopAction icon="plus" label="New" onClick={onNewInvoice} />
        </div>
        <input
          className="mt-5 h-10 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm"
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Invoice, client, status"
          type="search"
          value={searchQuery}
        />
        <select
          aria-label="Invoice status filter"
          className="mt-3 h-10 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm"
          onChange={(event) => setStatus(event.target.value)}
          value={status}
        >
          <option>All invoices</option>
          <option>Draft</option>
          <option>Open</option>
          <option>Paid</option>
          <option>Void</option>
        </select>
        <div className="mt-3 space-y-2">
          {!visibleInvoices.length ? (
            <div className="rounded-xl border border-dashed border-[#b9c2cf] px-4 py-10 text-center">
              <p className="font-black">
                {data.invoices.length
                  ? "No matching invoices"
                  : "No invoices yet"}
              </p>
              <p className="mt-1 text-sm text-[#6a7483]">
                {data.invoices.length
                  ? "Try another search or status."
                  : "Create the first invoice from an event."}
              </p>
              {!data.invoices.length ? (
                <button
                  className="mt-4 rounded-lg bg-[#1f4d73] px-4 py-2 text-sm font-black text-white"
                  onClick={onNewInvoice}
                  type="button"
                >
                  Create invoice
                </button>
              ) : null}
            </div>
          ) : (
            visibleInvoices.map((invoice) => (
              <button
                className={`block w-full rounded-lg border p-3 text-left transition ${selected?.id === invoice.id ? "border-[#1f4d73] bg-[#eef4fa]" : "border-[#d8dde5] hover:border-[#8fa0b5]"}`}
                key={invoice.id}
                onClick={() => setSelectedId(invoice.id)}
                type="button"
              >
                <div className="flex min-w-0 justify-between gap-3 font-black">
                  <span className="truncate">
                    {invoice.invoiceNumber} — {invoice.clientName}
                  </span>
                  <span className="shrink-0">
                    {money(invoice.totalCents, invoice.currency)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#6a7483]">
                  Created {date(invoice.createdAt)} · Due{" "}
                  {date(invoice.dueDate)}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Pill tone={statusTone(invoice.status)}>
                    {invoice.status}
                  </Pill>
                  <Pill>
                    Balance {money(invoice.balanceDueCents, invoice.currency)}
                  </Pill>
                </div>
              </button>
            ))
          )}
        </div>
      </section>
      {selected ? (
        <InvoiceDetails invoice={selected} />
      ) : (
        <section className="flex min-h-80 items-center justify-center rounded-xl border border-[#d8dde5] bg-white p-8 text-center shadow-sm">
          <div>
            <h2 className="font-black">Select an invoice</h2>
            <p className="mt-1 text-sm text-[#6a7483]">
              Invoice details will appear here.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

function InvoiceDetails({ invoice }: { invoice: Invoice }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[#d8dde5] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="min-w-0">
          <h2 className="truncate text-2xl font-black">
            {invoice.invoiceNumber}
          </h2>
          <p className="text-sm text-[#6a7483]">
            {invoice.clientName}
            {invoice.event?.hallName ? ` · ${invoice.event.hallName}` : ""}
          </p>
        </div>
        <TopAction icon="print" label="Print" onClick={() => window.print()} />
      </div>
      <div className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Total"
          value={money(invoice.totalCents, invoice.currency)}
          note=""
        />
        <StatCard
          label="Payments"
          value={money(invoice.amountPaidCents, invoice.currency)}
          note=""
          tone="green"
        />
        <StatCard
          label="Balance"
          value={money(invoice.balanceDueCents, invoice.currency)}
          note=""
          tone="gold"
        />
        <StatCard label="Status" value={invoice.status} note="" />
        <StatCard label="Due" value={date(invoice.dueDate)} note="" />
      </div>
      <div className="grid gap-4 p-4 pt-0 xl:grid-cols-2">
        <article className="rounded-xl border border-[#d8dde5] p-4">
          <h3 className="font-black">Line items</h3>
          <div className="mt-4 divide-y divide-[#d8dde5]">
            {!invoice.lineItems.length ? (
              <p className="py-4 text-sm text-[#6a7483]">
                No line items recorded.
              </p>
            ) : (
              invoice.lineItems.map((item) => (
                <div
                  className="flex justify-between gap-4 py-3 text-sm"
                  key={item.id}
                >
                  <span>
                    {item.description}
                    <span className="block text-xs text-[#6a7483]">
                      Quantity {String(item.quantity)} ·{" "}
                      {money(item.unitAmountCents, invoice.currency)} each
                    </span>
                  </span>
                  <strong>{money(item.totalCents, invoice.currency)}</strong>
                </div>
              ))
            )}
          </div>
        </article>
        <article className="rounded-xl border border-[#d8dde5] p-4">
          <h3 className="font-black">Invoice summary</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt>Client</dt>
              <dd className="font-black">{invoice.clientName}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Issued</dt>
              <dd className="font-black">{date(invoice.issuedAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Due</dt>
              <dd className="font-black">{date(invoice.dueDate)}</dd>
            </div>
            <div className="flex justify-between border-t border-[#d8dde5] pt-3 text-lg">
              <dt className="font-black">Total</dt>
              <dd className="font-black">
                {money(invoice.totalCents, invoice.currency)}
              </dd>
            </div>
          </dl>
          {invoice.notes ? (
            <p className="mt-4 rounded-lg bg-[#f5f6f8] p-3 text-sm text-[#6a7483]">
              {invoice.notes}
            </p>
          ) : null}
        </article>
      </div>
    </section>
  );
}
