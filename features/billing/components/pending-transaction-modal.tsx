"use client";

import { LineIcon, Pill } from "@/features/billing/components/billing-shared";

export function PendingTransactionModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-[#17202a]/45 p-4">
      <section className="max-h-[92vh] w-full max-w-130 overflow-hidden rounded-3xl border border-white/40 bg-white shadow-2xl">
        <header className="bg-[#146c43] p-5 text-white">
          <div className="flex items-center justify-between">
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/60"
              type="button"
              onClick={onClose}
              aria-label="Close transaction review"
            >
              <LineIcon name="back" />
            </button>
            <h2 className="text-xl font-black">Pending transaction</h2>
            <Pill tone="green">Needs review</Pill>
          </div>
        </header>
        <div className="max-h-[74vh] overflow-y-auto p-5">
          <article className="rounded-xl bg-white p-4 shadow-lg">
            <div className="flex justify-between">
              <h3 className="text-2xl font-black">Zelle Yidel Graus</h3>
              <span className="text-[#6a7483]">6/29/26</span>
            </div>
            <p className="text-sm uppercase text-[#6a7483]">
              BUS COMPLETE CHK (1909) - 1
            </p>
            <p className="text-center text-5xl font-black">$3,900</p>
          </article>
          <div className="mt-5 grid grid-cols-3 overflow-hidden rounded-xl border border-[#b9c2cf] text-sm font-black">
            <button className="h-12 bg-white" type="button">
              Categorize
            </button>
            <button
              className="h-12 border-x border-[#b9c2cf] bg-white"
              type="button"
            >
              Match
            </button>
            <button className="h-12 bg-white" type="button">
              Transfer
            </button>
          </div>
          <p className="mt-5 text-sm text-[#6a7483]">
            Confirm or edit how this transaction should post in Event Core.
          </p>
          <div className="mt-5 divide-y divide-[#d8dde5]">
            {[
              "Category*|Uncategorized",
              "Split transaction|1 split lines",
              "From / To event|Unassigned",
              "Invoice|No invoice",
              "Attachment|Choose File  No file chosen"
            ].map((row) => {
              const [label, value] = row.split("|");
              return (
                <button
                  key={label}
                  className="flex w-full items-center justify-between py-4 text-left"
                  type="button"
                >
                  <span>
                    <span className="block text-sm text-[#6a7483]">
                      {label}
                    </span>
                    <strong>{value}</strong>
                  </span>
                  <LineIcon name="chevron" className="h-5 w-5 text-[#6a7483]" />
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex gap-3">
            <button
              className="rounded-lg border border-[#b9c2cf] px-4 text-sm font-black"
              type="button"
            >
              Split
            </button>
            <button
              className="h-12 flex-1 rounded-lg bg-[#146c43] font-black text-white"
              type="button"
              onClick={onClose}
            >
              Post
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
