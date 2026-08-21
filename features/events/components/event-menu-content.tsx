"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MENU_SECTIONS,
  MenuItemSelectorDrawer,
  type MenuSection,
  type MenuSelection,
  type MenuSelectorItem
} from "@/features/events/components/menu-item-selector-drawer";
import {
  invalidateAuthenticatedQuery,
  setAuthenticatedQueryData,
  useAuthenticatedQuery
} from "@/features/dashboard/hooks/use-authenticated-query";
import {
  PackageSelectorDrawer,
  type PackageOption
} from "@/features/events/components/package-selector-drawer";
import { AsyncState } from "@/components/ui/async-state";
import { EventMenuPackageBar } from "@/features/events/components/event-menu-package-bar";
import {
  EventMenuRuleBand,
  rulelessLines
} from "@/features/events/components/event-menu-rule-band";
import { EventMenuSkeleton } from "@/features/events/components/event-menu-skeleton";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import {
  LineIcon,
  MenuThumbnail,
  type EventFile,
  type EventMenuDocument,
  type EventMenuDocumentResponse,
  type EventMenuLine,
  type EventMenuResponse
} from "@/features/events/components/event-manager-shared";

const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

/** The id a line points at, which is what the drawer matches against. */
function targetId(line: EventMenuLine) {
  return line.menuItemId ?? line.addOnId ?? "";
}

function MenuDishCard({
  badge,
  name,
  detail,
  pictureUrl,
  onRemove,
  disabled = false
}: {
  badge: string;
  name: string;
  detail?: string | null;
  pictureUrl: string | null;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative flex h-28 min-w-0 flex-col overflow-hidden rounded-lg border border-[#d8dde5] bg-white sm:h-40 lg:h-44">
      {!disabled ? (
        <button
          aria-label={`Remove ${name}`}
          className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white/85 text-lg leading-none text-[#6a7483] hover:bg-[#fff4f2] hover:text-[#c3291b]"
          onClick={onRemove}
          type="button"
        >
          <span aria-hidden="true">×</span>
        </button>
      ) : null}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#fbfcfd]">
        {pictureUrl ? (
          <>
            {/* Plain <img> for the reason the menu library's cards give: the
                URL is signed and rotates, so the optimizer never gets a cache
                hit. Decorative - the name is right below it. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              src={pictureUrl}
            />
            <span className="absolute left-1.5 top-1.5 truncate rounded-full bg-white/90 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-normal text-[#1f4d73] sm:text-[9px]">
              {badge}
            </span>
          </>
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#b9c2cf] sm:h-16 sm:w-16 lg:h-18 lg:w-18">
            <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-[#d8dde5] bg-white px-0.5 text-center text-[6px] font-black uppercase leading-2 tracking-normal text-[#1f4d73] sm:h-10 sm:w-10 sm:text-[7px] sm:leading-2.5 lg:h-11 lg:w-11 lg:px-1 lg:text-[8px] lg:leading-3 lg:tracking-[0.03em]">
              {badge}
            </span>
          </div>
        )}
      </div>
      <div className="flex h-10 flex-col items-center justify-center border-t border-[#d8dde5] px-1 sm:h-12 sm:px-2">
        <h3 className="line-clamp-2 wrap-break-word text-center text-[9px] font-black leading-3 text-[#17202a] sm:text-xs sm:leading-4 lg:text-sm">
          {name}
        </h3>
        {detail ? (
          <span className="mt-0.5 text-[8px] text-[#6a7483] sm:text-[10px]">
            {detail}
          </span>
        ) : null}
      </div>
    </div>
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
  /// Applying a package is a menu write plus a change to the event's own
  /// package columns, which is why it is its own route rather than another
  /// shape of the PUT below.
  const packageUrl = `${menuUrl}/package`;
  /// The kitchen tab reads these same lines through its own route, so a write
  /// here has to age that entry too. Without this the sheet keeps its cached
  /// copy for the two minute stale window and shows a dish list the user has
  /// just changed one tab across.
  const kitchenUrl = `/api/events/${event.id}/kitchen`;
  const libraryQuery = useAuthenticatedQuery<EventMenuResponse>("/api/menu");
  const documentQuery =
    useAuthenticatedQuery<EventMenuDocumentResponse>(menuUrl);

  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [isPackageSelectorOpen, setIsPackageSelectorOpen] = useState(false);
  const [selectorSection, setSelectorSection] = useState<MenuSection>("Buffet");
  const [message, setMessage] = useState("");
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // What the user has just done, shown while the write is in the air. Tagged
  // with the url it belongs to because this component is not remounted when the
  // sidebar selects another event - untagged, an optimistic menu would stay on
  // screen over the next event's, which is how this tab used to show the
  // previous event's dishes for as long as the new ones took to arrive.
  const [pendingMenu, setPendingMenu] = useState<{
    url: string;
    menu: EventMenuDocument;
  } | null>(null);

  // The cache is the source of truth; the overlay only wins while it belongs to
  // the event on screen. Nothing is mirrored into state, so a cache hit renders
  // the menu on the first paint rather than a frame later.
  const menu =
    pendingMenu?.url === menuUrl
      ? pendingMenu.menu
      : (documentQuery.data?.menu ?? null);

  const isConfirmed = menu?.status === "Confirmed";
  const lines = useMemo(() => menu?.lines ?? [], [menu]);

  const libraryItems = useMemo<MenuSelectorItem[]>(() => {
    const data = libraryQuery.data;

    if (!data) return [];

    // Deactivated entries stay on menus that already carry them but are not
    // offered for anything new.
    return [
      ...data.items
        .filter((item) => item.isActive)
        .map((item) => ({
          id: item.id,
          kind: "Dish" as const,
          name: item.name,
          styles: [
            ...new Set((item.services ?? []).map((s) => s.serviceStyle))
          ],
          price: null,
          pictureUrl: item.pictureUrl ?? null
        })),
      ...data.addOns
        .filter((addOn) => addOn.isActive)
        .map((addOn) => ({
          id: addOn.id,
          kind: "AddOn" as const,
          name: addOn.name,
          styles: [],
          price: addOn.price === null ? null : Number(addOn.price),
          pictureUrl: addOn.pictureUrl ?? null
        }))
    ];
  }, [libraryQuery.data]);

  const selectedIds = useMemo(() => new Set(lines.map(targetId)), [lines]);

  /**
   * The packages this event could be served from, with their ids resolved
   * against the library that is already on hand. Deactivated dishes are left
   * out on purpose - they are not offered for anything new, and the server
   * skips them for the same reason, so what the drawer previews is what lands.
   */
  const packageOptions = useMemo<
    Array<PackageOption & { isActive: boolean }>
  >(() => {
    const data = libraryQuery.data;

    if (!data) return [];

    const dishesById = new Map(
      data.items
        .filter((item) => item.isActive)
        .map((item) => [
          item.id,
          {
            id: item.id,
            name: item.name,
            styles: [
              ...new Set((item.services ?? []).map((s) => s.serviceStyle))
            ]
          }
        ])
    );

    return (data.packages ?? []).map((entry) => {
      const items = entry.includedMenuItemIds
        .map((id) => dishesById.get(id))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));

      return {
        id: entry.id,
        name: entry.name,
        price: entry.regularPrice === null ? null : Number(entry.regularPrice),
        items,
        // Ids the package still lists that no active dish answers to. Shown
        // rather than hidden, because a package quietly one dish short is worse
        // than one that says so.
        missingCount: entry.includedMenuItemIds.length - items.length,
        isActive: entry.isActive
      };
    });
  }, [libraryQuery.data]);

  /// A package that has since been deactivated still names itself here - the
  /// event is on it - but it is not offered for a new event.
  const offeredPackages = useMemo(
    () => packageOptions.filter((option) => option.isActive),
    [packageOptions]
  );

  const appliedPackage = useMemo(
    () =>
      menu?.packageId
        ? (packageOptions.find((option) => option.id === menu.packageId) ??
          null)
        : null,
    [menu?.packageId, packageOptions]
  );

  const packageLineCount = useMemo(
    () => lines.filter((line) => line.source === "Package").length,
    [lines]
  );

  const menuItemIds = useMemo(
    () =>
      new Set(
        lines
          .map((line) => line.menuItemId)
          .filter((value): value is string => Boolean(value))
      ),
    [lines]
  );

  /** Buffet, Plated, Add-ons - plus the dishes still waiting for an answer. */
  const sections = useMemo(
    () =>
      MENU_SECTIONS.map((section) => ({
        ...section,
        lines: lines.filter((line) =>
          section.id === "AddOn"
            ? line.kind === "AddOn"
            : line.kind === "Dish" && line.serviceStyle === section.id
        )
      })),
    [lines]
  );

  // A dish that carries both a Buffet and a Plated rule and reached this event
  // through the old id array has no recorded answer for which one applies. It
  // is surfaced rather than filed under a guess, because the guess would decide
  // the quantity the kitchen cooks.
  const unassignedLines = useMemo(
    () =>
      lines.filter(
        (line) => line.kind === "Dish" && line.serviceStyle === null
      ),
    [lines]
  );

  // The other half of the same problem: the style is known, but the dish was
  // catalogued without a rule for it, so there is still no number to cook to.
  // Distinct from the band above because the question is different - not which
  // way, but how much - and the answer belongs to the library, not the line.
  const linesNeedingRule = useMemo(() => rulelessLines(lines), [lines]);

  /**
   * One write to this event's menu, whichever route it goes through.
   *
   * Every one of them answers with the whole saved menu, so the cache is
   * written rather than thrown away - that is what stops the next visit to this
   * event from paying for a fetch it does not need. `optimistic` is what the
   * user should see while the request is in the air; dropping the overlay is
   * the whole rollback, because the cache still holds what the server last
   * confirmed.
   */
  const commitMenu = async (
    optimistic: EventMenuDocument | null,
    send: () => Promise<Response>,
    fallbackMessage: string,
    { refreshEvent = false }: { refreshEvent?: boolean } = {}
  ) => {
    if (optimistic) setPendingMenu({ url: menuUrl, menu: optimistic });

    setIsSaving(true);
    setMessage("");

    try {
      const response = await send();
      const payload = (await response.json().catch(() => null)) as {
        menu?: EventMenuDocument;
        error?: string;
      } | null;

      if (!response.ok || !payload?.menu) {
        setPendingMenu(null);
        setMessage(payload?.error ?? fallbackMessage);

        // A conflict means somebody else's version is the real one, so pull it
        // rather than leaving the stale one on screen.
        if (response.status === 409) {
          invalidateAuthenticatedQuery(menuUrl);
          await documentQuery.refetch();
        }

        return null;
      }

      setAuthenticatedQueryData<EventMenuDocumentResponse>(menuUrl, {
        menu: payload.menu
      });
      /// The kitchen tab reads these same lines through its own route, so a
      /// write here has to age that entry too.
      invalidateAuthenticatedQuery(kitchenUrl);
      setPendingMenu(null);

      // Only for writes that touch the event row itself - the package name and
      // the confirmation flag are read all over the manager, and re-reading the
      // event list is not something an ordinary dish add should cost.
      if (refreshEvent) await onEventSaved();

      return payload.menu;
    } catch {
      setPendingMenu(null);
      setMessage(fallbackMessage);

      return null;
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Sends the menu the user now wants. Every add and remove goes through here,
   * which is the whole point of the rewrite: the previous version only ever
   * saved as part of confirming, so a menu built and left unconfirmed was gone
   * on the next reload.
   */
  const saveLines = async (nextLines: EventMenuLine[]) => {
    if (!menu) return;

    await commitMenu(
      { ...menu, lines: nextLines },
      () =>
        authenticatedFetch(menuUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meal: menu.meal,
            version: menu.version,
            lines: nextLines.map((line) =>
              line.kind === "AddOn"
                ? {
                    addOnId: line.addOnId,
                    notes: line.notes,
                    source: line.source
                  }
                : {
                    menuItemId: line.menuItemId,
                    serviceStyle: line.serviceStyle,
                    notes: line.notes,
                    // Sent back as it was read, so a dish the package put here
                    // is still the package's after an unrelated edit.
                    source: line.source
                  }
            )
          })
        }),
      "Could not save the menu."
    );
  };

  /**
   * Drops a whole package onto the menu. The server decides which dishes land
   * and under which style, because those rules live beside the library rows;
   * what is built here is only what to show while it answers.
   */
  const applyPackage = async (option: PackageOption) => {
    setIsPackageSelectorOpen(false);

    if (!menu) return;

    const includedIds = new Set(option.items.map((item) => item.id));
    // Swapping packages takes the old one's dishes off, exactly as the server
    // does, so the two never disagree while the request is in the air.
    const kept = lines.filter(
      (line) =>
        !(
          line.source === "Package" &&
          line.menuItemId !== null &&
          !includedIds.has(line.menuItemId)
        )
    );
    const keptIds = new Set(kept.map(targetId));
    const fresh = option.items
      .filter((item) => !keptIds.has(item.id))
      .map((item, index) => ({
        // Provisional until the server answers with the real rows.
        id: `pending-package-${item.id}`,
        menuItemId: item.id,
        addOnId: null,
        kind: "Dish" as const,
        name: item.name,
        pictureUrl: null,
        // A dish served exactly one way needs no decision; one with a rule for
        // both is left for the section above to ask about.
        serviceStyle: item.styles.length === 1 ? item.styles[0] : null,
        availableStyles: item.styles,
        price: null,
        notes: null,
        sortOrder: kept.length + index,
        source: "Package",
        isRetired: false
      }));

    const saved = await commitMenu(
      { ...menu, packageId: option.id, lines: [...kept, ...fresh] },
      () =>
        authenticatedFetch(packageUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meal: menu.meal,
            version: menu.version,
            packageId: option.id
          })
        }),
      "Could not add the package.",
      // The event row carries the package name the rest of the manager shows.
      { refreshEvent: true }
    );

    if (saved) {
      const added = saved.lines.filter(
        (line) => line.source === "Package"
      ).length;

      setMessage(
        `${option.name} added - ${added} dish${added === 1 ? "" : "es"} on this menu.`
      );
    }
  };

  /** Takes the package back off. Dishes added by hand are left alone. */
  const removePackage = async () => {
    if (!menu) return;

    const saved = await commitMenu(
      {
        ...menu,
        packageId: null,
        lines: lines.filter((line) => line.source !== "Package")
      },
      () =>
        authenticatedFetch(
          `${packageUrl}?meal=${encodeURIComponent(menu.meal)}&version=${menu.version}`,
          { method: "DELETE" }
        ),
      "Could not remove the package.",
      { refreshEvent: true }
    );

    if (saved) setMessage("Package removed.");
  };

  /**
   * Everything the drawer queued, in one save. Adding them one at a time would
   * mean one request each against the menu's version, so all but the first
   * would come back as a conflict.
   */
  const addSelections = (selections: MenuSelection[]) => {
    setIsSelectorOpen(false);

    if (!menu) return;

    const fresh = selections
      .filter(({ item }) => !selectedIds.has(item.id))
      .map(({ item, section }, index) => ({
        // Provisional until the server answers with the real rows.
        id: `pending-${item.id}`,
        menuItemId: item.kind === "Dish" ? item.id : null,
        addOnId: item.kind === "AddOn" ? item.id : null,
        kind: item.kind,
        name: item.name,
        // Carried over from the drawer so the thumbnail is there straight away
        // rather than appearing when the save comes back.
        pictureUrl: item.pictureUrl,
        // The tab it was picked under is the style it is served in here.
        serviceStyle: section === "AddOn" ? null : section,
        availableStyles: item.styles,
        price: item.price,
        notes: null,
        sortOrder: lines.length + index,
        source: "Manual",
        isRetired: false
      }));

    if (fresh.length === 0) return;

    void saveLines([...lines, ...fresh]);
  };

  const removeLine = (line: EventMenuLine) => {
    void saveLines(lines.filter((candidate) => candidate.id !== line.id));
  };

  const clearSection = (section: MenuSection) => {
    void saveLines(
      lines.filter((line) =>
        section === "AddOn"
          ? line.kind !== "AddOn"
          : !(line.kind === "Dish" && line.serviceStyle === section)
      )
    );
  };

  const assignStyle = (line: EventMenuLine, serviceStyle: string) => {
    void saveLines(
      lines.map((candidate) =>
        candidate.id === line.id ? { ...candidate, serviceStyle } : candidate
      )
    );
  };

  const openSelector = (section: MenuSection) => {
    setSelectorSection(section);
    setIsSelectorOpen(true);
  };

  /**
   * A rule was written to the library, so three cached things are now stale.
   *
   * The menu document is the one that clears the band: `availableStyles` is
   * computed server-side off the dish's rows, so nothing local can decide that
   * a line has been answered. The library feeds the selector drawer and this
   * band's own lookup, and the kitchen tab is where the new number shows up.
   */
  const refreshAfterRuleSaved = async () => {
    invalidateAuthenticatedQuery(kitchenUrl);
    invalidateAuthenticatedQuery(menuUrl);

    await Promise.all([documentQuery.refetch(), libraryQuery.refetch()]);
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

    const saved = await commitMenu(
      // Nothing to show ahead of the answer: confirming changes the lock, not
      // the dishes, and a lock that flips back on a refusal reads as a bug.
      null,
      () =>
        authenticatedFetch(menuUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: confirming ? "confirm" : "reopen",
            meal: menu.meal,
            version: menu.version
          })
        }),
      confirming ? "Could not confirm menu." : "Could not reopen menu.",
      // The event row carries the mirrored ids and the confirmation flag, so
      // the rest of the manager has to re-read it.
      { refreshEvent: true }
    );

    if (!saved) return;

    setIsReviewOpen(false);
    setMessage(confirming ? "Menu confirmed." : "Menu reopened.");
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

        {documentQuery.isLoading ? (
          <EventMenuSkeleton />
        ) : documentQuery.error ? (
          <div className="p-4">
            <AsyncState
              error={documentQuery.error}
              onRetry={() => void documentQuery.refetch()}
            />
          </div>
        ) : (
          <>
            <EventMenuPackageBar
              appliedPackage={appliedPackage}
              hasPackages={offeredPackages.length > 0}
              isConfirmed={isConfirmed}
              isSaving={isSaving}
              onOpenSelector={() => setIsPackageSelectorOpen(true)}
              onRemove={() => void removePackage()}
              packageLineCount={packageLineCount}
            />

            {unassignedLines.length > 0 ? (
              <section className="border-b border-[#f0d9a8] bg-[#fdf8ec] px-3 py-3 sm:px-4">
                <h3 className="text-xs font-black uppercase tracking-wide text-[#8a6414]">
                  Needs a service style
                </h3>
                <p className="mt-1 text-xs text-[#6a7483]">
                  These dishes are served both ways. Pick the one this event
                  uses so the kitchen gets the right quantity.
                </p>
                <ul className="mt-2 space-y-2">
                  {unassignedLines.map((line) => (
                    <li
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e6dcc2] bg-white px-3 py-2"
                      key={line.id}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <MenuThumbnail
                          className="h-9 w-9"
                          pictureUrl={line.pictureUrl}
                        />
                        <span className="truncate text-sm font-black text-[#17202a]">
                          {line.name}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        {(line.availableStyles.length > 0
                          ? line.availableStyles
                          : ["Buffet", "Plated"]
                        ).map((style) => (
                          <button
                            className="h-7 rounded-lg border border-[#b9c2cf] bg-white px-2.5 text-[11px] font-black text-[#17202a] hover:bg-[#eef4fa] disabled:opacity-50"
                            disabled={isSaving || isConfirmed}
                            key={style}
                            onClick={() => assignStyle(line, style)}
                            type="button"
                          >
                            {style}
                          </button>
                        ))}
                        <button
                          aria-label={`Remove ${line.name}`}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-lg leading-none text-[#6a7483] hover:bg-[#fff4f2] hover:text-[#c3291b] disabled:opacity-50"
                          disabled={isSaving || isConfirmed}
                          onClick={() => removeLine(line)}
                          type="button"
                        >
                          <span aria-hidden="true">×</span>
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <EventMenuRuleBand
              catalog={libraryQuery.data?.items ?? []}
              disabled={isSaving || isConfirmed}
              lines={linesNeedingRule}
              onSaved={refreshAfterRuleSaved}
            />

            {sections.map((section) => (
              <section
                className="border-b border-[#d8dde5] last:border-b-0"
                key={section.id}
              >
                <h3 className="px-3 pt-3 text-xs font-black uppercase tracking-wide text-[#1f4d73] sm:px-4">
                  {section.label}
                  <span className="ml-2 font-semibold normal-case text-[#6a7483]">
                    {section.lines.length}
                  </span>
                </h3>
                <div className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-4 sm:gap-3">
                  {section.lines.map((line) => (
                    <MenuDishCard
                      key={line.id}
                      badge={section.id === "AddOn" ? "ADD-ON" : section.label}
                      name={line.name}
                      pictureUrl={line.pictureUrl}
                      detail={
                        line.price === null
                          ? null
                          : priceFormatter.format(line.price)
                      }
                      onRemove={() => removeLine(line)}
                      disabled={isConfirmed}
                    />
                  ))}
                  <AddMenuCard
                    label={
                      section.id === "AddOn"
                        ? "Add add-on"
                        : `Add ${section.label.toLowerCase()} item`
                    }
                    onClick={() => openSelector(section.id)}
                    disabled={isConfirmed}
                  />
                </div>
              </section>
            ))}
          </>
        )}
      </section>

      <PackageSelectorDrawer
        appliedPackageId={menu?.packageId ?? null}
        isSaving={isSaving}
        menuItemIds={menuItemIds}
        onApply={(option) => void applyPackage(option)}
        onClose={() => setIsPackageSelectorOpen(false)}
        open={isPackageSelectorOpen}
        packages={offeredPackages}
      />

      <MenuItemSelectorDrawer
        initialSection={selectorSection}
        items={libraryItems}
        onAdd={addSelections}
        onClear={clearSection}
        onClose={() => setIsSelectorOpen(false)}
        open={isSelectorOpen}
        selectedIds={selectedIds}
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
              {unassignedLines.length > 0 ? (
                <p className="rounded-lg border border-[#f0d9a8] bg-[#fdf8ec] p-3 text-sm text-[#8a6414]">
                  {unassignedLines.length} dish
                  {unassignedLines.length === 1 ? "" : "es"} still need a
                  service style. Confirming without one leaves the kitchen no
                  quantity rule to run.
                </p>
              ) : null}
              {sections
                .filter((section) => section.lines.length > 0)
                .map((section) => (
                  <section
                    className="rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-3"
                    key={section.id}
                  >
                    <h3 className="text-xs font-black uppercase tracking-wide text-[#1f4d73]">
                      {section.label}
                    </h3>
                    <ul className="mt-2 space-y-1 text-sm text-[#17202a]">
                      {section.lines.map((line) => (
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
