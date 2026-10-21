"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { useAppLanguage } from "@/components/providers/app-language-provider";

export type VendorDialogValues = { name: string; category: string };

export function VendorDialog({
  initialValues,
  onClose,
  onSave,
  open
}: {
  initialValues?: VendorDialogValues;
  onClose: () => void;
  onSave: (values: VendorDialogValues) => Promise<void>;
  open: boolean;
}) {
  const { t } = useAppLanguage();
  const titleId = useId();
  const [values, setValues] = useState<VendorDialogValues>({
    name: "",
    category: "General"
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setValues(initialValues ?? { name: "", category: "General" });
    setError("");
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [initialValues, onClose, open]);

  if (!open) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    try {
      await onSave({
        name: values.name.trim(),
        category: values.category.trim()
      });
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : t("vendors.saveFailed")
      );
    } finally {
      setIsSaving(false);
    }
  }

  const editing = Boolean(initialValues);
  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-[#17202a]/35 p-4 backdrop-blur-sm"
      onMouseDown={(event) => event.currentTarget === event.target && onClose()}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-md overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-2xl"
        role="dialog"
      >
        <header className="flex items-center justify-between border-b border-[#d8dde5] px-5 py-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-[#1f4d73]">{t("vendors.directory")}</p>
            <h2 className="text-lg font-black text-[#17202a]" id={titleId}>{editing ? "Edit vendor" : "Add vendor"}</h2>
          </div>
          <button aria-label={t("vendors.closeDialog")} className="h-10 w-10 rounded-full text-xl hover:bg-[#eef4fa]" onClick={onClose} type="button">×</button>
        </header>
        <form onSubmit={submit}>
          <div className="space-y-4 p-5">
            <label className="block text-xs font-black uppercase text-[#64748b]">{t("vendors.name")}
              <input autoFocus className="mt-1 h-10 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm font-medium normal-case text-[#17202a] outline-none focus:border-[#1f4d73]" onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} required value={values.name} />
            </label>
            <label className="block text-xs font-black uppercase text-[#64748b]">{t("vendors.category")}
              <input className="mt-1 h-10 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm font-medium normal-case text-[#17202a] outline-none focus:border-[#1f4d73]" onChange={(event) => setValues((current) => ({ ...current, category: event.target.value }))} required value={values.category} />
            </label>
            {error ? <p className="text-sm font-semibold text-[#b42318]" role="alert">{error}</p> : null}
          </div>
          <footer className="flex justify-end gap-2 border-t border-[#d8dde5] bg-[#fbfcfd] px-5 py-4">
            <button className="h-9 rounded-lg border border-[#b9c2cf] px-4 text-sm font-bold" onClick={onClose} type="button">{t("common.cancel")}</button>
            <button className="h-9 rounded-lg bg-[#1f4d73] px-4 text-sm font-black text-white disabled:opacity-60" disabled={isSaving} type="submit">{isSaving ? t("vendors.saving") : t("vendors.save")}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
