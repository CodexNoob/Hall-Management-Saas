import type { CountryCode } from "libphonenumber-js";
import { z } from "zod";

import { countSchema, parseNumericInput } from "@/lib/validation/number";
import { DEFAULT_PHONE_COUNTRY, requiredPhoneSchema } from "@/lib/validation/phone";

/**
 * The calendar quick-booking form, as text.
 *
 * Every value the dialog holds is a string, because that is what an input
 * gives back. The schema owns the whole hop from that text to the payload the
 * `/api/events` route expects, so a field cannot be "checked" in one place and
 * converted in another.
 *
 * Client name, phone, date, hall and event type are all required here. Guests,
 * couples and children stay optional - blank means zero rather than an error -
 * and notes are free text.
 */

export type CalendarBookingFormValues = {
  clientName: string;
  phone: string;
  eventDate: string;
  hallId: string;
  eventTypeId: string;
  guests: string;
  couples: string;
  children: string;
  notes: string;
};

export type CalendarBookingFormErrors = Partial<
  Record<keyof CalendarBookingFormValues, string>
>;

/**
 * Counts that may be left blank but never left garbage.
 *
 * Same double-parse shape as `phoneSchema`: the refinement decides whether the
 * text is acceptable, the transform then converts it. Blank becomes 0, which is
 * what the old dialog pre-filled by hand.
 */
function countTextSchema(label: string) {
  const number = countSchema({ label });

  return z
    .string({ invalid_type_error: `${label} must be text.` })
    .transform((value) => value.trim())
    .superRefine((value, context) => {
      if (value === "") return;

      const result = parseNumericInput(value, number);

      if (result.status === "invalid") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: result.message
        });
      }
    })
    .transform((value) => {
      if (value === "") return 0;

      const result = parseNumericInput(value, number);

      // The refinement above has already rejected anything else.
      return result.status === "valid" ? result.value : 0;
    });
}

/**
 * Built per submit rather than once at module scope: the phone country comes
 * from the picker next to the field, and the same digits are a valid number in
 * one country and impossible in another.
 */
export function calendarBookingFormSchema({
  country = DEFAULT_PHONE_COUNTRY
}: { country?: CountryCode } = {}) {
  return z
    .object({
      clientName: z
        .string()
        .trim()
        .min(1, "Client name is required.")
        .max(160, "Client name must be 160 characters or less."),
      phone: requiredPhoneSchema({
        label: "Phone number",
        defaultCountry: country
      }),
      // `.date()` rather than a bare string: the date input can be cleared, and
      // a typed-in partial date reaches us as text the route would reject.
      eventDate: z
        .string()
        .min(1, "Date is required.")
        .pipe(z.string().date("Enter a valid date.")),
      hallId: z.string().uuid("Select a hall."),
      eventTypeId: z.string().uuid("Select an event type."),
      // The head count for the whole event. Couples and children below are the
      // parts of it the kitchen and dining rooms are counted separately by, the
      // same way the event manager's guest-counts section reads them back.
      guests: countTextSchema("Guests"),
      couples: countTextSchema("Couples"),
      children: countTextSchema("Children"),
      notes: z
        .string()
        .trim()
        .max(10000, "Notes must be 10000 characters or less.")
    })
    .superRefine((values, context) => {
      const parts = values.couples * 2 + values.children;

      // A total smaller than its own parts would be silently clamped on the way
      // to the database, and the event would then open showing a guest count
      // nobody typed. Only checked once a total is given: left blank, the total
      // is simply the parts.
      if (values.guests > 0 && values.guests < parts) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Guests must be at least ${parts} to cover the couples and children entered.`,
          path: ["guests"]
        });
      }
    });
}

export type CalendarBookingFormInput = z.output<
  ReturnType<typeof calendarBookingFormSchema>
>;

/** First message per field, which is all a single-line error slot can show. */
export function toFieldErrors(
  error: z.ZodError<CalendarBookingFormValues>
): CalendarBookingFormErrors {
  const fieldErrors = error.flatten().fieldErrors;
  const errors: CalendarBookingFormErrors = {};

  for (const [field, messages] of Object.entries(fieldErrors)) {
    const message = messages?.[0];

    if (message) {
      errors[field as keyof CalendarBookingFormValues] = message;
    }
  }

  return errors;
}
