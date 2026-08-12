"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useAuthenticatedMutation } from "@/features/dashboard/hooks/use-authenticated-mutation";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { useDashboardAccess } from "@/features/dashboard/hooks/use-dashboard-permission";

export type NewBookingFormValues = {
  clientName: string;
  phone: string;
  email: string;
  eventType: string;
  eventDate: string;
  hall: string;
  guestCount: string;
  eventPackage: string;
};

export type NewBookingSubmitIntent = "save" | "proposal";

type NewBookingDialogProps = {
  open: boolean;
  onClose: () => void;
  onSubmit?: (
    values: NewBookingFormValues,
    intent: NewBookingSubmitIntent
  ) => void | Promise<void>;
};

type LookupOption = {
  id: string;
  name: string;
};

type EventsLookupResponse = {
  halls: LookupOption[];
  eventTypes: LookupOption[];
  packages: LookupOption[];
};

type BookingPayload = {
  clientName: string;
  phone: string;
  email?: string;
  eventDate: string;
  hallId: string;
  eventTypeId?: string;
  packageId?: string;
  bookingStatus: "TENTATIVE_HOLD" | "CONFIRMED";
  eventStatus: "Hold" | "Confirmed";
  couplesCount: number;
  idempotencyKey: string;
};

const initialValues: NewBookingFormValues = {
  clientName: "",
  phone: "",
  email: "",
  eventType: "",
  eventDate: "",
  hall: "",
  guestCount: "",
  eventPackage: ""
};

const steps = ["Client", "Event", "Availability", "Proposal", "Confirm"];

const controlClass =
  "h-10 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm text-[#17202a] outline-none transition focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15";

function hallReady(data: EventsLookupResponse | null) {
  return Boolean(data?.halls.length);
}

function FieldLabel({
  children,
  htmlFor
}: {
  children: string;
  htmlFor: string;
}) {
  return (
    <label
      className="mb-1.5 block text-xs font-black text-[#59677c]"
      htmlFor={htmlFor}
    >
      {children}
    </label>
  );
}

export function NewBookingDialog({
  open,
  onClose,
  onSubmit
}: NewBookingDialogProps) {
  const titleId = useId();
  const firstInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const { hasPermission } = useDashboardAccess();
  const canCreateBooking = hasPermission("canCreateBooking");
  const [values, setValues] = useState(initialValues);
  const eventsQuery = useAuthenticatedQuery<EventsLookupResponse>(
    "/api/events",
    open
  );
  const bookingMutation = useAuthenticatedMutation<
    BookingPayload,
    { event: { id: string } }
  >("/api/events");
  const { resetError } = bookingMutation;
  const halls = eventsQuery.data?.halls ?? [];
  const eventTypes = eventsQuery.data?.eventTypes ?? [];
  const packages = eventsQuery.data?.packages ?? [];

  useEffect(() => {
    if (!open) return;

    setValues(initialValues);
    resetError();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstInputRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open, resetError]);

  useEffect(() => {
    const firstHallName = eventsQuery.data?.halls[0]?.name;
    if (!open || !firstHallName) return;

    setValues((current) => {
      if (current.hall) return current;

      return {
        ...current,
        hall: firstHallName
      };
    });
  }, [eventsQuery.data, open]);

  if (!open) return null;

  const updateValue = (field: keyof NewBookingFormValues, value: string) => {
    resetError();
    setValues((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const intent =
      submitter instanceof HTMLButtonElement && submitter.value === "proposal"
        ? "proposal"
        : "save";
    const hall = halls.find((option) => option.name === values.hall);
    const eventType = eventTypes.find(
      (option) => option.name === values.eventType
    );
    const eventPackage = packages.find(
      (option) => option.name === values.eventPackage
    );

    if (!hall) {
      return;
    }

    try {
      await bookingMutation.mutate({
        clientName: values.clientName.trim(),
        phone: values.phone.trim(),
        email: values.email.trim() || undefined,
        eventDate: values.eventDate,
        hallId: hall.id,
        eventTypeId: eventType?.id,
        packageId: eventPackage?.id,
        bookingStatus: intent === "proposal" ? "TENTATIVE_HOLD" : "CONFIRMED",
        eventStatus: intent === "proposal" ? "Hold" : "Confirmed",
        couplesCount: Number(values.guestCount) || 0,
        idempotencyKey: crypto.randomUUID()
      });
      await onSubmit?.(values, intent);
      onClose();
    } catch {
      // The mutation error is rendered inside the form.
    }
  };

  const formattedDate = values.eventDate
    ? new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric"
      }).format(new Date(`${values.eventDate}T00:00:00`))
    : "the selected date";
  const displayedEventDate = values.eventDate
    ? new Intl.DateTimeFormat("en-US", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      }).format(new Date(`${values.eventDate}T00:00:00`))
    : "";

  const openDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) return;

    input.focus();
    input.showPicker?.();
  };

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-[#17202a]/25 p-3 backdrop-blur-[1px] sm:p-6"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="flex max-h-[calc(100dvh-24px)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-2xl shadow-[#17202a]/20 sm:max-h-[calc(100dvh-48px)]"
        role="dialog"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#d8dde5] px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-[#17202a]" id={titleId}>
              New booking
            </h2>
            <p className="mt-1 text-sm text-[#64748b]">
              Create a client, check availability, prepare proposal, and confirm
              the event.
            </p>
          </div>
          <button
            aria-label="Close new booking"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-4xl leading-none text-[#17202a] hover:bg-[#eef4fa]"
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

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
            <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {steps.map((step, index) => (
                <li
                  className={`rounded-lg border px-3 py-2 text-xs font-black ${
                    index === 0
                      ? "border-[#1f5f91] bg-[#eef4fa] text-[#173b58]"
                      : "border-[#d8dde5] bg-[#fbfcfd] text-[#64748b]"
                  }`}
                  key={step}
                >
                  {index + 1}. {step}
                </li>
              ))}
            </ol>

            <div className="mt-4 grid gap-x-4 gap-y-3 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="booking-client-name">
                  Client name
                </FieldLabel>
                <input
                  className={controlClass}
                  id="booking-client-name"
                  name="clientName"
                  onChange={(event) =>
                    updateValue("clientName", event.target.value)
                  }
                  ref={firstInputRef}
                  required
                  value={values.clientName}
                />
              </div>
              <div>
                <FieldLabel htmlFor="booking-phone">Phone</FieldLabel>
                <input
                  className={controlClass}
                  id="booking-phone"
                  name="phone"
                  onChange={(event) => updateValue("phone", event.target.value)}
                  required
                  type="tel"
                  value={values.phone}
                />
              </div>
              <div>
                <FieldLabel htmlFor="booking-email">Email</FieldLabel>
                <input
                  className={controlClass}
                  id="booking-email"
                  name="email"
                  onChange={(event) => updateValue("email", event.target.value)}
                  type="email"
                  value={values.email}
                />
              </div>
              <div>
                <FieldLabel htmlFor="booking-event-type">Event type</FieldLabel>
                <select
                  className={controlClass}
                  disabled={eventsQuery.isLoading || eventTypes.length === 0}
                  id="booking-event-type"
                  name="eventType"
                  required
                  onChange={(event) =>
                    updateValue("eventType", event.target.value)
                  }
                  value={values.eventType}
                >
                  <option disabled value="">
                    Select event type
                  </option>
                  {!eventTypes.length ? (
                    <option value="">No event types configured</option>
                  ) : null}
                  {eventTypes.map((eventType) => (
                    <option key={eventType.id} value={eventType.name}>
                      {eventType.name}
                    </option>
                  ))}
                </select>
                {!eventsQuery.isLoading && eventTypes.length === 0 ? (
                  <p className="mt-1.5 text-xs font-semibold text-[#b26a00]">
                    Add an event type in{" "}
                    <a
                      className="font-black text-[#1f4d73] underline"
                      href="/dashboard/settings"
                    >
                      Settings
                    </a>{" "}
                    before creating a booking.
                  </p>
                ) : null}
              </div>
              <div>
                <FieldLabel htmlFor="booking-date">Date</FieldLabel>
                <div className="relative">
                  <button
                    aria-label="Open booking date calendar"
                    className={`${controlClass} flex items-center justify-between pr-10 text-left`}
                    onClick={openDatePicker}
                    type="button"
                  >
                    <span
                      className={
                        displayedEventDate ? "text-[#17202a]" : "text-[#64748b]"
                      }
                    >
                      {displayedEventDate || "mm/dd/yyyy"}
                    </span>
                  </button>
                  <input
                    className="absolute right-0 top-0 h-10 w-10 cursor-pointer opacity-0"
                    id="booking-date"
                    min={new Date().toISOString().slice(0, 10)}
                    name="eventDate"
                    onChange={(event) =>
                      updateValue("eventDate", event.target.value)
                    }
                    ref={dateInputRef}
                    required
                    tabIndex={-1}
                    type="date"
                    value={values.eventDate}
                  />
                  <svg
                    aria-hidden="true"
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#17202a]"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 2v4M16 2v4" />
                    <rect height="18" rx="2" width="18" x="3" y="4" />
                    <path d="M3 10h18" />
                  </svg>
                </div>
              </div>
              <div>
                <FieldLabel htmlFor="booking-hall">Hall / room</FieldLabel>
                <select
                  className={controlClass}
                  disabled={eventsQuery.isLoading || halls.length === 0}
                  id="booking-hall"
                  name="hall"
                  onChange={(event) => updateValue("hall", event.target.value)}
                  value={values.hall}
                >
                  {halls.map((hall) => (
                    <option key={hall.id}>{hall.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel htmlFor="booking-guests">
                  Guests / couples
                </FieldLabel>
                <input
                  className={controlClass}
                  id="booking-guests"
                  min="1"
                  name="guestCount"
                  onChange={(event) =>
                    updateValue("guestCount", event.target.value)
                  }
                  placeholder="180"
                  required
                  type="number"
                  value={values.guestCount}
                />
              </div>
              <div>
                <FieldLabel htmlFor="booking-package">Package</FieldLabel>
                <select
                  className={controlClass}
                  disabled={eventsQuery.isLoading || packages.length === 0}
                  id="booking-package"
                  name="eventPackage"
                  onChange={(event) =>
                    updateValue("eventPackage", event.target.value)
                  }
                  value={values.eventPackage}
                >
                  <option value="">No package</option>
                  {packages.map((eventPackage) => (
                    <option key={eventPackage.id}>{eventPackage.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <p className="mt-4 rounded-lg border border-[#c9dced] bg-[#f2f7fb] px-3 py-3 text-xs leading-5 text-[#315573]">
              <strong>Availability check:</strong> {values.hall} will be checked
              for {formattedDate} before the booking is confirmed.
            </p>
            <p className="mt-2 rounded-lg border border-[#f3c679] bg-[#fff9ef] px-3 py-3 text-xs leading-5 text-[#80500c]">
              <strong>Workflow:</strong> Saving continues to the event workflow,
              where availability, pricing, proposal, and retainer details are
              finalized.
            </p>
            {!canCreateBooking ? (
              <p className="mt-2 rounded-lg border border-[#f3c679] bg-[#fff9ef] px-3 py-3 text-xs font-bold text-[#80500c]">
                You do not have permission to create bookings. Contact an
                administrator if you need access.
              </p>
            ) : null}
            {eventsQuery.error || bookingMutation.error ? (
              <p className="mt-2 rounded-lg border border-[#efb5ad] bg-[#fff4f2] px-3 py-3 text-xs font-bold text-[#a92217]">
                {eventsQuery.error ?? bookingMutation.error}
              </p>
            ) : null}
          </div>

          <footer className="grid shrink-0 grid-cols-2 gap-2 border-t border-[#d8dde5] bg-[#fbfcfd] px-4 py-3 sm:flex sm:flex-wrap sm:justify-end sm:px-5">
            <button
              className="h-10 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-black text-[#17202a] hover:bg-[#eef4fa] sm:w-auto sm:px-4"
              disabled={bookingMutation.isPending}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="h-10 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-black text-[#17202a] hover:bg-[#eef4fa] sm:w-auto sm:px-4"
              disabled={
                !canCreateBooking ||
                bookingMutation.isPending ||
                !hallReady(eventsQuery.data) ||
                eventTypes.length === 0 ||
                !values.eventType
              }
              type="submit"
              value="proposal"
            >
              Create proposal
            </button>
            <button
              className="col-span-2 h-10 w-full rounded-lg bg-[#1f4d73] px-4 text-sm font-black text-white shadow-sm hover:bg-[#15344f] sm:w-auto"
              disabled={
                !canCreateBooking ||
                bookingMutation.isPending ||
                !hallReady(eventsQuery.data) ||
                eventTypes.length === 0 ||
                !values.eventType
              }
              type="submit"
              value="save"
            >
              {bookingMutation.isPending ? "Saving..." : "Save booking"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
