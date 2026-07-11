"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";

export type NewLibraryItemFormValues = {
  name: string;
  category: string;
  kashrutType: string;
  allergies: string;
  description: string;
  picture: File | null;
};

type NewLibraryItemDialogProps = {
  open: boolean;
  onClose: () => void;
  onSave: (values: NewLibraryItemFormValues) => void;
};

const initialValues: Omit<NewLibraryItemFormValues, "picture"> = {
  name: "",
  category: "Main",
  kashrutType: "Parve",
  allergies: "",
  description: "",
};

const controlClass =
  "h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm text-[#17202a] outline-none transition focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15";

function LibraryIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M6 3h12v18H6Z" />
      <path d="M9 7h6M9 11h6M9 15h4" />
    </svg>
  );
}

export function NewLibraryItemDialog({ open, onClose, onSave }: NewLibraryItemDialogProps) {
  const titleId = useId();
  const firstInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState(initialValues);
  const [picture, setPicture] = useState<File | null>(null);

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

  const updateValue = (field: keyof typeof initialValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setValues(initialValues);
    setPicture(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const closeAndReset = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    onSave({ ...values, picture });
    resetForm();
  };

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-[#17202a]/30 p-3 sm:p-5"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.currentTarget === mouseEvent.target) closeAndReset();
      }}
    >
      <section aria-labelledby={titleId} aria-modal="true" className="w-full max-w-3xl overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-2xl shadow-[#17202a]/20" role="dialog">
        <header className="flex items-center justify-between gap-4 border-b border-[#d8dde5] px-4 py-3">
          <div className="flex items-center gap-3">
            <LibraryIcon />
            <h2 className="text-base font-black text-[#17202a]" id={titleId}>Library item</h2>
          </div>
          <button className="h-8 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black text-[#17202a] hover:bg-[#eef4fa]" onClick={closeAndReset} type="button">Close</button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-2">
            <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]">
              Item name
              <input className={`${controlClass} mt-1`} onChange={(event) => updateValue("name", event.target.value)} ref={firstInputRef} required value={values.name} />
            </label>
            <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]">
              Category
              <select className={`${controlClass} mt-1`} onChange={(event) => updateValue("category", event.target.value)} value={values.category}>
                <option>Appetizer</option><option>Soup</option><option>Main</option><option>Side</option><option>Drink</option><option>Dessert</option><option>More</option>
              </select>
            </label>
            <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]">
              Kashrut type
              <select className={`${controlClass} mt-1`} onChange={(event) => updateValue("kashrutType", event.target.value)} value={values.kashrutType}>
                <option>Parve</option><option>Fleishig</option><option>Milchig</option>
              </select>
            </label>
            <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]">
              Allergies
              <input className={`${controlClass} mt-1`} onChange={(event) => updateValue("allergies", event.target.value)} placeholder="Nuts, gluten, dairy, sesame" value={values.allergies} />
            </label>
            <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b] sm:col-span-2">
              Description
              <textarea className="mt-1 min-h-13 w-full resize-y rounded-lg border border-[#b9c2cf] bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-[#17202a] outline-none placeholder:text-[#8a94a3] focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15" onChange={(event) => updateValue("description", event.target.value)} placeholder="Short description for reference" value={values.description} />
            </label>
            <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b] sm:col-span-2">
              Picture
              <input accept="image/*" className="mt-1 block h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-2 py-1 text-sm font-medium normal-case tracking-normal text-[#17202a] file:mr-2 file:rounded-sm file:border file:border-[#8a94a3] file:bg-[#f5f6f8] file:px-2 file:py-0.5" onChange={(event) => setPicture(event.target.files?.[0] ?? null)} ref={fileInputRef} type="file" />
            </label>
          </div>

          <footer className="flex justify-end gap-2 border-t border-[#d8dde5] bg-[#fbfcfd] px-4 py-3">
            <button className="h-9 rounded-lg border border-[#efaaa4] bg-white px-4 text-xs font-black text-[#b42318] hover:bg-[#fff5f4]" onClick={closeAndReset} type="button">Delete</button>
            <button className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-4 text-xs font-black text-[#17202a] hover:bg-[#eef4fa]" onClick={closeAndReset} type="button">Cancel</button>
            <button className="h-9 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white shadow-sm hover:bg-[#15344f]" type="submit">Save item</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
