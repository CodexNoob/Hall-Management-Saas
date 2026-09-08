"use client";

import { useEffect, useId, useMemo, useState, type FormEvent } from "react";

import type { CountryCode } from "libphonenumber-js";

import {
  BookingFormFields,
  type BookingLookupOption
} from "@/features/bookings/forms/booking-form-fields";
import {
  bookingFormSchema,
  earliestBookableDate,
  emptyBookingFormValues,
  fieldErrorPatch,
  liveCountErrors,
  pastDateIssue,
  toFieldErrors,
  toGuestCountPayload,
  type BookingFormErrors,
  type BookingFormValues
} from "@/features/bookings/validations/booking-form.schema";
import { useAuthenticatedMutation } from "@/features/dashboard/hooks/use-authenticated-mutation";
import { useAccess } from "@/features/dashboard/hooks/use-dashboard-permission";
import { DEFAULT_PHONE_COUNTRY } from "@/lib/validation/phone";

const OTHER_EVENT_TYPE_ID = "calendar-other-event-type";

type BookingPayload = {
  clientName: string;
  phone: string;
  email?: string;
  eventDate: string;
  hallId: string;
  eventTypeId?: string;
  newEventTypeName?: string;
  bookingStatus: "TENTATIVE_HOLD";
  eventStatus: "Hold";
  couplesCount: number;
  kidsCount: number;
  menCount: number;
  boysCount: number;
  girlsCount: number;
  ladiesCount: number;
  notes?: string;
  idempotencyKey: string;
};

type CalendarBookingDialogProps = {
  open: boolean;
  selectedDate: string;
  halls: BookingLookupOption[];
  eventTypes: BookingLookupOption[];
  onClose: () => void;
  onEventTypesChanged: () => void | Promise<void>;
  onSaved: () => void | Promise<void>;
};

function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <rect height="17" rx="2" width="18" x="3" y="4" />
      <path d="M8 2v4M16 2v4M3 9h18" />
    </svg>
  );
}

export function CalendarBookingDialog({
  open,
  selectedDate,
  halls,
  eventTypes,
  onClose,
  onEventTypesChanged,
  onSaved
}: CalendarBookingDialogProps) {
  const titleId = useId();

  const bookingMutation = useAuthenticatedMutation<
    BookingPayload,
    { event: { id: string } }
  >("/api/events");
  // Naming a type the list does not have yet CREATES one, which is why this
  // asks for the create key rather than for a general "may manage event types":
  // POST /api/events authorizes the same key on that branch.
  const canManageEventTypes = useAccess("eventtype.create");
  const { resetError } = bookingMutation;

  const [values, setValues] = useState<BookingFormValues>(
    emptyBookingFormValues
  );
  const [errors, setErrors] = useState<BookingFormErrors>({});
  const [otherEventTypeName, setOtherEventTypeName] = useState("");
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>(
    DEFAULT_PHONE_COUNTRY
  );
  const availableEventTypes = useMemo(() => {
    const byId = new Map<string, BookingLookupOption>();
    for (const eventType of eventTypes) {
      byId.set(eventType.id, eventType);
    }
    return Array.from(byId.values()).sort((left, right) =>
      left.name.localeCompare(right.name)
    );
  }, [eventTypes]);

  useEffect(() => {
    if (!open) return;

    setValues({
      ...emptyBookingFormValues,
      eventDate: selectedDate,
      hallId: halls[0]?.id ?? "",
      eventTypeId: availableEventTypes[0]?.id ?? ""
    });

    setErrors({});
    setOtherEventTypeName("");
    resetError();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
    // Only reset the form when the dialog opens (or the target date changes)
    // while open - not whenever halls/eventTypes get a new array identity
    // from an unrelated data refetch, which would silently wipe user input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedDate]);

  // Halls can still be loading when the dialog opens. Fill in the default hall
  // once they arrive - without this the required select stays empty and the
  // form is refused with no explanation. Existing input is kept.
  useEffect(() => {
    if (!open || !halls.length) return;

    setValues((current) =>
      current.hallId ? current : { ...current, hallId: halls[0].id }
    );
  }, [halls, open]);

  // Event types load on the same request as the halls, and the field is
  // required, so it needs the same late-arrival fill.
  useEffect(() => {
    if (!open || !availableEventTypes.length) return;

    setValues((current) =>
      current.eventTypeId
        ? current
        : { ...current, eventTypeId: availableEventTypes[0].id }
    );
  }, [availableEventTypes, open]);

  if (!open) return null;

  // Read on every render rather than pinned when the dialog mounted: a form
  // left open across midnight must not still be offering yesterday.
  const earliestDate = earliestBookableDate();

  const updateValue = (field: keyof BookingFormValues, value: string) => {
    const next = { ...values, [field]: value };

    resetError();
    // Checked against the form this keystroke produces, not the one it
    // replaced: the counts have to answer for themselves as they are typed
    // rather than holding their complaint until a save.
    setErrors((current) => ({
      ...current,
      ...fieldErrorPatch(field),
      ...liveCountErrors(next),
      // The input's `min` stops the picker walking back, but a date can still
      // be typed straight into it, so the complaint is made as it is typed
      // rather than held until the save.
      ...(field === "eventDate"
        ? { eventDate: pastDateIssue(next.eventDate, earliestDate) }
        : {})
    }));

    setValues(next);

    if (field === "eventTypeId" && value !== OTHER_EVENT_TYPE_ID) {
      setOtherEventTypeName("");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const isNewEventType = values.eventTypeId === OTHER_EVENT_TYPE_ID;
    const newEventTypeName = otherEventTypeName.trim();

    if (isNewEventType && !newEventTypeName) {
      setErrors((current) => ({
        ...current,
        eventTypeId: "Enter the new event type name."
      }));
      return;
    }

    // Validate the complete form before sending the atomic booking request.
    // The temporary UUID satisfies the client-side field shape; the API uses
    // `newEventTypeName` instead and creates the real type in its transaction.
    const parsed = bookingFormSchema({
      country: phoneCountry,
      earliestDate
    }).safeParse({
      ...values,
      eventTypeId: isNewEventType ? crypto.randomUUID() : values.eventTypeId
    });

    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }

    setErrors({});

    try {
      await bookingMutation.mutate({
        clientName: parsed.data.clientName,
        phone: parsed.data.phone,
        eventDate: parsed.data.eventDate,
        hallId: parsed.data.hallId,
        eventTypeId: isNewEventType ? undefined : values.eventTypeId,
        newEventTypeName: isNewEventType ? newEventTypeName : undefined,
        // The status picker is gone: a booking made from the calendar is always
        // a hold, which is what the picker defaulted to.
        bookingStatus: "TENTATIVE_HOLD",
        eventStatus: "Hold",
        ...toGuestCountPayload(parsed.data),
        email: parsed.data.email ?? undefined,
        notes: parsed.data.notes || undefined,
        idempotencyKey: crypto.randomUUID()
      });

      await onSaved();
      if (isNewEventType) await onEventTypesChanged();
      onClose();
    } catch {
      // The mutation displays the server error below the form.
    }
  };

  return (
    <div
      className="dashboard-drawer-backdrop fixed inset-0 z-100 flex items-center justify-center bg-[#17202a]/30 p-2 sm:p-3"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="dashboard-panel-enter flex max-h-[calc(100dvh-16px)] w-full max-w-180 flex-col overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-2xl sm:max-h-[calc(100dvh-24px)]"
        role="dialog"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-[#d8dde5] px-4 py-3">
          <div className="flex items-center gap-3">
            <CalendarIcon />

            <h2 className="text-base font-black text-[#17202a]" id={titleId}>
              New booking
            </h2>
          </div>

          <button
            aria-label="Close calendar booking"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#17202a] hover:bg-[#eef4fa]"
            onClick={onClose}
            type="button"
          >
            <svg
              aria-hidden="true"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                d="M5 5 19 19M19 5 5 19"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2.25"
              />
            </svg>
          </button>
        </header>

        <form
          className="flex min-h-0 flex-1 flex-col"
          // The schema decides what is acceptable. Leaving the browser's own
          // validation on would swallow the submit first and replace those
          // messages with its generic bubble.
          noValidate
          onSubmit={handleSubmit}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <BookingFormFields
              autoFocus
              errors={errors}
              eventTypes={availableEventTypes}
              extraEventTypeOption={
                canManageEventTypes
                  ? { id: OTHER_EVENT_TYPE_ID, name: "Other" }
                  : undefined
              }
              halls={halls}
              idPrefix="calendar"
              minDate={earliestDate}
              onChange={updateValue}
              onPhoneCountryChange={setPhoneCountry}
              phoneCountry={phoneCountry}
              renderEventTypeExtra={() =>
                values.eventTypeId === OTHER_EVENT_TYPE_ID ? (
                  <div className="mt-2">
                    <input
                      aria-label="Other event type"
                      className="h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-medium outline-none focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15"
                      maxLength={100}
                      onChange={(event) => {
                        resetError();
                        setErrors((current) => ({
                          ...current,
                          eventTypeId: undefined
                        }));
                        setOtherEventTypeName(event.target.value);
                      }}
                      placeholder="Type new event type"
                      value={otherEventTypeName}
                    />
                    <p className="mt-1 text-[10px] font-medium text-[#6a7483]">
                      This type will be saved to Event Type Settings when the
                      booking is saved.
                    </p>
                  </div>
                ) : null
              }
              values={values}
            />

            {bookingMutation.error ? (
              <p
                className="mt-3 inline-flex rounded-full border border-[#efb7b0] bg-[#fff3f1] px-3 py-1 text-xs font-bold text-[#b42318]"
                role="alert"
              >
                {bookingMutation.error}
              </p>
            ) : null}
          </div>

          <footer className="flex shrink-0 justify-end gap-2 border-t border-[#d8dde5] bg-[#fbfcfd] px-4 py-3">
            <button
              className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-4 text-xs font-black hover:bg-[#eef4fa]"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>

            <button
              className="h-9 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={bookingMutation.isPending}
              type="submit"
            >
              {bookingMutation.isPending ? "Saving..." : "Save booking"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
