"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";

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
  onSubmit: (values: NewBookingFormValues, intent: NewBookingSubmitIntent) => void;
};

const initialValues: NewBookingFormValues = {
  clientName: "",
  phone: "",
  email: "",
  eventType: "Wedding",
  eventDate: "",
  hall: "Grand Hall",
  guestCount: "",
  eventPackage: "Standard fleishig",
};

const steps = ["Client", "Event", "Availability", "Proposal", "Confirm"];
const eventTypes = ["Wedding", "Bar Mitzvah", "Sheva Brachos", "Lchaim", "School event"];
const halls = ["Grand Hall", "Nachlas Yehuda A", "Nachlas Yehuda B", "Terrace Room", "Small Hall"];
const packages = ["Standard fleishig", "Premium fleishig", "Milchig brunch", "School lunch"];

const controlClass =
  "h-10 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm text-[#17202a] outline-none transition focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15";

function FieldLabel({ children, htmlFor }: { children: string; htmlFor: string }) {
  return (
    <label className="mb-1.5 block text-xs font-black text-[#59677c]" htmlFor={htmlFor}>
      {children}
    </label>
  );
}

export function NewBookingDialog({ open, onClose, onSubmit }: NewBookingDialogProps) {
  const titleId = useId();
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState(initialValues);

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

  const updateValue = (field: keyof NewBookingFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const intent = submitter instanceof HTMLButtonElement && submitter.value === "proposal" ? "proposal" : "save";
    onSubmit(values, intent);
  };

  const formattedDate = values.eventDate
    ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(
        new Date(`${values.eventDate}T00:00:00`),
      )
    : "the selected date";

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
            <h2 className="text-lg font-black text-[#17202a]" id={titleId}>New booking</h2>
            <p className="mt-1 text-sm text-[#64748b]">Create a client, check availability, prepare proposal, and confirm the event.</p>
          </div>
          <button
            className="h-8 shrink-0 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black text-[#17202a] hover:bg-[#eef4fa]"
            onClick={onClose}
            type="button"
          >
            Close
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
                <FieldLabel htmlFor="booking-client-name">Client name</FieldLabel>
                <input
                  className={controlClass}
                  id="booking-client-name"
                  name="clientName"
                  onChange={(event) => updateValue("clientName", event.target.value)}
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
                  id="booking-event-type"
                  name="eventType"
                  onChange={(event) => updateValue("eventType", event.target.value)}
                  value={values.eventType}
                >
                  {eventTypes.map((eventType) => <option key={eventType}>{eventType}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel htmlFor="booking-date">Date</FieldLabel>
                <input
                  className={controlClass}
                  id="booking-date"
                  min={new Date().toISOString().slice(0, 10)}
                  name="eventDate"
                  onChange={(event) => updateValue("eventDate", event.target.value)}
                  required
                  type="date"
                  value={values.eventDate}
                />
              </div>
              <div>
                <FieldLabel htmlFor="booking-hall">Hall / room</FieldLabel>
                <select
                  className={controlClass}
                  id="booking-hall"
                  name="hall"
                  onChange={(event) => updateValue("hall", event.target.value)}
                  value={values.hall}
                >
                  {halls.map((hall) => <option key={hall}>{hall}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel htmlFor="booking-guests">Guests / couples</FieldLabel>
                <input
                  className={controlClass}
                  id="booking-guests"
                  min="1"
                  name="guestCount"
                  onChange={(event) => updateValue("guestCount", event.target.value)}
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
                  id="booking-package"
                  name="eventPackage"
                  onChange={(event) => updateValue("eventPackage", event.target.value)}
                  value={values.eventPackage}
                >
                  {packages.map((eventPackage) => <option key={eventPackage}>{eventPackage}</option>)}
                </select>
              </div>
            </div>

            <p className="mt-4 rounded-lg border border-[#c9dced] bg-[#f2f7fb] px-3 py-3 text-xs leading-5 text-[#315573]">
              <strong>Availability check:</strong> {values.hall} will be checked for {formattedDate} before the booking is confirmed.
            </p>
            <p className="mt-2 rounded-lg border border-[#f3c679] bg-[#fff9ef] px-3 py-3 text-xs leading-5 text-[#80500c]">
              <strong>Workflow:</strong> Saving continues to the event workflow, where availability, pricing, proposal, and retainer details are finalized.
            </p>
          </div>

          <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-[#d8dde5] bg-[#fbfcfd] px-5 py-3">
            <button className="h-10 rounded-lg border border-[#b9c2cf] bg-white px-4 text-sm font-black text-[#17202a] hover:bg-[#eef4fa]" onClick={onClose} type="button">
              Cancel
            </button>
            <button
              className="h-10 rounded-lg border border-[#b9c2cf] bg-white px-4 text-sm font-black text-[#17202a] hover:bg-[#eef4fa]"
              type="submit"
              value="proposal"
            >
              Create proposal
            </button>
            <button
              className="h-10 rounded-lg bg-[#1f4d73] px-4 text-sm font-black text-white shadow-sm hover:bg-[#15344f]"
              type="submit"
              value="save"
            >
              Save booking
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
