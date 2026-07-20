"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";

export type AddKitchenEventFormValues = {
  eventName: string;
  portions: string;
  kitchenNote: string;
};

type AddKitchenEventDialogProps = {
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
  "h-10 w-full border border-[#b9c2cf] bg-white px-3 text-sm text-[#17202a] outline-none placeholder:text-[#737373] focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15";

function FieldLabel({ children }: { children: string }) {
  return (
    <span className="block text-xs font-black uppercase tracking-[0.04em] text-[#53627a]">
      {children}
    </span>
  );
}

export function AddKitchenEventDialog({
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
    onClose();
  }

  function updateValue(
    field: keyof AddKitchenEventFormValues,
    value: string
  ) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedValues = {
      eventName: values.eventName.trim(),
      portions: values.portions.trim(),
      kitchenNote: values.kitchenNote.trim()
    };

    if (!normalizedValues.eventName || !normalizedValues.portions) return;

    onSave(normalizedValues);
    closeDialog();
  }

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-[#17202a]/40 p-3 sm:p-5"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) closeDialog();
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-[650px] overflow-hidden border border-[#cbd5df] bg-white shadow-2xl shadow-[#17202a]/25"
        role="dialog"
      >
        <header className="flex items-center justify-between gap-4 border-b border-[#d8dde5] px-4 py-2">
          <h2 className="text-lg font-black text-[#17202a]" id={titleId}>
            Add Kitchen Event
          </h2>

          <button
            className="h-11 border border-[#d8dde5] bg-white px-5 text-sm font-black text-black hover:bg-[#f6f8fa]"
            onClick={closeDialog}
            type="button"
          >
            Close
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="px-4 py-5">
            <p className="mb-1 text-xs font-black text-[#53627a]">{date}</p>

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

              <label htmlFor={portionsId}>
                <FieldLabel>Portions</FieldLabel>
                <input
                  className={inputClass}
                  id={portionsId}
                  inputMode="numeric"
                  min="1"
                  name="portions"
                  onChange={(event) =>
                    updateValue("portions", event.target.value)
                  }
                  placeholder="e.g. 80"
                  required
                  type="number"
                  value={values.portions}
                />
              </label>
            </div>

            <label className="mt-3 block" htmlFor={kitchenNoteId}>
              <FieldLabel>Kitchen note</FieldLabel>
              <textarea
                className="h-19 w-full resize-y border border-[#b9c2cf] bg-white px-3 py-2 text-sm text-[#17202a] outline-none focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15"
                id={kitchenNoteId}
                name="kitchenNote"
                onChange={(event) =>
                  updateValue("kitchenNote", event.target.value)
                }
                value={values.kitchenNote}
              />
            </label>
          </div>

          <footer className="flex justify-end gap-3 border-t border-[#d8dde5] bg-[#fbfcfd] px-4 py-3">
            <button
              className="h-11 border border-[#d8dde5] bg-white px-5 text-sm font-black text-black hover:bg-[#eef4fa]"
              onClick={closeDialog}
              type="button"
            >
              Cancel
            </button>

            <button
              className="h-11 bg-[#07162d] px-5 text-sm font-black text-white hover:bg-[#142946]"
              type="submit"
            >
              Save Event
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
