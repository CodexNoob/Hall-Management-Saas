"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { countSchema, parseNumericInput } from "@/lib/validation/number";

export type AddKitchenEventFormValues = {
  /** The menu to cook. A kitchen event exists to produce one. */
  menuId: string;
  /** The menu's name, so the card can label itself without a lookup. */
  menuName: string;
  quickMenuName: string;
  quickMenuDishes: string;
  saveQuickMenuToLibrary: boolean;
  portions: string;
  kitchenNote: string;
};

export type KitchenMenuOption = {
  id: string;
  name: string;
  dishCount: number;
};

type AddKitchenEventDialogProps = {
  canSave: boolean;
  date: string;
  open: boolean;
  onClose: () => void;
  /** Menus this event can be raised against. */
  menus: KitchenMenuOption[];
  onSave: (values: AddKitchenEventFormValues) => void | Promise<void>;
};

const initialValues: AddKitchenEventFormValues = {
  menuId: "",
  menuName: "",
  quickMenuName: "",
  quickMenuDishes: "",
  saveQuickMenuToLibrary: false,
  portions: "",
  kitchenNote: ""
};

const inputClass =
  "h-10 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm text-[#17202a] outline-none placeholder:text-[#737373] focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15";

function FieldLabel({ children }: { children: string }) {
  return (
    <span className="block text-xs font-black uppercase tracking-[0.04em] text-[#53627a]">
      {children}
    </span>
  );
}

/**
 * The board hands over a `YYYY-MM-DD` key, which is unreadable in a form beside
 * fields a person is typing into.
 *
 * Parsed field by field rather than through `new Date(key)`: that reads the
 * string as UTC midnight and prints the day before in every timezone west of
 * Greenwich, so the dialog would name a different day than the column the
 * person clicked.
 */
function formatDateLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);

  if (!year || !month || !day) return dateKey;

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(year, month - 1, day));
}

export function AddKitchenEventDialog({
  canSave,
  date,
  open,
  menus,
  onClose,
  onSave
}: AddKitchenEventDialogProps) {
  const titleId = useId();
  const menuId = useId();
  const quickMenuNameId = useId();
  const quickMenuDishesId = useId();
  const portionsId = useId();
  const kitchenNoteId = useId();
  const firstInputRef = useRef<HTMLSelectElement>(null);
  const newMenuNameRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState(initialValues);
  const [portionsError, setPortionsError] = useState("");
  const [menuError, setMenuError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQuickMenu, setIsQuickMenu] = useState(false);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstInputRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  // Focus follows the switch. Turning the new-menu panel on replaces the
  // control that was just used, so without this a keyboard user is left on a
  // button that no longer exists and has to tab back in from the top.
  useEffect(() => {
    if (isQuickMenu) newMenuNameRef.current?.focus();
  }, [isQuickMenu]);

  if (!open) return null;

  function closeDialog() {
    setValues(initialValues);
    setPortionsError("");
    setMenuError("");
    setSubmitError("");
    setIsSubmitting(false);
    setIsQuickMenu(false);
    onClose();
  }

  function updateValue(
    field: keyof AddKitchenEventFormValues,
    value: string
  ) {
    if (field === "portions") setPortionsError("");
    if (field === "menuId" || field === "quickMenuName" || field === "quickMenuDishes") {
      setMenuError("");
    }
    setSubmitError("");
    setValues((current) => ({ ...current, [field]: value }));
  }

  function updateChecked(
    field: keyof Pick<AddKitchenEventFormValues, "saveQuickMenuToLibrary">,
    checked: boolean
  ) {
    setSubmitError("");
    setValues((current) => ({ ...current, [field]: checked }));
  }

  function enableQuickMenu() {
    setMenuError("");
    setSubmitError("");
    setIsQuickMenu(true);
    setValues((current) => ({ ...current, menuId: "", menuName: "" }));
  }

  function useExistingMenu() {
    setMenuError("");
    setSubmitError("");
    setIsQuickMenu(false);
    setValues((current) => ({
      ...current,
      quickMenuName: "",
      quickMenuDishes: "",
      saveQuickMenuToLibrary: false
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedValues = {
      menuId: values.menuId,
      menuName: menus.find((menu) => menu.id === values.menuId)?.name ?? "",
      quickMenuName: values.quickMenuName.trim(),
      quickMenuDishes: values.quickMenuDishes.trim(),
      saveQuickMenuToLibrary: values.saveQuickMenuToLibrary,
      portions: values.portions.trim(),
      kitchenNote: values.kitchenNote.trim()
    };

    if (!canSave) return;

    if (!isQuickMenu && !normalizedValues.menuId) {
      setMenuError("Choose a menu or create a new one.");
      return;
    }

    if (isQuickMenu) {
      const dishNames = normalizedValues.quickMenuDishes
        .split(/\r?\n/)
        .map((dish) => dish.trim())
        .filter(Boolean);

      if (!normalizedValues.quickMenuName) {
        setMenuError("Enter a menu name.");
        return;
      }

      if (dishNames.length === 0) {
        setMenuError("Add at least one dish, one per line.");
        return;
      }
    }

    // The saved value is rendered straight back as "<portions> portions", so an
    // unparseable entry would show up on the kitchen board as "abc portions".
    const parsedPortions = parseNumericInput(
      normalizedValues.portions,
      countSchema({ min: 1, label: "Portions" })
    );

    if (parsedPortions.status !== "valid") {
      setPortionsError(
        parsedPortions.status === "invalid"
          ? parsedPortions.message
          : "Enter a portion count."
      );
      return;
    }

    setPortionsError("");
    setSubmitError("");
    setIsSubmitting(true);

    try {
      await onSave(normalizedValues);
      closeDialog();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Unable to save this kitchen event."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="dashboard-drawer-backdrop fixed inset-0 z-100 flex items-center justify-center bg-[#17202a]/25 p-3 backdrop-blur-[1px] sm:p-6"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) closeDialog();
      }}
    >
      {/* Capped and column-laid out, the way the manage-workers and event
          details dialogs already are. Without it the form grew past a phone
          screen, and `overflow-hidden` clipped the title off the top with no
          way to scroll back to it - the new-menu panel made that reachable on
          any handset. */}
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="flex max-h-[calc(100dvh-24px)] w-full max-w-162.5 flex-col overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-2xl shadow-[#17202a]/20 sm:max-h-[calc(100dvh-48px)]"
        role="dialog"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#d8dde5] px-4 py-3.5 sm:px-5 sm:py-4">
          <div>
            <h2 className="text-lg font-black text-[#17202a]" id={titleId}>
              Add kitchen event
            </h2>
            <p className="mt-1 text-sm text-[#64748b]">
              Production with no booking behind it - a staff meal, a school
              lunch.
            </p>
          </div>

          <button
            aria-label="Close add kitchen event"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full leading-none text-[#17202a] hover:bg-[#eef4fa]"
            onClick={closeDialog}
            type="button"
          >
            <svg
              aria-hidden="true"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                d="M5 5 19 19M19 5 5 19"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2.25"
              />
            </svg>
          </button>
        </header>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          {/* `content-start`: the body is a flex child that grows to fill the
              dialog, and a stretched grid would spread its rows to match
              instead of leaving them their own height. */}
          <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
            {/* Day and quantity first: both are single short facts, and pairing
                them puts the count next to the day it is for. The date is not
                editable here - it comes from the column that was clicked. */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>Date</FieldLabel>
                <p className="mt-1 flex h-10 items-center rounded-lg border border-[#d8dde5] bg-[#f4f7fa] px-3 text-sm font-bold text-[#17202a]">
                  {formatDateLabel(date)}
                </p>
              </div>

              {/* Not a wrapping label: the error text below would be folded
                  into the input's accessible name. */}
              <div>
                <label htmlFor={portionsId}>
                  <FieldLabel>Portions</FieldLabel>
                </label>
                <input
                  aria-describedby={
                    portionsError ? `${portionsId}-error` : undefined
                  }
                  aria-invalid={portionsError ? true : undefined}
                  className={`${inputClass} mt-1`}
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
                {portionsError ? (
                  <p
                    className="mt-1 text-[10px] font-bold text-[#c2410c]"
                    id={`${portionsId}-error`}
                    role="alert"
                  >
                    {portionsError}
                  </p>
                ) : null}
              </div>
            </div>

            {/* A menu, not a typed name. A kitchen event is a production job,
                and the kitchen needs to know what to cook - a label like
                "School Lunch" tells them nothing.

                Full width, on its own row: menu names are long, and the button
                beside the picker used to squeeze both into half the dialog. */}
            <div>
              <div className="mb-1 flex items-center justify-between gap-3">
                <label htmlFor={menuId}>
                  <FieldLabel>Menu</FieldLabel>
                </label>
                {/* One control for the two states rather than a toggle plus a
                    separate "creating" button that did the same thing. */}
                <button
                  className="shrink-0 text-xs font-black text-[#1f4d73] underline-offset-2 hover:underline"
                  onClick={isQuickMenu ? useExistingMenu : enableQuickMenu}
                  type="button"
                >
                  {isQuickMenu ? "Use an existing menu" : "+ New menu"}
                </button>
              </div>

              {isQuickMenu ? (
                <div className="grid gap-3 rounded-xl border border-[#d8dde5] bg-[#fbfcfd] p-3">
                  <div>
                    <label htmlFor={quickMenuNameId}>
                      <FieldLabel>Menu name</FieldLabel>
                    </label>
                    <input
                      ref={newMenuNameRef}
                      aria-describedby={
                        menuError ? `${menuId}-error` : undefined
                      }
                      className={`${inputClass} mt-1`}
                      id={quickMenuNameId}
                      name="quickMenuName"
                      onChange={(event) =>
                        updateValue("quickMenuName", event.target.value)
                      }
                      placeholder="e.g. School lunch"
                      type="text"
                      value={values.quickMenuName}
                    />
                  </div>

                  <div>
                    <label htmlFor={quickMenuDishesId}>
                      <FieldLabel>Dishes</FieldLabel>
                    </label>
                    <textarea
                      className="mt-1 h-24 w-full resize-y rounded-lg border border-[#b9c2cf] bg-white px-3 py-2 text-sm text-[#17202a] outline-none placeholder:text-[#737373] focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15"
                      id={quickMenuDishesId}
                      name="quickMenuDishes"
                      onChange={(event) =>
                        updateValue("quickMenuDishes", event.target.value)
                      }
                      placeholder={"Pasta\nSalad\nJuice"}
                      value={values.quickMenuDishes}
                    />
                    <p className="mt-1 text-[10px] font-bold text-[#6a7483]">
                      One dish per line. Each dish starts at one portion per
                      guest.
                    </p>
                  </div>

                  <label className="flex items-start gap-2 text-xs font-bold text-[#53627a]">
                    <input
                      checked={values.saveQuickMenuToLibrary}
                      className="mt-0.5 h-4 w-4 rounded border-[#b9c2cf]"
                      onChange={(event) =>
                        updateChecked(
                          "saveQuickMenuToLibrary",
                          event.target.checked
                        )
                      }
                      type="checkbox"
                    />
                    <span>
                      Save this menu to the menu library for next time.
                    </span>
                  </label>
                </div>
              ) : (
                <select
                  ref={firstInputRef}
                  aria-describedby={menuError ? `${menuId}-error` : undefined}
                  aria-invalid={menuError ? true : undefined}
                  aria-label="Menu"
                  className={inputClass}
                  id={menuId}
                  name="menuId"
                  onChange={(event) =>
                    updateValue("menuId", event.target.value)
                  }
                  required={!isQuickMenu}
                  value={values.menuId}
                >
                  <option value="">
                    {menus.length ? "Select a menu" : "No menus available"}
                  </option>
                  {menus.map((menu) => (
                    <option key={menu.id} value={menu.id}>
                      {menu.dishCount
                        ? `${menu.name} (${menu.dishCount} dishes)`
                        : menu.name}
                    </option>
                  ))}
                </select>
              )}

              {menuError ? (
                <p
                  className="mt-1 text-[10px] font-bold text-[#c2410c]"
                  id={`${menuId}-error`}
                  role="alert"
                >
                  {menuError}
                </p>
              ) : null}
            </div>

            <div>
              <label htmlFor={kitchenNoteId}>
                <FieldLabel>Kitchen note</FieldLabel>
              </label>
              <textarea
                className="mt-1 h-19 w-full resize-y rounded-lg border border-[#b9c2cf] bg-white px-3 py-2 text-sm text-[#17202a] outline-none placeholder:text-[#737373] focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15"
                id={kitchenNoteId}
                name="kitchenNote"
                onChange={(event) =>
                  updateValue("kitchenNote", event.target.value)
                }
                placeholder="Anything the kitchen needs to know - allergies, drop-off time"
                value={values.kitchenNote}
              />
            </div>

            {!canSave ? (
              <p className="rounded-lg border border-[#f3c679] bg-[#fff9ef] px-3 py-3 text-xs font-bold text-[#80500c]">
                You do not have permission to add kitchen events. Contact an
                administrator if you need access.
              </p>
            ) : null}
            {submitError ? (
              <p
                className="rounded-lg border border-[#f3c679] bg-[#fff9ef] px-3 py-3 text-xs font-bold text-[#80500c]"
                role="alert"
              >
                {submitError}
              </p>
            ) : null}
          </div>

          <footer className="flex shrink-0 justify-end gap-3 border-t border-[#d8dde5] bg-[#fbfcfd] px-4 py-3 sm:px-5">
            <button
              className="h-10 flex-1 rounded-lg border border-[#b9c2cf] bg-white px-4 text-sm font-black text-[#17202a] hover:bg-[#eef4fa] sm:flex-initial"
              onClick={closeDialog}
              type="button"
            >
              Cancel
            </button>

            <button
              className="h-10 flex-1 rounded-lg bg-[#1f4d73] px-4 text-sm font-black text-white shadow-sm enabled:hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-45 sm:flex-initial"
              disabled={!canSave || isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Saving..." : "Save event"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
