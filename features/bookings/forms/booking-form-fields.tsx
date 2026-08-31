"use client";

import type { CountryCode } from "libphonenumber-js";
import type { ReactNode } from "react";

import { PhoneField } from "@/components/ui/phone-field";
import type {
  BookingFormErrors,
  BookingFormValues
} from "@/features/bookings/validations/booking-form.schema";

/**
 * The booking form's fields, rendered once and hosted twice: the calendar's
 * new-booking dialog and the event manager's Event information panel.
 *
 * State stays with the host - one is a create form that resets on open, the
 * other an edit form that reloads when the selected event changes - but the
 * fields, their order, and their error slots are literally the same component,
 * so the two cannot drift apart.
 */

export type BookingLookupOption = {
  id: string;
  name: string;
};

const bookingControlBase =
  "h-9 rounded-lg border border-[#b9c2cf] bg-white px-3 " +
  "text-sm text-[#17202a] transition";

export const bookingControlClass =
  `${bookingControlBase} w-full outline-none ` +
  "focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15";

/**
 * The phone country trigger. Same skin as any other control, but a fixed width
 * rather than `w-full` - it holds an ISO code and a dialling code, and letting
 * it size itself would shove the number input around as the country changed.
 * No `focus:` rules: the trigger is a div, and `PhoneField` rings it from the
 * `<select>` inside.
 */
const bookingCountryClass = `${bookingControlBase} w-[6.5rem]`;

type BookingFormFieldsProps = {
  autoFocus?: boolean;
  /** Two for a dialog, three for a full-width panel. Fields are unchanged. */
  columns?: 2 | 3;
  /**
   * Staff this event can be assigned to. Empty is a legitimate answer - a fresh
   * organization has only the person setting it up - and the field still offers
   * Unassigned, so the form does not need a special case for it.
   */
  coordinators: BookingLookupOption[];
  errors: BookingFormErrors;
  eventTypes: BookingLookupOption[];
  extraEventTypeOption?: BookingLookupOption;
  halls: BookingLookupOption[];
  /** Keeps ids unique when more than one booking form is on a page. */
  idPrefix: string;
  onChange: (field: keyof BookingFormValues, value: string) => void;
  onPhoneCountryChange: (country: CountryCode) => void;
  renderEventTypeExtra?: () => ReactNode;
  phoneCountry: CountryCode;
  /**
   * Show the phone country picker. Off for the event manager's panel, where the
   * country is already fixed by the number that was saved and the row is better
   * spent on the number itself. `phoneCountry` still validates either way.
   */
  showPhoneCountry?: boolean;
  /**
   * Show phone, email and coordinator. Off for the event manager's panel, where
   * the Client contact card beside it owns those three and edits them a row at
   * a time. On for the calendar's dialog, which is creating the event and has
   * no card to send anybody to yet.
   */
  showClientContact?: boolean;
  values: BookingFormValues;
};

function FieldLabel({
  children,
  htmlFor
}: {
  children: string;
  htmlFor: string;
}) {
  return (
    <label
      className="mb-1 block text-[10px] font-black uppercase tracking-[0.06em] text-[#64748b]"
      htmlFor={htmlFor}
    >
      {children}
    </label>
  );
}

function FieldError({ children, id }: { children: string; id: string }) {
  return (
    <p
      className="mt-1 text-[10px] font-bold text-[#c2410c]"
      id={id}
      role="alert"
    >
      {children}
    </p>
  );
}

export function BookingFormFields({
  autoFocus = false,
  columns = 2,
  coordinators,
  errors,
  eventTypes,
  extraEventTypeOption,
  halls,
  idPrefix,
  onChange,
  onPhoneCountryChange,
  renderEventTypeExtra,
  phoneCountry,
  showPhoneCountry = true,
  showClientContact = true,
  values
}: BookingFormFieldsProps) {
  const fieldId = (name: string) => `${idPrefix}-${name}`;
  const errorId = (name: string) => `${idPrefix}-${name}-error`;

  return (
    <div
      className={`grid gap-x-3 gap-y-2 ${
        columns === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"
      }`}
    >
      <div>
        <FieldLabel htmlFor={fieldId("client-name")}>Client name</FieldLabel>

        <input
          aria-describedby={
            errors.clientName ? errorId("client-name") : undefined
          }
          aria-invalid={errors.clientName ? true : undefined}
          autoFocus={autoFocus}
          className={bookingControlClass}
          id={fieldId("client-name")}
          onChange={(event) => onChange("clientName", event.target.value)}
          placeholder="Client name"
          required
          value={values.clientName}
        />
        {errors.clientName ? (
          <FieldError id={errorId("client-name")}>
            {errors.clientName}
          </FieldError>
        ) : null}
      </div>

      {showClientContact ? (
        <>
          <div>
            <FieldLabel htmlFor={fieldId("phone")}>Phone</FieldLabel>

            <PhoneField
              country={phoneCountry}
              countryClassName={bookingCountryClass}
              id={fieldId("phone")}
              inputClassName={`${bookingControlClass} min-w-0 flex-1`}
              name="phone"
              onChange={(value) => onChange("phone", value)}
              onCountryChange={onPhoneCountryChange}
              required
              rowClassName="flex gap-2"
              serverError={errors.phone}
              showCountry={showPhoneCountry}
              value={values.phone}
            />
          </div>

          <div>
            <FieldLabel htmlFor={fieldId("email")}>Email</FieldLabel>

            <input
              aria-describedby={errors.email ? errorId("email") : undefined}
              aria-invalid={errors.email ? true : undefined}
              className={bookingControlClass}
              id={fieldId("email")}
              inputMode="email"
              onChange={(event) => onChange("email", event.target.value)}
              placeholder="Optional"
              type="email"
              value={values.email}
            />
            {errors.email ? (
              <FieldError id={errorId("email")}>{errors.email}</FieldError>
            ) : null}
          </div>
        </>
      ) : null}

      <div>
        <FieldLabel htmlFor={fieldId("date")}>Date</FieldLabel>

        <input
          aria-describedby={errors.eventDate ? errorId("date") : undefined}
          aria-invalid={errors.eventDate ? true : undefined}
          className={bookingControlClass}
          id={fieldId("date")}
          onChange={(event) => onChange("eventDate", event.target.value)}
          required
          type="date"
          value={values.eventDate}
        />
        {errors.eventDate ? (
          <FieldError id={errorId("date")}>{errors.eventDate}</FieldError>
        ) : null}
      </div>

      <div>
        <FieldLabel htmlFor={fieldId("hall")}>Hall / room</FieldLabel>

        <select
          aria-describedby={errors.hallId ? errorId("hall") : undefined}
          aria-invalid={errors.hallId ? true : undefined}
          className={bookingControlClass}
          id={fieldId("hall")}
          onChange={(event) => onChange("hallId", event.target.value)}
          required
          value={values.hallId}
        >
          <option disabled value="">
            Select hall
          </option>

          {halls.map((hall) => (
            <option key={hall.id} value={hall.id}>
              {hall.name}
            </option>
          ))}
        </select>
        {errors.hallId ? (
          <FieldError id={errorId("hall")}>{errors.hallId}</FieldError>
        ) : null}
      </div>

      <div>
        <FieldLabel htmlFor={fieldId("event-type")}>Event type</FieldLabel>

        <select
          aria-describedby={
            errors.eventTypeId ? errorId("event-type") : undefined
          }
          aria-invalid={errors.eventTypeId ? true : undefined}
          className={bookingControlClass}
          id={fieldId("event-type")}
          onChange={(event) => onChange("eventTypeId", event.target.value)}
          required
          value={values.eventTypeId}
        >
          <option disabled value="">
            Select event type
          </option>

          {eventTypes.map((eventType) => (
            <option key={eventType.id} value={eventType.id}>
              {eventType.name}
            </option>
          ))}
          {extraEventTypeOption ? (
            <option value={extraEventTypeOption.id}>
              {extraEventTypeOption.name}
            </option>
          ) : null}
        </select>
        {errors.eventTypeId ? (
          <FieldError id={errorId("event-type")}>
            {errors.eventTypeId}
          </FieldError>
        ) : null}
        {renderEventTypeExtra ? renderEventTypeExtra() : null}
      </div>

      {showClientContact ? (
        <div>
          <FieldLabel htmlFor={fieldId("coordinator")}>Coordinator</FieldLabel>

          {/*
            Unassigned is the first option rather than a disabled placeholder:
            an event with nobody on it is a state somebody has to be able to go
            back to, not just the one it starts in.
          */}
          <select
            aria-describedby={
              errors.coordinatorMembershipId
                ? errorId("coordinator")
                : undefined
            }
            aria-invalid={errors.coordinatorMembershipId ? true : undefined}
            className={bookingControlClass}
            id={fieldId("coordinator")}
            onChange={(event) =>
              onChange("coordinatorMembershipId", event.target.value)
            }
            value={values.coordinatorMembershipId}
          >
            <option value="">Unassigned</option>

            {coordinators.map((coordinator) => (
              <option key={coordinator.id} value={coordinator.id}>
                {coordinator.name}
              </option>
            ))}
          </select>
          {errors.coordinatorMembershipId ? (
            <FieldError id={errorId("coordinator")}>
              {errors.coordinatorMembershipId}
            </FieldError>
          ) : null}
        </div>
      ) : null}

      <div>
        <FieldLabel htmlFor={fieldId("count-mode")}>Count type</FieldLabel>

        <select
          className={bookingControlClass}
          id={fieldId("count-mode")}
          onChange={(event) => onChange("countMode", event.target.value)}
          value={values.countMode}
        >
          <option value="People">People</option>
          <option value="Couples">Couples</option>
        </select>
      </div>

      {/*
        One count box, never two. The mode names how this room is counted, and
        the other box is hidden rather than cleared - whatever it holds is still
        there if the mode is switched back, and nothing anybody typed is thrown
        away on a change of mind.
      */}
      {values.countMode === "People" ? (
        <div>
          <FieldLabel htmlFor={fieldId("guests")}>Guests</FieldLabel>

          <input
            aria-describedby={errors.guests ? errorId("guests") : undefined}
            aria-invalid={errors.guests ? true : undefined}
            className={bookingControlClass}
            id={fieldId("guests")}
            inputMode="decimal"
            onChange={(event) => onChange("guests", event.target.value)}
            type="text"
            value={values.guests}
          />
          {errors.guests ? (
            <FieldError id={errorId("guests")}>{errors.guests}</FieldError>
          ) : null}
        </div>
      ) : (
        <div>
          <FieldLabel htmlFor={fieldId("couples")}>Couples</FieldLabel>

          <input
            aria-describedby={errors.couples ? errorId("couples") : undefined}
            aria-invalid={errors.couples ? true : undefined}
            className={bookingControlClass}
            id={fieldId("couples")}
            inputMode="decimal"
            onChange={(event) => onChange("couples", event.target.value)}
            type="text"
            value={values.couples}
          />
          {errors.couples ? (
            <FieldError id={errorId("couples")}>{errors.couples}</FieldError>
          ) : null}
        </div>
      )}

      <div>
        <FieldLabel htmlFor={fieldId("children")}>Children</FieldLabel>

        <input
          aria-describedby={errors.children ? errorId("children") : undefined}
          aria-invalid={errors.children ? true : undefined}
          className={bookingControlClass}
          id={fieldId("children")}
          inputMode="decimal"
          onChange={(event) => onChange("children", event.target.value)}
          type="text"
          value={values.children}
        />
        {errors.children ? (
          <FieldError id={errorId("children")}>{errors.children}</FieldError>
        ) : null}
      </div>

      <div className="col-span-full">
        <FieldLabel htmlFor={fieldId("notes")}>Notes</FieldLabel>

        <textarea
          aria-describedby={errors.notes ? errorId("notes") : undefined}
          aria-invalid={errors.notes ? true : undefined}
          className="min-h-13 w-full resize-y rounded-lg border border-[#b9c2cf] bg-white px-3 py-2 text-sm outline-none focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15"
          id={fieldId("notes")}
          onChange={(event) => onChange("notes", event.target.value)}
          placeholder="Internal notes"
          value={values.notes}
        />
        {errors.notes ? (
          <FieldError id={errorId("notes")}>{errors.notes}</FieldError>
        ) : null}
      </div>
    </div>
  );
}
