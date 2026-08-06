"use client";

import { useMemo, useState } from "react";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { DashboardPageState } from "@/components/layout/dashboard-page-state";
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
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";

import {
  AddItemCard,
  AddOnCard,
  MenuItemCard,
  MenuRuleSection,
  PackageAddCard
} from "@/features/menu/components/menu-cards";
import {
  LineIcon,
  buffetSections,
  packageAddItems,
  platedSections,
  tabs,
  type MenuResponse
} from "@/features/menu/components/menu-shared";
export function MenuPage() {
  const [pageSearchQuery, setPageSearchQuery] = useDashboardPageSearch("Menu");
  const menuQuery = useAuthenticatedQuery<MenuResponse>("/api/menu");
  const menuMutation = useAuthenticatedMutation<
    Record<string, unknown>,
    Record<string, unknown>
  >("/api/menu");
  const [activeTab, setActiveTab] = useState("Menu Library");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedPackage, setSelectedPackage] = useState("");
  const [isNewPackageOpen, setIsNewPackageOpen] = useState(false);
  const [isEditingPackage, setIsEditingPackage] = useState(false);
  const [isNewAddOnOpen, setIsNewAddOnOpen] = useState(false);
  const [isNewLibraryItemOpen, setIsNewLibraryItemOpen] = useState(false);
  const allMenuItems = useMemo(() => {
    const savedItems = (menuQuery.data?.items ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category ?? "More"
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
        name: item.name,
        description: item.notes ?? item.pricingType,
        price: new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD"
        }).format(Number(item.price ?? 0)),
        tag: item.pricingType
      })),
    [menuQuery.data]
  );

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
  const activePackage =
    allPackages.find((item) => item.name === selectedPackage) ??
    allPackages[0] ??
    null;
  const activePackageItems = activePackage
    ? allMenuItems.filter((item) =>
        activePackage.includedMenuItemIds.includes(item.id)
      )
    : [];

  const updatePackage = async (changes: Record<string, unknown>) => {
    if (!activePackage) return;
    const response = await authenticatedFetch(
      `/api/menu/packages/${activePackage.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes)
      }
    );
    if (response.ok) await menuQuery.refetch();
  };
  const isRuleMenu = activeTab === "Buffet Menu" || activeTab === "Plated Menu";
  const ruleSections =
    activeTab === "Plated Menu" ? platedSections : buffetSections;
  const ruleMode = activeTab === "Plated Menu" ? "plated" : "buffet";

  const savePackage = async (values: NewPackageFormValues) => {
    if (isEditingPackage) {
      await updatePackage({
        name: values.name,
        regularPrice: Number(values.basePrice)
      });
      setSelectedPackage(values.name);
      setIsEditingPackage(false);
      setIsNewPackageOpen(false);
      return;
    }
    await menuMutation.mutate({
      resource: "package",
      name: values.name,
      regularPrice: Number(values.basePrice),
      hallIds: [],
      eventTypeIds: [],
      includedMenuItemIds: []
    });
    await menuQuery.refetch();
    setSelectedPackage(values.name);
    setActiveTab("Packages");
    setIsNewPackageOpen(false);
  };

  const saveAddOn = async (values: NewAddOnValues) => {
    await menuMutation.mutate({
      resource: "addon",
      name: values.name,
      price: Number(values.price),
      pricingType: "fixed",
      hallIds: []
    });
    await menuQuery.refetch();
  };

  const saveLibraryItem = async (values: NewLibraryItemFormValues) => {
    await menuMutation.mutate({
      resource: "item",
      name: values.name,
      category: values.category,
      usageType: "Library",
      kosherType: values.kashrutType,
      notes: values.description
    });
    await menuQuery.refetch();
    setSelectedCategory(values.category);
    setActiveTab("Menu Library");
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
          basePrice: activePackage.price.replace(/[^0-9.]/g, ""),
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
      <NewLibraryItemDialog
        onClose={() => setIsNewLibraryItemOpen(false)}
        onSave={saveLibraryItem}
        open={isNewLibraryItemOpen}
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
                  const isActive = selectedPackage === item.name;

                  return (
                    <button
                      key={item.name}
                      className={`flex min-h-24 w-full min-w-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border p-2 text-center sm:h-14 sm:min-h-0 sm:flex-row sm:justify-start sm:gap-3 sm:px-3 sm:text-left ${
                        isActive
                          ? "border-[#1f4d73] bg-[#eef4fa]"
                          : "border-[#d8dde5] bg-white hover:bg-[#eef4fa]"
                      }`}
                      type="button"
                      onClick={() => setSelectedPackage(item.name)}
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
                        {activePackage.type} - Base {activePackage.price} -
                        $95.00 per couple
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

                  <div className="space-y-2 p-3">
                    {activePackageItems.map((item) => (
                      <article
                        key={`${activePackage.name}-${item.id}`}
                        className="flex min-h-14 min-w-0 flex-wrap items-center gap-2 rounded-lg border border-[#d8dde5] bg-white px-3 py-2 sm:flex-nowrap sm:gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-black text-[#17202a]">
                            {item.name}
                          </h3>
                          <p className="mt-0.5 text-xs text-[#516174]">
                            {item.category}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full border border-[#d8dde5] bg-[#fbfcfd] px-3 py-1 text-center text-[10px] font-black text-[#1f4d73] sm:w-22">
                          Included
                        </span>
                        <button
                          className="shrink-0 rounded-md border border-[#f0b4ae] bg-white px-2 py-1 text-xs font-black text-[#a62b24] hover:bg-[#fff5f4]"
                          type="button"
                          onClick={() =>
                            void updatePackage({
                              includedMenuItemIds:
                                activePackage.includedMenuItemIds.filter(
                                  (id) => id !== item.id
                                )
                            })
                          }
                        >
                          Remove
                        </button>
                      </article>
                    ))}
                  </div>

                  <section className="mx-3 mb-3 overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
                    <header className="flex h-11 items-center border-b border-[#d8dde5] px-3">
                      <h3 className="text-sm font-black text-[#17202a]">
                        Add Buffet or Plated items
                      </h3>
                    </header>
                    <div className="grid grid-cols-3 gap-2 p-3 sm:flex sm:flex-wrap sm:gap-3">
                      {packageAddItems.map((item) => (
                        <PackageAddCard
                          key={item.name}
                          category={item.category}
                          name={item.name}
                          rule={item.rule}
                          price={item.price}
                        />
                      ))}
                    </div>
                  </section>
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

              <div className="grid items-start gap-3 p-3 md:grid-cols-2 2xl:grid-cols-4">
                {ruleSections.map((section) => (
                  <MenuRuleSection
                    key={`${activeTab}-${section.title}`}
                    title={section.title}
                    items={section.items}
                  />
                ))}
              </div>
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
                  key={item.name}
                  name={item.name}
                  description={item.description}
                  price={item.price}
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
                  <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_150px_140px]">
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
                    <select
                      className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm text-[#17202a] outline-none focus:border-[#1f4d73]"
                      defaultValue="All"
                      name="menuTypeFilter"
                    >
                      <option>All</option>
                    </select>
                  </div>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-3 gap-2 overflow-y-auto p-3 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 2xl:grid-cols-6">
                  {visibleItems.map((item) => (
                    <MenuItemCard
                      key={item.id}
                      category={item.category}
                      name={item.name}
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
