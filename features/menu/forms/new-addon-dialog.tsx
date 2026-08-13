"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { moneySchema, parseNumericInput } from "@/lib/validation/number";

export type NewAddOnValues = { name: string; price: string };

export function NewAddOnDialog({
  onClose,
  onSave,
  open
}: {
  onClose: () => void;
  onSave: (values: NewAddOnValues) => Promise<void>;
  open: boolean;
}) {
  const titleId = useId();
  const [values, setValues] = useState<NewAddOnValues>({ name: "", price: "0" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setValues({ name: "", price: "0" });
    setError("");
    const handleKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedPrice = parseNumericInput(
      values.price,
      moneySchema({ label: "Price" })
    );

    if (parsedPrice.status !== "valid") {
      setError(
        parsedPrice.status === "invalid" ? parsedPrice.message : "Enter a price."
      );
      return;
    }

    setSaving(true);
    setError("");
    try {
      await onSave(values);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save add-on.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-[#17202a]/35 p-4 backdrop-blur-sm" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <section aria-labelledby={titleId} aria-modal="true" className="w-full max-w-md rounded-xl border border-[#d8dde5] bg-white shadow-2xl" role="dialog">
        <header className="flex items-center justify-between border-b border-[#d8dde5] px-5 py-4"><h2 className="text-lg font-black" id={titleId}>New add-on</h2><button aria-label="Close add-on dialog" className="h-10 w-10 rounded-full text-xl hover:bg-[#eef4fa]" onClick={onClose} type="button">×</button></header>
        <form onSubmit={submit}>
          <div className="space-y-4 p-5">
            <label className="block text-xs font-black uppercase text-[#64748b]">Name<input autoFocus className="mt-1 h-10 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm font-medium normal-case text-[#17202a]" onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} required value={values.name} /></label>
            <label className="block text-xs font-black uppercase text-[#64748b]">Price<input className="mt-1 h-10 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm font-medium normal-case text-[#17202a]" inputMode="decimal" onChange={(event) => setValues((current) => ({ ...current, price: event.target.value }))} required type="text" value={values.price} /></label>
            {error ? <p className="text-sm font-semibold text-[#b42318]" role="alert">{error}</p> : null}
          </div>
          <footer className="flex justify-end gap-2 border-t border-[#d8dde5] bg-[#fbfcfd] px-5 py-4"><button className="h-9 rounded-lg border border-[#b9c2cf] px-4 text-sm font-bold" onClick={onClose} type="button">Cancel</button><button className="h-9 rounded-lg bg-[#1f4d73] px-4 text-sm font-black text-white disabled:opacity-60" disabled={saving} type="submit">{saving ? "Saving..." : "Save add-on"}</button></footer>
        </form>
      </section>
    </div>
  );
}
