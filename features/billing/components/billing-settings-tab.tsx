"use client";

import { LineIcon } from "@/features/billing/components/billing-shared";

export function SettingsTab() {
  const categories = [
    "Uncategorized",
    "Event Deposit",
    "Final Payment",
    "Vendor Cost",
    "Food Purchase",
    "Staff Payroll",
    "Linen Rental",
    "Equipment Rental",
    "Utilities",
    "Repairs",
    "Refund",
    "Office Expense"
  ];

  return (
    <div className="grid gap-4 p-4 xl:grid-cols-[1fr_1fr]">
      <section className="rounded-xl border border-[#d8dde5] bg-white shadow-sm">
        <div className="border-b border-[#d8dde5] p-4">
          <h2 className="font-black">Invoice settings</h2>
          <p className="text-sm text-[#6a7483]">
            Controls invoice PDF and email defaults.
          </p>
        </div>
        <div className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-black uppercase text-[#6a7483]">
              Business Name
              <input
                className="mt-1 h-10 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm"
                defaultValue="Event Core Demo Hall"
                name="businessName"
              />
            </label>
            <label className="text-xs font-black uppercase text-[#6a7483]">
              Payment Terms
              <select
                className="mt-1 h-10 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm"
                aria-label="Payment terms"
                name="paymentTerms"
                title="Payment terms"
              >
                <option>Due before event</option>
              </select>
            </label>
          </div>
          <label className="text-xs font-black uppercase text-[#6a7483]">
            Invoice Footer
            <textarea
              className="mt-1 h-24 w-full rounded-lg border border-[#b9c2cf] p-3 text-sm"
              defaultValue="Thank you. Please submit payment according to the agreed terms."
              name="invoiceFooter"
            />
          </label>
          <button
            className="h-10 w-full rounded-lg bg-[#1f4d73] text-sm font-black text-white"
            type="button"
          >
            Save settings
          </button>
        </div>
      </section>
      <section className="rounded-xl border border-[#d8dde5] bg-white shadow-sm">
        <div className="border-b border-[#d8dde5] p-4">
          <h2 className="font-black">Bank and categories</h2>
          <p className="text-sm text-[#6a7483]">
            Rules for transaction review.
          </p>
        </div>
        <div className="m-4 rounded-lg border border-[#9a5b00] bg-[#fbfcfd] p-3 text-sm text-[#9a5b00]">
          In production, bank transactions would come from a bank connection or
          CSV import. This prototype shows the approval workflow.
        </div>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-[#6a7483]">
            <tr>
              <th className="border-y border-[#d8dde5] p-3">Category</th>
              <th className="border-y border-[#d8dde5] p-3">Type</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category, index) => (
              <tr key={category}>
                <td className="border-b border-[#d8dde5] p-3 font-black">
                  {category}
                </td>
                <td className="border-b border-[#d8dde5] p-3">
                  {index === 1 || index === 2 ? "Income" : "Expense / General"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
