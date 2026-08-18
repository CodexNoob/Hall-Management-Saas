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
import { useAuthenticatedMutation } from "@/features/dashboard/hooks/use-authenticated-mutation";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { useDashboardPageSearch } from "@/features/dashboard/hooks/use-dashboard-page-search";
import { useDashboardPermission } from "@/features/dashboard/hooks/use-dashboard-permission";
import { useMenuItemActions } from "@/features/menu/hooks/use-menu-item-actions";
import { usePackageItems } from "@/features/menu/hooks/use-package-items";
import { parseAllergens } from "@/features/menu/lib/allergens";
import { uploadMenuPicture } from "@/features/menu/lib/upload-menu-picture";
import { updateMenuPackage } from "@/features/menu/services/menu-packages";
import { moneySchema, parseNumericInput } from "@/lib/validation/number";

import {
  AddItemCard,
  AddOnCard,
  MenuItemCard,
  MenuRuleCard,
  MenuRuleSection
} from "@/features/menu/components/menu-cards";
import { PackageItemPicker } from "@/features/menu/components/package-item-picker";
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
  const canEditMenu = useDashboardPermission("canEditMenu");
  const libraryItemActions = useMenuItemActions({
    items: allMenuItems,
    onCategorySaved: setSelectedCategory,
    onChanged: menuQuery.refetch
  });
  const packageItemActions = usePackageItems({
    activePackage,
    onChanged: menuQuery.refetch
  });

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
  const displayCategories = categoryNames.map((label) => ({
    label,
    count:
      label === "All"
        ? allMenuItems.length
        : allMenuItems.filter((item) => item.category === label).length
  }));
  // Both lists are resolved against the library rather than read off the
  // package: `included_menu_item_ids` is an id array, so this is the only place
  // the ids become items with names to draw.
  const activePackageItems = activePackage
    ? allMenuItems.filter((item) =>
        activePackage.includedMenuItemIds.includes(item.id)
      )
    : [];
  const addablePackageItems = activePackage
    ? allMenuItems.filter(
        (item) => !activePackage.includedMenuItemIds.includes(item.id)
      )
    : [];
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
  // Plated keeps its courses - a plated meal is served in them - while buffet
  // is one flat list. Empty courses are dropped rather than rendered as a row
  // of placeholders, because these come from org-defined categories now.
  const platedCourses = categoryNames
    .filter((label) => label !== "All")
    .map((label) => ({
      title: label,
      items: servedItems
        .filter((item) => item.category === label)
        .map(toRuleCard)
    }))
    .filter((course) => course.items.length > 0);

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
        // A create started from a service tab is already that kind of item.
        defaultServiceStyle={isRuleMenu ? serviceStyle : undefined}
        initialValues={libraryItemActions.editingValues}
        onClose={() => {
          setIsNewLibraryItemOpen(false);
          libraryItemActions.cancelEdit();
        }}
        onSave={
          libraryItemActions.editingItem
            ? libraryItemActions.saveEdit
            : saveLibraryItem
        }
        open={isNewLibraryItemOpen || Boolean(libraryItemActions.editingItem)}
      />
      <ConfirmDialog
        confirmLabel="Remove item"
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
                          {item.type} - {item.summary}
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

                  {/* The same card as the Menu Library grid, so an item looks
                      like itself - picture included - wherever it is shown, and
                      removing it is the three-dot action it already is there. */}
                  {activePackageItems.length === 0 ? (
                    <p className="m-3 rounded-lg border border-dashed border-[#d8dde5] bg-[#fbfcfd] px-3 py-6 text-center text-xs text-[#516174]">
                      No items in this package yet. Pick them from the library
                      below.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 p-3 sm:gap-3 md:grid-cols-4 2xl:grid-cols-6">
                      {activePackageItems.map((item) => {
                        const isPending =
                          packageItemActions.pendingItemId === item.id;

                        return (
                          <MenuItemCard
                            key={`${activePackage.id}-${item.id}`}
                            actions={[
                              {
                                label: "Remove",
                                disabled: !canEditMenu,
                                tone: "danger",
                                onSelect: () =>
                                  void packageItemActions.removeItem(item.id)
                              }
                            ]}
                            category={item.category}
                            name={item.name}
                            pendingLabel={isPending ? "Removing…" : null}
                            pictureUrl={item.pictureUrl}
                          />
                        );
                      })}
                    </div>
                  )}

                  <PackageItemPicker
                    availableItems={addablePackageItems}
                    isDisabled={!canEditMenu}
                    libraryItemCount={allMenuItems.length}
                    onAdd={(itemId) => void packageItemActions.addItem(itemId)}
                    pendingItemId={packageItemActions.pendingItemId}
                  />
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
              ) : isPlatedMenu ? (
                <div className="grid items-start gap-3 p-3 md:grid-cols-2 2xl:grid-cols-4">
                  {platedCourses.map((course) => (
                    <MenuRuleSection
                      key={`${activeTab}-${course.title}`}
                      title={course.title}
                      items={course.items}
                    />
                  ))}
                </div>
              ) : (
                // Ungrouped: the buffet has no courses, so the cards sit in one
                // wrapping row rather than under section headers.
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
          <div className="grid h-auto min-h-0 min-w-0 items-start gap-3 xl:h-full xl:grid-cols-[minmax(0,1fr)_320px]">
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
                      {displayCategories.map((category) => (
                        <option key={category.label} value={category.label}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-3 gap-2 overflow-y-auto p-3 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 2xl:grid-cols-6">
                  {visibleItems.map((item) => (
                    <MenuItemCard
                      key={item.id}
                      actions={[
                        {
                          label: "Update",
                          disabled: !canEditMenu,
                          onSelect: () => libraryItemActions.startEdit(item.id)
                        },
                        {
                          label: "Remove",
                          disabled: !canEditMenu,
                          tone: "danger",
                          onSelect: () => libraryItemActions.startRemove(item.id)
                        }
                      ]}
                      category={item.category}
                      name={item.name}
                      pictureUrl={item.pictureUrl}
                    />
                  ))}
                  <AddItemCard onClick={() => setIsNewLibraryItemOpen(true)} />
                </div>
              </div>
            </section>

            <aside className="flex h-auto min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-[#d8dde5] bg-white xl:h-full">
              <header className="flex h-11 items-center gap-2 border-b border-[#d8dde5] px-4">
                <LineIcon name="filter" className="h-4 w-4 text-[#17202a]" />
                <h2 className="text-sm font-black text-[#17202a]">
                  Categories
                </h2>
              </header>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                {displayCategories.map((category) => {
                  const isActive = selectedCategory === category.label;

                  return (
                    <button
                      key={category.label}
                      className={`flex h-13.5 w-full items-center gap-3 rounded-lg border px-3 text-left ${
                        isActive
                          ? "border-[#1f4d73] bg-[#eef4fa]"
                          : "border-[#d8dde5] bg-white hover:bg-[#eef4fa]"
                      }`}
                      type="button"
                      onClick={() => setSelectedCategory(category.label)}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#d8dde5] bg-[#fbfcfd] text-[#1f4d73]">
                        <LineIcon name="document" className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="text-sm font-black text-[#17202a]">
                          {category.label}
                        </span>
                        <span className="ml-0.5 text-xs text-[#6a7483]">
                          {category.count} items
                        </span>
                      </span>
                      <LineIcon
                        name="chevron"
                        className="h-4 w-4 shrink-0 text-[#17202a]"
                      />
                    </button>
                  );
                })}
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
