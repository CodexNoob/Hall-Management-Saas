"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useScrollLock } from "@/lib/ui/use-scroll-lock";
import {
  COUNT_BASES,
  COUNT_BASIS_LABELS,
  COUNTING_UNITS,
  MENU_ITEM_KINDS,
  ROUNDING_MODES,
  SERVICE_STYLES,
  serviceFormDefaults,
  serviceStyleLabel,
  type ServiceRuleFormValues,
  type ServiceStyle,
  type ServiceStyleFormValues
} from "@/features/menu/lib/service-style";

export type NewLibraryItemFormValues = {
  name: string;
  category: string;
  kind: string;
  kashrutType: string;
  /** Comma separated; the page splits it into the `text[]` column. */
  allergies: string;
  description: string;
  /**
   * One entry per service style, each with its own rule.
   *
   * A style is served when its checkbox is on, so an item with both off is
   * library-only and one with both on carries two independent rules - which is
   * the case a single style field could not express: grilled chicken is one
   * tray per thirty on a buffet and one plate per guest when plated.
   *
   * Rule numbers are held as text, like every other input here. The page parses
   * them with `parseNumericInput` so an unparseable value cannot reach the
   * database as a silent zero.
   */
  services: ServiceStyleFormValues;
  picture: File | null;
};

export type LibraryItemSeedValues = Omit<NewLibraryItemFormValues, "picture">;

type NewLibraryItemDialogProps = {
  /**
   * Present for an edit, absent for a create. It is the only thing that tells
   * the two apart, the same way `NewPackageDialog` does it.
   */
  initialValues?: LibraryItemSeedValues;
  /**
   * What a create starts on, so "Add buffet item" opens a form that is already
   * a buffet item. Ignored for an edit, which seeds from the row itself.
   */
  defaultServiceStyle?: string;
  /**
   * Suppresses Escape and the backdrop click while something sits on top of
   * this form - the remove confirmation, which is the only thing that does.
   * Without it a single Escape dismisses both, and the operator loses the edit
   * they were in the middle of along with the confirmation they meant to answer.
   */
  isDismissBlocked?: boolean;
  open: boolean;
  onClose: () => void;
  /**
   * Opens the removal confirmation. Absent for a create, and absent when the
   * viewer may not edit the menu - there is nothing to remove in the first case
   * and nothing they are allowed to remove in the second.
   *
   * Deliberately not the deletion itself: the confirmation and the failure it
   * has to report belong to the page that owns the item, not to this form.
   */
  onRemove?: () => void;
  // Awaited, not fired and forgotten: saving uploads the picture before it
  // writes the item, so the form must stay put until that resolves.
  onSave: (values: NewLibraryItemFormValues) => void | Promise<void>;
};

const initialValues: LibraryItemSeedValues = {
  name: "",
  category: "Main",
  kind: "Food",
  kashrutType: "Parve",
  allergies: "",
  description: "",
  services: serviceFormDefaults("Food")
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

export function NewLibraryItemDialog({ initialValues: editValues, defaultServiceStyle, isDismissBlocked = false, open, onClose, onRemove, onSave }: NewLibraryItemDialogProps) {
  const titleId = useId();
  // One list for both style blocks - the suggestions are the same, and a
  // per-style copy would only duplicate eight options in the DOM.
  const unitListId = useId();
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
  // A function rather than a computed object: the seeding effect depends on it,
  // and an object rebuilt every render would re-seed the form mid-typing.
  const buildCreateValues = useCallback((): LibraryItemSeedValues => {
    // "Add buffet item" opens a form that is already a buffet item - the style
    // it was opened from starts checked, and nothing else does.
    const defaults = serviceFormDefaults(initialValues.kind);
    const services = Object.fromEntries(
      SERVICE_STYLES.map((style) => [
        style,
        { ...defaults[style], enabled: style === defaultServiceStyle }
      ])
    ) as ServiceStyleFormValues;

    return { ...initialValues, services };
  }, [defaultServiceStyle]);

  // Shared with the remove confirmation that opens on top of this form, so
  // closing both at once cannot leave the page unscrollable.
  useScrollLock(open);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }

    if (!wasOpenRef.current) {
      wasOpenRef.current = true;
      setValues(editValues ?? buildCreateValues());
      setPicture(null);
      setSaveError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }

    firstInputRef.current?.focus();

    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "Escape" && !isDismissBlocked) onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
    // `isDismissBlocked` is a dependency so the listener sees its current value.
    // Re-running is safe: the seeding above is gated on the closed -> open edge,
    // so only the listener and the focus call are re-applied.
  }, [buildCreateValues, editValues, isDismissBlocked, onClose, open]);

  if (!open) return null;

  // Narrowed to the text fields so `services`, which is not a string, cannot be
  // passed here by accident.
  type TextField = Exclude<keyof LibraryItemSeedValues, "services">;

  const updateValue = (field: TextField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  /**
   * Switching Food <-> Drink re-seeds the styles that are still switched off,
   * so a drink opens on bottles per table rather than the plated "1 plate per 1
   * guest" it used to inherit.
   *
   * Enabled blocks are left exactly as typed. Their numbers are on screen, and
   * rewriting what someone is looking at is worse than a default that no longer
   * matches the kind - the disabled ones are invisible, so re-seeding those
   * costs nothing and is what makes the new defaults actually reachable.
   */
  const updateKind = (kind: string) => {
    setValues((current) => {
      const defaults = serviceFormDefaults(kind);

      return {
        ...current,
        kind,
        services: Object.fromEntries(
          SERVICE_STYLES.map((style) => [
            style,
            current.services[style].enabled
              ? current.services[style]
              : { ...defaults[style] }
          ])
        ) as ServiceStyleFormValues
      };
    });
  };

  const updateService = (
    style: ServiceStyle,
    patch: Partial<ServiceRuleFormValues>
  ) => {
    setValues((current) => ({
      ...current,
      services: {
        ...current.services,
        [style]: { ...current.services[style], ...patch }
      }
    }));
  };

  const resetForm = () => {
    setValues(buildCreateValues());
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
        if (isDismissBlocked) return;
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
            <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]">
              Food or drink
              <select className={`${controlClass} mt-1`} name="kind" onChange={(event) => updateKind(event.target.value)} value={values.kind}>
                {MENU_ITEM_KINDS.map((kind) => (
                  <option key={kind}>{kind}</option>
                ))}
              </select>
            </label>
            {/* One block per style, each with its own rule. Ticking neither
                leaves the dish catalogued but not served - which is what the
                old "Library" option meant, without a value standing in for it.
                Ticking both is how one dish carries a tray rule for the buffet
                and a plate rule for the plated menu at the same time. */}
            <fieldset className="sm:col-span-2">
              <legend className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]">
                Served as
              </legend>
              <p className="mt-1 text-[10px] font-bold normal-case tracking-normal text-[#6a7483]">
                Decides which service tabs list it, and how much to cook for each. Price stays on the package.
              </p>
              <div className="mt-2 grid gap-2">
                {SERVICE_STYLES.map((style) => {
                  const entry = values.services[style];
                  // A drink is served at the table, not plated. Only the word
                  // changes - `style` is still what gets stored, and it stays
                  // the field name so a form key never shifts under a rename.
                  const label = serviceStyleLabel(style, values.kind);

                  return (
                    <div className="rounded-lg border border-[#d8dde5] p-2" key={style}>
                      <label className="flex items-center gap-2 text-xs font-black normal-case tracking-normal text-[#17202a]">
                        <input checked={entry.enabled} className="h-4 w-4" name={`serves${style}`} onChange={(event) => updateService(style, { enabled: event.target.checked })} type="checkbox" />
                        {label}
                      </label>
                      {entry.enabled ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <input aria-label={`${label} quantity`} className={`${controlClass} w-20`} inputMode="decimal" onChange={(event) => updateService(style, { quantity: event.target.value })} required value={entry.quantity} />
                          {/* Typed, not picked: the eight presets never covered
                              every kitchen's vocabulary, and an operator who
                              counts in pans had to file them under the nearest
                              wrong word. The list is still offered, as
                              suggestions the field does not enforce. */}
                          <input aria-label={`${label} unit`} className={`${controlClass} w-28`} list={unitListId} maxLength={24} onChange={(event) => updateService(style, { unit: event.target.value })} required value={entry.unit} />
                          <span className="text-xs font-black normal-case text-[#6a7483]">per</span>
                          {/* A whole-event rule - one cake, however many guests -
                              divides nothing, so the count is not asked for. */}
                          {entry.perBasis === "Event" ? null : (
                            <input aria-label={`${label} per quantity`} className={`${controlClass} w-20`} inputMode="numeric" onChange={(event) => updateService(style, { per: event.target.value })} required value={entry.per} />
                          )}
                          <select aria-label={`${label} per basis`} className={`${controlClass} w-32`} onChange={(event) => updateService(style, { perBasis: event.target.value })} value={entry.perBasis}>
                            {COUNT_BASES.map((basis) => (
                              <option key={basis} value={basis}>
                                {COUNT_BASIS_LABELS[basis]}
                              </option>
                            ))}
                          </select>
                          <select aria-label={`${label} rounding`} className={`${controlClass} w-32`} onChange={(event) => updateService(style, { rounding: event.target.value })} value={entry.rounding}>
                            {ROUNDING_MODES.map((mode) => (
                              <option key={mode} value={mode}>
                                {mode === "Exact" ? "no rounding" : `round ${mode.toLowerCase()}`}
                              </option>
                            ))}
                          </select>
                          <input aria-label={`${label} minimum`} className={`${controlClass} w-28`} inputMode="numeric" onChange={(event) => updateService(style, { minimumUnits: event.target.value })} placeholder="min (opt)" value={entry.minimumUnits} />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <datalist id={unitListId}>
                {COUNTING_UNITS.map((unit) => (
                  <option key={unit} value={unit} />
                ))}
              </datalist>
            </fieldset>
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
            {/* Grouped so one `mr-auto` divides the footer. Two of them - one on
                the error, one on Cancel - split the free space between
                themselves instead, and the buttons stop sitting where the
                previous render put them the moment a save fails. */}
            <div className="mr-auto flex flex-wrap items-center gap-3">
              {/* Removing lives here because opening this form is now the only
                  way into an item - the card is one click target, not a menu.
                  It only asks: the confirmation in front of the delete, and the
                  refusal the server may answer with, belong to the page. Kept
                  at the far end from Save so a destructive click is a
                  deliberate one, never a slip off the primary button. */}
              {isEditing && onRemove ? (
                <button className="h-9 rounded-lg border border-[#efb6b6] bg-white px-4 text-xs font-black text-[#b42318] transition hover:bg-[#fff5f5] disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving} onClick={onRemove} type="button">Remove item</button>
              ) : null}
              {saveError ? (
                <p className="text-xs font-bold text-[#b42318]" role="alert">{saveError}</p>
              ) : null}
            </div>
            <button className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-4 text-xs font-black text-[#17202a] hover:bg-[#eef4fa]" onClick={closeAndReset} type="button">Cancel</button>
            <button className="h-9 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white shadow-sm hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving} type="submit">{isSaving ? "Saving…" : isEditing ? "Save changes" : "Save item"}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
