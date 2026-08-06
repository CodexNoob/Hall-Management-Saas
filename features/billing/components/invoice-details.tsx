"use client";

import React, { useState } from "react";
import { StatCard, TopAction, type BillingResponse } from "@/features/billing/components/billing-shared";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import { InvoiceEditDialog } from "@/features/billing/components/invoice-edit-dialog";
import { RecordPaymentDialog } from "@/features/billing/components/record-payment-dialog";

type Invoice = BillingResponse["invoices"][number];
function money(cents: number, currency = "USD") { return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100); }
function date(value: string | null) { return value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value)) : "Not set"; }
export function InvoiceDetails({
  canManagePayments,
  history,
  invoice,
  onRefresh
}: {
  canManagePayments: boolean;
  history: NonNullable<BillingResponse["invoiceHistory"]>;
  invoice: Invoice;
  onRefresh: () => Promise<BillingResponse | null>;
}) {
  const [dialog, setDialog] = useState<"edit" | "payment" | null>(null);
  const [actionError, setActionError] = useState("");
  const [isActing, setIsActing] = useState(false);

  async function changeStatus(status: "Sent" | "Cancelled") {
    setIsActing(true);
    setActionError("");
    try {
      const response = await authenticatedFetch(
        `/api/billing/invoices/${invoice.id}/status`,
        { method: "PATCH", body: JSON.stringify({ status }) }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload.error ?? "Unable to update invoice.");
      await onRefresh();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to update invoice."
      );
    } finally {
      setIsActing(false);
    }
  }

  async function openStripeCheckout() {
    setIsActing(true);
    setActionError("");
    try {
      const response = await authenticatedFetch(
        "/api/billing/stripe/checkout",
        {
          method: "POST",
          body: JSON.stringify({ invoiceId: invoice.id })
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload.error ?? "Unable to start Stripe Checkout.");
      if (!payload.checkoutUrl)
        throw new Error("Stripe did not return a checkout URL.");
      window.location.assign(payload.checkoutUrl);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to start Stripe Checkout."
      );
      setIsActing(false);
    }
  }
  return (
    <>
      <section className="min-w-0 overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#d8dde5] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-black">
              {invoice.invoiceNumber}
            </h2>
            <p className="text-sm text-[#6a7483]">
              {invoice.clientName}
              {invoice.event?.hallName ? ` Ã‚Â· ${invoice.event.hallName}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {invoice.status === "Draft" ? (
              <TopAction
                disabled={!canManagePayments || isActing}
                icon="upload"
                label="Send invoice"
                onClick={() => void changeStatus("Sent")}
              />
            ) : null}
            <TopAction
              disabled={
                !canManagePayments ||
                invoice.status === "Paid" ||
                invoice.status === "Cancelled"
              }
              icon="edit"
              label="Edit"
              onClick={() => setDialog("edit")}
            />
            <TopAction
              disabled={
                !canManagePayments ||
                isActing ||
                !invoice.eventId ||
                invoice.balanceDueCents <= 0 ||
                ["Draft", "Paid", "Cancelled"].includes(invoice.status)
              }
              icon="payment"
              label="Pay with Stripe"
              onClick={() => void openStripeCheckout()}
            />
            <TopAction
              disabled={
                !canManagePayments ||
                isActing ||
                ["Paid", "Cancelled"].includes(invoice.status)
              }
              icon="back"
              label="Cancel invoice"
              onClick={() => void changeStatus("Cancelled")}
            />
            <TopAction
              disabled={
                !canManagePayments ||
                !invoice.eventId ||
                invoice.balanceDueCents <= 0 ||
                invoice.status === "Cancelled"
              }
              icon="payment"
              label="Record payment"
              onClick={() => setDialog("payment")}
            />
            <TopAction
              icon="print"
              label="Print"
              onClick={() => window.print()}
            />
          </div>
        </div>
        {actionError ? (
          <p className="mx-4 mt-3 rounded-lg bg-[#fff0ee] p-3 text-sm font-bold text-[#b42318]">
            {actionError}
          </p>
        ) : null}
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
                        Quantity {String(item.quantity)} Ã‚Â·{" "}
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
          <article className="rounded-xl border border-[#d8dde5] p-4 xl:col-span-2">
            <h3 className="font-black">Status history</h3>
            <div className="mt-3 divide-y divide-[#edf0f4]">
              {history.length ? (
                history.map((entry) => (
                  <div
                    className="flex flex-wrap justify-between gap-2 py-3 text-sm"
                    key={entry.id}
                  >
                    <div>
                      <p className="font-bold">{entry.message}</p>
                      <p className="text-xs text-[#6a7483]">
                        {entry.userName ?? "System"}
                      </p>
                    </div>
                    <time className="text-xs text-[#6a7483]">
                      {date(entry.createdAt)}
                    </time>
                  </div>
                ))
              ) : (
                <p className="py-3 text-sm text-[#6a7483]">
                  No lifecycle changes recorded yet.
                </p>
              )}
            </div>
          </article>
        </div>
      </section>
      <InvoiceEditDialog
        invoice={invoice}
        onClose={() => setDialog(null)}
        onSaved={async () => {
          setDialog(null);
          await onRefresh();
        }}
        open={dialog === "edit"}
      />
      <RecordPaymentDialog
        invoice={invoice}
        onClose={() => setDialog(null)}
        onSaved={async () => {
          setDialog(null);
          await onRefresh();
        }}
        open={dialog === "payment"}
      />
    </>
  );
}
