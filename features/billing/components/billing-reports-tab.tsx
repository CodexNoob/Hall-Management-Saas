"use client";

import { DashboardPageState } from "@/components/layout/dashboard-page-state";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";

type Reports = {
  revenueCents: number;
  refundedCents: number;
  outstandingCents: number;
  invoiceCounts: Record<string, number>;
  aging: {
    current: number;
    days30: number;
    days60: number;
    days90Plus: number;
  };
};

const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100
  );

export function BillingReportsTab() {
  const query = useAuthenticatedQuery<Reports>("/api/billing/reports");
  if (query.isLoading || query.error || !query.data) {
    return (
      <DashboardPageState
        isLoading={query.isLoading}
        error={query.error}
        onRetry={query.refetch}
        subtitle="Revenue, outstanding balances, refunds, and aging."
        title="Billing reports"
      />
    );
  }
  const report = query.data;
  function exportCsv() {
    const rows = [
      ["Metric", "Amount"],
      ["Net revenue", report.revenueCents],
      ["Refunds", report.refundedCents],
      ["Outstanding", report.outstandingCents],
      ["Current", report.aging.current],
      ["1-30 days", report.aging.days30],
      ["31-60 days", report.aging.days60],
      ["61+ days", report.aging.days90Plus]
    ];
    const blob = new Blob([rows.map((row) => row.join(",")).join("\n")], {
      type: "text/csv"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "event-core-billing-report.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="space-y-4 p-3 sm:p-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#d8dde5] bg-white p-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-[#6a7483]">
            Financial reporting
          </p>
          <h2 className="text-xl font-black">Billing reports</h2>
        </div>
        <button
          className="h-10 rounded-lg bg-[#1f4d73] px-4 text-sm font-black text-white"
          onClick={exportCsv}
          type="button"
        >
          Export CSV
        </button>
      </header>
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Net revenue", report.revenueCents],
          ["Outstanding", report.outstandingCents],
          ["Refunded", report.refundedCents]
        ].map(([label, value]) => (
          <article
            className="rounded-xl border border-[#d8dde5] bg-white p-4"
            key={String(label)}
          >
            <p className="text-xs font-black uppercase text-[#6a7483]">
              {label}
            </p>
            <p className="mt-2 text-2xl font-black">{money(Number(value))}</p>
          </article>
        ))}
      </section>
      <section className="rounded-xl border border-[#d8dde5] bg-white p-4">
        <h3 className="font-black">Accounts receivable aging</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {[
            ["Current", report.aging.current],
            ["1-30 days", report.aging.days30],
            ["31-60 days", report.aging.days60],
            ["61+ days", report.aging.days90Plus]
          ].map(([label, value]) => (
            <div className="rounded-lg bg-[#f5f6f8] p-3" key={String(label)}>
              <p className="text-xs text-[#6a7483]">{label}</p>
              <strong>{money(Number(value))}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
