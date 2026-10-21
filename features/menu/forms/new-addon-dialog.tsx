"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { moneySchema, parseNumericInput } from "@/lib/validation/number";
import { useAppLanguage } from "@/components/providers/app-language-provider";

export type NewAddOnValues = {
  name: string;
  price: string;
  /**
   * The file itself, not a path: uploading is the page's job, the same way it
   * is for a library item, so a dialog that fails to save can be reopened
   * without having lost anything to storage.
   */
  picture: File | null;
};

export function NewAddOnDialog({
  onClose,
  onSave,
  open
}: {
  onClose: () => void;
  onSave: (values: NewAddOnValues) => Promise<void>;
  open: boolean;
}) {
  const { t } = useAppLanguage();
  const titleId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<NewAddOnValues>({
    name: "",
    price: "0",
    picture: null
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setValues({ name: "", price: "0", picture: null });
    setError("");
    // The file input keeps its own value, so clearing state alone would leave
    // the previous file name showing beside an empty form.
    if (fileInputRef.current) fileInputRef.current.value = "";
    const handleKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedPrice = parseNumericInput(
      values.price,
      moneySchema({ label: t("menu.price"), t }),
      t
    );

    if (parsedPrice.status !== "valid") {
      setError(
        parsedPrice.status === "invalid" ? parsedPrice.message : t("menu.enterPrice")
      );
      return;
    }

    setSaving(true);
    setError("");
    try {
      await onSave(values);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("menu.addOnSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-[#17202a]/35 p-4 backdrop-blur-sm" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <section aria-labelledby={titleId} aria-modal="true" className="w-full max-w-md rounded-xl border border-[#d8dde5] bg-white shadow-2xl" role="dialog">
        <header className="flex items-center justify-between border-b border-[#d8dde5] px-5 py-4"><h2 className="text-lg font-black" id={titleId}>{t("menu.newAddOn")}</h2><button aria-label={t("menu.closeAddOn")} className="h-10 w-10 rounded-full text-xl hover:bg-[#eef4fa]" onClick={onClose} type="button">×</button></header>
        <form onSubmit={submit}>
          <div className="space-y-4 p-5">
            <label className="block text-xs font-black uppercase text-[#64748b]">{t("common.name")}<input autoFocus className="mt-1 h-10 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm font-medium normal-case text-[#17202a]" onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} required value={values.name} /></label>
            <label className="block text-xs font-black uppercase text-[#64748b]">{t("menu.price")}<input className="mt-1 h-10 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm font-medium normal-case text-[#17202a]" inputMode="decimal" onChange={(event) => setValues((current) => ({ ...current, price: event.target.value }))} required type="text" value={values.price} /></label>
            <label className="block text-xs font-black uppercase text-[#64748b]">
              {t("menu.picture")}
              <input accept="image/jpeg,image/png,image/webp" className="mt-1 block h-10 w-full rounded-lg border border-[#b9c2cf] bg-white px-2 py-1 text-sm font-medium normal-case text-[#17202a] file:mr-2 file:rounded-sm file:border file:border-[#8a94a3] file:bg-[#f5f6f8] file:px-2 file:py-0.5" name="picture" onChange={(event) => setValues((current) => ({ ...current, picture: event.target.files?.[0] ?? null }))} ref={fileInputRef} type="file" />
              <span className="mt-1 block text-[10px] font-bold normal-case text-[#6a7483]">{t("menu.pictureFormats")}</span>
            </label>
            {error ? <p className="text-sm font-semibold text-[#b42318]" role="alert">{error}</p> : null}
          </div>
          <footer className="flex justify-end gap-2 border-t border-[#d8dde5] bg-[#fbfcfd] px-5 py-4"><button className="h-9 rounded-lg border border-[#b9c2cf] px-4 text-sm font-bold" onClick={onClose} type="button">{t("common.cancel")}</button><button className="h-9 rounded-lg bg-[#1f4d73] px-4 text-sm font-black text-white disabled:opacity-60" disabled={saving} type="submit">{saving ? t("menu.savingEllipsis") : t("menu.saveAddOn")}</button></footer>
        </form>
      </section>
    </div>
  );
}
