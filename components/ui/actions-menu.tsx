"use client";

import { useEffect, useRef, useState } from "react";

export type ActionsMenuItem = {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  /** `danger` paints the destructive entry - deletes, removals. */
  tone?: "default" | "danger";
};

type ActionsMenuProps = {
  items: ActionsMenuItem[];
  /**
   * Names the control for screen readers. A generic "More actions" is useless
   * in a grid of them, so pass the row it belongs to:
   * `More actions for Chicken soup`.
   */
  label: string;
  triggerClassName?: string;
};

const defaultTriggerClass =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#6a7483] transition hover:bg-[#eef4fa] hover:text-[#17202a]";

const toneClass = {
  default: "text-[#17202a] enabled:hover:bg-[#eef4fa]",
  danger: "text-[#c3291b] enabled:hover:bg-[#fff4f2]"
} as const;

function MoreIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  );
}

/**
 * The three-dot menu attached to a row or a card.
 *
 * It owns nothing but its own open state: what the entries do, and whether they
 * are allowed, is the caller's business. That is what lets the same component
 * sit on a card without the card knowing anything about dropdowns.
 */
export function ActionsMenu({
  items,
  label,
  triggerClassName = defaultTriggerClass
}: ActionsMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Scoped to this instance's own node rather than a shared data attribute:
    // pressing a sibling card's trigger has to count as "outside" for this one,
    // or a grid ends up with two menus open at once.
    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && containerRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      // Escape should leave focus where the user can reopen the menu, not on a
      // button that has just been unmounted.
      triggerRef.current?.focus();
    }

    window.addEventListener("pointerdown", closeOnOutsidePointer);
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("pointerdown", closeOnOutsidePointer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  if (items.length === 0) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={label}
        className={triggerClassName}
        onClick={() => setIsOpen((current) => !current)}
        ref={triggerRef}
        type="button"
      >
        <MoreIcon />
      </button>

      {isOpen ? (
        <div
          className="absolute right-0 top-full z-30 mt-1 w-32 overflow-hidden rounded-lg border border-[#d8dde5] bg-white p-1 shadow-xl"
          role="menu"
        >
          {items.map((item) => (
            <button
              key={item.label}
              className={`flex h-9 w-full items-center rounded-md px-3 text-left text-sm font-bold disabled:cursor-not-allowed disabled:opacity-45 ${
                toneClass[item.tone ?? "default"]
              }`}
              disabled={item.disabled}
              onClick={() => {
                setIsOpen(false);
                item.onSelect();
              }}
              role="menuitem"
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
