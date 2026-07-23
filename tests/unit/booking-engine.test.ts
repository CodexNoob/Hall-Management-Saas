import { describe, expect, it } from "vitest";
import {
  createBookingSchema,
  transitionBookingSchema
} from "@/features/bookings/validations/booking.schema";

const baseBooking = {
  clientName: "Miriam Cohen",
  phone: "+1 555 0100",
  hallId: "11111111-1111-4111-8111-111111111111",
  startsAt: "2026-08-20T18:00:00-04:00",
  endsAt: "2026-08-20T23:00:00-04:00",
  setupStartsAt: "2026-08-20T16:00:00-04:00",
  cleanupEndsAt: "2026-08-21T00:00:00-04:00",
  bookingStatus: "TENTATIVE_HOLD" as const,
  idempotencyKey: "22222222-2222-4222-8222-222222222222"
};

describe("booking engine request contracts", () => {
  it("accepts a complete setup-to-cleanup occupancy window", () => {
    const result = createBookingSchema.safeParse(baseBooking);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.holdDurationMinutes).toBe(1440);
      expect(result.data.setupMinutes).toBe(120);
      expect(result.data.cleanupMinutes).toBe(60);
    }
  });

  it("rejects incomplete start/end input", () => {
    const result = createBookingSchema.safeParse({
      ...baseBooking,
      endsAt: undefined
    });
    expect(result.success).toBe(false);
  });

  it("requires optimistic concurrency versions for status changes", () => {
    expect(
      transitionBookingSchema.safeParse({ status: "CONFIRMED" }).success
    ).toBe(false);
    expect(
      transitionBookingSchema.safeParse({
        status: "CONFIRMED",
        expectedVersion: 3
      }).success
    ).toBe(true);
  });

  it("limits tentative holds to seven days", () => {
    const result = createBookingSchema.safeParse({
      ...baseBooking,
      holdDurationMinutes: 10081
    });
    expect(result.success).toBe(false);
  });
});
