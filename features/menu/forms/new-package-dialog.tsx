"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";

export type NewPackageFormValues = {
  name: string;
  type: string;
  basePrice: string;
  perCouplePrice: string;
};

type NewPackageDialogProps = {
  open: boolean;
  onClose: () => void;
  onSave: (values: NewPackageFormValues) => void;
};

const initialValues: NewPackageFormValues = {
  name: "",
  type: "Dinner",
  basePrice: "0",
  perCouplePrice: "0",
};

const controlClass =
  "h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm text-[#17202a] outline-none transition focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15";

function PackageIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="m21 8-9-5-9 5 9 5Z" />
      <path d="M3 8v8l9 5 9-5V8M12 13v8" />
    </svg>
  );
}

export function NewPackageDialog({ open, onClose, onSave }: NewPackageDialogProps) {
  const titleId = useId();
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState(initialValues);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstInputRef.current?.focus();

    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  const updateValue = (field: keyof NewPackageFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    onSave(values);
    setValues(initialValues);
  };

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-[#17202a]/30 p-4"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.currentTarget === mouseEvent.target) onClose();
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-xl overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-2xl shadow-[#17202a]/20"
        role="dialog"
      >
        <header className="flex items-center justify-between gap-4 border-b border-[#d8dde5] px-4 py-3">
          <div className="flex items-center gap-3">
            <PackageIcon />
            <h2 className="text-base font-black text-[#17202a]" id={titleId}>Package</h2>
          </div>
          <button aria-label="Close package" className="flex h-9 w-9 items-center justify-center rounded-full text-3xl leading-none text-[#17202a] hover:bg-[#eef4fa]" onClick={onClose} type="button">
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-2">
            <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]">
              Package name
              <input className={`${controlClass} mt-1`} name="packageName" onChange={(event) => updateValue("name", event.target.value)} ref={firstInputRef} required value={values.name} />
            </label>
            <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]">
              Package type
              <select className={`${controlClass} mt-1`} name="packageType" onChange={(event) => updateValue("type", event.target.value)} value={values.type}>
                <option>Dinner</option>
                <option>Dairy</option>
                <option>Shabbos</option>
                <option>Lunch</option>
                <option>Brunch</option>
              </select>
            </label>
            <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]">
              Base price
              <input className={`${controlClass} mt-1`} min="0" name="basePrice" onChange={(event) => updateValue("basePrice", event.target.value)} required step="0.01" type="number" value={values.basePrice} />
            </label>
            <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]">
              Per couple
              <input className={`${controlClass} mt-1`} min="0" name="perCouplePrice" onChange={(event) => updateValue("perCouplePrice", event.target.value)} required step="0.01" type="number" value={values.perCouplePrice} />
            </label>
          </div>

          <footer className="flex justify-end gap-2 border-t border-[#d8dde5] bg-[#fbfcfd] px-4 py-3">
            <button className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-4 text-xs font-black text-[#17202a] hover:bg-[#eef4fa]" onClick={onClose} type="button">
              Cancel
            </button>
            <button className="h-9 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white shadow-sm hover:bg-[#15344f]" type="submit">
              Save package
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
