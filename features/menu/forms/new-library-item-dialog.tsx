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

export type LibraryItemSeedValues = Omit<NewLibraryItemFormValues, "picture">;

type NewLibraryItemDialogProps = {
  /**
   * Present for an edit, absent for a create. It is the only thing that tells
   * the two apart, the same way `NewPackageDialog` does it.
   */
  initialValues?: LibraryItemSeedValues;
  open: boolean;
  onClose: () => void;
  // Awaited, not fired and forgotten: saving uploads the picture before it
  // writes the item, so the form must stay put until that resolves.
  onSave: (values: NewLibraryItemFormValues) => void | Promise<void>;
};

const initialValues: LibraryItemSeedValues = {
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

export function NewLibraryItemDialog({ initialValues: editValues, open, onClose, onSave }: NewLibraryItemDialogProps) {
  const titleId = useId();
  const firstInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Tracks the closed -> open edge. Seeding on every run of the effect instead
  // would overwrite what the user is typing each time the parent re-renders,
  // because `editValues` is an object the parent rebuilds as it goes.
  const wasOpenRef = useRef(false);
  const [values, setValues] = useState(initialValues);
  const [picture, setPicture] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isEditing = Boolean(editValues);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }

    if (!wasOpenRef.current) {
      wasOpenRef.current = true;
      setValues(editValues ?? initialValues);
      setPicture(null);
      setSaveError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }

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
  }, [editValues, onClose, open]);

  if (!open) return null;

  const updateValue = (field: keyof typeof initialValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setValues(initialValues);
    setPicture(null);
    setSaveError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const closeAndReset = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    if (isSaving) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      await onSave({ ...values, picture });
      // Only on success, and only for a create - clearing after a failed upload
      // would throw away what the user typed along with the file they picked,
      // and blanking an edit would fight the seed it is about to be given.
      if (!isEditing) resetForm();
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "The item could not be saved. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-[#17202a]/30 p-3 sm:p-5"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.currentTarget === mouseEvent.target) closeAndReset();
      }}
    >
      <section aria-labelledby={titleId} aria-modal="true" className="max-h-[calc(100dvh-24px)] w-full max-w-3xl overflow-y-auto rounded-xl border border-[#d8dde5] bg-white shadow-2xl shadow-[#17202a]/20" role="dialog">
        <header className="flex items-center justify-between gap-4 border-b border-[#d8dde5] px-4 py-3">
          <div className="flex items-center gap-3">
            <LibraryIcon />
            <h2 className="text-base font-black text-[#17202a]" id={titleId}>{isEditing ? "Edit library item" : "Library item"}</h2>
          </div>
          <button aria-label="Close library item" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#17202a] hover:bg-[#eef4fa]" onClick={closeAndReset} type="button"><svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24"><path d="M5 5 19 19M19 5 5 19" stroke="currentColor" strokeLinecap="round" strokeWidth="2.25" /></svg></button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-2">
            <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]">
              Item name
              <input className={`${controlClass} mt-1`} name="libraryItemName" onChange={(event) => updateValue("name", event.target.value)} ref={firstInputRef} required value={values.name} />
            </label>
            <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]">
              Category
              <select className={`${controlClass} mt-1`} name="libraryItemCategory" onChange={(event) => updateValue("category", event.target.value)} value={values.category}>
                <option>Appetizer</option><option>Soup</option><option>Main</option><option>Side</option><option>Drink</option><option>Dessert</option><option>More</option>
              </select>
            </label>
            <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]">
              Kashrut type
              <select className={`${controlClass} mt-1`} name="kashrutType" onChange={(event) => updateValue("kashrutType", event.target.value)} value={values.kashrutType}>
                <option>Parve</option><option>Fleishig</option><option>Milchig</option>
              </select>
            </label>
            <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]">
              Allergies
              <input className={`${controlClass} mt-1`} name="allergies" onChange={(event) => updateValue("allergies", event.target.value)} placeholder="Nuts, gluten, dairy, sesame" value={values.allergies} />
            </label>
            <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b] sm:col-span-2">
              Description
              <textarea className="mt-1 min-h-13 w-full resize-y rounded-lg border border-[#b9c2cf] bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-[#17202a] outline-none placeholder:text-[#8a94a3] focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15" name="description" onChange={(event) => updateValue("description", event.target.value)} placeholder="Short description for reference" value={values.description} />
            </label>
            <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b] sm:col-span-2">
              {isEditing ? "Replace picture" : "Picture"}
              <input accept="image/jpeg,image/png,image/webp" className="mt-1 block h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-2 py-1 text-sm font-medium normal-case tracking-normal text-[#17202a] file:mr-2 file:rounded-sm file:border file:border-[#8a94a3] file:bg-[#f5f6f8] file:px-2 file:py-0.5" name="picture" onChange={(event) => setPicture(event.target.files?.[0] ?? null)} ref={fileInputRef} type="file" />
              {isEditing ? (
                <p className="mt-1 text-[10px] font-bold normal-case tracking-normal text-[#6a7483]">Leave empty to keep the current picture.</p>
              ) : null}
            </label>
          </div>

          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-[#d8dde5] bg-[#fbfcfd] px-4 py-3">
            {saveError ? (
              <p className="mr-auto text-xs font-bold text-[#b42318]" role="alert">{saveError}</p>
            ) : null}
            {/* No Delete button here: removing an item is the card's own
                "Remove" action, which can confirm and report a refusal. The
                one that used to sit here only closed the dialog. */}
            <button className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-4 text-xs font-black text-[#17202a] hover:bg-[#eef4fa]" onClick={closeAndReset} type="button">Cancel</button>
            <button className="h-9 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white shadow-sm hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving} type="submit">{isSaving ? "Saving…" : isEditing ? "Save changes" : "Save item"}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
