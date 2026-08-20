"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { countSchema, parseNumericInput } from "@/lib/validation/number";

export type AddKitchenEventFormValues = {
  eventName: string;
  portions: string;
  kitchenNote: string;
};

type AddKitchenEventDialogProps = {
  canSave: boolean;
  date: string;
  open: boolean;
  onClose: () => void;
  onSave: (values: AddKitchenEventFormValues) => void;
};

const initialValues: AddKitchenEventFormValues = {
  eventName: "",
  portions: "",
  kitchenNote: ""
};

const inputClass =
  "h-10 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm text-[#17202a] outline-none placeholder:text-[#737373] focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15";

function FieldLabel({ children }: { children: string }) {
  return (
    <span className="block text-xs font-black uppercase tracking-[0.04em] text-[#53627a]">
      {children}
    </span>
  );
}

export function AddKitchenEventDialog({
  canSave,
  date,
  open,
  onClose,
  onSave
}: AddKitchenEventDialogProps) {
  const titleId = useId();
  const eventNameId = useId();
  const portionsId = useId();
  const kitchenNoteId = useId();
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState(initialValues);
  const [portionsError, setPortionsError] = useState("");

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstInputRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  function closeDialog() {
    setValues(initialValues);
    setPortionsError("");
    onClose();
  }

  function updateValue(
    field: keyof AddKitchenEventFormValues,
    value: string
  ) {
    if (field === "portions") setPortionsError("");
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedValues = {
      eventName: values.eventName.trim(),
      portions: values.portions.trim(),
      kitchenNote: values.kitchenNote.trim()
    };

    if (!canSave || !normalizedValues.eventName) return;

    // The saved value is rendered straight back as "<portions> portions", so an
    // unparseable entry would show up on the kitchen board as "abc portions".
    const parsedPortions = parseNumericInput(
      normalizedValues.portions,
      countSchema({ min: 1, label: "Portions" })
    );

    if (parsedPortions.status !== "valid") {
      setPortionsError(
        parsedPortions.status === "invalid"
          ? parsedPortions.message
          : "Enter a portion count."
      );
      return;
    }

    setPortionsError("");
    onSave(normalizedValues);
    closeDialog();
  }

  return (
    <div
      className="dashboard-drawer-backdrop fixed inset-0 z-100 flex items-center justify-center bg-[#17202a]/25 p-3 backdrop-blur-[1px] sm:p-6"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) closeDialog();
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-[650px] overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-2xl shadow-[#17202a]/20"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#d8dde5] px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-[#17202a]" id={titleId}>
              Add kitchen event
            </h2>
            <p className="mt-1 text-sm text-[#64748b]">
              Production with no booking behind it - a staff meal, a school
              lunch.
            </p>
          </div>

          <button
            aria-label="Close add kitchen event"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full leading-none text-[#17202a] hover:bg-[#eef4fa]"
            onClick={closeDialog}
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
          <div className="px-5 py-5">
            <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#d8dde5] bg-[#fbfcfd] px-2.5 py-1 text-xs font-black text-[#516071]">
              <span className="sr-only">Date</span>
              {date}
            </p>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
              <label htmlFor={eventNameId}>
                <FieldLabel>Event name</FieldLabel>
                <input
                  ref={firstInputRef}
                  autoComplete="off"
                  className={inputClass}
                  id={eventNameId}
                  name="eventName"
                  onChange={(event) =>
                    updateValue("eventName", event.target.value)
                  }
                  placeholder="e.g. School Lunch, Staff Meal"
                  required
                  value={values.eventName}
                />
              </label>

              {/* Not a wrapping label like the field beside it: the error text
                  would be folded into the input's accessible name. */}
              <div>
                <label htmlFor={portionsId}>
                  <FieldLabel>Portions</FieldLabel>
                </label>
                <input
                  aria-describedby={
                    portionsError ? `${portionsId}-error` : undefined
                  }
                  aria-invalid={portionsError ? true : undefined}
                  className={inputClass}
                  id={portionsId}
                  inputMode="decimal"
                  name="portions"
                  onChange={(event) =>
                    updateValue("portions", event.target.value)
                  }
                  placeholder="e.g. 80"
                  required
                  type="text"
                  value={values.portions}
                />
                {portionsError ? (
                  <p
                    className="mt-1 text-[10px] font-bold text-[#c2410c]"
                    id={`${portionsId}-error`}
                    role="alert"
                  >
                    {portionsError}
                  </p>
                ) : null}
              </div>
            </div>

            <label className="mt-3 block" htmlFor={kitchenNoteId}>
              <FieldLabel>Kitchen note</FieldLabel>
              <textarea
                className="h-19 w-full resize-y rounded-lg border border-[#b9c2cf] bg-white px-3 py-2 text-sm text-[#17202a] outline-none focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15"
                id={kitchenNoteId}
                name="kitchenNote"
                onChange={(event) =>
                  updateValue("kitchenNote", event.target.value)
                }
                value={values.kitchenNote}
              />
            </label>

            {!canSave ? (
              <p className="mt-3 rounded-lg border border-[#f3c679] bg-[#fff9ef] px-3 py-3 text-xs font-bold text-[#80500c]">
                You do not have permission to add kitchen events. Contact an
                administrator if you need access.
              </p>
            ) : null}
          </div>

          <footer className="flex justify-end gap-3 border-t border-[#d8dde5] bg-[#fbfcfd] px-5 py-3">
            <button
              className="h-10 rounded-lg border border-[#b9c2cf] bg-white px-4 text-sm font-black text-[#17202a] hover:bg-[#eef4fa]"
              onClick={closeDialog}
              type="button"
            >
              Cancel
            </button>

            <button
              className="h-10 rounded-lg bg-[#1f4d73] px-4 text-sm font-black text-white shadow-sm enabled:hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={!canSave}
              type="submit"
            >
              Save event
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
