import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server-auth", () => ({
  requirePermission: vi.fn()
}));
vi.mock("@/features/bookings/services/booking.service", () => ({
  BookingError: class BookingError extends Error {
    constructor(
      message: string,
      public readonly status: 400 | 404 | 409 = 400,
      public readonly code = "BOOKING_INVALID"
    ) {
      super(message);
    }
  },
  createBooking: vi.fn(),
  expireOrganizationHolds: vi.fn(),
  transitionBooking: vi.fn()
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findMany: vi.fn() },
    hall: { findMany: vi.fn() },
    eventType: { findMany: vi.fn() },
    eventPackage: { findMany: vi.fn() }
  }
}));

import { POST } from "@/app/api/events/route";
import { PATCH } from "@/app/api/events/[eventId]/status/route";
import { requirePermission } from "@/lib/auth/server-auth";
import {
  BookingError,
  createBooking,
  transitionBooking
} from "@/features/bookings/services/booking.service";

const actor = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Event Admin",
  organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  membership: { role: "admin" },
  access: { allowedHallIds: [] }
};
const eventId = "44444444-4444-4444-8444-444444444444";

describe("event creation and status editing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePermission).mockResolvedValue(actor as never);
  });

  it("creates an event using only the verified actor organization", async () => {
    vi.mocked(createBooking).mockResolvedValue({
      event: { id: eventId },
      replayed: false
    } as never);
    const request = new Request("http://localhost/api/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "77777777-7777-4777-8777-777777777777"
      },
      body: JSON.stringify({
        clientName: "Cohen",
        phone: "555-0100",
        eventDate: "2026-08-20",
        hallId: "33333333-3333-4333-8333-333333333333",
        bookingStatus: "TENTATIVE_HOLD",
        organizationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
      })
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(createBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        clientName: "Cohen",
        idempotencyKey: "77777777-7777-4777-8777-777777777777"
      }),
      expect.objectContaining({
        organizationId: actor.organizationId,
        id: actor.id
      })
    );
    expect(createBooking).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        organizationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
      })
    );
  });

  it("returns a conflict response for overlapping bookings", async () => {
    vi.mocked(createBooking).mockRejectedValue(
      new BookingError(
        "That hall is already reserved for this time.",
        409,
        "BOOKING_CONFLICT"
      )
    );
    const request = new Request("http://localhost/api/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "77777777-7777-4777-8777-777777777777"
      },
      body: JSON.stringify({
        clientName: "Cohen",
        phone: "555-0100",
        eventDate: "2026-08-20",
        hallId: "33333333-3333-4333-8333-333333333333",
        bookingStatus: "TENTATIVE_HOLD"
      })
    });

    const response = await POST(request);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "BOOKING_CONFLICT"
    });
  });

  it("edits booking status with optimistic concurrency", async () => {
    vi.mocked(transitionBooking).mockResolvedValue({
      id: eventId,
      bookingStatus: "CONFIRMED",
      version: 4
    } as never);
    const request = new Request(
      `http://localhost/api/events/${eventId}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "CONFIRMED",
          expectedVersion: 3
        })
      }
    );

    const response = await PATCH(request, {
      params: Promise.resolve({ eventId })
    });

    expect(response.status).toBe(200);
    expect(transitionBooking).toHaveBeenCalledWith(
      eventId,
      "CONFIRMED",
      3,
      1440,
      expect.objectContaining({ organizationId: actor.organizationId })
    );
  });
});
