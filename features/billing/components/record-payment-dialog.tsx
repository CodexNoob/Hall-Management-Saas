"use client";

import React, { useEffect, useState } from "react";
import type { BillingResponse } from "@/features/billing/components/billing-shared";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import { readApiError } from "@/lib/http/api-request-error";
import { moneySchema, parseNumericInput } from "@/lib/validation/number";
type Invoice = BillingResponse["invoices"][number];
function money(cents: number, currency = "USD") { return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100); }
function modalControlClass() { return "mt-1 h-10 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm text-[#17202a] outline-none focus:border-[#1f4d73]"; }

export function RecordPaymentDialog({
  invoice,
  onClose,
  onSaved,
  open
}: {
  invoice: Invoice;
  onClose: () => void;
  onSaved: () => Promise<void>;
  open: boolean;
}) {
  const [amount, setAmount] = useState(String(invoice.balanceDueCents / 100));
  const [method, setMethod] = useState("Manual");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount(String(invoice.balanceDueCents / 100));
    setMethod("Manual");
    setReference("");
    setNote("");
    setError("");
  }, [invoice, open]);
  if (!open || !invoice.eventId) return null;

  async function save() {
    const parsed = parseNumericInput(amount, moneySchema({ label: "Amount" }));

    if (parsed.status !== "valid") {
      setError(
        parsed.status === "invalid"
          ? parsed.message
          : "Enter a payment amount."
      );
      return;
    }

    const amountCents = Math.round(parsed.value * 100);

    if (amountCents <= 0 || amountCents > invoice.balanceDueCents) {
      setError(
        `Enter an amount between ${money(1, invoice.currency)} and ${money(invoice.balanceDueCents, invoice.currency)}.`
      );
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await authenticatedFetch(
        `/api/events/${invoice.eventId}/payments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            invoiceId: invoice.id,
            amountCents,
            result: "paid",
            currency: invoice.currency,
            provider: method,
            providerReference: reference.trim() || undefined,
            note: note.trim() || undefined
          })
        }
      );
      if (!response.ok) throw await readApiError(response);
      await onSaved();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to record payment."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-[#17202a]/40 p-3">
      <section
        aria-modal="true"
        className="w-full max-w-lg rounded-xl bg-white shadow-2xl"
        role="dialog"
      >
        <header className="flex items-center justify-between border-b border-[#d8dde5] p-4">
          <div>
            <h2 className="font-black">Record payment</h2>
            <p className="text-sm text-[#6a7483]">
              {invoice.invoiceNumber} {"\u00b7"} Balance{" "}
              {money(invoice.balanceDueCents, invoice.currency)}
            </p>
          </div>
          <button
            aria-label="Close payment dialog"
            className="h-10 w-10 rounded-full text-2xl hover:bg-[#eef4fa]"
            disabled={saving}
            onClick={onClose}
            type="button"
          >
            &times;
          </button>
        </header>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <label className="text-xs font-black uppercase text-[#64748b]">
            Amount
            <input
              autoFocus
              className={modalControlClass()}
              inputMode="decimal"
              onChange={(event) => setAmount(event.target.value)}
              type="text"
              value={amount}
            />
          </label>
          <label className="text-xs font-black uppercase text-[#64748b]">
            Payment method
            <select
              className={modalControlClass()}
              onChange={(event) => setMethod(event.target.value)}
              value={method}
            >
              <option>Manual</option>
              <option>Cash</option>
              <option>Check</option>
              <option>Card</option>
              <option>Bank Transfer</option>
              <option>ACH</option>
            </select>
          </label>
          <label className="text-xs font-black uppercase text-[#64748b] sm:col-span-2">
            Reference number
            <input
              className={modalControlClass()}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Optional"
              value={reference}
            />
          </label>
          <label className="text-xs font-black uppercase text-[#64748b] sm:col-span-2">
            Note
            <textarea
              className="mt-1 min-h-24 w-full rounded-lg border border-[#b9c2cf] p-3 text-sm"
              onChange={(event) => setNote(event.target.value)}
              value={note}
            />
          </label>
          {error ? (
            <p
              className="rounded-lg bg-[#fff1f0] p-3 text-sm font-semibold text-[#a62b24] sm:col-span-2"
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </div>
        <footer className="flex justify-end gap-2 border-t border-[#d8dde5] bg-[#fbfcfd] p-4">
          <button
            className="h-10 rounded-lg border border-[#b9c2cf] px-4 text-sm font-black"
            disabled={saving}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="h-10 rounded-lg bg-[#1f4d73] px-4 text-sm font-black text-white disabled:opacity-60"
            disabled={saving}
            onClick={save}
            type="button"
          >
            {saving ? "Recording\u2026" : "Record payment"}
          </button>
        </footer>
      </section>
    </div>
  );
}


