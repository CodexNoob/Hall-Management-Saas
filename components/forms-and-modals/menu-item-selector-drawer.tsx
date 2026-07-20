"use client";

import { useEffect, useId, useState } from "react";

export const menuCourses = [
  "Appetizer",
  "Soup",
  "Main",
  "Side",
  "Drink",
  "Dessert",
  "More"
] as const;

export type MenuCourse = (typeof menuCourses)[number];

export type MenuSelectorItem = {
  id: string;
  name: string;
  course: MenuCourse;
};

type MenuItemSelectorDrawerProps = {
  initialCourse: MenuCourse;
  items: MenuSelectorItem[];
  open: boolean;
  onClear: (course: MenuCourse) => void;
  onClose: () => void;
  onSelect: (item: MenuSelectorItem) => void;
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

export function MenuItemSelectorDrawer({
  initialCourse,
  items,
  open,
  onClear,
  onClose,
  onSelect
}: MenuItemSelectorDrawerProps) {
  const titleId = useId();
  const [activeCourse, setActiveCourse] =
    useState<MenuCourse>(initialCourse);

  useEffect(() => {
    if (!open) return;

    setActiveCourse(initialCourse);

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
  }, [initialCourse, onClose, open]);

  if (!open) return null;

  const visibleItems = items.filter(
    (item) => item.course === activeCourse
  );

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
              Select {activeCourse}
            </h2>
          </div>

          <button
            className="h-8 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black text-[#17202a] hover:bg-[#eef4fa]"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <nav
            aria-label="Menu courses"
            className="flex flex-wrap gap-2"
          >
            {menuCourses.map((course) => (
              <button
                aria-pressed={activeCourse === course}
                className={`h-8 rounded-lg border px-2.5 text-[11px] font-black transition sm:px-3 sm:text-xs ${
                  activeCourse === course
                    ? "border-[#a9c6df] bg-[#eef4fa] text-[#173b58]"
                    : "border-[#b9c2cf] bg-white text-[#17202a] hover:bg-[#eef4fa]"
                }`}
                key={course}
                onClick={() => setActiveCourse(course)}
                type="button"
              >
                {course}
              </button>
            ))}
          </nav>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {visibleItems.map((item) => (
              <button
                className="dashboard-hover-card min-h-21 rounded-xl border border-[#d8dde5] bg-white p-3 text-left hover:bg-[#fbfcfd]"
                key={item.id}
                onClick={() => onSelect(item)}
                type="button"
              >
                <strong className="block wrap-break-word text-[13px] leading-5 text-[#17202a] sm:text-sm">
                  {item.name}
                </strong>
                <span className="mt-1 block text-xs text-[#6a7483]">
                  {item.course}
                </span>
              </button>
            ))}
          </div>

          {visibleItems.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-[#b9c2cf] px-4 py-8 text-center text-sm font-semibold text-[#6a7483]">
              No {activeCourse.toLowerCase()} items are available.
            </p>
          ) : null}
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-[#d8dde5] bg-[#fbfcfd] px-3 py-3">
          <button
            className="h-9 rounded-lg border border-[#efb5ad] bg-white px-4 text-xs font-black text-[#c3291b] hover:bg-[#fff4f2]"
            onClick={() => onClear(activeCourse)}
            type="button"
          >
            Clear
          </button>
          <button
            className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-4 text-xs font-black text-[#17202a] hover:bg-[#eef4fa]"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </footer>
      </aside>
    </div>
  );
}
