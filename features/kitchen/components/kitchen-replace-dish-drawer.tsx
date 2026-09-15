"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { AsyncState } from "@/components/ui/async-state";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import {
  MenuThumbnail,
  type EventKitchenLine,
  type EventMenuResponse
} from "@/features/events/components/event-manager-shared";
import { LineQuantity } from "@/features/kitchen/components/kitchen-line-presentation";
import { resolveReplacementStyle } from "@/features/kitchen/components/kitchen-shared";
import { isDrinkKind } from "@/features/menu/lib/service-style";

/**
 * Swapping one dish for another, from the board.
 *
 * The kitchen is where a dish stops being possible - a delivery is short, a tray
 * comes out wrong - so this is where the swap is offered. It reads the menu
 * library rather than the event, because the question being answered is "what
 * else could we cook", and a list of names would not answer it: a cook picks
 * food by looking at it, which is why every row carries its picture.
 *
 * Nothing is written until the footer, which names both ends of the swap. A
 * replacement is a change to what the client was promised, and the person making
 * it should be able to read the sentence before they agree to it.
 */

type ReplacementOption = {
  id: string;
  name: string;
  pictureUrl: string | null;
  styles: string[];
  /// The style this dish would be served in here, or null if nobody has said.
  landsAs: string | null;
  /// Already on this event's menu, so it cannot go on twice - a dish appears
  /// once per menu, and the database will not hold a second line for it.
  isOnMenu: boolean;
  kind: "dish" | "add-on";
};

function replacementGroup(line: EventKitchenLine) {
  if (line.kind === "AddOn") return "add-on" as const;
  if (isDrinkKind(line.itemKind ?? "")) return "drink" as const;
  if (line.serviceStyle === "Plated") return "plated" as const;
  if (line.serviceStyle === "Buffet") return "buffet" as const;
  return "other" as const;
}

function styleNote(option: ReplacementOption) {
  if (option.isOnMenu) return "Already on this menu";
  if (option.kind === "add-on") return "Add-on";
  if (option.landsAs) return `Will be served ${option.landsAs.toLowerCase()}`;
  if (option.styles.length > 1) {
    return "Served both ways - needs a style set on the Menu tab";
  }

  return "No counting rule, so there is no quantity to cook to";
}

export function KitchenReplaceDishDrawer({
  isSaving,
  line,
  menuStatus,
  onClose,
  onReplace,
  usedMenuItemIds
}: {
  isSaving: boolean;
  /// The dish coming off.
  line: EventKitchenLine;
  /// `Confirmed` means the client has already been shown this menu.
  menuStatus: string;
  onClose: () => void;
  /// Rejects with the server's own message, which is what the footer prints.
  onReplace: (
    replacementMenuItemId: string,
    reason?: string
  ) => Promise<void>;
  usedMenuItemIds: Set<string>;
}) {
  const titleId = useId();
  const searchId = useId();
  const libraryQuery = useAuthenticatedQuery<EventMenuResponse>("/api/menu");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  // Shown only once the server has said it needs one. See `replace` below.
  const [needsReason, setNeedsReason] = useState(false);
  const [reason, setReason] = useState("");
  const group = replacementGroup(line);

  useEffect(() => {
    const handleKeyDown = (keyEvent: KeyboardEvent) => {
      // Only this layer closes: the drawer is the topmost thing on screen, and
      // taking the dialog underneath with it would lose the board position too.
      if (keyEvent.key === "Escape") {
        keyEvent.stopPropagation();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const options = useMemo<ReplacementOption[]>(() => {
    const query = search.trim().toLowerCase();
    if (group === "add-on") {
      return (libraryQuery.data?.addOns ?? [])
        .filter((item) => item.isActive && item.id !== line.addOnId)
        .filter((item) => !query || item.name.toLowerCase().includes(query))
        .map((item) => ({
          id: item.id,
          name: item.name,
          pictureUrl: item.pictureUrl,
          styles: [],
          landsAs: null,
          isOnMenu: usedMenuItemIds.has(item.id),
          kind: "add-on"
        }));
    }

    return (
      (libraryQuery.data?.items ?? [])
        // Retired dishes stay on the menus that already carry them but are not
        // offered for anything new, which is the rule the event's own menu drawer
        // follows - and the rule the server enforces on this write.
        .filter((item) => item.isActive && item.id !== line.menuItemId)
        .filter((item) => {
          if (group === "drink") return isDrinkKind(item.kind);
          if (isDrinkKind(item.kind)) return false;
          if (group === "plated" || group === "buffet") {
            const expected = group === "plated" ? "Plated" : "Buffet";
            return (item.services ?? []).some(
              (service) => service.serviceStyle === expected
            );
          }
          return true;
        })
        .filter((item) => !query || item.name.toLowerCase().includes(query))
        .map((item) => {
          const styles = [
            ...new Set(
              (item.services ?? []).map((service) => service.serviceStyle)
            )
          ];

          return {
            id: item.id,
            name: item.name,
            pictureUrl: item.pictureUrl,
            styles,
            landsAs: resolveReplacementStyle(line.serviceStyle, styles),
            isOnMenu: usedMenuItemIds.has(item.id),
            kind: "dish"
          };
        })
    );
  }, [
    libraryQuery.data,
    line.addOnId,
    group,
    line.menuItemId,
    line.serviceStyle,
    search,
    usedMenuItemIds
  ]);

  const selected = options.find((option) => option.id === selectedId) ?? null;

  async function replace() {
    if (!selected || isSaving) return;

    setMessage("");

    try {
      await onReplace(selected.id, reason.trim() || undefined);
      onClose();
    } catch (replaceError) {
      // The kitchen has already picked this dish up, so the route wants a
      // reason before it will swap it. Asked here rather than up front: most
      // swaps happen before anyone has touched the dish, and making everybody
      // justify those would train people to type "x" into the box.
      if (
        replaceError instanceof Error &&
        replaceError.message.includes("Say why it is being replaced")
      ) {
        setNeedsReason(true);
      }

      // The route answers with the reason - already on the menu, changed
      // elsewhere, no longer in the library - and each has a different next
      // move, so it is shown rather than flattened into "could not save".
      setMessage(
        replaceError instanceof Error
          ? replaceError.message
          : "Could not replace the dish."
      );
    }
  }

  return (
    <div
      className="dashboard-drawer-backdrop fixed inset-0 z-110 bg-[#07162d]/40"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.currentTarget === mouseEvent.target) onClose();
      }}
    >
      <aside
        aria-labelledby={titleId}
        aria-modal="true"
        className="dashboard-drawer-enter ml-auto flex h-full w-full max-w-121.5 flex-col border-l border-[#d8dde5] bg-white shadow-2xl shadow-[#17202a]/20"
        role="dialog"
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-[#d8dde5] px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2
              className="truncate text-sm font-black text-[#17202a] sm:text-base"
              id={titleId}
            >
              Replace {line.kind === "AddOn" ? "an add-on" : "a dish"}
            </h2>
            <p className="mt-0.5 text-xs text-[#6a7483]">
              Pick another item from the same menu section.
            </p>
          </div>

          <button
            aria-label="Close replacement picker"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-3xl leading-none text-[#17202a] hover:bg-[#eef4fa]"
            onClick={onClose}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {/* What is coming off, drawn the way the board draws it, so there is
              no doubt about which card this drawer was opened from. */}
          <section className="rounded-xl border border-[#e5c894] bg-[#fffaf1] p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#8a6414]">
              Coming off
            </p>
            <div className="mt-2 flex min-w-0 items-center gap-2.5">
              <MenuThumbnail
                className="h-11 w-11"
                pictureUrl={line.pictureUrl}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-[#17202a]">
                  {line.name}
                </p>
                <div className="mt-0.5">
                  <LineQuantity line={line} />
                </div>
              </div>
            </div>
          </section>

          {menuStatus === "Confirmed" ? (
            <p
              className="mt-2 rounded-lg border border-[#f0d9a8] bg-[#fdf8ec] px-3 py-2 text-xs leading-5 text-[#8a6414]"
              role="status"
            >
              This menu is confirmed, so the client has already been shown it.
              Replacing a dish changes what they were promised - tell whoever is
              running the event.
            </p>
          ) : null}

          <label className="mt-3 block" htmlFor={searchId}>
            <span className="sr-only">Search the menu library</span>
            <input
              autoComplete="off"
              className="h-10 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-semibold text-[#17202a] placeholder:font-normal placeholder:text-[#6a7483] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f4d73]"
              id={searchId}
              onChange={(changeEvent) => setSearch(changeEvent.target.value)}
              placeholder="Search dishes"
              type="search"
              value={search}
            />
          </label>

          {libraryQuery.isLoading || libraryQuery.error ? (
            <div className="mt-3">
              <AsyncState
                error={libraryQuery.error}
                isLoading={libraryQuery.isLoading}
                onRetry={() => void libraryQuery.refetch()}
              />
            </div>
          ) : options.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-[#b9c2cf] px-4 py-8 text-center text-sm font-semibold text-[#6a7483]">
              {search.trim()
                ? `Nothing in the menu library matches "${search.trim()}".`
                : "There is no other item in this section to swap this one for."}
            </p>
          ) : (
            <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {options.map((option) => {
                const isSelected = option.id === selectedId;

                return (
                  <li className="min-w-0" key={option.id}>
                    <button
                      aria-pressed={isSelected}
                      className={`dashboard-hover-card flex min-h-21 w-full items-center gap-3 rounded-xl border p-3 text-left disabled:cursor-not-allowed disabled:opacity-55 ${
                        isSelected
                          ? "border-[#1f4d73] bg-[#eef4fa] ring-1 ring-[#1f4d73]"
                          : "border-[#d8dde5] bg-white hover:bg-[#fbfcfd] disabled:hover:bg-white"
                      }`}
                      disabled={option.isOnMenu || isSaving}
                      onClick={() => setSelectedId(option.id)}
                      type="button"
                    >
                      <MenuThumbnail pictureUrl={option.pictureUrl} />
                      <span className="min-w-0 flex-1">
                        <strong className="block wrap-break-word text-[13px] leading-5 text-[#17202a] sm:text-sm">
                          {option.name}
                        </strong>
                        <span
                          className={`mt-1 block text-xs ${
                            !option.isOnMenu && !option.landsAs
                              ? "font-black text-[#9a5b00]"
                              : "text-[#6a7483]"
                          }`}
                        >
                          {styleNote(option)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="shrink-0 border-t border-[#d8dde5] bg-[#fbfcfd] px-3 py-3">
          {message ? (
            <p
              className="mb-2 rounded-lg border border-[#efb5ad] bg-[#fff4f2] px-3 py-2 text-xs font-semibold text-[#c3291b]"
              role="alert"
            >
              {message}
            </p>
          ) : null}

          {/* Appears only after the server has refused the swap for want of a
              reason, so an ordinary swap on an untouched dish stays one click.
              The text goes into the event's history beside who did it, which is
              what somebody fielding the client's question will read later. */}
          {needsReason ? (
            <label className="mb-2 block">
              <span className="mb-1 block text-xs font-black text-[#17202a]">
                Why is this being replaced?
              </span>
              <input
                autoFocus
                className="h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-2 text-xs font-black text-[#17202a] transition hover:border-[#1f4d73]"
                maxLength={500}
                onChange={(changeEvent) => setReason(changeEvent.target.value)}
                placeholder="Delivery was short"
                type="text"
                value={reason}
              />
            </label>
          ) : null}

          {/* The sentence the button carries out. Both dishes are named, in the
              order the swap happens, so it can be read back before agreeing. */}
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs font-black text-[#17202a]">
            {selected ? (
              <>
                <span className="truncate line-through decoration-[#c3291b]">
                  {line.name}
                </span>
                <span aria-hidden="true" className="text-[#6a7483]">
                  →
                </span>
                <span className="truncate text-[#0f5132]">{selected.name}</span>
              </>
            ) : (
              <span className="font-semibold text-[#6a7483]">
                Pick the {line.kind === "AddOn" ? "add-on" : "dish"} going on
                instead.
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
            <button
              className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-4 text-xs font-black text-[#17202a] hover:bg-[#eef4fa]"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white transition hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!selected || isSaving}
              onClick={() => void replace()}
              type="button"
            >
              {isSaving
                ? "Replacing…"
                : `Replace ${line.kind === "AddOn" ? "add-on" : "dish"}`}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
