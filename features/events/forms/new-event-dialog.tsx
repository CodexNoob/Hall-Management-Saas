"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { countSchema } from "@/lib/validation/number";
import { readNumericFields } from "@/lib/validation/numeric-form";

type EventCountField = "guests" | "couples" | "children";

export type NewEventFormValues = {
  clientName: string;
  eventType: string;
  status: "Confirmed" | "Hold";
  date: string;
  setupTime: string;
  startTime: string;
  endTime: string;
  cleanupTime: string;
  room: string;
  guests: string;
  couples: string;
  children: string;
  initialNotes: string;
};

type NewEventDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (values: NewEventFormValues) => void;
};

const initialValues: NewEventFormValues = {
  clientName: "New client",
  eventType: "Wedding",
  status: "Hold",
  date: "2026-07-22",
  setupTime: "16:30",
  startTime: "18:30",
  endTime: "22:30",
  cleanupTime: "23:30",
  room: "Grand Hall",
  guests: "180",
  couples: "80",
  children: "20",
  initialNotes: "Booking created from Event Manager."
};

const controlClass =
  "h-10 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm text-[#17202a] outline-none transition focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15";

function FieldLabel({ children }: { children: string }) {
  return (
    <span className="block text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]">
      {children}
    </span>
  );
}

function SaveIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M5 4h12l2 2v14H5Z" />
      <path d="M8 4v6h8V4M8 20v-6h8v6" />
    </svg>
  );
}

export function NewEventDialog({
  open,
  onClose,
  onCreate
}: NewEventDialogProps) {
  const titleId = useId();
  const clientNameId = useId();
  const eventTypeId = useId();
  const statusId = useId();
  const dateId = useId();
  const setupTimeId = useId();
  const startTimeId = useId();
  const endTimeId = useId();
  const cleanupTimeId = useId();
  const roomId = useId();
  const guestsId = useId();
  const couplesId = useId();
  const childrenId = useId();
  const initialNotesId = useId();
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState(initialValues);
  const [countErrors, setCountErrors] = useState<
    Partial<Record<EventCountField, string>>
  >({});

  useEffect(() => {
    if (!open) return;

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
  }, [onClose, open]);

  if (!open) return null;

  const updateValue = (field: keyof NewEventFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setCountErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const counts = readNumericFields<EventCountField>({
      guests: {
        raw: values.guests,
        schema: countSchema({ label: "Guests" }),
        emptyMessage: "Enter a guest count."
      },
      couples: {
        raw: values.couples,
        schema: countSchema({ label: "Couples" }),
        emptyMessage: "Enter a couples count."
      },
      children: {
        raw: values.children,
        schema: countSchema({ label: "Children" }),
        emptyMessage: "Enter a children count."
      }
    });

    if (!counts.ok) {
      setCountErrors(counts.errors);
      return;
    }

    setCountErrors({});
    onCreate(values);
    setValues(initialValues);
  };

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-[#17202a]/30 p-3 sm:p-5"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="max-h-[calc(100dvh-24px)] w-full max-w-4xl overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-2xl shadow-[#17202a]/20"
        role="dialog"
      >
        <header className="flex items-center justify-between gap-4 border-b border-[#d8dde5] px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-light leading-none text-[#17202a]">
              +
            </span>
            <h2 className="text-base font-black text-[#17202a]" id={titleId}>
              New booking
            </h2>
          </div>
          <button
            aria-label="Close new booking"
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

        <form onSubmit={handleSubmit}>
          <div className="max-h-[calc(100dvh-150px)] overflow-y-auto px-4 py-3">
            <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              <label>
                <FieldLabel>Client name</FieldLabel>
                <input
                  autoComplete="name"
                  className={`${controlClass} mt-1`}
                  id={clientNameId}
                  name="clientName"
                  onChange={(event) =>
                    updateValue("clientName", event.target.value)
                  }
                  ref={firstInputRef}
                  required
                  value={values.clientName}
                />
              </label>
              <label>
                <FieldLabel>Event type</FieldLabel>
                <input
                  autoComplete="off"
                  className={`${controlClass} mt-1`}
                  id={eventTypeId}
                  name="eventType"
                  onChange={(event) =>
                    updateValue("eventType", event.target.value)
                  }
                  required
                  value={values.eventType}
                />
              </label>
              <label>
                <FieldLabel>Status</FieldLabel>
                <select
                  className={`${controlClass} mt-1`}
                  id={statusId}
                  name="status"
                  onChange={(event) =>
                    updateValue("status", event.target.value)
                  }
                  value={values.status}
                >
                  <option>Hold</option>
                  <option>Confirmed</option>
                </select>
              </label>
              <label>
                <FieldLabel>Date</FieldLabel>
                <input
                  autoComplete="off"
                  className={`${controlClass} mt-1`}
                  id={dateId}
                  name="eventDate"
                  onChange={(event) => updateValue("date", event.target.value)}
                  required
                  type="date"
                  value={values.date}
                />
              </label>
              <label>
                <FieldLabel>Setup starts</FieldLabel>
                <input
                  autoComplete="off"
                  className={`${controlClass} mt-1`}
                  id={setupTimeId}
                  name="setupTime"
                  onChange={(event) =>
                    updateValue("setupTime", event.target.value)
                  }
                  required
                  type="time"
                  value={values.setupTime}
                />
              </label>
              <label>
                <FieldLabel>Event starts</FieldLabel>
                <input
                  className={`${controlClass} mt-1`}
                  id={startTimeId}
                  name="startTime"
                  onChange={(event) =>
                    updateValue("startTime", event.target.value)
                  }
                  required
                  type="time"
                  value={values.startTime}
                />
              </label>
              <label>
                <FieldLabel>Event ends</FieldLabel>
                <input
                  className={`${controlClass} mt-1`}
                  id={endTimeId}
                  name="endTime"
                  onChange={(event) =>
                    updateValue("endTime", event.target.value)
                  }
                  required
                  type="time"
                  value={values.endTime}
                />
              </label>
              <label>
                <FieldLabel>Cleanup ends</FieldLabel>
                <input
                  className={`${controlClass} mt-1`}
                  id={cleanupTimeId}
                  name="cleanupTime"
                  onChange={(event) =>
                    updateValue("cleanupTime", event.target.value)
                  }
                  required
                  type="time"
                  value={values.cleanupTime}
                />
              </label>
              <label>
                <FieldLabel>Hall / room</FieldLabel>
                <select
                  className={`${controlClass} mt-1`}
                  id={roomId}
                  name="hall"
                  onChange={(event) => updateValue("room", event.target.value)}
                  value={values.room}
                >
                  <option>Grand Hall</option>
                  <option>Nachlas Yehuda A</option>
                  <option>Nachlas Yehuda B</option>
                  <option>Terrace Room</option>
                  <option>Small Hall</option>
                </select>
              </label>
              <label>
                <FieldLabel>Guests</FieldLabel>
                <input
                  aria-describedby={
                    countErrors.guests ? `${guestsId}-error` : undefined
                  }
                  aria-invalid={countErrors.guests ? true : undefined}
                  className={`${controlClass} mt-1`}
                  id={guestsId}
                  inputMode="decimal"
                  name="guests"
                  onChange={(event) =>
                    updateValue("guests", event.target.value)
                  }
                  required
                  type="text"
                  value={values.guests}
                />
                {countErrors.guests ? (
                  <p
                    className="mt-1 text-[10px] font-bold text-[#c2410c]"
                    id={`${guestsId}-error`}
                    role="alert"
                  >
                    {countErrors.guests}
                  </p>
                ) : null}
              </label>
              <label>
                <FieldLabel>Couples</FieldLabel>
                <input
                  aria-describedby={
                    countErrors.couples ? `${couplesId}-error` : undefined
                  }
                  aria-invalid={countErrors.couples ? true : undefined}
                  className={`${controlClass} mt-1`}
                  id={couplesId}
                  inputMode="decimal"
                  name="couples"
                  onChange={(event) =>
                    updateValue("couples", event.target.value)
                  }
                  required
                  type="text"
                  value={values.couples}
                />
                {countErrors.couples ? (
                  <p
                    className="mt-1 text-[10px] font-bold text-[#c2410c]"
                    id={`${couplesId}-error`}
                    role="alert"
                  >
                    {countErrors.couples}
                  </p>
                ) : null}
              </label>
              <label>
                <FieldLabel>Children</FieldLabel>
                <input
                  aria-describedby={
                    countErrors.children ? `${childrenId}-error` : undefined
                  }
                  aria-invalid={countErrors.children ? true : undefined}
                  className={`${controlClass} mt-1`}
                  id={childrenId}
                  inputMode="decimal"
                  name="children"
                  onChange={(event) =>
                    updateValue("children", event.target.value)
                  }
                  required
                  type="text"
                  value={values.children}
                />
                {countErrors.children ? (
                  <p
                    className="mt-1 text-[10px] font-bold text-[#c2410c]"
                    id={`${childrenId}-error`}
                    role="alert"
                  >
                    {countErrors.children}
                  </p>
                ) : null}
              </label>
            </div>

            <label className="mt-2 block">
              <FieldLabel>Initial notes</FieldLabel>
              <textarea
                className="mt-1 min-h-20 w-full resize-y rounded-lg border border-[#b9c2cf] bg-white px-3 py-2 text-sm text-[#17202a] outline-none transition focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15"
                id={initialNotesId}
                name="initialNotes"
                onChange={(event) =>
                  updateValue("initialNotes", event.target.value)
                }
                value={values.initialNotes}
              />
            </label>
          </div>

          <footer className="flex justify-end gap-2 border-t border-[#d8dde5] bg-[#fbfcfd] px-4 py-3">
            <button
              className="h-10 rounded-lg border border-[#b9c2cf] bg-white px-4 text-sm font-black text-[#17202a] hover:bg-[#eef4fa]"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1f4d73] px-4 text-sm font-black text-white shadow-sm hover:bg-[#15344f]"
              type="submit"
            >
              <SaveIcon />
              Create booking
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
