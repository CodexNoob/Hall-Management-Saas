import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/features/bookings/services/booking.service", () => ({
  BookingError: class BookingError extends Error {}
}));
vi.mock("@/lib/authz/authorize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authz/authorize")>()),
  authorize: vi.fn(),
  assertPermission: vi.fn()
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
import { AuthorizationError } from "@/lib/auth/errors";
import { assertPermission, authorize } from "@/lib/authz/authorize";
import { authzContext } from "./authz-test-helpers";

describe("invoice status route", () => {
  const invoiceId = "11111111-1111-4111-8111-111111111111";
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authorize).mockResolvedValue(
      authzContext({ organizationId: "org" })
    );
    vi.mocked(assertPermission).mockResolvedValue(undefined);
    vi.mocked(transitionInvoiceStatus).mockResolvedValue({
      id: invoiceId,
      status: "Sent"
    } as never);
  });

  it("requires the invoice permission and delegates a valid transition", async () => {
    const request = new Request(
      `http://localhost/api/billing/invoices/${invoiceId}/status`,
      { method: "PATCH", body: JSON.stringify({ status: "Sent" }) }
    );
    const response = await PATCH(request, {
      params: Promise.resolve({ invoiceId })
    });
    expect(response.status).toBe(200);
    expect(authorize).toHaveBeenCalledWith(request, "invoice.update");
    expect(transitionInvoiceStatus).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org" }),
      invoiceId,
      "Sent",
      undefined
    );
  });
});

describe("voiding an invoice", () => {
  const invoiceId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authorize).mockResolvedValue(
      authzContext({ organizationId: "org" })
    );
    vi.mocked(assertPermission).mockResolvedValue(undefined);
    vi.mocked(transitionInvoiceStatus).mockResolvedValue({
      id: invoiceId,
      status: "Cancelled"
    } as never);
  });

  function patch(status: string) {
    const request = new Request(
      `http://localhost/api/billing/invoices/${invoiceId}/status`,
      { method: "PATCH", body: JSON.stringify({ status }) }
    );

    return PATCH(request, { params: Promise.resolve({ invoiceId }) });
  }

  it("asks for the void permission before cancelling", async () => {
    // Cancelling stamps `voidedAt`, so it reverses a billed amount. Letting it
    // through on `invoice.update` alone would put a dangerous money action
    // behind an ordinary bookkeeping key.
    await patch("Cancelled");

    expect(assertPermission).toHaveBeenCalledWith(
      expect.anything(),
      "invoice.void"
    );
  });

  it("refuses the void without it, and writes nothing", async () => {
    vi.mocked(assertPermission).mockRejectedValue(
      new AuthorizationError(403, "You do not have permission.")
    );

    const response = await patch("Cancelled");

    expect(response.status).toBe(403);
    expect(transitionInvoiceStatus).not.toHaveBeenCalled();
  });

  it("leaves every other transition on the ordinary key", async () => {
    await patch("Sent");

    expect(assertPermission).not.toHaveBeenCalled();
  });
});
