"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";

export type NewInvoiceFormValues = {
  event: string;
  status: string;
  firstItem: string;
  amount: string;
};

type NewInvoiceDialogProps = {
  open: boolean;
  onClose: () => void;
  onSave: (values: NewInvoiceFormValues) => void;
};

const initialValues: NewInvoiceFormValues = {
  event: "Friedman - Wedding",
  status: "Draft",
  firstItem: "Event package",
  amount: "1000",
};

const controlClass =
  "h-10 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm text-[#17202a] outline-none transition focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15";

export function NewInvoiceDialog({ open, onClose, onSave }: NewInvoiceDialogProps) {
  const titleId = useId();
  const firstControlRef = useRef<HTMLSelectElement>(null);
  const [values, setValues] = useState(initialValues);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstControlRef.current?.focus();

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

  const updateValue = (field: keyof NewInvoiceFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave(values);
    setValues(initialValues);
  };

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-[#17202a]/30 p-4"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-3xl overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-2xl shadow-[#17202a]/20"
        role="dialog"
      >
        <header className="flex items-center justify-between gap-4 border-b border-[#d8dde5] px-4 py-3">
          <h2 className="text-base font-black text-[#17202a]" id={titleId}>New invoice</h2>
          <button
            className="h-8 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black text-[#17202a] hover:bg-[#eef4fa]"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-2">
            <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]">
              Event
              <select
                className={`${controlClass} mt-1`}
                onChange={(event) => updateValue("event", event.target.value)}
                ref={firstControlRef}
                value={values.event}
              >
                <option>Friedman - Wedding</option>
                <option>Klein - Sheva Brachos</option>
                <option>Weiss - Bar Mitzvah</option>
                <option>Green - Dinner</option>
              </select>
            </label>

            <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]">
              Status
              <select
                className={`${controlClass} mt-1`}
                onChange={(event) => updateValue("status", event.target.value)}
                value={values.status}
              >
                <option>Draft</option>
                <option>Open</option>
                <option>Paid</option>
                <option>Void</option>
              </select>
            </label>

            <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]">
              First item
              <input
                className={`${controlClass} mt-1`}
                onChange={(event) => updateValue("firstItem", event.target.value)}
                required
                value={values.firstItem}
              />
            </label>

            <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]">
              Amount
              <input
                className={`${controlClass} mt-1`}
                min="0"
                onChange={(event) => updateValue("amount", event.target.value)}
                required
                step="0.01"
                type="number"
                value={values.amount}
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
              className="h-10 rounded-lg bg-[#1f4d73] px-4 text-sm font-black text-white shadow-sm hover:bg-[#15344f]"
              type="submit"
            >
              Save
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
