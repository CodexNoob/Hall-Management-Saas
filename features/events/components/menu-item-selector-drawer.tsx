"use client";

import { useEffect, useId, useState } from "react";
import { MenuThumbnail } from "@/features/events/components/event-manager-shared";

/**
 * The three things an event's menu is made of.
 *
 * This used to be seven hardcoded courses - Appetizer, Soup, Main and so on -
 * that a dish was filed under by matching its category text. The menu library
 * does not organise by course any more; it organises by how a dish is served,
 * with add-ons kept separate. The event menu now reads the same way.
 */
export const MENU_SECTIONS = [
  { id: "Buffet", label: "Buffet" },
  { id: "Plated", label: "Plated" },
  { id: "AddOn", label: "Add-ons" }
] as const;

export type MenuSection = (typeof MENU_SECTIONS)[number]["id"];

export type MenuSelectorItem = {
  /// The menu item id for a dish, the add-on id for an add-on.
  id: string;
  kind: "Dish" | "AddOn";
  name: string;
  /// Which styles the dish has a counting rule for. Empty for an add-on.
  styles: string[];
  price: number | null;
  /// Optional: plenty of dishes have no photo. Null shows the placeholder.
  pictureUrl: string | null;
};

/// One chosen dish or add-on and the section it is being added under, which is
/// the style it will be served in.
export type MenuSelection = { item: MenuSelectorItem; section: MenuSection };

export function sectionLabel(section: MenuSection) {
  return MENU_SECTIONS.find((entry) => entry.id === section)?.label ?? section;
}

/**
 * A dish belongs to a service tab iff it has a rule for that style - the same
 * test the menu library's Buffet and Plated tabs use. A dish served both ways
 * appears under both without being stored twice.
 */
export function itemsForSection(
  items: MenuSelectorItem[],
  section: MenuSection
) {
  return section === "AddOn"
    ? items.filter((item) => item.kind === "AddOn")
    : items.filter(
        (item) => item.kind === "Dish" && item.styles.includes(section)
      );
}

type MenuItemSelectorDrawerProps = {
  initialSection: MenuSection;
  items: MenuSelectorItem[];
  /// Already on the menu, so the drawer can show it as added rather than
  /// letting someone add it twice.
  selectedIds: Set<string>;
  open: boolean;
  onClear: (section: MenuSection) => void;
  onClose: () => void;
  /// The whole batch at once. One call rather than one per dish, because each
  /// add is a save against the menu's version - firing them separately would
  /// have them race each other.
  onAdd: (selections: MenuSelection[]) => void;
};

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M6 3h12v18H6Z" />
      <path d="M9 7h6M9 11h6M9 15h4" />
    </svg>
  );
}

function CheckMark() {
  return (
    <svg
      aria-hidden="true"
      className="h-3 w-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      viewBox="0 0 24 24"
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

function formatPrice(price: number | null) {
  if (price === null) return null;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(price);
}

export function MenuItemSelectorDrawer({
  initialSection,
  items,
  selectedIds,
  open,
  onClear,
  onClose,
  onAdd
}: MenuItemSelectorDrawerProps) {
  const titleId = useId();
  const [activeSection, setActiveSection] =
    useState<MenuSection>(initialSection);
  // id -> the section it was picked under. Keyed by id rather than held as a
  // list so a dish cannot be queued twice, and holding the section means a
  // selection made on one tab survives switching to another.
  const [pending, setPending] = useState<Map<string, MenuSection>>(new Map());

  useEffect(() => {
    if (!open) return;

    setActiveSection(initialSection);
    // A fresh drawer starts empty; leftovers from the last time it was open
    // would be added by a click the user does not connect to them.
    setPending(new Map());

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [initialSection, open, onClose]);

  if (!open) return null;

  const visibleItems = itemsForSection(items, activeSection);
  const isAddOnSection = activeSection === "AddOn";

  /**
   * Clicking a dish already queued under this tab takes it back out; clicking
   * one queued under another tab moves it here, which is what someone reaching
   * for a dish on the Plated tab after picking it on Buffet actually means.
   */
  const toggle = (item: MenuSelectorItem) => {
    setPending((current) => {
      const next = new Map(current);

      if (next.get(item.id) === activeSection) next.delete(item.id);
      else next.set(item.id, activeSection);

      return next;
    });
  };

  const commit = () => {
    if (pending.size === 0) return;

    const byId = new Map(items.map((item) => [item.id, item]));
    const selections: MenuSelection[] = [];

    for (const [id, section] of pending) {
      const item = byId.get(id);
      if (item) selections.push({ item, section });
    }

    onAdd(selections);
  };

  return (
    <div
      className="dashboard-drawer-backdrop fixed inset-0 z-100 bg-[#17202a]/30"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <aside
        aria-labelledby={titleId}
        aria-modal="true"
        className="dashboard-drawer-enter ml-auto flex h-full w-full max-w-121.5 flex-col border-l border-[#d8dde5] bg-white shadow-2xl shadow-[#17202a]/20"
        role="dialog"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[#d8dde5] px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <MenuIcon />
            <h2
              className="min-w-0 truncate text-sm font-black text-[#17202a] sm:text-base"
              id={titleId}
            >
              Add to {sectionLabel(activeSection)}
            </h2>
          </div>

          <button
            aria-label="Close menu item selector"
            className="flex h-9 w-9 items-center justify-center rounded-full text-3xl leading-none text-[#17202a] hover:bg-[#eef4fa]"
            onClick={onClose}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <nav aria-label="Menu sections" className="flex flex-wrap gap-2">
            {MENU_SECTIONS.map((section) => {
              const queuedHere = [...pending.values()].filter(
                (value) => value === section.id
              ).length;

              return (
                <button
                  aria-pressed={activeSection === section.id}
                  className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-black transition sm:px-3 sm:text-xs ${
                    activeSection === section.id
                      ? "border-[#a9c6df] bg-[#eef4fa] text-[#173b58]"
                      : "border-[#b9c2cf] bg-white text-[#17202a] hover:bg-[#eef4fa]"
                  }`}
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  type="button"
                >
                  {section.label}
                  {/* So a selection made on another tab is not invisible. */}
                  {queuedHere > 0 ? (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#1f4d73] px-1 text-[9px] font-black text-white">
                      {queuedHere}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          <p className="mt-2 text-xs text-[#6a7483]">
            Pick as many as you need, then add them together.
          </p>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {visibleItems.map((item) => {
              const isAdded = selectedIds.has(item.id);
              const queuedIn = pending.get(item.id);
              const isQueuedHere = queuedIn === activeSection;
              const price = formatPrice(item.price);

              return (
                <button
                  aria-pressed={isQueuedHere}
                  className={`dashboard-hover-card flex min-h-21 items-center gap-3 rounded-xl border p-3 text-left disabled:cursor-not-allowed disabled:opacity-55 ${
                    isQueuedHere
                      ? "border-[#1f4d73] bg-[#eef4fa] ring-1 ring-[#1f4d73]"
                      : "border-[#d8dde5] bg-white hover:bg-[#fbfcfd] disabled:hover:bg-white"
                  }`}
                  disabled={isAdded}
                  key={item.id}
                  onClick={() => toggle(item)}
                  type="button"
                >
                  <MenuThumbnail pictureUrl={item.pictureUrl} />
                  <span className="min-w-0 flex-1">
                    <strong className="block wrap-break-word text-[13px] leading-5 text-[#17202a] sm:text-sm">
                      {item.name}
                    </strong>
                    <span className="mt-1 block text-xs text-[#6a7483]">
                      {isAdded
                        ? "Already on this menu"
                        : queuedIn && queuedIn !== activeSection
                          ? `Queued under ${sectionLabel(queuedIn)}`
                          : (price ??
                            // A dish served both ways is being pinned to this
                            // tab's style by the click, worth saying out loud.
                            (item.styles.length > 1
                              ? `Served ${item.styles.join(" and ").toLowerCase()}`
                              : sectionLabel(activeSection)))}
                    </span>
                  </span>
                  {isQueuedHere ? (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1f4d73] text-white">
                      <CheckMark />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {visibleItems.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-[#b9c2cf] px-4 py-8 text-center text-sm font-semibold text-[#6a7483]">
              {isAddOnSection
                ? "No add-ons have been set up yet. Create one on the Add-ons tab of the menu library."
                : `No items are served ${sectionLabel(activeSection).toLowerCase()} yet. Open a library item and give it a ${sectionLabel(activeSection).toLowerCase()} rule.`}
            </p>
          ) : null}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[#d8dde5] bg-[#fbfcfd] px-3 py-3">
          <button
            className="mr-auto h-9 rounded-lg border border-[#efb5ad] bg-white px-4 text-xs font-black text-[#c3291b] hover:bg-[#fff4f2]"
            onClick={() => onClear(activeSection)}
            type="button"
          >
            Clear {sectionLabel(activeSection).toLowerCase()}
          </button>
          <button
            className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-4 text-xs font-black text-[#17202a] hover:bg-[#eef4fa]"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
          <button
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white transition hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={pending.size === 0}
            onClick={commit}
            type="button"
          >
            {pending.size === 0
              ? "Add selected"
              : `Add ${pending.size} item${pending.size === 1 ? "" : "s"}`}
          </button>
        </footer>
      </aside>
    </div>
  );
}
