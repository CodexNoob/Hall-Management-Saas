"use client";

import { useEffect, useId } from "react";
import { useScrollLock } from "@/lib/ui/use-scroll-lock";
import {
  LineIcon,
  type IconName
} from "@/features/menu/components/menu-shared";
import type {
  MenuItemKind,
  ServiceStyle
} from "@/features/menu/lib/service-style";

/**
 * Which menu a new item is being added to.
 *
 * `serviceStyle: null` is the catalogue-only answer, not a missing one: a dish
 * with no service row exists in the library and is served nowhere until
 * somebody says how much of it to cook.
 */
export type NewItemMenuChoice = {
  kind: MenuItemKind;
  serviceStyle: ServiceStyle | null;
};

type MenuOption = {
  id: string;
  label: string;
  description: string;
  icon: IconName;
  choice: NewItemMenuChoice;
};

/**
 * The four places a new item can land, in the order the tab strip lists them.
 *
 * "Library only" is last and reads as the deferral it is. It was the only
 * behaviour this button had before the picker existed, so it stays reachable -
 * dropping it would mean a dish could no longer be catalogued by someone who
 * has not yet decided how it is served.
 */
const MENU_OPTIONS: MenuOption[] = [
  {
    id: "buffet",
    label: "Buffet Menu",
    description: "Served from a tray. Counted per guests.",
    icon: "tray",
    choice: { kind: "Food", serviceStyle: "Buffet" }
  },
  {
    id: "plated",
    label: "Plated Menu",
    description: "Plated per guest and brought to the table.",
    icon: "plate",
    choice: { kind: "Food", serviceStyle: "Plated" }
  },
  {
    id: "drink",
    label: "Drink Menu",
    description: "Bottles on the table, or a self-serve station.",
    icon: "drink",
    choice: { kind: "Drink", serviceStyle: null }
  },
  {
    id: "library",
    label: "Library only",
    description: "Catalogue it now, decide how it is served later.",
    icon: "document",
    choice: { kind: "Food", serviceStyle: null }
  }
];

/**
 * The question the item form used to ask twice.
 *
 * On the Buffet, Plated and Drink tabs the answer is already on screen - the
 * tab is the answer - so those open their form directly and it asks nothing.
 * The library tab is the one place where nothing has been said yet, and asking
 * it here rather than inside the form is what lets the form be a buffet form,
 * a plated form or a drink form instead of one form carrying every branch.
 *
 * Cards rather than a select: these are four destinations, and a dropdown of
 * destinations reads as a property of the item being made.
 */
export function NewItemMenuPicker({
  open,
  onClose,
  onChoose
}: {
  open: boolean;
  onClose: () => void;
  onChoose: (choice: NewItemMenuChoice) => void;
}) {
  const titleId = useId();
  const descriptionId = useId();

  useScrollLock(open);

  useEffect(() => {
    if (!open) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-[#17202a]/30 p-3 sm:p-5"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.currentTarget === mouseEvent.target) onClose();
      }}
    >
      <section
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="max-h-[calc(100dvh-24px)] w-full max-w-lg overflow-y-auto rounded-xl border border-[#d8dde5] bg-white shadow-2xl shadow-[#17202a]/20"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#d8dde5] px-4 py-3">
          <div className="min-w-0">
            <h2
              className="text-base font-black text-[#17202a]"
              id={titleId}
            >
              Which menu?
            </h2>
            <p className="mt-1 text-xs text-[#6a7483]" id={descriptionId}>
              Pick where this item is served. The form opens ready for it.
            </p>
          </div>
          <button
            aria-label="Close menu picker"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#17202a] hover:bg-[#eef4fa]"
            onClick={onClose}
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

        <div className="grid gap-2 p-4 sm:grid-cols-2 sm:gap-3">
          {MENU_OPTIONS.map((option) => (
            <button
              className="flex h-full flex-col items-start gap-2 rounded-xl border border-[#d8dde5] bg-white p-3 text-left transition hover:border-[#1f4d73] hover:bg-[#f6fafd] focus:border-[#1f4d73] focus:outline-none focus:ring-2 focus:ring-[#1f4d73]/15"
              key={option.id}
              onClick={() => onChoose(option.choice)}
              type="button"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#d8dde5] text-[#1f4d73]">
                <LineIcon className="h-5 w-5" name={option.icon} />
              </span>
              <span className="text-sm font-black text-[#17202a]">
                {option.label}
              </span>
              <span className="text-[11px] leading-4 text-[#6a7483]">
                {option.description}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
