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

export const bookingControlClass =
  "h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 " +
  "text-sm text-[#17202a] outline-none transition " +
  "focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15";

type BookingFormFieldsProps = {
  autoFocus?: boolean;
  /** Two for a dialog, three for a full-width panel. Fields are unchanged. */
  columns?: 2 | 3;
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
  errors,
  eventTypes,
  extraEventTypeOption,
  halls,
  idPrefix,
  onChange,
  onPhoneCountryChange,
  renderEventTypeExtra,
  phoneCountry,
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

      <div>
        <FieldLabel htmlFor={fieldId("phone")}>Phone</FieldLabel>

        <PhoneField
          country={phoneCountry}
          id={fieldId("phone")}
          inputClassName={`${bookingControlClass} min-w-0 flex-1`}
          name="phone"
          onChange={(value) => onChange("phone", value)}
          onCountryChange={onPhoneCountryChange}
          required
          rowClassName="flex gap-2"
          selectClassName={`${bookingControlClass} max-w-[8.5rem]`}
          serverError={errors.phone}
          value={values.phone}
        />
      </div>

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
