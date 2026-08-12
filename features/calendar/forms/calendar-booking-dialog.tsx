"use client";

import {
  useEffect,
  useId,
  useState,
  type FormEvent
} from "react";

import { useAuthenticatedMutation } from "@/features/dashboard/hooks/use-authenticated-mutation";

type LookupOption = {
  id: string;
  name: string;
};

type BookingFormValues = {
  clientName: string;
  phone: string;
  eventDate: string;
  hallId: string;
  eventTypeId: string;
  status: "Hold" | "Confirmed";
  couples: string;
  children: string;
  notes: string;
};

type BookingPayload = {
  clientName: string;
  phone: string;
  eventDate: string;
  hallId: string;
  eventTypeId?: string;
  bookingStatus: "TENTATIVE_HOLD" | "CONFIRMED";
  eventStatus: "Hold" | "Confirmed";
  couplesCount: number;
  kidsCount: number;
  notes?: string;
  idempotencyKey: string;
};

type CalendarBookingDialogProps = {
  open: boolean;
  selectedDate: string;
  halls: LookupOption[];
  eventTypes: LookupOption[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

const controlClass =
  "h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 " +
  "text-sm text-[#17202a] outline-none transition " +
  "focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15";

const initialValues: BookingFormValues = {
  clientName: "",
  phone: "",
  eventDate: "",
  hallId: "",
  eventTypeId: "",
  status: "Hold",
  couples: "0",
  children: "0",
  notes: ""
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
  onSaved
}: CalendarBookingDialogProps) {
  const titleId = useId();

  const bookingMutation = useAuthenticatedMutation<
    BookingPayload,
    { event: { id: string } }
  >("/api/events");
  const { resetError } = bookingMutation;

  const [values, setValues] =
    useState<BookingFormValues>(initialValues);

  useEffect(() => {
    if (!open) return;

    setValues({
      ...initialValues,
      eventDate: selectedDate,
      hallId: halls[0]?.id ?? "",
      eventTypeId: eventTypes[0]?.id ?? ""
    });

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
  // browser blocks the submit with no explanation. Existing input is kept.
  useEffect(() => {
    if (!open || !halls.length) return;

    setValues((current) =>
      current.hallId ? current : { ...current, hallId: halls[0].id }
    );
  }, [halls, open]);

  if (!open) return null;

  const updateValue = (
    field: keyof BookingFormValues,
    value: string
  ) => {
    resetError();

    setValues((current) => ({
      ...current,
      [field]: value
    }));
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const bookingStatuses = {
      Hold: "TENTATIVE_HOLD",
      Confirmed: "CONFIRMED"
    } as const;

    try {
      await bookingMutation.mutate({
        clientName: values.clientName.trim(),
        phone: values.phone.trim(),
        eventDate: values.eventDate,
        hallId: values.hallId,
        eventTypeId: values.eventTypeId || undefined,
        bookingStatus: bookingStatuses[values.status],
        eventStatus: values.status,
        couplesCount: Number(values.couples) || 0,
        kidsCount: Number(values.children) || 0,
        notes: values.notes.trim() || undefined,
        idempotencyKey: crypto.randomUUID()
      });

      await onSaved();
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

            <h2
              className="text-base font-black text-[#17202a]"
              id={titleId}
            >
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
          onSubmit={handleSubmit}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="calendar-client-name">
                  Client name
                </FieldLabel>

                <input
                  autoFocus
                  className={controlClass}
                  id="calendar-client-name"
                  onChange={(event) =>
                    updateValue("clientName", event.target.value)
                  }
                  placeholder="Client name"
                  required
                  value={values.clientName}
                />
              </div>

              <div>
                <FieldLabel htmlFor="calendar-phone">
                  Phone
                </FieldLabel>

                <input
                  className={controlClass}
                  id="calendar-phone"
                  onChange={(event) =>
                    updateValue("phone", event.target.value)
                  }
                  placeholder="Phone number"
                  required
                  type="tel"
                  value={values.phone}
                />
              </div>

              <div>
                <FieldLabel htmlFor="calendar-date">
                  Date
                </FieldLabel>

                <input
                  className={controlClass}
                  id="calendar-date"
                  onChange={(event) =>
                    updateValue("eventDate", event.target.value)
                  }
                  required
                  type="date"
                  value={values.eventDate}
                />
              </div>

              <div>
                <FieldLabel htmlFor="calendar-hall">
                  Hall / room
                </FieldLabel>

                <select
                  className={controlClass}
                  id="calendar-hall"
                  onChange={(event) =>
                    updateValue("hallId", event.target.value)
                  }
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
              </div>

              <div>
                <FieldLabel htmlFor="calendar-event-type">
                  Event type
                </FieldLabel>

                <select
                  className={controlClass}
                  id="calendar-event-type"
                  onChange={(event) =>
                    updateValue("eventTypeId", event.target.value)
                  }
                  value={values.eventTypeId}
                >
                  <option value="">Not assigned</option>

                  {eventTypes.map((eventType) => (
                    <option
                      key={eventType.id}
                      value={eventType.id}
                    >
                      {eventType.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel htmlFor="calendar-status">
                  Status
                </FieldLabel>

                <select
                  className={controlClass}
                  id="calendar-status"
                  onChange={(event) =>
                    updateValue("status", event.target.value)
                  }
                  value={values.status}
                >
                  <option>Hold</option>
                  <option>Confirmed</option>
                </select>
              </div>

              <div>
                <FieldLabel htmlFor="calendar-couples">
                  Couples
                </FieldLabel>

                <input
                  className={controlClass}
                  id="calendar-couples"
                  min="0"
                  onChange={(event) =>
                    updateValue("couples", event.target.value)
                  }
                  type="number"
                  value={values.couples}
                />
              </div>

              <div>
                <FieldLabel htmlFor="calendar-children">
                  Children
                </FieldLabel>

                <input
                  className={controlClass}
                  id="calendar-children"
                  min="0"
                  onChange={(event) =>
                    updateValue("children", event.target.value)
                  }
                  type="number"
                  value={values.children}
                />
              </div>

            </div>

            <div className="mt-2">
              <FieldLabel htmlFor="calendar-notes">
                Notes
              </FieldLabel>

              <textarea
                className="min-h-13 w-full resize-y rounded-lg border border-[#b9c2cf] bg-white px-3 py-2 text-sm outline-none focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15"
                id="calendar-notes"
                onChange={(event) =>
                  updateValue("notes", event.target.value)
                }
                placeholder="Internal notes"
                value={values.notes}
              />
            </div>

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
              {bookingMutation.isPending
                ? "Saving..."
                : "Save booking"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
