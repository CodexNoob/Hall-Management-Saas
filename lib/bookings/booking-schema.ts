import { z } from "zod";

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
    phone: z.string().trim().min(1).max(40),
    email: z.string().trim().email().optional(),
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
    setupMinutes: z.number().int().min(0).max(1440).default(120),
    cleanupMinutes: z.number().int().min(0).max(1440).default(60),
    holdDurationMinutes: z.number().int().min(5).max(10080).default(1440),
    hallId: z.string().uuid(),
    eventTypeId: z.string().uuid().optional(),
    bookingStatus: z.enum(bookingStatuses).optional(),
    eventStatus: z.enum(["Inquiry", "On Hold", "Hold", "Confirmed"]).optional(),
    paymentStatus: z
      .enum(["Deposit Paid", "Paid Partially", "Paid in Full"])
      .optional(),
    packageId: z.string().uuid().optional(),
    couplesCount: z.number().int().min(0).default(0),
    menCount: z.number().int().min(0).default(0),
    ladiesCount: z.number().int().min(0).default(0),
    boysCount: z.number().int().min(0).default(0),
    girlsCount: z.number().int().min(0).default(0),
    kidsCount: z.number().int().min(0).default(0),
    waitersCount: z.number().int().min(0).default(0),
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
