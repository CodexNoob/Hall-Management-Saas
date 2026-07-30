"use client";

import { useState } from "react";
import { LineIcon, Pill } from "@/features/billing/components/billing-shared";

export function TransactionsTab({
  openModal,
  searchQuery,
  setSearchQuery
}: {
  openModal: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}) {
  const [expandedTransaction, setExpandedTransaction] = useState<
    "zelle" | "payroll" | null
  >(null);

  return (
    <div className="min-w-0 p-2 sm:p-4">
      <section className="min-w-0 overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
        <div className="border-b border-[#d8dde5] p-4">
          <h2 className="font-black">Transactions</h2>
          <p className="text-sm text-[#6a7483]">
            Bank feed and imported entries.
          </p>
        </div>
        <div className="space-y-3 p-4">
          <label className="block text-xs font-black uppercase tracking-[0.08em] text-[#6a7483]">
            Search
          </label>
          <input
            className="h-10 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm"
            name="transactionSearch"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Merchant, memo, client, amount"
            type="search"
            value={searchQuery}
          />
          <div className="grid min-w-0 gap-2 sm:grid-cols-2">
            <select
              className="h-10 min-w-0 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm"
              aria-label="Transaction status filter"
              name="transactionStatusFilter"
              title="Transaction status filter"
            >
              <option>Needs review</option>
            </select>
            <select
              className="h-10 min-w-0 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm"
              aria-label="Transaction category filter"
              name="transactionCategoryFilter"
              title="Transaction category filter"
            >
              <option>All categories</option>
            </select>
          </div>
          <div className="divide-y divide-[#d8dde5] overflow-hidden rounded-lg border border-[#d8dde5] xl:hidden">
            <div>
              <button
                aria-expanded={expandedTransaction === "zelle"}
                className="grid min-h-12 w-full grid-cols-[minmax(0,1fr)_auto_2rem] items-center gap-2 px-3 text-left hover:bg-[#eef4fa]"
                onClick={() =>
                  setExpandedTransaction((current) =>
                    current === "zelle" ? null : "zelle"
                  )
                }
                type="button"
              >
                <span className="truncate text-sm font-black">
                  Zelle Yidel Graus
                </span>
                <span className="whitespace-nowrap text-sm font-black text-[#146c43]">
                  $3,900
                </span>
                <LineIcon
                  className={`h-4 w-4 justify-self-end transition-transform ${
                    expandedTransaction === "zelle" ? "rotate-90" : ""
                  }`}
                  name="chevron"
                />
              </button>
              {expandedTransaction === "zelle" ? (
                <div className="border-t border-[#d8dde5] bg-[#fbfcfd] px-3 py-3">
                  <p className="text-xs leading-5 text-[#6a7483]">
                    Jun 29 - Zelle payment from YIDEL GRAUS XXXXXXX5312
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Pill tone="gold">Unassigned</Pill>
                    <Pill>Uncategorized</Pill>
                    <Pill tone="gray">1 splits</Pill>
                  </div>
                  <button
                    className="mt-3 h-9 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white hover:bg-[#15344f]"
                    onClick={openModal}
                    type="button"
                  >
                    Review transaction
                  </button>
                </div>
              ) : null}
            </div>

            <div>
              <button
                aria-expanded={expandedTransaction === "payroll"}
                className="grid min-h-12 w-full grid-cols-[minmax(0,1fr)_auto_2rem] items-center gap-2 px-3 text-left hover:bg-[#eef4fa]"
                onClick={() =>
                  setExpandedTransaction((current) =>
                    current === "payroll" ? null : "payroll"
                  )
                }
                type="button"
              >
                <span className="truncate text-sm font-black">Payroll</span>
                <span className="whitespace-nowrap text-sm font-black text-[#a62b24]">
                  -$5,200
                </span>
                <LineIcon
                  className={`h-4 w-4 justify-self-end transition-transform ${
                    expandedTransaction === "payroll" ? "rotate-90" : ""
                  }`}
                  name="chevron"
                />
              </button>
              {expandedTransaction === "payroll" ? (
                <div className="border-t border-[#d8dde5] bg-[#fbfcfd] px-3 py-3">
                  <p className="text-xs leading-5 text-[#6a7483]">
                    Jun 27 - Waiter payroll weekend events
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Pill tone="gold">Unassigned</Pill>
                    <Pill>Staff Payroll</Pill>
                    <Pill tone="gray">1 splits</Pill>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <button
            className="hidden w-full rounded-lg border border-[#1f4d73] bg-[#eef4fa] p-3 text-left xl:block"
            type="button"
            onClick={openModal}
          >
            <div className="flex min-w-0 flex-wrap justify-between gap-x-3 font-black">
              <span className="min-w-0 wrap-break-word">Zelle Yidel Graus</span>
              <span className="shrink-0 text-[#146c43]">$3,900</span>
            </div>
            <p className="text-xs text-[#6a7483]">
              Jun 29 - Zelle payment from YIDEL GRAUS XXXXXXX5312
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Pill tone="gold">Unassigned</Pill>
              <Pill>Uncategorized</Pill>
              <Pill tone="gray">1 splits</Pill>
            </div>
          </button>
          <article className="hidden rounded-lg border border-[#d8dde5] p-3 xl:block">
            <div className="flex flex-wrap justify-between gap-x-3 font-black">
              <span>Payroll</span>
              <span className="text-[#a62b24]">-$5,200</span>
            </div>
            <p className="text-xs text-[#6a7483]">
              Jun 27 - Waiter payroll weekend events
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Pill tone="gold">Unassigned</Pill>
              <Pill>Staff Payroll</Pill>
              <Pill tone="gray">1 splits</Pill>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
