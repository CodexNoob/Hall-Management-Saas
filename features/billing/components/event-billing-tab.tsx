"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Pill,
  StatCard,
  TopAction,
  type BillingResponse
} from "@/features/billing/components/billing-shared";
import { useAppLanguage } from "@/components/providers/app-language-provider";

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
  const { t } = useAppLanguage();
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
        <h2 className="font-black">{t("billing.eventBilling")}</h2>
        <p className="text-sm text-[#6a7483]">
          {t("billing.openEventWorkspace")}
        </p>
        <input
          className="mt-5 h-10 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm"
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={t("billing.eventSearch")}
          type="search"
          value={searchQuery}
        />
        <select
          aria-label={t("billing.eventBillingFilter")}
          className="mt-3 h-10 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm"
          onChange={(event) => setBalanceFilter(event.target.value)}
          value={balanceFilter}
        >
          <option value="All events">{t("billing.allEvents")}</option>
          <option value="Open balance">{t("billing.openBalance")}</option>
        </select>
        <div className="mt-3 space-y-2">
          {!visibleEvents.length ? (
            <div className="rounded-xl border border-dashed border-[#b9c2cf] p-8 text-center">
              <p className="font-black">
                {data.events.length ? t("billing.noMatchingEvents") : t("billing.noEventsYet")}
              </p>
              <p className="mt-1 text-sm text-[#6a7483]">
                {t("billing.eventBillingAfterCreate")}
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
                    {event.eventType || "Event"} · {event.hallName || t("billing.noHall")}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Pill tone={balance > 0 ? "gold" : "green"}>
                      {balance > 0 ? t("billing.openBalance") : t("billing.noBalance")}
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
                {selected.hallName || t("billing.noHall")}
              </p>
            </div>
            <TopAction label={t("billing.createInvoice")} onClick={onCreateInvoice} />
          </div>
          <div className="grid gap-2 p-4 sm:grid-cols-3">
            <StatCard
              label={t("billing.invoices")}
              value={money(invoicedCents)}
              note={t("billing.invoiceRecords", {
                count: selectedInvoices.length
              })}
            />
            <StatCard
              label={t("billing.statusPaid")}
              value={money(paidCents)}
              note={t("billing.recordedPayments")}
              tone="green"
            />
            <StatCard
              label={t("billing.openBalance")}
              value={money(balanceCents)}
              note={t("billing.amountOutstanding")}
              tone="gold"
            />
          </div>
          <div className="p-4 pt-0">
            <article className="rounded-xl border border-[#d8dde5] p-4">
              <h3 className="font-black">{t("billing.eventBillingSummary")}</h3>
              <dl className="mt-4 grid grid-cols-[140px_1fr] gap-3 text-sm">
                <dt className="font-black uppercase text-[#6a7483]">{t("common.client")}</dt>
                <dd className="font-black">{selected.clientName}</dd>
                <dt className="font-black uppercase text-[#6a7483]">{t("common.status")}</dt>
                <dd className="font-black">{selected.eventStatus}</dd>
                <dt className="font-black uppercase text-[#6a7483]">{t("billing.payment")}</dt>
                <dd className="font-black">{selected.paymentStatus}</dd>
                <dt className="font-black uppercase text-[#6a7483]">
                  {t("billing.amountDue")}
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
            <h2 className="font-black">{t("billing.selectEvent")}</h2>
            <p className="text-sm text-[#6a7483]">
              {t("billing.billingDetailsHere")}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
