"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MenuItemSelectorDrawer,
  type MenuSelectorItem
} from "@/features/events/components/menu-item-selector-drawer";
import {
  invalidateAuthenticatedQuery,
  useAuthenticatedQuery
} from "@/features/dashboard/hooks/use-authenticated-query";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import {
  LineIcon,
  type EventFile,
  type EventMenuDocument,
  type EventMenuDocumentResponse,
  type EventMenuLine,
  type EventMenuResponse
} from "@/features/events/components/event-manager-shared";

const UNFILED_LABEL = "Unfiled";

function MenuDishCard({
  course,
  name,
  onClick,
  disabled = false
}: {
  course: string;
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
  const menuUrl = `/api/events/${event.id}/menu`;
  const libraryQuery = useAuthenticatedQuery<EventMenuResponse>("/api/menu");
  const documentQuery = useAuthenticatedQuery<EventMenuDocumentResponse>(menuUrl);

  const [menu, setMenu] = useState<EventMenuDocument | null>(null);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [selectorCategoryId, setSelectorCategoryId] = useState<string | null>(
    null
  );
  const [message, setMessage] = useState("");
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (documentQuery.data) setMenu(documentQuery.data.menu);
  }, [documentQuery.data]);

  const isConfirmed = menu?.status === "Confirmed";
  const lines = useMemo(() => menu?.lines ?? [], [menu]);

  // The course tabs, straight from the organization's own categories.
  const categories = useMemo(
    () => documentQuery.data?.categories ?? [],
    [documentQuery.data]
  );

  const libraryItems = useMemo<MenuSelectorItem[]>(
    () =>
      (libraryQuery.data?.items ?? [])
        // A deactivated dish stays on menus that already carry it but is not
        // offered for anything new.
        .filter((item) => item.isActive)
        .map((item) => ({
          id: item.id,
          name: item.name,
          categoryId: item.categoryId,
          categoryName: item.category
        })),
    [libraryQuery.data]
  );

  /**
   * Sends the menu the user now wants. Every add and remove goes through here,
   * which is the whole point of the rewrite: the previous version only ever
   * saved as part of confirming, so a menu built and left unconfirmed was gone
   * on the next reload.
   */
  const saveLines = async (nextLines: EventMenuLine[]) => {
    if (!menu) return;

    const previous = menu;
    // Shown immediately; rolled back below if the write does not land.
    setMenu({ ...menu, lines: nextLines });
    setIsSaving(true);
    setMessage("");

    try {
      const response = await authenticatedFetch(menuUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meal: menu.meal,
          version: menu.version,
          lines: nextLines.map((line) => ({
            menuItemId: line.menuItemId,
            serviceStyle: line.serviceStyle,
            notes: line.notes
          }))
        })
      });

      const payload = (await response.json().catch(() => null)) as
        | { menu?: EventMenuDocument; error?: string }
        | null;

      if (!response.ok || !payload?.menu) {
        setMenu(previous);
        setMessage(payload?.error ?? "Could not save the menu.");

        // A conflict means somebody else's version is the real one, so pull it
        // rather than leaving the stale one on screen.
        if (response.status === 409) {
          invalidateAuthenticatedQuery(menuUrl);
          await documentQuery.refetch();
        }

        return;
      }

      setMenu(payload.menu);
      invalidateAuthenticatedQuery(menuUrl);
    } catch {
      setMenu(previous);
      setMessage("Could not save the menu.");
    } finally {
      setIsSaving(false);
    }
  };

  const selectMenuItem = (item: MenuSelectorItem) => {
    setIsSelectorOpen(false);

    if (!menu || lines.some((line) => line.menuItemId === item.id)) return;

    void saveLines([
      ...lines,
      {
        // Provisional until the server answers with the real row.
        id: `pending-${item.id}`,
        menuItemId: item.id,
        name: item.name,
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        serviceStyle: null,
        notes: null,
        sortOrder: lines.length,
        source: "Manual",
        kind: "Food",
        isRetired: false
      }
    ]);
  };

  const clearCategory = (categoryId: string | null) => {
    void saveLines(lines.filter((line) => line.categoryId !== categoryId));
  };

  const openSelector = (categoryId: string | null) => {
    setSelectorCategoryId(categoryId);
    setIsSelectorOpen(true);
  };

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

  const saveConfirmationState = async (confirming: boolean) => {
    if (!menu) return;

    setIsSaving(true);
    setMessage("");

    try {
      const response = await authenticatedFetch(menuUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: confirming ? "confirm" : "reopen",
          meal: menu.meal,
          version: menu.version
        })
      });

      const payload = (await response.json().catch(() => null)) as
        | { menu?: EventMenuDocument; error?: string }
        | null;

      if (!response.ok || !payload?.menu) {
        setMessage(
          payload?.error ??
            (confirming ? "Could not confirm menu." : "Could not reopen menu.")
        );

        if (response.status === 409) {
          invalidateAuthenticatedQuery(menuUrl);
          await documentQuery.refetch();
        }

        return;
      }

      setMenu(payload.menu);
      invalidateAuthenticatedQuery(menuUrl);
      setIsReviewOpen(false);
      // The event row carries the mirrored ids and the confirmation flag, so
      // the rest of the manager has to re-read it.
      await onEventSaved();
      setMessage(confirming ? "Menu confirmed." : "Menu reopened.");
    } catch {
      setMessage(
        confirming ? "Could not confirm menu." : "Could not reopen menu."
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
                disabled={isSaving || documentQuery.isLoading}
                type="button"
                onClick={() => {
                  if (lines.length === 0) {
                    setMessage("Add at least one menu item before confirming.");
                    return;
                  }
                  setMessage("");
                  setIsReviewOpen(true);
                }}
              >
                <LineIcon name="check" />
                Review &amp; confirm
              </button>
            )}
          </div>
          {message ? (
            <span className="text-xs text-[#516174]" role="status">
              {message}
            </span>
          ) : null}
          {!message && isSaving ? (
            <span className="text-xs text-[#516174]" role="status">
              Saving...
            </span>
          ) : null}
        </header>
        <div className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-4 sm:gap-3">
          {lines.map((line) => (
            <MenuDishCard
              key={line.id}
              course={line.categoryName ?? UNFILED_LABEL}
              name={line.name}
              onClick={() => openSelector(line.categoryId)}
              disabled={isConfirmed}
            />
          ))}
          {categories.map((category) => (
            <AddMenuCard
              key={category.id}
              label={`Add ${category.name}`}
              onClick={() => openSelector(category.id)}
              disabled={isConfirmed}
            />
          ))}
        </div>
      </section>

      <MenuItemSelectorDrawer
        categories={categories}
        initialCategoryId={selectorCategoryId}
        items={libraryItems}
        onClear={clearCategory}
        onClose={() => setIsSelectorOpen(false)}
        onSelect={selectMenuItem}
        open={isSelectorOpen}
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
                Review {lines.length} selected item
                {lines.length === 1 ? "" : "s"}. The menu will be locked until
                it is reopened.
              </p>
            </header>

            <div className="max-h-[55vh] space-y-3 overflow-y-auto p-5">
              {/* Already ordered by course then position, so grouping is just
                  a walk over the distinct labels in that order. */}
              {[
                ...new Set(
                  lines.map((line) => line.categoryName ?? UNFILED_LABEL)
                )
              ].map((course) => (
                <section
                  className="rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-3"
                  key={course}
                >
                  <h3 className="text-xs font-black uppercase tracking-wide text-[#1f4d73]">
                    {course}
                  </h3>
                  <ul className="mt-2 space-y-1 text-sm text-[#17202a]">
                    {lines
                      .filter(
                        (line) =>
                          (line.categoryName ?? UNFILED_LABEL) === course
                      )
                      .map((line) => (
                        <li key={line.id}>• {line.name}</li>
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
