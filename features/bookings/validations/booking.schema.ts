import { z } from "zod";
import { countSchema } from "@/lib/validation/number";
import { phoneSchema } from "@/lib/validation/phone";

export const bookingStatuses = [
  "INQUIRY",
  "TENTATIVE_HOLD",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED"
] as const;

export type BookingStatus = (typeof bookingStatuses)[number];

export const createBookingSchema = z
  .object({
    clientId: z.string().uuid().optional(),
    clientName: z.string().trim().min(1).max(160),
    // Optional rather than required, which it was before. The event manager's
    // quick-create form does not ask for a phone and used to satisfy `min(1)`
    // by sending the literal string "Not provided" - a sentinel that real
    // validation would reject outright. Absent is now expressible.
    phone: phoneSchema({ label: "Phone number" }),
    email: z.string().trim().email().optional(),
    // The membership running the event. Absent is Unassigned, which is what a
    // booking taken at the calendar usually is until somebody picks it up.
    coordinatorMembershipId: z.string().uuid().optional(),
    eventDate: z.string().date().optional(),
    startsAt: z.string().datetime({ offset: true }).optional(),
    endsAt: z.string().datetime({ offset: true }).optional(),
    setupStartsAt: z.string().datetime({ offset: true }).optional(),
    cleanupEndsAt: z.string().datetime({ offset: true }).optional(),
    startTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    endTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    setupMinutes: countSchema({ max: 1440, label: "Setup minutes" }).default(120),
    cleanupMinutes: countSchema({ max: 1440, label: "Cleanup minutes" }).default(60),
    holdDurationMinutes: countSchema({
      min: 5,
      max: 10080,
      label: "Hold duration"
    }).default(1440),
    hallId: z.string().uuid(),
    eventTypeId: z.string().uuid().optional(),
    bookingStatus: z.enum(bookingStatuses).optional(),
    eventStatus: z.enum(["Inquiry", "On Hold", "Hold", "Confirmed"]).optional(),
    paymentStatus: z
      .enum(["Deposit Paid", "Paid Partially", "Paid in Full"])
      .optional(),
    packageId: z.string().uuid().optional(),
    // Bounded because these are Postgres `Int` columns; an unbounded value
    // used to pass Zod and then fail at the driver as an unhandled 500.
    couplesCount: countSchema({ label: "Couples" }).default(0),
    menCount: countSchema({ label: "Men" }).default(0),
    ladiesCount: countSchema({ label: "Ladies" }).default(0),
    boysCount: countSchema({ label: "Boys" }).default(0),
    girlsCount: countSchema({ label: "Girls" }).default(0),
    kidsCount: countSchema({ label: "Kids" }).default(0),
    waitersCount: countSchema({ label: "Waiters" }).default(0),
    notes: z.string().max(10000).optional(),
    idempotencyKey: z.string().uuid().optional()
  })
  .superRefine((value, context) => {
    const hasExplicitWindow = Boolean(value.startsAt && value.endsAt);
    if (!hasExplicitWindow && !value.eventDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide startsAt and endsAt, or an eventDate.",
        path: ["startsAt"]
      });
    }
    if (Boolean(value.startsAt) !== Boolean(value.endsAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "startsAt and endsAt must be provided together.",
        path: ["endsAt"]
      });
    }
  });

export const transitionBookingSchema = z.object({
  status: z.enum(bookingStatuses),
  expectedVersion: z.number().int().min(0),
  holdDurationMinutes: z.number().int().min(5).max(10080).default(1440)
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
