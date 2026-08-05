import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InvoicesTab } from "@/features/billing/components/invoices-tab";
import { buildRows } from "@/features/billing/components/transactions-tab";
import type { BillingResponse } from "@/features/billing/components/billing-shared";

const emptyBilling: BillingResponse = {
  transactions: [],
  invoices: [],
  events: [],
  summary: { paidCents: 0, openInvoiceCents: 0, openInvoices: 0 }
};

describe("billing UI data", () => {
  it("does not manufacture sample transactions for an empty tenant", () => {
    expect(buildRows(emptyBilling)).toEqual([]);
  });

  it("shows an invoice empty state instead of sample invoices", () => {
    render(
      <InvoicesTab
        data={emptyBilling}
        onNewInvoice={vi.fn()}
        searchQuery=""
        setSearchQuery={vi.fn()}
      />
    );

    expect(screen.getByText("No invoices yet")).toBeInTheDocument();
    expect(
      screen.queryByText(/Friedman|Klein|Weiss|Green/)
    ).not.toBeInTheDocument();
  });
});
