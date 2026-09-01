import type { CountryCode } from "libphonenumber-js";
import { z } from "zod";

import { dateKey } from "@/lib/dates/calendar-date";
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
  email: string;
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
  email: "",
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
 * The one rule the counts can break, stated once.
 *
 * A total smaller than its own children would be silently clamped on the way to
 * the database, and the event would then open showing a guest count nobody
 * typed. Only checked once a total is given: left blank, the total is simply
 * the children.
 *
 * Only `People` mode has a total to check. In `Couples` mode the total is the
 * couples and children themselves, and the guests box is off screen -
 * complaining about a number nobody can see would be unanswerable.
 *
 * Lives out here because the form has to answer it twice: the schema asks on
 * submit, and the panels ask on every keystroke. One function so the message
 * shown while typing is the same one that refuses the save.
 */
export function guestsCoverIssue(
  countMode: CountMode,
  guests: number,
  children: number
) {
  if (countMode !== "People" || guests <= 0 || guests >= children) {
    return undefined;
  }

  return `Guests must be at least ${children} to cover the children entered.`;
}

/**
 * The count errors as they stand right now, for a form still being typed into.
 *
 * Returns the guests slot either way - a message when the counts disagree, and
 * `undefined` the moment they stop, so a complaint clears itself as soon as it
 * is answered instead of waiting for another save.
 *
 * Half-typed and mistyped counts are left alone: `parseNumericInput` owns that
 * message and says it on submit, and second-guessing a number mid-keystroke
 * would flash an error at somebody who is still typing it.
 */
export function liveCountErrors(values: BookingFormValues): BookingFormErrors {
  const guests = Number(values.guests.trim());
  const children = Number(values.children.trim());

  if (!Number.isFinite(guests) || !Number.isFinite(children)) {
    return { guests: undefined };
  }

  return { guests: guestsCoverIssue(values.countMode, guests, children) };
}

/** Today as `YYYY-MM-DD`, which is the earliest date a new booking may take. */
export function earliestBookableDate() {
  return dateKey(new Date());
}

/**
 * The one thing a create form can get wrong about a date that an edit form
 * cannot: a day that has already been and gone.
 *
 * Only asked on the way in. An event that has already happened keeps the date
 * it happened on, and a rule that refused it would make every past event
 * unsaveable the moment somebody opened it to correct a guest count.
 *
 * Both values are `YYYY-MM-DD`, so this compares as text.
 */
export function pastDateIssue(eventDate: string, earliestDate: string) {
  if (!eventDate || eventDate >= earliestDate) return undefined;

  return "The event date cannot be in the past.";
}

/**
 * Who to contact about the event, as two fields that travel together.
 *
 * Built per call rather than held at module scope: the phone country comes from
 * the picker beside the field, and the same digits are a valid number in one
 * country and impossible in another.
 *
 * Exported as the shape rather than as a schema because the Client contact card
 * edits one row at a time and validates just that row - `[field].safeParse` -
 * while the booking dialog spreads both into the form it submits whole.
 */
export function clientContactFields({
  country = DEFAULT_PHONE_COUNTRY
}: { country?: CountryCode } = {}) {
  return {
    phone: requiredPhoneSchema({
      label: "Phone number",
      defaultCountry: country
    }),
    // Blank is an answer, not an omission: plenty of bookings are taken over
    // the phone and never get one, and the card says "Email not provided"
    // rather than pretending otherwise. `null` on the way out so clearing the
    // box takes a wrong address back off the event.
    email: z
      .string()
      .trim()
      .max(200)
      .refine(
        (value) => value === "" || z.string().email().safeParse(value).success,
        "Enter a valid email address."
      )
      .transform((value) => value || null)
  };
}

/**
 * The event itself: everything the booking form asks that is not contact
 * details.
 *
 * Split out so the event manager's panel can parse with exactly this and
 * nothing else. The contact fields are owned by the Client contact card now,
 * and a schema that cannot see them is what stops the panel sending a stale
 * copy back over an edit the card just made.
 */
function eventFields() {
  return {
    clientName: z
      .string()
      .trim()
      .min(1, "Client name is required.")
      .max(160, "Client name must be 160 characters or less."),
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
  };
}

/** Shared by both forms below, because both carry the counts. */
function refineCounts(
  values: { countMode: CountMode; guests: number; children: number },
  context: z.RefinementCtx
) {
  const message = guestsCoverIssue(
    values.countMode,
    values.guests,
    values.children
  );

  if (message) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message,
      path: ["guests"]
    });
  }
}

/**
 * The whole booking, as the calendar's new-booking dialog submits it.
 *
 * Creating an event asks for the contact details in the same breath as the
 * event, because there is no card to edit them on yet.
 *
 * `earliestDate` is the day the booking may not start before - the dialog
 * passes today. Left out, the date is only checked for being a date: the schema
 * stays a pure function of its input, so a caller reading a stored event back
 * through it is not refused for having been booked last month.
 */
export function bookingFormSchema({
  country = DEFAULT_PHONE_COUNTRY,
  earliestDate
}: { country?: CountryCode; earliestDate?: string } = {}) {
  return z
    .object({ ...eventFields(), ...clientContactFields({ country }) })
    .superRefine(refineCounts)
    .superRefine((values, context) => {
      const message = earliestDate
        ? pastDateIssue(values.eventDate, earliestDate)
        : undefined;

      if (message) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message,
          path: ["eventDate"]
        });
      }
    });
}

/**
 * The event manager's Event information panel.
 *
 * Deliberately narrower than `bookingFormSchema`: the phone and email belong to
 * the Client contact card beside it. Zod drops the keys it does not know, so
 * the panel can hold the full form values and still parse to something that
 * cannot carry a contact field back to the route.
 *
 * That is also what makes an event with no stored phone editable. `Event.phone`
 * is written as "" when a booking is taken without one, and a required phone the
 * panel no longer shows would have made those events unsaveable with no field
 * on screen to fix.
 */
export function eventDetailsFormSchema() {
  return z.object(eventFields()).superRefine(refineCounts);
}

export type BookingFormInput = z.output<ReturnType<typeof bookingFormSchema>>;
export type EventDetailsFormInput = z.output<
  ReturnType<typeof eventDetailsFormSchema>
>;

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
  error: z.ZodError<Partial<BookingFormValues>>
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
export function toGuestCountPayload(
  data: BookingFormInput | EventDetailsFormInput
) {
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
