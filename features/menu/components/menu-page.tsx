"use client";

import { useMemo, useState } from "react";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { DashboardPageState } from "@/components/layout/dashboard-page-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { centerMobileTab } from "@/lib/ui/center-mobile-tab";
import {
  NewPackageDialog,
  type NewPackageFormValues
} from "@/features/menu/forms/new-package-dialog";
import {
  NewLibraryItemDialog,
  type NewLibraryItemFormValues
} from "@/features/menu/forms/new-library-item-dialog";
import {
  NewAddOnDialog,
  type NewAddOnValues
} from "@/features/menu/forms/new-addon-dialog";
import { BulkUploadDialog } from "@/features/menu/forms/bulk-upload-dialog";
import { useAuthenticatedMutation } from "@/features/dashboard/hooks/use-authenticated-mutation";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { useDashboardPageSearch } from "@/features/dashboard/hooks/use-dashboard-page-search";
import { useDashboardPermission } from "@/features/dashboard/hooks/use-dashboard-permission";
import { useMenuItemActions } from "@/features/menu/hooks/use-menu-item-actions";
import { usePackageItems } from "@/features/menu/hooks/use-package-items";
import { usePackageSelection } from "@/features/menu/hooks/use-package-selection";
import { parseAllergens } from "@/features/menu/lib/allergens";
import { uploadMenuPicture } from "@/features/menu/lib/upload-menu-picture";
import { updateMenuPackage } from "@/features/menu/services/menu-packages";
import { moneySchema, parseNumericInput } from "@/lib/validation/number";

import {
  AddItemCard,
  AddOnCard,
  MenuItemCard,
  MenuRuleCard
} from "@/features/menu/components/menu-cards";
import { PackageIncludedItems } from "@/features/menu/components/package-included-items";
import { PackageItemPicker } from "@/features/menu/components/package-item-picker";
import { SelectionActionBar } from "@/features/menu/components/selection-action-bar";
import {
  LineIcon,
  tabs,
  type MenuLibraryItem,
  type MenuResponse
} from "@/features/menu/components/menu-shared";
import {
  DEFAULT_SEGMENT,
  findRuleForStyle,
  formatServiceRule,
  readServiceRules,
  servesStyle,
  toServiceRules,
  type ServiceStyle
} from "@/features/menu/lib/service-style";
/**
 * The dialogs validate before calling back, so reaching an invalid value here
 * means a caller skipped that check - throw rather than send `NaN`, which
 * JSON.stringify would quietly turn into `null`.
 */
function readPrice(raw: string, label: string) {
  const parsed = parseNumericInput(raw, moneySchema({ label }));

  if (parsed.status === "valid") return parsed.value;

  throw new Error(
    parsed.status === "invalid" ? parsed.message : `${label} is required.`
  );
}

export function MenuPage() {
  const [pageSearchQuery, setPageSearchQuery] = useDashboardPageSearch("Menu");
  const menuQuery = useAuthenticatedQuery<MenuResponse>("/api/menu");
  const menuMutation = useAuthenticatedMutation<
    Record<string, unknown>,
    // Only the created package's id is read back, and only so the new package
    // can be the one that opens. The other two resources ignore the payload.
    { package?: { id?: string } }
  >("/api/menu");
  const [activeTab, setActiveTab] = useState("Menu Library");
  const [selectedCategory, setSelectedCategory] = useState("All");
  // By id, not by name: two packages may share a name, and renaming one would
  // otherwise deselect it mid-edit.
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(
    null
  );
  const [isNewPackageOpen, setIsNewPackageOpen] = useState(false);
  const [isEditingPackage, setIsEditingPackage] = useState(false);
  const [isNewAddOnOpen, setIsNewAddOnOpen] = useState(false);
  const [isNewLibraryItemOpen, setIsNewLibraryItemOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const allMenuItems = useMemo<MenuLibraryItem[]>(() => {
    const savedItems = (menuQuery.data?.items ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category ?? "More",
      usageType: item.usageType,
      kind: item.kind,
      services: readServiceRules(item.services),
      kosherType: item.kosherType,
      allergens: item.allergens ?? [],
      notes: item.notes,
      pictureUrl: item.pictureUrl
    }));
    return savedItems;
  }, [menuQuery.data]);
  const allPackages = useMemo(
    () =>
      (menuQuery.data?.packages ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        includedMenuItemIds: item.includedMenuItemIds,
        type: "Package",
        summary: `${item.includedMenuItemIds.length} included items`,
        // Kept beside the formatted string rather than derived back out of it:
        // the edit dialog needs the number, and stripping the currency symbols
        // off `price` to get it back is a round trip through a lossy format.
        regularPrice: Number(item.regularPrice ?? 0),
        price: new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD"
        }).format(Number(item.regularPrice ?? 0))
      })),
    [menuQuery.data]
  );
  const addOns = useMemo(
    () =>
      (menuQuery.data?.addOns ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        description: item.notes ?? item.pricingType,
        price: new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD"
        }).format(Number(item.price ?? 0)),
        tag: item.pricingType,
        pictureUrl: item.pictureUrl
      })),
    [menuQuery.data]
  );
  // Resolved up here rather than beside the panel that draws it: the hook below
  // acts on it, and hooks cannot be called after the loading gate. Falling back
  // to the first package keeps a package open on the first visit, before
  // anything has been selected.
  const activePackage =
    allPackages.find((item) => item.id === selectedPackageId) ??
    allPackages[0] ??
    null;
  const canEditMenu = useDashboardPermission("menu.update");
  const libraryItemActions = useMenuItemActions({
    items: allMenuItems,
    onCategorySaved: setSelectedCategory,
    onChanged: menuQuery.refetch
  });
  const packageItemActions = usePackageItems({
    activePackage,
    onChanged: menuQuery.refetch
  });
  const packageSelection = usePackageSelection(activePackage?.id ?? null);

  if (menuQuery.isLoading || menuQuery.error) {
    return (
      <DashboardPageState
        error={menuQuery.error}
        isLoading={menuQuery.isLoading}
        onRetry={menuQuery.refetch}
        subtitle="Menu library, packages, buffet, plated and add-ons."
        title="Menu"
      />
    );
  }

  const normalizedSearch = pageSearchQuery.trim().toLowerCase();
  const visibleItems = (
    selectedCategory === "All"
      ? allMenuItems
      : allMenuItems.filter((item) => item.category === selectedCategory)
  ).filter(
    (item) =>
      !normalizedSearch ||
      `${item.name} ${item.category}`.toLowerCase().includes(normalizedSearch)
  );
  const visiblePackages = allPackages.filter(
    (item) =>
      !normalizedSearch ||
      `${item.name} ${item.type} ${item.summary}`
        .toLowerCase()
        .includes(normalizedSearch)
  );
  const visibleAddOns = addOns.filter(
    (item) =>
      !normalizedSearch ||
      `${item.name} ${item.description} ${item.tag}`
        .toLowerCase()
        .includes(normalizedSearch)
  );
  const categoryNames = [
    "All",
    ...Array.from(
      new Set([
        ...(menuQuery.data?.categories ?? []).map((category) => category.name),
        ...allMenuItems.map((item) => item.category)
      ])
    )
  ];
  // Both lists are resolved against the library rather than read off the
  // package: `included_menu_item_ids` is an id array, so this is the only place
  // the ids become items with names to draw.
  //
  // Split on the hook's list, not on `activePackage.includedMenuItemIds`: a
  // clicked card has to cross between these two grids on the click, and the
  // package will not carry the change until a write and a refetch have both
  // come back.
  const packageItemIds = packageItemActions.itemIds;
  const activePackageItems = activePackage
    ? allMenuItems.filter((item) => packageItemIds.includes(item.id))
    : [];
  const addablePackageItems = activePackage
    ? allMenuItems.filter((item) => !packageItemIds.includes(item.id))
    : [];
  // Intersected with what is actually on screen rather than handed over raw: a
  // ticked card can leave its grid without being unticked - refetched away, or
  // moved across by someone else's write - and a count that includes it would
  // put a number on the bar that nothing on the page adds up to.
  const tickedIncludedIds = new Set(
    activePackageItems
      .map((item) => item.id)
      .filter((itemId) => packageSelection.selectedIn("included").has(itemId))
  );
  const tickedLibraryIds = new Set(
    addablePackageItems
      .map((item) => item.id)
      .filter((itemId) => packageSelection.selectedIn("library").has(itemId))
  );
  // One grid holds a selection at a time, so the panel needs one bar and this
  // is which way round it reads.
  const isRemoving = tickedIncludedIds.size > 0;
  const tickedItemIds = isRemoving
    ? [...tickedIncludedIds]
    : [...tickedLibraryIds];
  const tickedCount = tickedItemIds.length;
  // Cleared on the click, not on the answer, for the same reason the cards move
  // then: the items leave the grid they were ticked in, so a selection that
  // outlived the click would be pointing at cards that are no longer there.
  const actOnTickedItems = () => {
    if (isRemoving) packageItemActions.removeItems(tickedItemIds);
    else packageItemActions.addItems(tickedItemIds);

    packageSelection.clear();
  };
  const isRuleMenu = activeTab === "Buffet Menu" || activeTab === "Plated Menu";
  const isPlatedMenu = activeTab === "Plated Menu";
  const ruleMode = isPlatedMenu ? "plated" : "buffet";
  const serviceStyle: ServiceStyle = isPlatedMenu ? "Plated" : "Buffet";
  // The service tabs are views over the same catalog the library tab renders,
  // not lists of their own. A dish served both ways carries a rule for each and
  // shows under both tabs without being stored twice.
  //
  // Filtering the items rather than flattening their rules is what keeps this
  // one card per dish: the unique key allows a dish to hold more than one rule
  // for the same style, and flattening would render it twice.
  const servedItems = allMenuItems
    .filter((item) => servesStyle(item.services, serviceStyle))
    .filter(
      (item) =>
        !normalizedSearch ||
        `${item.name} ${item.category}`.toLowerCase().includes(normalizedSearch)
    );
  const toRuleCard = (item: MenuLibraryItem) => ({
    id: item.id,
    name: item.name,
    // Kashrut, not the service style: you already know which tab you are on.
    badge: item.kosherType ?? item.category,
    // The rule for the tab you are on, which is the whole reason these live on
    // their own rows - the same dish reads differently under Buffet and Plated.
    rule: formatServiceRule(findRuleForStyle(item.services, serviceStyle)),
    pictureUrl: item.pictureUrl
  });
  // Read off once so the remove button below closes over an id rather than over
  // the item object, which the next refetch replaces.
  const editingItemId = libraryItemActions.editingItem?.id ?? null;

  const savePackage = async (values: NewPackageFormValues) => {
    const regularPrice = readPrice(values.basePrice, "Base price");

    if (isEditingPackage && activePackage) {
      // Name and price only. The items are edited from the panel behind this
      // dialog, so sending the list here would let a stale copy of it overwrite
      // an add that happened while the dialog was open.
      await updateMenuPackage(activePackage.id, {
        name: values.name,
        regularPrice
      });
      await menuQuery.refetch();
      setIsEditingPackage(false);
      setIsNewPackageOpen(false);
      return;
    }

    const created = await menuMutation.mutate({
      resource: "package",
      name: values.name,
      regularPrice,
      hallIds: [],
      eventTypeIds: [],
      includedMenuItemIds: []
    });
    await menuQuery.refetch();
    // Selected by the id the server assigned, so the panel opens on the package
    // that was just created even if another one shares its name.
    setSelectedPackageId(created?.package?.id ?? null);
    setActiveTab("Packages");
    setIsNewPackageOpen(false);
  };

  const saveAddOn = async (values: NewAddOnValues) => {
    // Priced first, then uploaded: a price the parser rejects should not cost an
    // upload, the same order `saveLibraryItem` below works in.
    const price = readPrice(values.price, "Price");
    // Uploaded before the row is created, so a failure anywhere in here leaves
    // an unreferenced object in the bucket rather than an add-on pointing at
    // nothing.
    const picturePath = values.picture
      ? await uploadMenuPicture(values.picture)
      : undefined;

    await menuMutation.mutate({
      resource: "addon",
      name: values.name,
      price,
      pricingType: "fixed",
      hallIds: [],
      picturePath
    });
    await menuQuery.refetch();
  };

  const saveLibraryItem = async (values: NewLibraryItemFormValues) => {
    // Parsed first: a bad counting rule should not cost an upload, and this
    // throws for the dialog to render.
    const services = toServiceRules(values.services);
    // Upload before the row is created, so a failure anywhere in here leaves an
    // unreferenced object in the bucket rather than an item pointing at nothing.
    const picturePath = values.picture
      ? await uploadMenuPicture(values.picture)
      : undefined;

    await menuMutation.mutate({
      resource: "item",
      name: values.name,
      category: values.category,
      // The business segment, not the service style. Nothing filters on it yet,
      // so a new dish starts visible to both sides of the business.
      usageType: DEFAULT_SEGMENT,
      kind: values.kind,
      services,
      kosherType: values.kashrutType,
      allergens: parseAllergens(values.allergies),
      notes: values.description,
      picturePath
    });
    await menuQuery.refetch();
    setSelectedCategory(values.category);
    // Stay on the tab the item was added from. Jumping to the library is what
    // made "Add buffet item" look like it had created the wrong thing.
    if (!isRuleMenu) setActiveTab("Menu Library");
    setIsNewLibraryItemOpen(false);
  };

  return (
    <div className="flex h-dvh w-full max-w-full flex-col overflow-hidden bg-[#f5f6f8] text-[#17202a]">
      <DashboardTopbar
        title="Menu"
        subtitle="Menu library, packages, buffet, plated and add-ons."
        compactMobileActions
        actionsSlot={
          <>
            <button
              aria-label="Create new library item"
              className="inline-flex h-9 w-8 shrink-0 items-center justify-center bg-transparent p-0 text-[#17202a] hover:text-[#1f4d73] [&_svg]:h-6 [&_svg]:w-6 lg:h-11 lg:w-auto lg:gap-2 lg:rounded-xl lg:border lg:border-[#b9c2cf] lg:bg-white lg:px-4 lg:text-sm lg:font-black lg:[&_svg]:h-4 lg:[&_svg]:w-4"
              onClick={() => setIsNewLibraryItemOpen(true)}
              title="New library item"
              type="button"
            >
              <LineIcon name="plus" />
              <span className="hidden lg:inline">New library item</span>
            </button>
            {/* Only where a create button would also be: the import writes the
                same rows `New library item` does, through the same permission. */}
            {canEditMenu ? (
              <button
                aria-label="Bulk upload menu items"
                className="inline-flex h-9 w-8 shrink-0 items-center justify-center bg-transparent p-0 text-[#17202a] hover:text-[#1f4d73] [&_svg]:h-6 [&_svg]:w-6 lg:h-11 lg:w-auto lg:gap-2 lg:rounded-xl lg:border lg:border-[#b9c2cf] lg:bg-white lg:px-4 lg:text-sm lg:font-black lg:[&_svg]:h-4 lg:[&_svg]:w-4"
                onClick={() => setIsBulkUploadOpen(true)}
                title="Bulk upload"
                type="button"
              >
                <LineIcon name="upload" />
                <span className="hidden lg:inline">Bulk upload</span>
              </button>
            ) : null}
            <button
              aria-label="Create new package"
              className="inline-flex h-9 w-8 shrink-0 items-center justify-center bg-transparent p-0 text-[#1f4d73] hover:text-[#15344f] [&_svg]:h-6 [&_svg]:w-6 lg:h-11 lg:w-auto lg:gap-2 lg:rounded-xl lg:bg-[#1f4d73] lg:px-4 lg:text-sm lg:font-black lg:text-white lg:shadow-sm lg:[&_svg]:h-4 lg:[&_svg]:w-4"
              onClick={() => setIsNewPackageOpen(true)}
              title="New package"
              type="button"
            >
              <LineIcon name="box" />
              <span className="hidden lg:inline">New package</span>
            </button>
          </>
        }
      />

      <div className="shrink-0 bg-white">
        <nav className="scrollbar-none mt-2 flex min-h-12 shrink-0 flex-nowrap gap-2 overflow-x-auto border-b border-t border-[#d8dde5] px-3 sm:px-4 lg:mt-0 lg:border-t-0">
          {tabs.map((tab) => (
            <button
              key={tab.label}
              className={`inline-flex h-12 shrink-0 items-center gap-2 border-b-3 px-2 text-sm font-black ${
                activeTab === tab.label
                  ? "border-[#1f4d73] text-[#17202a]"
                  : "border-transparent text-[#17202a] hover:bg-[#eef4fa]"
              }`}
              type="button"
              onClick={(event) => {
                setActiveTab(tab.label);
                centerMobileTab(event.currentTarget);
              }}
            >
              <LineIcon name={tab.icon} className="h-4 w-4 text-[#516174]" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <NewPackageDialog
        initialValues={isEditingPackage && activePackage ? {
          name: activePackage.name,
          type: activePackage.type,
          basePrice: String(activePackage.regularPrice),
          perCouplePrice: "0"
        } : undefined}
        onClose={() => { setIsNewPackageOpen(false); setIsEditingPackage(false); }}
        onSave={savePackage}
        open={isNewPackageOpen}
      />
      <NewAddOnDialog
        onClose={() => setIsNewAddOnOpen(false)}
        onSave={saveAddOn}
        open={isNewAddOnOpen}
      />
      {/* One dialog for both flows: `initialValues` is what makes it an edit,
          and the save handler follows it. */}
      <NewLibraryItemDialog
        // Signed by GET /api/menu, the same URL the card draws - so the form
        // shows the picture the operator clicked on rather than an empty slot.
        currentPictureUrl={libraryItemActions.editingItem?.pictureUrl}
        // A create started from a service tab is already that kind of item.
        defaultServiceStyle={isRuleMenu ? serviceStyle : undefined}
        initialValues={libraryItemActions.editingValues}
        // The confirmation below sits on top of this form; while it is up, an
        // Escape belongs to it and must not take the edit down with it.
        isDismissBlocked={Boolean(libraryItemActions.removingItem)}
        onClose={() => {
          setIsNewLibraryItemOpen(false);
          libraryItemActions.cancelEdit();
        }}
        // Only for an editor opened on a real item, and only for someone allowed
        // to write - a create has nothing to remove, and the server would refuse
        // the rest anyway.
        onRemove={
          canEditMenu && editingItemId
            ? () => libraryItemActions.startRemove(editingItemId)
            : undefined
        }
        onSave={
          libraryItemActions.editingItem
            ? libraryItemActions.saveEdit
            : saveLibraryItem
        }
        open={isNewLibraryItemOpen || Boolean(libraryItemActions.editingItem)}
      />
      {/* Reads `defaultServiceStyle` the same way the create dialog above does:
          a file uploaded from the Buffet tab should land on the buffet, not in
          a library the operator then has to open dish by dish. */}
      <BulkUploadDialog
        defaultServiceStyle={isRuleMenu ? serviceStyle : undefined}
        existingNames={allMenuItems.map((item) => item.name)}
        onClose={() => setIsBulkUploadOpen(false)}
        onImported={async () => {
          await menuQuery.refetch();
        }}
        open={canEditMenu && isBulkUploadOpen}
      />
      {/* An alert dialog, not `window.confirm`: it has to name the item, carry
          the server's refusal when a package still holds it, and stack above the
          editor the removal was started from. `confirmLabel` deliberately does
          not repeat the editor's "Remove item" - the two buttons are on screen
          together, and only one of them deletes anything. */}
      <ConfirmDialog
        confirmLabel="Remove from library"
        description={`"${libraryItemActions.removingItem?.name ?? ""}" will be removed from the menu library. This cannot be undone.`}
        fallbackErrorMessage="The item could not be removed. Please try again."
        onClose={libraryItemActions.cancelRemove}
        onConfirm={libraryItemActions.confirmRemove}
        open={Boolean(libraryItemActions.removingItem)}
        pendingLabel="Removing…"
        title="Remove menu item"
      />

      <main className="min-h-0 w-full min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto p-2 sm:p-3">
        {activeTab === "Packages" ? (
          <div className="grid min-w-0 items-start gap-3 xl:grid-cols-[310px_minmax(0,1fr)]">
            <aside className="min-w-0 self-start overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
              <header className="flex h-14 items-center justify-between gap-3 border-b border-[#d8dde5] px-3">
                <div className="flex items-center gap-2">
                  <LineIcon name="box" className="h-4 w-4 text-[#17202a]" />
                  <h2 className="text-sm font-black text-[#17202a]">
                    Packages
                  </h2>
                </div>
                <button
                  className="inline-flex h-8 items-center rounded-lg bg-[#1f4d73] px-3 text-xs font-black text-white hover:bg-[#15344f]"
                  onClick={() => setIsNewPackageOpen(true)}
                  type="button"
                >
                  New
                </button>
              </header>

              <div className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-1">
                {visiblePackages.map((item) => {
                  const isActive = activePackage?.id === item.id;
                  // The open package counts what the panel is drawing, so the
                  // two do not disagree for the moment between a click and the
                  // refetch that follows it.
                  const summary = isActive
                    ? `${packageItemIds.length} included items`
                    : item.summary;

                  return (
                    <button
                      key={item.id}
                      className={`flex min-h-24 w-full min-w-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border p-2 text-center sm:h-14 sm:min-h-0 sm:flex-row sm:justify-start sm:gap-3 sm:px-3 sm:text-left ${
                        isActive
                          ? "border-[#1f4d73] bg-[#eef4fa]"
                          : "border-[#d8dde5] bg-white hover:bg-[#eef4fa]"
                      }`}
                      type="button"
                      onClick={() => setSelectedPackageId(item.id)}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#d8dde5] bg-[#fbfcfd] text-[#1f4d73] sm:h-9 sm:w-9">
                        <LineIcon name="box" className="h-4 w-4" />
                      </span>
                      <span className="grid min-w-0 max-w-full flex-1 gap-0.5">
                        <span className="truncate text-sm font-black leading-4 text-[#17202a]">
                          {item.name}
                        </span>
                        <span className="hidden truncate text-xs leading-4 text-[#6a7483] sm:block">
                          {item.type} - {summary}
                        </span>
                      </span>
                      <span className="max-w-full shrink-0 truncate rounded-full border border-[#b9c2cf] bg-[#eef4fa] px-1.5 py-1 text-[9px] font-black leading-none text-[#1f4d73] sm:text-[10px]">
                        {item.price}
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="min-w-0 self-start overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
              {activePackage ? (
                <div className="max-h-none overflow-visible xl:max-h-[calc(100vh-9rem)] xl:overflow-y-auto">
                  <header className="flex min-h-14 flex-col items-stretch gap-3 border-b border-[#d8dde5] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <LineIcon
                          name="box"
                          className="h-4 w-4 text-[#17202a]"
                        />
                        <h2 className="truncate text-sm font-black text-[#17202a]">
                          {activePackage.name}
                        </h2>
                      </div>
                      <p className="mt-1 text-xs text-[#6a7483]">
                        Base {activePackage.price} - {activePackageItems.length}{" "}
                        {activePackageItems.length === 1 ? "item" : "items"}{" "}
                        included
                      </p>
                    </div>
                    <button
                      className="inline-flex h-8 shrink-0 items-center justify-center self-end rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black text-[#17202a] hover:bg-[#eef4fa] sm:self-auto"
                      onClick={() => { setIsEditingPackage(true); setIsNewPackageOpen(true); }}
                      type="button"
                    >
                      Edit package
                    </button>
                  </header>

                  {/* Neither adding nor removing opens a dialog, so this banner
                      is the only place a rejected write can be read. */}
                  {packageItemActions.errorMessage ? (
                    <div className="mx-3 mt-3 flex items-start justify-between gap-3 rounded-lg border border-[#f0b4ae] bg-[#fff5f4] px-3 py-2">
                      <p
                        className="text-xs font-bold text-[#a62b24]"
                        role="alert"
                      >
                        {packageItemActions.errorMessage}
                      </p>
                      <button
                        className="shrink-0 text-xs font-black text-[#a62b24] hover:underline"
                        onClick={packageItemActions.dismissError}
                        type="button"
                      >
                        Dismiss
                      </button>
                    </div>
                  ) : null}

                  <PackageIncludedItems
                    includedItems={activePackageItems}
                    isDisabled={!canEditMenu}
                    onReplaceSelection={(itemIds) =>
                      packageSelection.replace("included", itemIds)
                    }
                    onToggle={(itemId) =>
                      packageSelection.toggle("included", itemId)
                    }
                    pendingItemIds={packageItemActions.pendingItemIds}
                    selectedItemIds={tickedIncludedIds}
                  />

                  <PackageItemPicker
                    availableItems={addablePackageItems}
                    isDisabled={!canEditMenu}
                    libraryItemCount={allMenuItems.length}
                    onReplaceSelection={(itemIds) =>
                      packageSelection.replace("library", itemIds)
                    }
                    onToggle={(itemId) =>
                      packageSelection.toggle("library", itemId)
                    }
                    pendingItemIds={packageItemActions.pendingItemIds}
                    selectedItemIds={tickedLibraryIds}
                  />

                  {/* Room for the floating bar to sit over, so it never covers
                      the last row of cards the selection was made from. */}
                  {tickedCount > 0 ? <div className="h-16" /> : null}
                </div>
              ) : (
                <div className="flex min-h-[18rem] flex-col items-center justify-center px-6 py-10 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#d8dde5] bg-[#eef4fa] text-[#1f4d73]">
                    <LineIcon name="box" className="h-5 w-5" />
                  </span>
                  <h2 className="mt-4 text-base font-black text-[#17202a]">
                    No packages yet
                  </h2>
                  <p className="mt-2 max-w-sm text-sm text-[#6a7483]">
                    Create a package to bundle menu items for weddings, buffets,
                    and other events.
                  </p>
                  <button
                    className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-[#1f4d73] px-4 text-sm font-black text-white shadow-md shadow-[#1f4d73]/20 hover:bg-[#173a56]"
                    type="button"
                    onClick={() => setIsNewPackageOpen(true)}
                  >
                    + New package
                  </button>
                </div>
              )}
            </section>

            {/* Outside both grids, because the selection belongs to the panel
                rather than to whichever half of it is scrolled into view - and
                because a sticky bar inside either of those `overflow-hidden`
                sections would resolve against a box that never scrolls. */}
            <SelectionActionBar
              actionLabel={isRemoving ? "Remove" : "Add"}
              icon={isRemoving ? "trash" : "plus"}
              isDisabled={!canEditMenu}
              onAct={actOnTickedItems}
              onClear={packageSelection.clear}
              selectedCount={tickedCount}
              tone={isRemoving ? "danger" : "primary"}
            />
          </div>
        ) : isRuleMenu ? (
          <section className="min-w-0 self-start overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
            <div className="max-h-none overflow-visible xl:max-h-[calc(100vh-9rem)] xl:overflow-y-auto">
              <header className="flex min-h-14 flex-col items-stretch gap-3 border-b border-[#d8dde5] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <LineIcon
                      name="document"
                      className="h-4 w-4 text-[#17202a]"
                    />
                    <h2 className="text-sm font-black text-[#17202a]">
                      {activeTab}
                    </h2>
                  </div>
                  <p className="mt-1 text-xs text-[#6a7483]">
                    Select a Menu Library item, then add the rule and price.
                  </p>
                </div>
                <button
                  className="inline-flex h-8 shrink-0 items-center justify-center self-end rounded-lg bg-[#1f4d73] px-3 text-xs font-black text-white hover:bg-[#15344f] sm:self-auto"
                  onClick={() => setIsNewLibraryItemOpen(true)}
                  type="button"
                >
                  Add {ruleMode} item
                </button>
              </header>

              {!servedItems.length ? (
                <p className="px-3 py-6 text-xs text-[#516174]">
                  {normalizedSearch
                    ? `No ${ruleMode} items match "${pageSearchQuery.trim()}".`
                    : `No items are served ${ruleMode} yet. Add one here, or open a library item and set its service style.`}
                </p>
              ) : (
                // Ungrouped, on both tabs: the cards sit in one wrapping row
                // rather than under section headers. Plated used to group by
                // category, which spent a full panel per course to hold one or
                // two cards - the same list reads faster as a plain grid.
                <div className="grid grid-cols-3 gap-2 p-3 sm:flex sm:flex-wrap sm:gap-3">
                  {servedItems.map((item) => {
                    const card = toRuleCard(item);

                    return (
                      <MenuRuleCard
                        key={card.id}
                        badge={card.badge}
                        name={card.name}
                        pictureUrl={card.pictureUrl}
                        rule={card.rule}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        ) : activeTab === "Add-ons" ? (
          <section className="min-w-0 self-start overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
            <header className="flex min-h-14 flex-col items-stretch gap-3 border-b border-[#d8dde5] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <LineIcon name="dollar" className="h-4 w-4 text-[#17202a]" />
                  <h2 className="text-sm font-black text-[#17202a]">Add-ons</h2>
                </div>
                <p className="mt-1 text-xs text-[#6a7483]">
                  Separate add-on items. Add-ons are not pulled from Buffet Menu
                  or Plated Menu.
                </p>
              </div>
              <button
                className="inline-flex h-8 shrink-0 items-center justify-center self-end rounded-lg bg-[#1f4d73] px-3 text-xs font-black text-white hover:bg-[#15344f] sm:self-auto"
                type="button"
                onClick={() => setIsNewAddOnOpen(true)}
              >
                New add-on
              </button>
            </header>

            <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-[repeat(2,325px)]">
              {visibleAddOns.map((item) => (
                <AddOnCard
                  // By id, not name: two add-ons may share a name, and a
                  // duplicate key would drop one of the cards.
                  key={item.id}
                  name={item.name}
                  description={item.description}
                  price={item.price}
                  pictureUrl={item.pictureUrl}
                  tag={item.tag}
                />
              ))}
            </div>
          </section>
        ) : (
          <div className="grid h-auto min-h-0 min-w-0 items-start gap-3 xl:h-full">
            <section className="flex h-auto min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-[#d8dde5] bg-white xl:h-full">
              <div className="flex min-h-0 flex-1 flex-col">
                <header className="flex shrink-0 flex-col items-stretch gap-3 border-b border-[#d8dde5] px-3 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <LineIcon
                        name="document"
                        className="h-4 w-4 text-[#17202a]"
                      />
                      <h1 className="text-sm font-black text-[#17202a]">
                        Menu Library
                      </h1>
                    </div>
                    <p className="mt-1 text-xs text-[#6a7483]">
                      Base food items only. No rules, no prices, no hall usage.
                    </p>
                  </div>
                  <button
                    className="inline-flex h-8 shrink-0 items-center justify-center self-end rounded-lg bg-[#1f4d73] px-3 text-xs font-black text-white hover:bg-[#15344f] sm:self-auto"
                    onClick={() => {
                      setIsNewLibraryItemOpen(true);
                    }}
                    type="button"
                  >
                    New item
                  </button>
                </header>

                <div className="shrink-0 border-b border-[#d8dde5] p-3">
                  <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_150px]">
                    <input
                      className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm text-[#17202a] outline-none placeholder:text-[#6a7483] focus:border-[#1f4d73]"
                      name="menuSearch"
                      onChange={(event) =>
                        setPageSearchQuery(event.target.value)
                      }
                      placeholder="Search menu items"
                      type="search"
                      value={pageSearchQuery}
                    />
                    <select
                      className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm text-[#17202a] outline-none focus:border-[#1f4d73]"
                      name="menuCategoryFilter"
                      value={selectedCategory}
                      onChange={(event) =>
                        setSelectedCategory(event.target.value)
                      }
                    >
                      {categoryNames.map((label) => (
                        <option key={label} value={label}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* The card is the update: one click opens the editor, and
                    removing is a button inside it. The three-dot menu that used
                    to sit in the corner held those same two entries behind a
                    28px target that was the hardest thing on a phone to hit. */}
                <div className="grid min-h-0 flex-1 grid-cols-3 gap-2 overflow-y-auto p-3 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 2xl:grid-cols-6">
                  {visibleItems.map((item) => (
                    <MenuItemCard
                      key={item.id}
                      category={item.category}
                      isSelectDisabled={!canEditMenu}
                      name={item.name}
                      onSelect={() => libraryItemActions.startEdit(item.id)}
                      pictureUrl={item.pictureUrl}
                    />
                  ))}
                  <AddItemCard onClick={() => setIsNewLibraryItemOpen(true)} />
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
