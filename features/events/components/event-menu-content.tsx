"use client";

import { useMemo, useState } from "react";
import {
  MenuItemSelectorDrawer,
  type MenuCourse,
  type MenuSelectorItem
} from "@/features/events/components/menu-item-selector-drawer";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import {
  LineIcon,
  addMenuItems,
  fallbackMenuLibrary,
  menuItems,
  type EventMenuResponse
} from "@/features/events/components/event-manager-shared";

function normalizeMenuCourse(category: string | null): MenuCourse {
  const value = category?.trim().toLowerCase() ?? "";

  if (value.includes("appetizer")) return "Appetizer";
  if (value.includes("soup")) return "Soup";
  if (value.includes("main") || value.includes("entree")) return "Main";
  if (value.includes("side")) return "Side";
  if (value.includes("drink") || value.includes("beverage")) return "Drink";
  if (value.includes("dessert")) return "Dessert";
  return "More";
}

function courseFromAddLabel(label: string): MenuCourse {
  const course = label.replace(/^Add\s+/i, "").trim();
  return course === "more" || course === "More"
    ? "More"
    : (course as MenuCourse);
}

function MenuDishCard({
  course,
  name,
  onClick
}: {
  course: MenuCourse;
  name: string;
  onClick: () => void;
}) {
  return (
    <button
      className="dashboard-hover-card flex h-28 min-w-0 flex-col overflow-hidden rounded-lg border border-[#d8dde5] bg-white text-left sm:h-40 lg:h-44"
      onClick={onClick}
      type="button"
    >
      <div className="flex flex-1 items-center justify-center bg-[#fbfcfd]">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#b9c2cf] sm:h-16 sm:w-16 lg:h-18 lg:w-18">
          <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-[#d8dde5] bg-white px-0.5 text-center text-[6px] font-black uppercase leading-2 tracking-normal text-[#1f4d73] sm:h-10 sm:w-10 sm:text-[7px] sm:leading-2.5 lg:h-11 lg:w-11 lg:px-1 lg:text-[8px] lg:leading-3 lg:tracking-[0.03em]">
            {course}
          </span>
        </div>
      </div>
      <div className="flex h-10 items-center justify-center border-t border-[#d8dde5] px-1 sm:h-12 sm:px-2">
        <h3 className="line-clamp-2 wrap-break-word text-center text-[9px] font-black leading-3 text-[#17202a] sm:text-xs sm:leading-4 lg:text-sm">
          {name}
        </h3>
      </div>
    </button>
  );
}

function AddMenuCard({
  label,
  onClick
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="dashboard-hover-card flex h-28 min-w-0 flex-col overflow-hidden rounded-lg border border-dashed border-[#b9c2cf] bg-[#fbfcfd] text-[#17202a] hover:bg-[#eef4fa] sm:h-40 lg:h-44"
      onClick={onClick}
      type="button"
    >
      <div className="flex flex-1 items-center justify-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-dashed border-[#b9c2cf] bg-white text-[#1f4d73] sm:h-14 sm:w-14 sm:rounded-2xl">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#d8dde5] sm:h-8 sm:w-8">
            <LineIcon name="plus" className="h-3.5 w-3.5" />
          </span>
        </span>
      </div>
      <div className="flex h-10 w-full items-center justify-center border-t border-[#d8dde5] px-1 sm:h-12 sm:px-2">
        <span className="line-clamp-2 wrap-break-word text-center text-[9px] font-black leading-3 sm:text-xs sm:leading-4 lg:text-sm">
          {label}
        </span>
      </div>
    </button>
  );
}

export function EventMenuContent() {
  const menuQuery = useAuthenticatedQuery<EventMenuResponse>("/api/menu");
  const [selectedItems, setSelectedItems] =
    useState<Array<{ course: MenuCourse; name: string }>>(menuItems);
  const [selectorCourse, setSelectorCourse] = useState<MenuCourse | null>(null);
  const libraryItems = useMemo<MenuSelectorItem[]>(() => {
    const liveItems = (menuQuery.data?.items ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      course: normalizeMenuCourse(item.category)
    }));

    return liveItems.length ? liveItems : fallbackMenuLibrary;
  }, [menuQuery.data]);

  const selectMenuItem = (item: MenuSelectorItem) => {
    setSelectedItems((current) =>
      current.some(
        (selected) =>
          selected.course === item.course && selected.name === item.name
      )
        ? current
        : [...current, { course: item.course, name: item.name }]
    );
    setSelectorCourse(null);
  };

  const clearCourse = (course: MenuCourse) => {
    setSelectedItems((current) =>
      current.filter((item) => item.course !== course)
    );
  };

  return (
    <>
      <section className="dashboard-panel-enter rounded-lg border border-[#d8dde5] bg-white">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d8dde5] px-3 py-3 sm:px-4">
          <div className="flex items-center gap-2">
            <LineIcon name="document" />
            <h2 className="text-[13px] font-black text-[#17202a] sm:text-sm">
              Menu for this event
            </h2>
          </div>
          <button
            className="inline-flex h-8 shrink-0 items-center gap-2 rounded-lg bg-[#1f4d73] px-3 text-[11px] font-black text-white transition hover:-translate-y-0.5 hover:bg-[#15344f] sm:px-4 sm:text-xs"
            type="button"
          >
            <LineIcon name="check" />
            Confirm menu
          </button>
        </header>
        <div className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-4 sm:gap-3">
          {selectedItems.map((item) => (
            <MenuDishCard
              key={`${item.course}-${item.name}`}
              {...item}
              onClick={() => setSelectorCourse(item.course)}
            />
          ))}
          {addMenuItems.map((label) => (
            <AddMenuCard
              key={label}
              label={label}
              onClick={() => setSelectorCourse(courseFromAddLabel(label))}
            />
          ))}
        </div>
      </section>

      <MenuItemSelectorDrawer
        initialCourse={selectorCourse ?? "Appetizer"}
        items={libraryItems}
        onClear={clearCourse}
        onClose={() => setSelectorCourse(null)}
        onSelect={selectMenuItem}
        open={selectorCourse !== null}
      />
    </>
  );
}
