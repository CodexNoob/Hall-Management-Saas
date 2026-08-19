import type { CountryCode } from "libphonenumber-js";
import { z } from "zod";

import { countSchema, parseNumericInput } from "@/lib/validation/number";
import { DEFAULT_PHONE_COUNTRY, requiredPhoneSchema } from "@/lib/validation/phone";

/**
 * The booking form, as text.
 *
 * Every value a booking form holds is a string, because that is what an input
 * gives back. This schema owns the whole hop from that text to the numbers and
 * E.164 the API expects, so a field cannot be "checked" in one place and
 * converted in another.
 *
 * Shared deliberately: the calendar's new-booking dialog and the event
 * manager's Event information panel are the same form over the same fields, one
 * creating and one editing. Anything added here appears in both.
 *
 * Client name, phone, date, hall and event type are required. Guests, couples
 * and children stay optional - blank means zero rather than an error - and
 * notes are free text.
 */

export type BookingFormValues = {
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

export type BookingFormErrors = Partial<Record<keyof BookingFormValues, string>>;

export const emptyBookingFormValues: BookingFormValues = {
  clientName: "",
  phone: "",
  eventDate: "",
  hallId: "",
  eventTypeId: "",
  guests: "0",
  couples: "0",
  children: "0",
  notes: ""
};

/**
 * Counts that may be left blank but never left garbage.
 *
 * Same double-parse shape as `phoneSchema`: the refinement decides whether the
 * text is acceptable, the transform then converts it. Blank becomes 0.
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
export function bookingFormSchema({
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
      // same way the event manager reads them back.
      guests: countTextSchema("Guests"),
      couples: countTextSchema("Couples"),
      children: countTextSchema("Children"),
      // 5000 because that is the tighter of the two routes this form posts to;
      // a note that passes here is accepted by both.
      notes: z
        .string()
        .trim()
        .max(5000, "Notes must be 5000 characters or less.")
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

export type BookingFormInput = z.output<ReturnType<typeof bookingFormSchema>>;

/** First message per field, which is all a single-line error slot can show. */
export function toFieldErrors(
  error: z.ZodError<BookingFormValues>
): BookingFormErrors {
  const fieldErrors = error.flatten().fieldErrors;
  const errors: BookingFormErrors = {};

  for (const [field, messages] of Object.entries(fieldErrors)) {
    const message = messages?.[0];

    if (message) {
      errors[field as keyof BookingFormValues] = message;
    }
  }

  return errors;
}

/**
 * The count columns a validated form maps onto.
 *
 * There is no total-guests column - the total is the sum of the parts - so
 * whatever the couples and children do not account for goes to the catch-all,
 * which is what makes the entered total read back unchanged.
 */
export function toGuestCountPayload(data: BookingFormInput) {
  return {
    couplesCount: data.couples,
    kidsCount: data.children,
    boysCount: 0,
    girlsCount: 0,
    ladiesCount: 0,
    menCount: Math.max(data.guests - data.couples * 2 - data.children, 0)
  };
}
