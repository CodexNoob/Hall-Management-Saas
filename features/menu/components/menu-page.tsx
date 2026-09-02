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
import {
  NewItemMenuPicker,
  type NewItemMenuChoice
} from "@/features/menu/forms/new-item-menu-picker";
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
  SERVICE_STYLES,
  findRuleForStyle,
  formatServiceRule,
  isDrinkKind,
  readServiceRules,
  servesStyle,
  serviceStyleLabel,
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

/**
 * Which tab lists an item created with this answer.
 *
 * Drinks are listed by kind, so one goes to the Drink Menu whether or not it
 * carries a rule yet. A dish goes to the tab for the style it was given, and a
 * dish given none stays in the library it was catalogued into.
 */
function menuTabForChoice({ kind, serviceStyle }: NewItemMenuChoice) {
  if (kind === "Drink") return "Drink Menu";
  if (serviceStyle === "Buffet") return "Buffet Menu";
  if (serviceStyle === "Plated") return "Plated Menu";

  return "Menu Library";
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
  // Which way of serving the Drink Menu is filtered to. Its own state rather
  // than a second `activeTab`, because it only means anything on that one tab
  // and must not survive a jump to Packages and back.
  const [drinkView, setDrinkView] = useState("All");
  // By id, not by name: two packages may share a name, and renaming one would
  // otherwise deselect it mid-edit.
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(
    null
  );
  const [isNewPackageOpen, setIsNewPackageOpen] = useState(false);
  const [isEditingPackage, setIsEditingPackage] = useState(false);
  const [isNewAddOnOpen, setIsNewAddOnOpen] = useState(false);
  const [isNewLibraryItemOpen, setIsNewLibraryItemOpen] = useState(false);
  // The library tab's two-step create: the picker asks which menu, and the
  // answer is what the form then opens as. Null everywhere else - the Buffet,
  // Plated and Drink tabs are their own answer and open the form directly.
  const [isMenuPickerOpen, setIsMenuPickerOpen] = useState(false);
  const [newItemChoice, setNewItemChoice] = useState<NewItemMenuChoice | null>(
    null
  );
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
      containsAlcohol: item.containsAlcohol ?? null,
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
        subtitle="Menu library, packages, buffet, plated, drinks and add-ons."
        title="Menu"
      />
    );
  }

  // Which tab is open, resolved before the lists below because two of them now
  // depend on it. `isRuleMenu` covers the two service tabs, which share a pane.
  const isRuleMenu = activeTab === "Buffet Menu" || activeTab === "Plated Menu";
  const isPlatedMenu = activeTab === "Plated Menu";
  const isDrinkMenu = activeTab === "Drink Menu";
  const ruleMode = isPlatedMenu ? "plated" : "buffet";
  const serviceStyle: ServiceStyle = isPlatedMenu ? "Plated" : "Buffet";
  /**
   * What a create opens as - the picker's answer on the library tab, the tab's
   * own answer everywhere else. Both settle it, so the form asks neither
   * question and opens as a buffet, plated or drink form outright.
   *
   * "Food" on the service tabs is not merely a default: `servedItems` drops
   * drinks, so a drink saved from the Buffet Menu used to appear on no tab at
   * all - not the one it was added from, and not the Drink Menu it was never
   * created on.
   */
  const createDefaults: NewItemMenuChoice =
    newItemChoice ??
    (isDrinkMenu
      ? { kind: "Drink", serviceStyle: null }
      : isRuleMenu
        ? { kind: "Food", serviceStyle }
        : { kind: "Food", serviceStyle: null });
  /** Opens the create flow the tab uses: the picker, or the form itself. */
  const startCreate = () => {
    if (isRuleMenu || isDrinkMenu) setIsNewLibraryItemOpen(true);
    else setIsMenuPickerOpen(true);
  };
  const normalizedSearch = pageSearchQuery.trim().toLowerCase();
  // Menu Library and Drink Menu are one screen over two halves of one catalog:
  // an item shows under exactly whichever of them matches its kind, so a drink
  // is managed in one place instead of sitting in a food library it has nothing
  // to do with. Split here rather than in the grid, so the category filter and
  // the search below only ever see the half that is on screen.
  const kindFilteredItems = allMenuItems.filter(
    (item) => isDrinkKind(item.kind) === isDrinkMenu
  );
  const visibleItems = (
    selectedCategory === "All"
      ? kindFilteredItems
      : kindFilteredItems.filter((item) => item.category === selectedCategory)
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
  // Drawn from the half of the catalog that is on screen, so the Drink Menu
  // filter does not offer courses no drink is ever filed under.
  const categoryNames = [
    "All",
    ...Array.from(
      new Set([
        ...(menuQuery.data?.categories ?? []).map((category) => category.name),
        ...kindFilteredItems.map((item) => item.category)
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
  // The service tabs are views over the same catalog the library tab renders,
  // not lists of their own. A dish served both ways carries a rule for each and
  // shows under both tabs without being stored twice.
  //
  // Filtering the items rather than flattening their rules is what keeps this
  // one card per dish: the unique key allows a dish to hold more than one rule
  // for the same style, and flattening would render it twice.
  const servedItems = allMenuItems
    .filter((item) => servesStyle(item.services, serviceStyle))
    // Drinks keep their rules - the kitchen sheet still counts bottles per
    // table - but they are read off the Drink Menu tab, which is the one place
    // they are managed. Leaving them here would list them under a food heading
    // and, on Plated, under a word that is not even the one they use.
    .filter((item) => !isDrinkKind(item.kind))
    .filter(
      (item) =>
        !normalizedSearch ||
        `${item.name} ${item.category}`.toLowerCase().includes(normalizedSearch)
    );
  /**
   * The Drink Menu, split by how each drink is served.
   *
   * This is the tab's whole answer to "I ticked Buffet - where did it go?". On
   * the food tabs the style IS the tab, so the answer is obvious; drinks stay on
   * one tab whichever way they are served, and without these groups the tick
   * changed nothing anyone could see.
   *
   * A drink served both ways appears in both groups, exactly as a dish with two
   * rules shows under both Buffet Menu and Plated Menu. It is one row with two
   * rules, not two drinks.
   */
  const rulelessDrinks = visibleItems.filter(
    (item) => item.services.length === 0
  );
  const drinkViews = [
    {
      id: "All",
      label: "All",
      hint: "Every drink, however it is served.",
      items: visibleItems
    },
    {
      id: "Buffet",
      label: "Buffet",
      hint: "A drinks station guests help themselves from. Counted per guests.",
      items: visibleItems.filter((item) => servesStyle(item.services, "Buffet"))
    },
    {
      // "Table" to the operator, `Plated` in the column - the same rename
      // `serviceStyleLabel` does everywhere else a drink's style is shown.
      id: "Table",
      label: "Table",
      hint: "Bottles set out on each table. Counted per table.",
      items: visibleItems.filter((item) => servesStyle(item.services, "Plated"))
    },
    // Only when there is something in it. A permanently visible "No rule yet"
    // reads as a chore the venue is failing at; a drink without a rule is a
    // normal state, and the event asks for the number when it matters.
    ...(rulelessDrinks.length > 0
      ? [
          {
            id: "NoRule",
            label: "No rule yet",
            hint: "Still available to put on an event, which is where the rule gets asked for.",
            items: rulelessDrinks
          }
        ]
      : [])
  ];
  // Falls back rather than trusting the state: answering the last outstanding
  // rule removes the tab the operator is standing on, and a dangling id would
  // leave an empty grid with nothing highlighted above it.
  const activeDrinkView =
    drinkViews.find((view) => view.id === drinkView) ?? drinkViews[0];

  /** The rule line under a drink's name, for whichever tab is open. */
  const describeDrink = (item: MenuLibraryItem) => {
    if (activeDrinkView.id === "NoRule" || item.services.length === 0) {
      return "Not counted yet";
    }

    if (activeDrinkView.id === "Buffet" || activeDrinkView.id === "Table") {
      const style = activeDrinkView.id === "Buffet" ? "Buffet" : "Plated";

      return formatServiceRule(findRuleForStyle(item.services, style));
    }

    // On All, a drink served both ways has two rules and one line to say them
    // in. Naming the ways beats truncating the numbers - the numbers are one
    // click away, on the tab for the way you care about.
    const styles = SERVICE_STYLES.filter((style) =>
      servesStyle(item.services, style)
    );

    return styles.length > 1
      ? styles.map((style) => serviceStyleLabel(style, "Drink")).join(" and ")
      : formatServiceRule(findRuleForStyle(item.services, styles[0]));
  };

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
    // A ticked style with no rule yet is allowed here: the library is where a
    // dish is catalogued, and the rule is asked for again the first time it
    // goes on an event.
    const services = toServiceRules(values.services, { allowBlankRule: true });
    // Which pair of questions the form asked - the drink form swaps the course
    // and kashrut selects for the alcohol switch, so only one of the two ever
    // has an answer worth writing.
    const isDrink = isDrinkKind(values.kind);
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
      // Not sent for a drink, whose form does not ask it: a column left null is
      // an unanswered question, while "Parve" written from the form's own seed
      // would be an answer nobody gave.
      kosherType: isDrink ? undefined : values.kashrutType,
      containsAlcohol: isDrink ? values.containsAlcohol : undefined,
      allergens: parseAllergens(values.allergies),
      notes: values.description,
      picturePath
    });
    await menuQuery.refetch();
    setSelectedCategory(values.category);
    // Land where the item actually went.
    //
    // On a service tab that is the tab you are already on - jumping to the
    // library is what made "Add buffet item" look like it had created the wrong
    // thing. From the library picker it is the menu you picked, for the same
    // reason in reverse: choosing Drink Menu and staying on a tab that does not
    // list drinks is the same disappearance, one step later.
    setActiveTab(menuTabForChoice(createDefaults));
    setIsNewLibraryItemOpen(false);
    setNewItemChoice(null);
  };

  return (
    <div className="flex h-dvh w-full max-w-full flex-col overflow-hidden bg-[#f5f6f8] text-[#17202a]">
      <DashboardTopbar
        title="Menu"
        subtitle="Menu library, packages, buffet, plated, drinks and add-ons."
        compactMobileActions
        showSearch={false}
        /* Bulk upload only. Creating an item or a package is done from the tab
           that owns it - the library's own "New item" and the Packages
           sidebar's "New" - so the topbar no longer duplicates either, and the
           library's own search box is the one place the list is filtered from.
           The fragment stays even when the button is gated away, or a slot that
           went nullish would fall back to the topbar's default actions. */
        actionsSlot={
          <>
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
                // The category list is drawn from the half of the catalog the
                // open tab owns, so a filter carried across from the other one
                // can name a category nothing here is filed under - an empty
                // grid under a selection the dropdown cannot even show. Only on
                // a click: a create still jumps to the category it saved into.
                setSelectedCategory("All");
                // Same reasoning one level down: coming back to Drinks should
                // show the whole list, not whichever way of serving was last
                // being looked at.
                setDrinkView("All");
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
      {/* Step one of the library tab's create. The service tabs skip it: they
          have already said which menu, which is the only thing it asks. */}
      <NewItemMenuPicker
        onChoose={(choice) => {
          setNewItemChoice(choice);
          setIsMenuPickerOpen(false);
          setIsNewLibraryItemOpen(true);
        }}
        onClose={() => setIsMenuPickerOpen(false)}
        open={isMenuPickerOpen}
      />
      {/* One dialog for both flows: `initialValues` is what makes it an edit,
          and the save handler follows it. */}
      <NewLibraryItemDialog
        // Signed by GET /api/menu, the same URL the card draws - so the form
        // shows the picture the operator clicked on rather than an empty slot.
        currentPictureUrl={libraryItemActions.editingItem?.pictureUrl}
        // Both settled before the form opens - see `createDefaults`. A drink
        // opens on the bottle defaults rather than the plate ones, and a buffet
        // item opens as a buffet item rather than asking which it is.
        defaultServiceStyle={createDefaults.serviceStyle ?? undefined}
        defaultKind={createDefaults.kind}
        initialValues={libraryItemActions.editingValues}
        // The confirmation below sits on top of this form; while it is up, an
        // Escape belongs to it and must not take the edit down with it.
        isDismissBlocked={Boolean(libraryItemActions.removingItem)}
        onClose={() => {
          setIsNewLibraryItemOpen(false);
          // Cleared with the form, so the next create asks again rather than
          // silently reusing the menu picked for the one that was abandoned.
          setNewItemChoice(null);
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
        defaultKind={isDrinkMenu ? "Drink" : undefined}
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
          // Both columns are capped at the row height from `xl` up, so a long
          // package list scrolls inside its own sidebar instead of growing the
          // row and handing the scroll to `main`. `max-h-full` rather than
          // `h-full`, so a column that fits still hugs its content instead of
          // drawing a screen-tall card around four packages. Below `xl` the two
          // stack and the page scrolls, which is the only shape that fits on a
          // phone.
          <div className="grid min-h-0 min-w-0 items-start gap-3 xl:h-full xl:grid-cols-[310px_minmax(0,1fr)]">
            <aside className="flex min-h-0 min-w-0 flex-col self-start overflow-hidden rounded-lg border border-[#d8dde5] bg-white xl:max-h-full">
              <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[#d8dde5] px-3">
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

              <div className="grid min-h-0 grid-cols-3 gap-2 p-3 sm:grid-cols-1 xl:overflow-y-auto">
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

            <section className="flex min-h-0 min-w-0 flex-col self-start overflow-hidden rounded-lg border border-[#d8dde5] bg-white xl:max-h-full">
              {activePackage ? (
                // Bounded by the section above rather than by a `100vh` cap:
                // the topbar and the tab strip are not a fixed number of rems -
                // they wrap on narrow screens - so any subtracted constant is
                // wrong at some width.
                <div className="min-h-0 overflow-visible xl:overflow-y-auto">
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
                <div className="flex min-h-72 flex-col items-center justify-center px-6 py-10 text-center">
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
          <section className="flex min-h-0 min-w-0 flex-col self-start overflow-hidden rounded-lg border border-[#d8dde5] bg-white xl:max-h-full">
            <div className="min-h-0 overflow-visible xl:overflow-y-auto">
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
                  onClick={startCreate}
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
          <section className="flex min-h-0 min-w-0 flex-col self-start overflow-hidden rounded-lg border border-[#d8dde5] bg-white xl:max-h-full">
            <header className="flex min-h-14 shrink-0 flex-col items-stretch gap-3 border-b border-[#d8dde5] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-2">
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

            <div className="grid min-h-0 gap-3 p-3 sm:grid-cols-2 xl:grid-cols-[repeat(2,325px)] xl:overflow-y-auto">
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
          // Menu Library and Drink Menu, which are the same screen twice: one
          // grid of clickable cards over `visibleItems`, which is already the
          // half of the catalog this tab owns. Only the wording differs, so
          // they share a branch rather than duplicating the pane.
          <div className="grid h-auto min-h-0 min-w-0 items-start gap-3 xl:h-full">
            <section className="flex h-auto min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-[#d8dde5] bg-white xl:h-full">
              <div className="flex min-h-0 flex-1 flex-col">
                <header className="flex shrink-0 flex-col items-stretch gap-3 border-b border-[#d8dde5] px-3 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <LineIcon
                        name={isDrinkMenu ? "drink" : "document"}
                        className="h-4 w-4 text-[#17202a]"
                      />
                      <h1 className="text-sm font-black text-[#17202a]">
                        {isDrinkMenu ? "Drink Menu" : "Menu Library"}
                      </h1>
                    </div>
                    <p className="mt-1 text-xs text-[#6a7483]">
                      {isDrinkMenu
                        ? "Drinks only. Serving rules are set on the item; price stays on the package."
                        : "Base food items only. No rules, no prices, no hall usage."}
                    </p>
                  </div>
                  <button
                    className="inline-flex h-8 shrink-0 items-center justify-center self-end rounded-lg bg-[#1f4d73] px-3 text-xs font-black text-white hover:bg-[#15344f] sm:self-auto"
                    onClick={startCreate}
                    type="button"
                  >
                    {isDrinkMenu ? "New drink" : "New item"}
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
                      placeholder={
                        isDrinkMenu ? "Search drinks" : "Search menu items"
                      }
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
                {isDrinkMenu ? (
                  /* A strip of its own, unlike the library beside it, because
                     "Buffet or Table?" is the one question this tab asks that
                     has nowhere else to be answered. On the food tabs the
                     choice IS the tab, so it needs no control; here both
                     answers live on one tab, and without this ticking either
                     one appeared to do nothing at all.

                     Pills rather than the underline the tab strip above uses:
                     two underlined rows stacked read as one confused nav, and
                     these filter what is already on a tab rather than moving
                     between tabs. */
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="shrink-0 border-b border-[#d8dde5] px-3 py-2">
                      <div
                        aria-label="Filter drinks by how they are served"
                        className="scrollbar-none flex flex-nowrap gap-2 overflow-x-auto"
                        role="tablist"
                      >
                        {drinkViews.map((view) => {
                          const isActive = activeDrinkView.id === view.id;

                          return (
                            <button
                              aria-selected={isActive}
                              className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-black ${
                                isActive
                                  ? "border-[#1f4d73] bg-[#1f4d73] text-white"
                                  : "border-[#b9c2cf] bg-white text-[#17202a] hover:bg-[#eef4fa]"
                              }`}
                              key={view.id}
                              onClick={(event) => {
                                setDrinkView(view.id);
                                centerMobileTab(event.currentTarget);
                              }}
                              role="tab"
                              type="button"
                            >
                              {view.label}
                              <span
                                className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
                                  isActive
                                    ? "bg-white/20 text-white"
                                    : "bg-[#eef4fa] text-[#1f4d73]"
                                }`}
                              >
                                {view.items.length}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-1.5 text-[11px] text-[#6a7483]">
                        {activeDrinkView.hint}
                      </p>
                    </div>

                    <div className="grid min-h-0 flex-1 grid-cols-3 gap-2 overflow-y-auto p-3 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 2xl:grid-cols-6">
                      {activeDrinkView.items.map((item) => (
                        <MenuItemCard
                          key={item.id}
                          // The switch, on the card. Drinks are all filed under
                          // one category now that their form stopped asking for
                          // one, so the pill had nothing left to say - and the
                          // answer it carries instead is the one an operator
                          // scans a drinks list for. Only when it is true: a
                          // "Non-alcoholic" pill on every juice is noise, and
                          // the pill is how you spot the ones that are not.
                          category={item.containsAlcohol ? "Alcohol" : item.category}
                          // The numbers, on the card. Choosing a style used to
                          // leave nothing on screen to show for it; this is
                          // what it bought you.
                          detail={describeDrink(item)}
                          isSelectDisabled={!canEditMenu}
                          name={item.name}
                          onSelect={() => libraryItemActions.startEdit(item.id)}
                          // Cutlery over a list of bottles reads as the wrong
                          // tab; a pictureless drink gets a glass instead.
                          pictureIcon="drink"
                          pictureUrl={item.pictureUrl}
                        />
                      ))}
                      <AddItemCard onClick={startCreate} />
                    </div>
                  </div>
                ) : (
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
                    <AddItemCard onClick={startCreate} />
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
