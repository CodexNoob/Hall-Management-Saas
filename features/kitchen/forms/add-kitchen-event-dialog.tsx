"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent
} from "react";
import { countSchema, parseNumericInput } from "@/lib/validation/number";
import { useAppLanguage } from "@/components/providers/app-language-provider";

export type AddKitchenEventFormValues = {
  menuId: string;
  menuName: string;
  quickMenuName: string;
  quickMenuDishes: string;
  quickMenuItemIds: string[];
  addOnIds: string[];
  saveQuickMenuToLibrary: boolean;
  portions: string;
  kitchenNote: string;
};

export type KitchenMenuOption = {
  id: string;
  name: string;
  dishCount: number;
};

export type KitchenMenuItemOption = {
  id: string;
  name: string;
  category: string | null;
  kind: string;
  serviceStyles: string[];
};

export type KitchenAddOnOption = {
  id: string;
  name: string;
};

type AddKitchenEventDialogProps = {
  canSave: boolean;
  date: string;
  open: boolean;
  onClose: () => void;
  menus: KitchenMenuOption[];
  menuItems: KitchenMenuItemOption[];
  addOns?: KitchenAddOnOption[];
  onSave: (values: AddKitchenEventFormValues) => void | Promise<void>;
};

const initialValues: AddKitchenEventFormValues = {
  menuId: "",
  menuName: "",
  quickMenuName: "",
  quickMenuDishes: "",
  quickMenuItemIds: [],
  addOnIds: [],
  saveQuickMenuToLibrary: false,
  portions: "",
  kitchenNote: ""
};

const inputClass =
  "h-11 w-full border border-[#b9c2cf] bg-white px-3 text-sm font-semibold text-[#111827] outline-none placeholder:text-[#9ca3af] focus:border-[#1f4d73] focus:ring-1 focus:ring-[#1f4d73]";

function FieldLabel({ children }: { children: string }) {
  return (
    <span className="block text-xs font-black uppercase tracking-[0.06em] text-[#4b5565]">
      {children}
    </span>
  );
}

function formatDateLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return dateKey;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function toggleInList(list: string[], item: string) {
  return list.includes(item)
    ? list.filter((current) => current !== item)
    : [...list, item];
}

export function AddKitchenEventDialog({
  canSave,
  date,
  open,
  menus,
  menuItems,
  addOns = [],
  onClose,
  onSave
}: AddKitchenEventDialogProps) {
  const { t } = useAppLanguage();
  const titleId = useId();
  const eventNameId = useId();
  const portionsId = useId();
  const kitchenNoteId = useId();
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState(initialValues);
  const [selectedMenuItemIds, setSelectedMenuItemIds] = useState<string[]>([]);
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [portionsError, setPortionsError] = useState("");
  const [menuError, setMenuError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedQuickItems = useMemo(
    () => menuItems.filter((item) => selectedMenuItemIds.includes(item.id)),
    [menuItems, selectedMenuItemIds]
  );
  const drinkOptions = useMemo(
    () =>
      menuItems.filter((item) => {
        const text =
          `${item.kind} ${item.category ?? ""} ${item.name}`.toLowerCase();
        return (
          item.kind.toLowerCase() === "drink" ||
          text.includes("drink") ||
          text.includes("juice") ||
          text.includes("water") ||
          text.includes("coffee")
        );
      }),
    [menuItems]
  );
  const buffetOptions = useMemo(
    () =>
      menuItems.filter(
        (item) =>
          !drinkOptions.some((drink) => drink.id === item.id) &&
          item.serviceStyles.includes("Buffet")
      ),
    [drinkOptions, menuItems]
  );
  const platedOptions = useMemo(
    () =>
      menuItems.filter(
        (item) =>
          !drinkOptions.some((drink) => drink.id === item.id) &&
          item.serviceStyles.includes("Plated")
      ),
    [drinkOptions, menuItems]
  );

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstInputRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeDialog();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
    // closeDialog intentionally resets form state, so keeping this effect tied
    // to `open` avoids re-registering on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  function resetForm() {
    setValues(initialValues);
    setSelectedMenuItemIds([]);
    setSelectedAddOnIds([]);
    setSelectedTemplateId("");
    setPortionsError("");
    setMenuError("");
    setSubmitError("");
    setIsSubmitting(false);
  }

  function closeDialog() {
    resetForm();
    onClose();
  }

  function updateValue(
    field: keyof Pick<
      AddKitchenEventFormValues,
      "quickMenuName" | "portions" | "kitchenNote"
    >,
    value: string
  ) {
    if (field === "portions") setPortionsError("");
    if (field === "quickMenuName") setMenuError("");
    setSubmitError("");
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;

    const eventName = values.quickMenuName.trim();
    const normalizedValues: AddKitchenEventFormValues = {
      menuId: selectedTemplateId,
      menuName:
        menus.find((menu) => menu.id === selectedTemplateId)?.name ?? "",
      quickMenuName:
        selectedQuickItems.length > 0 || selectedAddOnIds.length > 0
          ? eventName
          : "",
      quickMenuDishes: "",
      quickMenuItemIds: selectedQuickItems.map((item) => item.id),
      addOnIds: selectedAddOnIds,
      saveQuickMenuToLibrary: false,
      portions: values.portions.trim(),
      kitchenNote: values.kitchenNote.trim()
    };

    if (!eventName) {
      setMenuError(t("kitchen.enterEventName"));
      return;
    }

    if (
      !selectedTemplateId &&
      selectedQuickItems.length === 0 &&
      selectedAddOnIds.length === 0
    ) {
      setMenuError(t("kitchen.chooseItems"));
      return;
    }

    const parsedPortions = parseNumericInput(
      normalizedValues.portions,
      countSchema({ min: 1, label: t("kitchen.portions"), t }),
      t
    );

    if (parsedPortions.status !== "valid") {
      setPortionsError(
        parsedPortions.status === "invalid"
          ? parsedPortions.message
          : t("kitchen.enterPortionCount")
      );
      return;
    }

    setPortionsError("");
    setMenuError("");
    setSubmitError("");
    setIsSubmitting(true);

    try {
      await onSave(normalizedValues);
      closeDialog();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : t("kitchen.saveEventFailed")
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center overflow-hidden bg-black/65 px-4 py-6 text-[#111827]"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) closeDialog();
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="flex max-h-[calc(100dvh-48px)] w-full max-w-5xl flex-col overflow-hidden border border-[#c7ced8] bg-white shadow-2xl shadow-black/35"
        role="dialog"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#d8dde5] px-4 py-4">
          <div>
            <h2
              className="text-base font-black leading-none text-[#061126]"
              id={titleId}
            >
              {t("kitchen.addEventTitle")}
            </h2>
            <p className="mt-2 text-sm font-bold text-[#1f4d73]">
              {formatDateLabel(date)}
            </p>
          </div>

          <button
            aria-label={t("kitchen.closeAddEvent")}
            className="flex h-8 w-8 items-center justify-center border border-[#b9c2cf] bg-white text-xl leading-none text-[#061126] hover:bg-[#eef4fa]"
            onClick={closeDialog}
            type="button"
          >
            ×
          </button>
        </header>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
            <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
              <div>
                <label htmlFor={eventNameId}>
                  <FieldLabel>{t("kitchen.eventNameRequired")}</FieldLabel>
                </label>
                <input
                  ref={firstInputRef}
                  aria-describedby={
                    menuError ? `${eventNameId}-error` : undefined
                  }
                  aria-invalid={menuError ? true : undefined}
                  className={`${inputClass} mt-2`}
                  id={eventNameId}
                  name="quickMenuName"
                  onChange={(event) =>
                    updateValue("quickMenuName", event.target.value)
                  }
                  placeholder={t("kitchen.eventNamePlaceholder")}
                  type="text"
                  value={values.quickMenuName}
                />
              </div>

              <div>
                <label htmlFor={portionsId}>
                  <FieldLabel>{t("kitchen.portions")}</FieldLabel>
                </label>
                <input
                  aria-describedby={
                    portionsError ? `${portionsId}-error` : undefined
                  }
                  aria-invalid={portionsError ? true : undefined}
                  className={`${inputClass} mt-2`}
                  id={portionsId}
                  inputMode="decimal"
                  name="portions"
                  onChange={(event) =>
                    updateValue("portions", event.target.value)
                  }
                  placeholder="e.g. 80"
                  required
                  type="text"
                  value={values.portions}
                />
              </div>
            </div>

            {menuError ? (
              <p
                className="mt-2 text-[11px] font-black text-[#c2410c]"
                id={`${eventNameId}-error`}
                role="alert"
              >
                {menuError}
              </p>
            ) : null}
            {portionsError ? (
              <p
                className="mt-2 text-[11px] font-black text-[#c2410c]"
                id={`${portionsId}-error`}
                role="alert"
              >
                {portionsError}
              </p>
            ) : null}

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <FieldLabel>{t("kitchen.packages")}</FieldLabel>
                <div className="mt-2 grid max-h-52 gap-2 overflow-y-auto pr-1 text-sm font-bold text-[#111827]">
                  {menus.length ? (
                    menus.map((menu) => (
                      <label key={menu.id} className="flex items-start gap-2">
                        <input
                          checked={selectedTemplateId === menu.id}
                          className="mt-0.5 h-3.5 w-3.5 border-[#9aa4b2]"
                          name="kitchenMenuTemplate"
                          onChange={() => {
                            setMenuError("");
                            setSubmitError("");
                            setSelectedTemplateId((current) =>
                              current === menu.id ? "" : menu.id
                            );
                          }}
                          type="checkbox"
                        />
                        <span>{menu.name}</span>
                      </label>
                    ))
                  ) : (
                    <p className="text-xs font-bold text-[#6b7280]">
                      {t("kitchen.noSavedPackages")}
                    </p>
                  )}
                </div>
              </div>

              <CheckboxList
                items={buffetOptions}
                label={t("kitchen.buffetMenu")}
                maxHeightClass="max-h-52"
                onToggle={(item) => {
                  setMenuError("");
                  setSubmitError("");
                  setSelectedMenuItemIds((current) =>
                    toggleInList(current, item)
                  );
                }}
                selectedItems={selectedMenuItemIds}
              />

              <CheckboxList
                items={platedOptions}
                label={t("kitchen.platedMenu")}
                maxHeightClass="max-h-52"
                onToggle={(item) => {
                  setMenuError("");
                  setSubmitError("");
                  setSelectedMenuItemIds((current) =>
                    toggleInList(current, item)
                  );
                }}
                selectedItems={selectedMenuItemIds}
              />

              <CheckboxList
                items={drinkOptions}
                label={t("kitchen.drinkMenu")}
                maxHeightClass="max-h-52"
                onToggle={(item) => {
                  setMenuError("");
                  setSubmitError("");
                  setSelectedMenuItemIds((current) =>
                    toggleInList(current, item)
                  );
                }}
                selectedItems={selectedMenuItemIds}
              />

              <CheckboxList
                items={addOns}
                label={t("kitchen.addOns")}
                maxHeightClass="max-h-52"
                onToggle={(item) => {
                  setMenuError("");
                  setSubmitError("");
                  setSelectedAddOnIds((current) =>
                    toggleInList(current, item)
                  );
                }}
                selectedItems={selectedAddOnIds}
              />

            </div>

            <div className="mt-4">
              <label htmlFor={kitchenNoteId}>
                <FieldLabel>{t("kitchen.noteOptional")}</FieldLabel>
              </label>
              <textarea
                className="mt-2 h-18 w-full resize-y border border-[#b9c2cf] bg-white px-3 py-3 text-sm font-semibold text-[#111827] outline-none placeholder:text-[#9ca3af] focus:border-[#1f4d73] focus:ring-1 focus:ring-[#1f4d73]"
                id={kitchenNoteId}
                name="kitchenNote"
                onChange={(event) =>
                  updateValue("kitchenNote", event.target.value)
                }
                placeholder={t("kitchen.notePlaceholder")}
                value={values.kitchenNote}
              />
            </div>

            {!canSave ? (
              <p className="mt-4 border border-[#f3c679] bg-[#fff9ef] px-3 py-3 text-xs font-bold text-[#80500c]">
                {t("kitchen.noPermissionAddEvent")}
              </p>
            ) : null}
            {submitError ? (
              <p
                className="mt-4 border border-[#f3c679] bg-[#fff9ef] px-3 py-3 text-xs font-bold text-[#80500c]"
                role="alert"
              >
                {submitError}
              </p>
            ) : null}
          </div>

          <footer className="flex shrink-0 justify-end gap-2 border-t border-[#d8dde5] bg-[#f8fafc] px-4 py-3">
            <button
              className="h-11 border border-[#b9c2cf] bg-white px-6 text-sm font-black text-[#061126] hover:bg-[#eef4fa]"
              onClick={closeDialog}
              type="button"
            >
              {t("common.cancel")}
            </button>
            <button
              className="h-11 bg-[#061126] px-6 text-sm font-black text-white enabled:hover:bg-[#10203d] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={!canSave || isSubmitting}
              type="submit"
            >
              {isSubmitting
                ? t("common.savingEllipsis")
                : t("kitchen.saveEvent")}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function CheckboxList({
  items,
  label,
  maxHeightClass = "",
  selectedItems,
  onToggle
}: {
  items: Array<{ id: string; name: string }>;
  label: string;
  maxHeightClass?: string;
  selectedItems: string[];
  onToggle: (itemId: string) => void;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div
        className={`mt-2 grid gap-2 overflow-y-auto pr-1 text-sm font-bold text-[#111827] ${maxHeightClass}`}
      >
        {items.length ? (
          items.map((item) => (
            <label key={item.id} className="flex items-start gap-2">
              <input
                checked={selectedItems.includes(item.id)}
                className="mt-0.5 h-3.5 w-3.5 border-[#9aa4b2]"
                name={`kitchenMenuItem-${item.id}`}
                onChange={() => onToggle(item.id)}
                type="checkbox"
              />
              <span>{item.name}</span>
            </label>
          ))
        ) : (
          <p className="text-xs font-bold text-[#6b7280]">
            No saved {label.toLowerCase()} yet.
          </p>
        )}
      </div>
    </div>
  );
}
