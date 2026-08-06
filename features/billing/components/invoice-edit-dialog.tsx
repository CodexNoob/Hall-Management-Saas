"use client";

import React, { useEffect, useState } from "react";
import type { BillingResponse } from "@/features/billing/components/billing-shared";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
type Invoice = BillingResponse["invoices"][number];
function money(cents: number, currency = "USD") { return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100); }

type EditableLineItem = {
  description: string;
  quantity: string;
  unitAmount: string;
};

function modalControlClass() {
  return "mt-1 h-10 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm outline-none focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15";
}

export function InvoiceEditDialog({
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
  const [clientName, setClientName] = useState(invoice.clientName);
  const [status, setStatus] = useState<"Draft" | "Sent">(
    invoice.status === "Sent" ? "Sent" : "Draft"
  );
  const [dueDate, setDueDate] = useState(invoice.dueDate?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(invoice.notes ?? "");
  const [items, setItems] = useState<EditableLineItem[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setClientName(invoice.clientName);
    setStatus(invoice.status === "Sent" ? "Sent" : "Draft");
    setDueDate(invoice.dueDate?.slice(0, 10) ?? "");
    setNotes(invoice.notes ?? "");
    setItems(
      invoice.lineItems.map((item) => ({
        description: item.description,
        quantity: String(item.quantity),
        unitAmount: String(item.unitAmountCents / 100)
      }))
    );
    setError("");
  }, [invoice, open]);

  if (!open) return null;
  const computedTotal = items.reduce(
    (sum, item) =>
      sum + (Number(item.quantity) || 0) * (Number(item.unitAmount) || 0),
    0
  );

  async function save() {
    setError("");
    const lineItems = items.map((item) => ({
      description: item.description.trim(),
      quantity: Number(item.quantity),
      unitAmountCents: Math.round(Number(item.unitAmount) * 100)
    }));
    if (
      !clientName.trim() ||
      !lineItems.length ||
      lineItems.some(
        (item) =>
          !item.description ||
          !Number.isFinite(item.quantity) ||
          item.quantity <= 0 ||
          !Number.isInteger(item.unitAmountCents) ||
          item.unitAmountCents < 0
      )
    ) {
      setError(
        "Complete every line item with a valid description, quantity, and amount."
      );
      return;
    }
    setSaving(true);
    try {
      const response = await authenticatedFetch(
        `/api/billing/invoices/${invoice.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientName,
            status,
            dueDate: dueDate || null,
            notes: notes || null,
            lineItems
          })
        }
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok)
        throw new Error(payload?.error ?? "Unable to update invoice.");
      await onSaved();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to update invoice."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-[#17202a]/40 p-3"
      role="presentation"
    >
      <section
        aria-modal="true"
        className="max-h-[calc(100dvh-24px)] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl"
        role="dialog"
      >
        <header className="flex items-center justify-between border-b border-[#d8dde5] p-4">
          <div>
            <h2 className="font-black">Edit {invoice.invoiceNumber}</h2>
            <p className="text-sm text-[#6a7483]">
              Update invoice details and line items.
            </p>
          </div>
          <button
            aria-label="Close invoice editor"
            className="h-10 w-10 rounded-full text-2xl hover:bg-[#eef4fa]"
            disabled={saving}
            onClick={onClose}
            type="button"
          >
            Ãƒâ€”
          </button>
        </header>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <label className="text-xs font-black uppercase text-[#64748b]">
            Client
            <input
              className={modalControlClass()}
              onChange={(event) => setClientName(event.target.value)}
              value={clientName}
            />
          </label>
          <label className="text-xs font-black uppercase text-[#64748b]">
            Status
            <select
              className={modalControlClass()}
              onChange={(event) =>
                setStatus(event.target.value as "Draft" | "Sent")
              }
              value={status}
            >
              <option>Draft</option>
              <option>Sent</option>
            </select>
          </label>
          <label className="text-xs font-black uppercase text-[#64748b]">
            Due date
            <input
              className={modalControlClass()}
              onChange={(event) => setDueDate(event.target.value)}
              type="date"
              value={dueDate}
            />
          </label>
          <label className="text-xs font-black uppercase text-[#64748b]">
            Notes
            <input
              className={modalControlClass()}
              onChange={(event) => setNotes(event.target.value)}
              value={notes}
            />
          </label>
        </div>
        <div className="border-t border-[#d8dde5] p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black">Line items</h3>
            <button
              className="rounded-lg border border-[#b9c2cf] px-3 py-2 text-xs font-black"
              onClick={() =>
                setItems((current) => [
                  ...current,
                  { description: "", quantity: "1", unitAmount: "" }
                ])
              }
              type="button"
            >
              Add item
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {items.map((item, index) => (
              <div
                className="grid gap-2 rounded-lg border border-[#d8dde5] p-3 sm:grid-cols-[minmax(0,1fr)_100px_140px_auto]"
                key={index}
              >
                <input
                  aria-label={`Line ${index + 1} description`}
                  className="h-10 rounded-lg border border-[#b9c2cf] px-3 text-sm"
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((value, itemIndex) =>
                        itemIndex === index
                          ? { ...value, description: event.target.value }
                          : value
                      )
                    )
                  }
                  placeholder="Description"
                  value={item.description}
                />
                <input
                  aria-label={`Line ${index + 1} quantity`}
                  className="h-10 rounded-lg border border-[#b9c2cf] px-3 text-sm"
                  min="0.001"
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((value, itemIndex) =>
                        itemIndex === index
                          ? { ...value, quantity: event.target.value }
                          : value
                      )
                    )
                  }
                  step="0.001"
                  type="number"
                  value={item.quantity}
                />
                <input
                  aria-label={`Line ${index + 1} amount`}
                  className="h-10 rounded-lg border border-[#b9c2cf] px-3 text-sm"
                  min="0"
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((value, itemIndex) =>
                        itemIndex === index
                          ? { ...value, unitAmount: event.target.value }
                          : value
                      )
                    )
                  }
                  step="0.01"
                  type="number"
                  value={item.unitAmount}
                />
                <button
                  aria-label={`Remove line ${index + 1}`}
                  className="h-10 rounded-lg px-3 text-sm font-black text-[#a62b24] hover:bg-[#fff1f0]"
                  disabled={items.length === 1}
                  onClick={() =>
                    setItems((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index)
                    )
                  }
                  type="button"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <p className="mt-4 text-right text-lg font-black">
            Line-item subtotal:{" "}
            {money(Math.round(computedTotal * 100), invoice.currency)}
          </p>
          {invoice.discountCents || invoice.taxCents ? (
            <p className="mt-1 text-right text-xs text-[#6a7483]">
              Existing discounts and taxes remain applied.
            </p>
          ) : null}
          {error ? (
            <p
              className="mt-3 rounded-lg bg-[#fff1f0] p-3 text-sm font-semibold text-[#a62b24]"
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
            {saving ? "SavingÃ¢â‚¬Â¦" : "Save invoice"}
          </button>
        </footer>
      </section>
    </div>
  );
}

