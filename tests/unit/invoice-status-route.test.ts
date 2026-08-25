import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/features/bookings/services/booking.service", () => ({
  BookingError: class BookingError extends Error {}
}));
vi.mock("@/lib/authz/authorize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authz/authorize")>()),
  authorize: vi.fn()
}));
vi.mock("@/features/billing/services/invoice-lifecycle.service", () => ({
  invoiceStatuses: [
    "Draft",
    "Sent",
    "Partially Paid",
    "Paid",
    "Overdue",
    "Cancelled"
  ],
  transitionInvoiceStatus: vi.fn()
}));

import { PATCH } from "@/app/api/billing/invoices/[invoiceId]/status/route";
import { transitionInvoiceStatus } from "@/features/billing/services/invoice-lifecycle.service";
import { authorize } from "@/lib/authz/authorize";

describe("invoice status route", () => {
  const invoiceId = "11111111-1111-4111-8111-111111111111";
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authorize).mockResolvedValue({
      id: "user",
      organizationId: "org"
    } as never);
    vi.mocked(transitionInvoiceStatus).mockResolvedValue({
      id: invoiceId,
      status: "Sent"
    } as never);
  });

  it("requires payment-management permission and delegates a valid transition", async () => {
    const request = new Request(
      `http://localhost/api/billing/invoices/${invoiceId}/status`,
      { method: "PATCH", body: JSON.stringify({ status: "Sent" }) }
    );
    const response = await PATCH(request, {
      params: Promise.resolve({ invoiceId })
    });
    expect(response.status).toBe(200);
    expect(authorize).toHaveBeenCalledWith(
      request,
      "canManagePayments"
    );
    expect(transitionInvoiceStatus).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org" }),
      invoiceId,
      "Sent",
      undefined
    );
  });
});
