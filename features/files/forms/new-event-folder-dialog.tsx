"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";

export type NewEventFolderFormValues = {
  clientName: string;
  eventType: string;
  date: string;
  hall: string;
};

type NewEventFolderDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (values: NewEventFolderFormValues) => void;
};

const initialValues: NewEventFolderFormValues = {
  clientName: "",
  eventType: "Wedding",
  date: "",
  hall: "Grand Hall",
};

const controlClass =
  "mt-1 h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 " +
  "text-sm font-medium normal-case tracking-normal text-[#17202a] outline-none " +
  "placeholder:text-[#8a94a3] focus:border-[#1f4d73] " +
  "focus:ring-2 focus:ring-[#1f4d73]/15";

export function NewEventFolderDialog({
  open,
  onClose,
  onCreate,
}: NewEventFolderDialogProps) {
  const titleId = useId();
  const clientNameId = useId();
  const eventTypeId = useId();
  const dateId = useId();
  const hallId = useId();
  const clientInputRef = useRef<HTMLInputElement>(null);
  const [values, setValues] =
    useState<NewEventFolderFormValues>(initialValues);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    clientInputRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  function updateValue(
    field: keyof NewEventFolderFormValues,
    value: string,
  ) {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    setValues(initialValues);
  }

  function closeDialog() {
    resetForm();
    onClose();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    onCreate({
      clientName: values.clientName.trim(),
      eventType: values.eventType.trim(),
      date: values.date,
      hall: values.hall.trim(),
    });

    resetForm();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-[#17202a]/30 p-3 sm:p-5"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          closeDialog();
        }
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-140 overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-2xl shadow-[#17202a]/20"
        role="dialog"
      >
        <header className="flex items-center justify-between gap-4 border-b border-[#d8dde5] px-4 py-3">
          <h2 className="text-base font-black text-[#17202a]" id={titleId}>
            New event folder
          </h2>

          <button
            aria-label="Close new event folder"
            className="flex h-9 w-9 items-center justify-center rounded-full text-3xl leading-none text-[#17202a] transition hover:bg-[#eef4fa]"
            onClick={closeDialog}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-2">
            <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]" htmlFor={clientNameId}>
              Client
              <input
                ref={clientInputRef}
                autoComplete="name"
                className={controlClass}
                id={clientNameId}
                name="clientName"
                onChange={(event) => updateValue("clientName", event.target.value)}
                placeholder="Client name"
                required
                value={values.clientName}
              />
            </label>

            <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]" htmlFor={eventTypeId}>
              Event type
              <input
                className={controlClass}
                id={eventTypeId}
                name="eventType"
                onChange={(event) => updateValue("eventType", event.target.value)}
                placeholder="Wedding"
                required
                value={values.eventType}
              />
            </label>

            <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]" htmlFor={dateId}>
              Date
              <input
                className={controlClass}
                id={dateId}
                name="eventDate"
                onChange={(event) => updateValue("date", event.target.value)}
                required
                type="date"
                value={values.date}
              />
            </label>

            <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]" htmlFor={hallId}>
              Hall
              <input
                className={controlClass}
                id={hallId}
                name="hall"
                onChange={(event) => updateValue("hall", event.target.value)}
                placeholder="Grand Hall"
                required
                value={values.hall}
              />
            </label>

            <p className="rounded-full border border-[#bfd8ed] bg-[#eef7ff] px-3 py-1 text-[10px] font-bold text-[#1f4d73] sm:col-span-2">
              Creates only the folders that normally need files: Invoicing,
              Hall Layout, Footage, Pictures, Videos and Documents.
            </p>
          </div>

          <footer className="flex justify-end gap-2 border-t border-[#d8dde5] bg-[#fbfcfd] px-4 py-3">
            <button
              className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-4 text-xs font-black text-[#17202a] transition hover:bg-[#eef4fa]"
              onClick={closeDialog}
              type="button"
            >
              Cancel
            </button>

            <button
              className="h-9 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white shadow-sm transition hover:bg-[#15344f]"
              type="submit"
            >
              Create event folder
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
