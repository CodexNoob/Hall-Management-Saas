"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { moneySchema } from "@/lib/validation/number";
import { readNumericFields } from "@/lib/validation/numeric-form";
import { useAppLanguage } from "@/components/providers/app-language-provider";

export type NewPackageFormValues = {
  name: string;
  type: string;
  basePrice: string;
  perCouplePrice: string;
};

type NewPackageDialogProps = {
  initialValues?: NewPackageFormValues;
  open: boolean;
  onClose: () => void;
  // Awaited, not fired and forgotten, for the reason NewLibraryItemDialog is:
  // the save is a round trip that can be refused, and this dialog is the only
  // surface left to say so once it has closed.
  onSave: (values: NewPackageFormValues) => void | Promise<void>;
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

export function NewPackageDialog({ initialValues: editValues, open, onClose, onSave }: NewPackageDialogProps) {
  const { t } = useAppLanguage();
  const titleId = useId();
  const firstInputRef = useRef<HTMLInputElement>(null);
  // Tracks the closed -> open edge. Seeding on every run of the effect instead
  // would overwrite what the user is typing each time the parent re-renders,
  // because `editValues` is an object the parent rebuilds as it goes.
  const wasOpenRef = useRef(false);
  const [values, setValues] = useState(initialValues);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"basePrice" | "perCouplePrice", string>>
  >({});

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }

    if (!wasOpenRef.current) {
      wasOpenRef.current = true;
      setValues(editValues ?? initialValues);
      setSaveError(null);
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

  const updateValue = (field: keyof NewPackageFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = async (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    if (isSaving) return;

    const prices = readNumericFields<"basePrice" | "perCouplePrice">({
      basePrice: {
        raw: values.basePrice,
        schema: moneySchema({ label: t("menu.basePrice"), t }),
        emptyMessage: t("menu.enterBasePrice")
      },
      perCouplePrice: {
        raw: values.perCouplePrice,
        schema: moneySchema({ label: t("settings.perCouplePrice"), t }),
        emptyMessage: t("menu.enterPerCouplePrice")
      }
    });

    if (!prices.ok) {
      setFieldErrors(prices.errors);
      return;
    }

    setFieldErrors({});
    setIsSaving(true);
    setSaveError(null);

    try {
      await onSave(values);
      // Only on success, and only for a create: blanking an edit would fight
      // the seed it is about to be given, and clearing after a refusal would
      // throw away what the user typed along with the reason it did not save.
      if (!editValues) setValues(initialValues);
    } catch (error) {
      setSaveError(
        error instanceof Error && error.message
          ? error.message
          : t("menu.packageSaveFailed")
      );
    } finally {
      setIsSaving(false);
    }
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
        className="max-h-[calc(100dvh-32px)] w-full max-w-xl overflow-y-auto rounded-xl border border-[#d8dde5] bg-white shadow-2xl shadow-[#17202a]/20"
        role="dialog"
      >
        <header className="flex items-center justify-between gap-4 border-b border-[#d8dde5] px-4 py-3">
          <div className="flex items-center gap-3">
            <PackageIcon />
            <h2 className="text-base font-black text-[#17202a]" id={titleId}>{editValues ? "Edit package" : "New package"}</h2>
          </div>
          <button aria-label={t("menu.closePackage")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#17202a] hover:bg-[#eef4fa]" onClick={onClose} type="button">
            <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24"><path d="M5 5 19 19M19 5 5 19" stroke="currentColor" strokeLinecap="round" strokeWidth="2.25" /></svg>
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-2">
            <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]">
              {t("menu.packageName")}
              <input className={`${controlClass} mt-1`} name="packageName" onChange={(event) => updateValue("name", event.target.value)} ref={firstInputRef} required value={values.name} />
            </label>
            <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]">
              {t("menu.packageType")}
              <select className={`${controlClass} mt-1`} name="packageType" onChange={(event) => updateValue("type", event.target.value)} value={values.type}>
                <option value="Dinner">{t("menu.typeDinner")}</option>
                <option value="Dairy">{t("menu.typeDairy")}</option>
                <option value="Shabbos">{t("menu.typeShabbos")}</option>
                <option value="Lunch">{t("menu.typeLunch")}</option>
                <option value="Brunch">{t("menu.typeBrunch")}</option>
              </select>
            </label>
            <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]">
              {t("menu.basePrice")}
              <input aria-describedby={fieldErrors.basePrice ? "package-base-price-error" : undefined} aria-invalid={fieldErrors.basePrice ? true : undefined} className={`${controlClass} mt-1`} inputMode="decimal" name="basePrice" onChange={(event) => updateValue("basePrice", event.target.value)} required type="text" value={values.basePrice} />
              {fieldErrors.basePrice ? (
                <p className="mt-1 text-[10px] font-bold normal-case tracking-normal text-[#c2410c]" id="package-base-price-error" role="alert">{fieldErrors.basePrice}</p>
              ) : null}
            </label>
            <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]">
              {t("menu.perCouple")}
              <input aria-describedby={fieldErrors.perCouplePrice ? "package-per-couple-error" : undefined} aria-invalid={fieldErrors.perCouplePrice ? true : undefined} className={`${controlClass} mt-1`} inputMode="decimal" name="perCouplePrice" onChange={(event) => updateValue("perCouplePrice", event.target.value)} required type="text" value={values.perCouplePrice} />
              {fieldErrors.perCouplePrice ? (
                <p className="mt-1 text-[10px] font-bold normal-case tracking-normal text-[#c2410c]" id="package-per-couple-error" role="alert">{fieldErrors.perCouplePrice}</p>
              ) : null}
            </label>
          </div>

          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-[#d8dde5] bg-[#fbfcfd] px-4 py-3">
            {saveError ? (
              <p className="mr-auto text-xs font-bold text-[#b42318]" role="alert">{saveError}</p>
            ) : null}
            <button className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-4 text-xs font-black text-[#17202a] hover:bg-[#eef4fa]" onClick={onClose} type="button">
              {t("common.cancel")}
            </button>
            <button className="h-9 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white shadow-sm hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving} type="submit">
              {isSaving ? t("common.savingChar") : t("menu.savePackage")}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
