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
 *
 * An event is counted one way or the other, never both: `countMode` says which,
 * and the count it does not use is ignored rather than erased. See
 * `CountMode`.
 */

/**
 * How the room is counted.
 *
 * `People` counts by head, `Couples` counts in pairs, and the two are not
 * interchangeable - 110 couples is 220 people, but 220 people is not 110
 * couples. Naming the mode is what lets the form ask for one number instead of
 * two that have to agree.
 *
 * Same two words as the dining plan's `countType`, deliberately: an event
 * counted in couples on the booking form is the same event counted in couples
 * downstream, and two names for one idea would invite them to drift.
 */
export type CountMode = "People" | "Couples";

export type BookingFormValues = {
  clientName: string;
  phone: string;
  eventDate: string;
  hallId: string;
  eventTypeId: string;
  countMode: CountMode;
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
  countMode: "People",
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
      countMode: z.enum(["People", "Couples"]),
      // The head count for the whole event, children included. Read only in
      // `People` mode - in `Couples` mode the box is not on screen, and
      // whatever it still holds is left alone so switching back restores it.
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
      // Only `People` mode has a total to check. In `Couples` mode the total is
      // the couples and children themselves, and the guests box is off screen -
      // complaining about a number nobody can see would be unanswerable.
      if (values.countMode !== "People") return;

      // A total smaller than its own children would be silently clamped on the
      // way to the database, and the event would then open showing a guest
      // count nobody typed. Only checked once a total is given: left blank, the
      // total is simply the children.
      if (values.guests > 0 && values.guests < values.children) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Guests must be at least ${values.children} to cover the children entered.`,
          path: ["guests"]
        });
      }
    });
}

export type BookingFormInput = z.output<ReturnType<typeof bookingFormSchema>>;

/**
 * The errors an edit resolves.
 *
 * The edited field's own message goes, and so does the guests message whenever
 * the children move or the mode changes - it is about how the counts relate, so
 * fixing the children must not leave a complaint on screen that is no longer
 * true, and switching to `Couples` retires it entirely.
 */
export function fieldErrorPatch(
  field: keyof BookingFormValues
): BookingFormErrors {
  const patch: BookingFormErrors = {};

  patch[field] = undefined;

  if (field === "children" || field === "countMode") {
    patch.guests = undefined;
  }

  return patch;
}

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
 * There is no total-guests column - the total is the sum of the parts - so the
 * mode decides which parts are filled. `Couples` stores the pairs and puts
 * nothing in the catch-all; `People` stores no pairs and lets the catch-all
 * carry whatever the children do not account for, which is what makes an
 * entered total read back unchanged.
 *
 * The count the mode does not use is not read at all. It may still hold a value
 * the user typed before switching, and that value is theirs to come back to.
 */
export function toGuestCountPayload(data: BookingFormInput) {
  const countedInCouples = data.countMode === "Couples";

  return {
    couplesCount: countedInCouples ? data.couples : 0,
    kidsCount: data.children,
    boysCount: 0,
    girlsCount: 0,
    ladiesCount: 0,
    menCount: countedInCouples ? 0 : Math.max(data.guests - data.children, 0)
  };
}
