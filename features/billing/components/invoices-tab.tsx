"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Pill,
  TopAction,
  type BillingResponse
} from "@/features/billing/components/billing-shared";
import { InvoiceDetails } from "@/features/billing/components/invoice-details";

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
  if (status === "Overdue" || status === "Cancelled") return "red" as const;
  return "gold" as const;
}

function historyInvoiceId(value: unknown) {
  return value && typeof value === "object" && "invoiceId" in value
    ? String((value as { invoiceId: unknown }).invoiceId)
    : null;
}

export function InvoicesTab({
  canManagePayments,
  data,
  onNewInvoice,
  onRefresh,
  searchQuery,
  setSearchQuery
}: {
  canManagePayments: boolean;
  data: BillingResponse;
  onNewInvoice: () => void;
  onRefresh: () => Promise<BillingResponse | null>;
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
          <TopAction
            disabled={!canManagePayments}
            icon="plus"
            label="New"
            onClick={onNewInvoice}
          />
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
          <option>Sent</option>
          <option>Partially Paid</option>
          <option>Paid</option>
          <option>Overdue</option>
          <option>Cancelled</option>
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
        <InvoiceDetails
          canManagePayments={canManagePayments}
          history={(data.invoiceHistory ?? []).filter(
            (entry) => historyInvoiceId(entry.newValue) === selected.id
          )}
          invoice={selected}
          onRefresh={onRefresh}
        />
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
