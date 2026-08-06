import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server-auth", () => ({
  AuthorizationError: class AuthorizationError extends Error {
    constructor(
      public readonly status: 401 | 403,
      message: string
    ) {
      super(message);
    }
  },
  requirePermission: vi.fn()
}));

const transaction = {
  invoice: { findFirst: vi.fn(), update: vi.fn() },
  invoiceLineItem: { deleteMany: vi.fn() },
  invoiceBalance: { upsert: vi.fn() },
  activityLog: { create: vi.fn() }
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn((operation: (tx: typeof transaction) => unknown) =>
      operation(transaction)
    )
  }
}));

import { PATCH } from "@/app/api/billing/invoices/[invoiceId]/route";
import { requirePermission } from "@/lib/auth/server-auth";

describe("invoice update route", () => {
  const invoiceId = "11111111-1111-4111-8111-111111111111";
  const organizationId = "22222222-2222-4222-8222-222222222222";
  const currentInvoice = {
    id: invoiceId,
    organizationId,
    eventId: "33333333-3333-4333-8333-333333333333",
    clientId: null,
    invoiceNumber: "INV-1001",
    clientName: "Original Client",
    status: "Draft",
    dueDate: null,
    issuedAt: null,
    subtotalCents: 10000,
    discountCents: 500,
    taxCents: 1000,
    totalCents: 10500,
    amountPaidCents: 2000,
    balanceDueCents: 8500,
    lineItems: []
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePermission).mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444",
      organizationId,
      name: "Billing Admin"
    } as never);
    transaction.invoice.findFirst.mockResolvedValue(currentInvoice);
    transaction.invoice.update.mockImplementation(async ({ data }) => ({
      ...currentInvoice,
      ...data,
      lineItems: data.lineItems.create
    }));
    transaction.invoiceLineItem.deleteMany.mockResolvedValue({ count: 1 });
    transaction.invoiceBalance.upsert.mockResolvedValue({ id: "balance" });
    transaction.activityLog.create.mockResolvedValue({ id: "activity" });
  });

  it("scopes the update and recalculates totals and balance", async () => {
    const request = new Request(
      `http://localhost/api/billing/invoices/${invoiceId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: "Updated Client",
          status: "Open",
          dueDate: "2026-09-01",
          notes: "Updated",
          lineItems: [
            { description: "Venue", quantity: 2, unitAmountCents: 6000 }
          ]
        })
      }
    );

    const response = await PATCH(request, {
      params: Promise.resolve({ invoiceId })
    });

    expect(response.status).toBe(200);
    expect(transaction.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: invoiceId, organizationId } })
    );
    expect(transaction.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: invoiceId, organizationId },
        data: expect.objectContaining({
          subtotalCents: 12000,
          totalCents: 12500,
          balanceDueCents: 10500
        })
      })
    );
  });

  it("rejects a total below the amount already paid", async () => {
    const request = new Request(
      `http://localhost/api/billing/invoices/${invoiceId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: "Updated Client",
          status: "Open",
          dueDate: null,
          notes: null,
          lineItems: [
            {
              description: "Small adjustment",
              quantity: 1,
              unitAmountCents: 100
            }
          ]
        })
      }
    );

    const response = await PATCH(request, {
      params: Promise.resolve({ invoiceId })
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(
      expect.objectContaining({ code: "TOTAL_BELOW_PAID" })
    );
    expect(transaction.invoice.update).not.toHaveBeenCalled();
  });
});
