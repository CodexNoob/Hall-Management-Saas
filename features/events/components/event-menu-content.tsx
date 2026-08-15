"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MenuItemSelectorDrawer,
  type MenuCourse,
  type MenuSelectorItem
} from "@/features/events/components/menu-item-selector-drawer";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import {
  LineIcon,
  addMenuItems,
  type EventFile,
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
  onClick,
  disabled = false
}: {
  course: MenuCourse;
  name: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className="dashboard-hover-card flex h-28 min-w-0 flex-col overflow-hidden rounded-lg border border-[#d8dde5] bg-white text-left disabled:cursor-not-allowed disabled:opacity-65 sm:h-40 lg:h-44"
      onClick={onClick}
      disabled={disabled}
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
  onClick,
  disabled = false
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className="dashboard-hover-card flex h-28 min-w-0 flex-col overflow-hidden rounded-lg border border-dashed border-[#b9c2cf] bg-[#fbfcfd] text-[#17202a] hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-65 sm:h-40 lg:h-44"
      onClick={onClick}
      disabled={disabled}
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

export function EventMenuContent({
  event,
  onEventSaved
}: {
  event: EventFile;
  onEventSaved: () => Promise<unknown>;
}) {
  const menuQuery = useAuthenticatedQuery<EventMenuResponse>("/api/menu");
  const [selectedItems, setSelectedItems] = useState<MenuSelectorItem[]>([]);
  const [selectorCourse, setSelectorCourse] = useState<MenuCourse | null>(null);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isConfirmed = event.workspaceData.menuConfirmed === true;
  const libraryItems = useMemo<MenuSelectorItem[]>(() => {
    const liveItems = (menuQuery.data?.items ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      course: normalizeMenuCourse(item.category)
    }));

    return liveItems;
  }, [menuQuery.data]);

  useEffect(() => {
    if (menuQuery.isLoading) return;

    const selectedIds = new Set(event.menuItemIds ?? []);
    setSelectedItems(libraryItems.filter((item) => selectedIds.has(item.id)));
    setConfirmMessage(
      event.workspaceData.menuConfirmed === true ? "Menu confirmed." : ""
    );
  }, [
    event.id,
    event.menuItemIds,
    event.workspaceData,
    libraryItems,
    menuQuery.isLoading
  ]);

  useEffect(() => {
    if (!isReviewOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "Escape" && !isSaving) {
        setIsReviewOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isReviewOpen, isSaving]);

  const selectMenuItem = (item: MenuSelectorItem) => {
    setSelectedItems((current) =>
      current.some((selected) => selected.id === item.id)
        ? current
        : [...current, item]
    );
    setSelectorCourse(null);
  };

  const clearCourse = (course: MenuCourse) => {
    setSelectedItems((current) =>
      current.filter((item) => item.course !== course)
    );
  };

  const saveConfirmationState = async (menuConfirmed: boolean) => {
    setIsSaving(true);
    setConfirmMessage("");

    try {
      const response = await authenticatedFetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(menuConfirmed
            ? { menuItemIds: selectedItems.map((item) => item.id) }
            : {}),
          menuConfirmed
        })
      });

      if (!response.ok) {
        setConfirmMessage(
          menuConfirmed ? "Could not confirm menu." : "Could not reopen menu."
        );
        return;
      }

      setIsReviewOpen(false);
      await onEventSaved();
      setConfirmMessage(menuConfirmed ? "Menu confirmed." : "Menu reopened.");
    } catch {
      setConfirmMessage(
        menuConfirmed ? "Could not confirm menu." : "Could not reopen menu."
      );
    } finally {
      setIsSaving(false);
    }
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
          <div className="flex items-center gap-2">
            {isConfirmed ? (
              <>
                <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#e7f6ed] px-3 text-xs font-black text-[#167442]">
                  <LineIcon name="check" />
                  Confirmed
                </span>
                <button
                  className="h-8 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black text-[#17202a] hover:bg-[#eef4fa] disabled:opacity-50"
                  disabled={isSaving}
                  onClick={() => void saveConfirmationState(false)}
                  type="button"
                >
                  {isSaving ? "Reopening..." : "Reopen menu"}
                </button>
              </>
            ) : (
              <button
                className="inline-flex h-8 shrink-0 items-center gap-2 rounded-lg bg-[#1f4d73] px-3 text-[11px] font-black text-white transition hover:-translate-y-0.5 hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:text-xs"
                disabled={isSaving}
                type="button"
                onClick={() => {
                  if (selectedItems.length === 0) {
                    setConfirmMessage(
                      "Add at least one menu item before confirming."
                    );
                    return;
                  }
                  setConfirmMessage("");
                  setIsReviewOpen(true);
                }}
              >
                <LineIcon name="check" />
                Review &amp; confirm
              </button>
            )}
          </div>
          {confirmMessage ? (
            <span className="text-xs text-[#516174]" role="status">
              {confirmMessage}
            </span>
          ) : null}
        </header>
        <div className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-4 sm:gap-3">
          {selectedItems.map((item) => (
            <MenuDishCard
              key={`${item.course}-${item.name}`}
              course={item.course}
              name={item.name}
              onClick={() => setSelectorCourse(item.course)}
              disabled={isConfirmed}
            />
          ))}
          {addMenuItems.map((label) => (
            <AddMenuCard
              key={label}
              label={label}
              onClick={() => setSelectorCourse(courseFromAddLabel(label))}
              disabled={isConfirmed}
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

      {isReviewOpen ? (
        <div
          className="fixed inset-0 z-110 flex items-center justify-center bg-[#17202a]/45 p-4"
          onMouseDown={(mouseEvent) => {
            if (mouseEvent.currentTarget === mouseEvent.target && !isSaving) {
              setIsReviewOpen(false);
            }
          }}
        >
          <section
            aria-labelledby="menu-confirmation-title"
            aria-modal="true"
            className="w-full max-w-lg overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-2xl"
            role="dialog"
          >
            <header className="border-b border-[#d8dde5] px-5 py-4">
              <h2
                className="text-lg font-black text-[#17202a]"
                id="menu-confirmation-title"
              >
                Confirm event menu?
              </h2>
              <p className="mt-1 text-sm text-[#64748b]">
                Review {selectedItems.length} selected item
                {selectedItems.length === 1 ? "" : "s"}. The menu will be locked
                until it is reopened.
              </p>
            </header>

            <div className="max-h-[55vh] space-y-3 overflow-y-auto p-5">
              {Array.from(
                new Set(selectedItems.map((item) => item.course))
              ).map((course) => (
                <section
                  className="rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-3"
                  key={course}
                >
                  <h3 className="text-xs font-black uppercase tracking-wide text-[#1f4d73]">
                    {course}
                  </h3>
                  <ul className="mt-2 space-y-1 text-sm text-[#17202a]">
                    {selectedItems
                      .filter((item) => item.course === course)
                      .map((item) => (
                        <li key={item.id}>• {item.name}</li>
                      ))}
                  </ul>
                </section>
              ))}
            </div>

            <footer className="flex justify-end gap-2 border-t border-[#d8dde5] bg-[#fbfcfd] px-5 py-4">
              <button
                className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-4 text-xs font-black text-[#17202a] hover:bg-[#eef4fa] disabled:opacity-50"
                disabled={isSaving}
                onClick={() => setIsReviewOpen(false)}
                type="button"
              >
                Go back
              </button>
              <button
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white hover:bg-[#15344f] disabled:opacity-50"
                disabled={isSaving}
                onClick={() => void saveConfirmationState(true)}
                type="button"
              >
                <LineIcon name="check" />
                {isSaving ? "Confirming..." : "Confirm & lock menu"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
