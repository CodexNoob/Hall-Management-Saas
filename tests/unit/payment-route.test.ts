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
vi.mock("@/lib/billing/record-payment", () => ({
  recordPaymentWithAudit: vi.fn()
}));
vi.mock("@/lib/bookings/booking-service", () => ({
  BookingError: class BookingError extends Error {
    constructor(
      message: string,
      public readonly status: 400 | 404 | 409 = 400,
      public readonly code = "BOOKING_INVALID"
    ) {
      super(message);
    }
  }
}));

import { POST } from "@/app/api/events/[eventId]/payments/route";
import { requirePermission } from "@/lib/auth/server-auth";
import { recordPaymentWithAudit } from "@/lib/billing/record-payment";

describe("payment confirmation", () => {
  const eventId = "44444444-4444-4444-8444-444444444444";
  const actor = {
    id: "22222222-2222-4222-8222-222222222222",
    organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    name: "Authorized Admin"
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePermission).mockResolvedValue(actor as never);
    vi.mocked(recordPaymentWithAudit).mockResolvedValue({
      transaction: { id: "66666666-6666-4666-8666-666666666666" }
    } as never);
  });

  it("uses the authenticated actor and ignores a forged confirmer ID", async () => {
    const request = new Request(
      `http://localhost/api/events/${eventId}/payments`,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer valid-token",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amountCents: 25000,
          result: "paid",
          confirmedByUserId: "99999999-9999-4999-8999-999999999999"
        })
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ eventId })
    });

    expect(response.status).toBe(201);
    expect(requirePermission).toHaveBeenCalledWith(
      request,
      "canManagePayments"
    );
    expect(recordPaymentWithAudit).toHaveBeenCalledWith(actor, {
      eventId,
      amountCents: 25000,
      result: "paid"
    });
  });

  it("rejects non-positive payment amounts before recording", async () => {
    const request = new Request(
      `http://localhost/api/events/${eventId}/payments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: 0, result: "paid" })
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ eventId })
    });

    expect(response.status).toBe(400);
    expect(recordPaymentWithAudit).not.toHaveBeenCalled();
  });
});
