"use client";

import { useState } from "react";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";

export function SettingsTab() {
  const [businessName, setBusinessName] = useState("Event Core Hall");
  const [paymentTerms, setPaymentTerms] = useState("Due before event");
  const [invoiceFooter, setInvoiceFooter] = useState(
    "Thank you. Please submit payment according to the agreed terms."
  );
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveSettings() {
    setSaving(true);
    setMessage("");
    try {
      const response = await authenticatedFetch("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({
          billing: { businessName, paymentTerms, invoiceFooter }
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload.error ?? "Unable to save billing settings.");
      setMessage("Billing settings saved.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save billing settings."
      );
    } finally {
      setSaving(false);
    }
  }
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
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                name="businessName"
              />
            </label>
            <label className="text-xs font-black uppercase text-[#6a7483]">
              Payment Terms
              <select
                className="mt-1 h-10 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm"
                aria-label="Payment terms"
                name="paymentTerms"
                value={paymentTerms}
                onChange={(event) => setPaymentTerms(event.target.value)}
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
              value={invoiceFooter}
              onChange={(event) => setInvoiceFooter(event.target.value)}
              name="invoiceFooter"
            />
          </label>
          <button
            className="h-10 w-full rounded-lg bg-[#1f4d73] text-sm font-black text-white"
            type="button"
            disabled={saving}
            onClick={() => void saveSettings()}
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
          {message ? (
            <p className="text-sm font-bold text-[#1f4d73]">{message}</p>
          ) : null}
        </div>
      </section>
      <section className="rounded-xl border border-[#d8dde5] bg-white shadow-sm">
        <div className="border-b border-[#d8dde5] p-4">
          <h2 className="font-black">Bank and categories</h2>
          <p className="text-sm text-[#6a7483]">
            Company-level bank connections and transaction review rules.
          </p>
        </div>
        <div className="m-4 rounded-lg border border-[#1f4d73] bg-[#fbfcfd] p-3 text-sm text-[#1f4d73]">
          <p className="font-black">Plaid connection flow</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              The authorized person from each organization or company (owner,
              admin, or billing manager) can connect that company’s bank
              account.
            </li>
            <li>
              Plaid securely handles the bank sign-in and approval process, and
              Event Core never stores the bank username or password.
            </li>
            <li>
              After approval, transactions appear only in that organization’s
              Billing module and remain separated from other companies.
            </li>
          </ul>
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
