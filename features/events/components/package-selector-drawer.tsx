"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { LineIcon } from "@/features/events/components/event-manager-shared";

/**
 * Picking the package an event is served from.
 *
 * The library's Packages tab is where a package is built; this is where one is
 * put on an event. It reads the same `/api/menu` payload the dish selector
 * already has cached, so opening it costs nothing, and it shows what applying
 * would actually do - which dishes land, under which service style, and how many
 * of them are on the menu already - because the click after this one writes the
 * whole set at once.
 */

export type PackageSelectorItem = {
  id: string;
  name: string;
  /// Styles the dish has a counting rule for. One means it lands there; two
  /// means the event has to answer; none means the kitchen has no rule to run.
  styles: string[];
};

export type PackageOption = {
  id: string;
  name: string;
  price: number | null;
  /// Resolved against the library, so an id pointing at a deactivated or
  /// deleted dish is simply not here - the same set the server will add.
  items: PackageSelectorItem[];
  /// Ids the package lists that no active library item answers to.
  missingCount: number;
};

const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

/** What the dish's rules say this line will be when the package is applied. */
function styleLabel(item: PackageSelectorItem) {
  if (item.styles.length === 1) return item.styles[0];
  if (item.styles.length > 1) return "Needs a style";

  return "No service rule";
}

function styleTone(item: PackageSelectorItem) {
  return item.styles.length === 1
    ? "border-[#cfe0ee] bg-[#eef4fa] text-[#173b58]"
    : "border-[#f0d9a8] bg-[#fdf8ec] text-[#8a6414]";
}

export function PackageSelectorDrawer({
  open,
  packages,
  appliedPackageId,
  menuItemIds,
  isSaving,
  onApply,
  onClose
}: {
  open: boolean;
  packages: PackageOption[];
  /// The package this event already carries, so the card can say so instead of
  /// offering to apply what is applied.
  appliedPackageId: string | null;
  /// Dishes already on the menu, by menu item id. Used only to say how much of
  /// a package is redundant before the user commits to it.
  menuItemIds: Set<string>;
  isSaving: boolean;
  onApply: (option: PackageOption) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;

    // A fresh drawer starts unanswered. A leftover choice would be applied by a
    // click the user does not connect to it.
    setChosenId(null);
    setSearch("");

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSaving, onClose, open]);

  const normalizedSearch = search.trim().toLowerCase();
  const visiblePackages = useMemo(
    () =>
      normalizedSearch
        ? packages.filter((option) =>
            `${option.name} ${option.items.map((item) => item.name).join(" ")}`
              .toLowerCase()
              .includes(normalizedSearch)
          )
        : packages,
    [normalizedSearch, packages]
  );

  if (!open) return null;

  const chosen = packages.find((option) => option.id === chosenId) ?? null;
  const applied = packages.find((option) => option.id === appliedPackageId);
  const isSwap = Boolean(chosen && applied && chosen.id !== applied.id);

  return (
    <div
      className="dashboard-drawer-backdrop fixed inset-0 z-100 bg-[#17202a]/30"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !isSaving) onClose();
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
            <LineIcon name="box" />
            <h2
              className="min-w-0 truncate text-sm font-black text-[#17202a] sm:text-base"
              id={titleId}
            >
              Add a package
            </h2>
          </div>

          <button
            aria-label="Close package selector"
            className="flex h-9 w-9 items-center justify-center rounded-full text-3xl leading-none text-[#17202a] hover:bg-[#eef4fa]"
            onClick={onClose}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <p className="text-xs text-[#6a7483]">
            Every dish in the package is added to this menu at once. Dishes you
            added by hand are left alone.
          </p>

          {packages.length > 4 ? (
            <input
              aria-label="Search packages"
              className="mt-3 h-9 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm text-[#17202a] placeholder:text-[#8a95a5] focus:border-[#1f4d73] focus:outline-none"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search packages or the dishes in them"
              type="search"
              value={search}
            />
          ) : null}

          <div className="mt-3 space-y-2.5">
            {visiblePackages.map((option) => {
              const isChosen = option.id === chosenId;
              const isApplied = option.id === appliedPackageId;
              const alreadyOnMenu = option.items.filter((item) =>
                menuItemIds.has(item.id)
              ).length;

              return (
                <button
                  aria-pressed={isChosen}
                  className={`dashboard-hover-card block w-full rounded-xl border p-3 text-left ${
                    isChosen
                      ? "border-[#1f4d73] bg-[#eef4fa] ring-1 ring-[#1f4d73]"
                      : "border-[#d8dde5] bg-white hover:bg-[#fbfcfd]"
                  }`}
                  key={option.id}
                  onClick={() => setChosenId(isChosen ? null : option.id)}
                  type="button"
                >
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <strong className="wrap-break-word text-[13px] leading-5 text-[#17202a] sm:text-sm">
                      {option.name}
                    </strong>
                    <span className="flex items-center gap-2">
                      {isApplied ? (
                        <span className="rounded-full bg-[#e7f6ed] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#167442]">
                          On this event
                        </span>
                      ) : null}
                      {option.price === null ? null : (
                        <span className="text-xs font-black text-[#1f4d73]">
                          {priceFormatter.format(option.price)}
                        </span>
                      )}
                    </span>
                  </span>

                  <span className="mt-1 block text-xs text-[#6a7483]">
                    {option.items.length} dish
                    {option.items.length === 1 ? "" : "es"}
                    {alreadyOnMenu > 0
                      ? ` · ${alreadyOnMenu} already on this menu`
                      : ""}
                    {option.missingCount > 0
                      ? ` · ${option.missingCount} no longer in the library`
                      : ""}
                  </span>

                  {option.items.length > 0 ? (
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      {option.items.map((item) => (
                        <span
                          className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${styleTone(item)}`}
                          key={item.id}
                        >
                          <span className="truncate font-black">
                            {item.name}
                          </span>
                          <span className="shrink-0 opacity-75">
                            {styleLabel(item)}
                          </span>
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="mt-2 block text-xs text-[#8a6414]">
                      Nothing active to add. Put items in this package on the
                      Packages tab of the menu library.
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {visiblePackages.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-[#b9c2cf] px-4 py-8 text-center text-sm font-semibold text-[#6a7483]">
              {packages.length === 0
                ? "No packages have been set up yet. Build one on the Packages tab of the menu library."
                : "No package matches that search."}
            </p>
          ) : null}
        </div>

        <footer className="shrink-0 border-t border-[#d8dde5] bg-[#fbfcfd] px-3 py-3">
          {isSwap && applied ? (
            <p className="mb-2 rounded-lg border border-[#f0d9a8] bg-[#fdf8ec] px-3 py-2 text-xs text-[#8a6414]">
              This replaces {applied.name}. Its dishes come off unless the new
              package includes them too.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-4 text-xs font-black text-[#17202a] hover:bg-[#eef4fa] disabled:opacity-50"
              disabled={isSaving}
              onClick={onClose}
              type="button"
            >
              Close
            </button>
            <button
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white transition hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!chosen || chosen.items.length === 0 || isSaving}
              onClick={() => chosen && onApply(chosen)}
              type="button"
            >
              <LineIcon name="check" />
              {isSaving
                ? "Adding..."
                : chosen
                  ? `Add ${chosen.name}`
                  : "Add package"}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
