"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { clearCachedSyncedUser, getCachedSyncedUser, syncSignedInUser, type SyncSignedInUserResponse } from "@/lib/auth/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type IconName = "box" | "chevron" | "dollar" | "document" | "filter" | "plus";

function LineIcon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  const paths: Record<IconName, ReactNode> = {
    box: <><path d="m21 8-9-5-9 5 9 5Z" /><path d="M3 8v8l9 5 9-5V8M12 13v8" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    dollar: <><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" /></>,
    document: <><path d="M6 3h12v18H6Z" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
    filter: <path d="M4 5h16l-6 7v5l-4 2v-7Z" />,
    plus: <path d="M12 5v14M5 12h14" />,
  };

  return <svg {...common}>{paths[name]}</svg>;
}

const tabs = [
  { label: "Menu Library", icon: "document" },
  { label: "Packages", icon: "box" },
  { label: "Buffet Menu", icon: "document" },
  { label: "Plated Menu", icon: "document" },
  { label: "Add-ons", icon: "dollar" },
] satisfies Array<{ label: string; icon: IconName }>;

const menuItems = [
  { name: "Challah rolls", category: "Appetizer" },
  { name: "Dips platter", category: "Appetizer" },
  { name: "Chicken soup", category: "Soup" },
  { name: "Braised short ribs", category: "Main" },
  { name: "Grilled chicken", category: "Main" },
  { name: "Salmon platter", category: "Main" },
  { name: "Potato kugel", category: "Side" },
  { name: "Roasted vegetables", category: "Side" },
  { name: "Soda package", category: "Drink" },
  { name: "Coffee station", category: "Drink" },
  { name: "Dessert cups", category: "Dessert" },
  { name: "Sweet table", category: "Dessert" },
];

const packages = [
  { name: "Standard Dinner", type: "Dinner", summary: "8 Buffet/Plated items", price: "$9,500.00" },
  { name: "Gold Dinner", type: "Dinner", summary: "7 Buffet/Plated items", price: "$12,500.00" },
  { name: "Dairy Buffet", type: "Dairy", summary: "5 Buffet/Plated items", price: "$7,800.00" },
  { name: "Shabbos Package", type: "Shabbos", summary: "9 Buffet/Plated items", price: "$14,200.00" },
];

const packageItems = [
  { name: "Challah rolls", mode: "Buffet", rule: "1 roll per 1 people", price: "$0.00" },
  { name: "Dips platter", mode: "Buffet", rule: "1 set per 1 tables", price: "$0.00" },
  { name: "Chicken soup", mode: "Plated", rule: "1 bowl per 1 people", price: "$0.00" },
  { name: "Grilled chicken", mode: "Plated", rule: "1 plate per 1 people", price: "$0.00" },
  { name: "Potato kugel", mode: "Buffet", rule: "1 tray per 30 people", price: "$0.00" },
  { name: "Roasted vegetables", mode: "Plated", rule: "1 portion per 1 people", price: "$0.00" },
  { name: "Soda package", mode: "Buffet", rule: "1 bottle per 8 people", price: "$0.00" },
  { name: "Dessert cups", mode: "Plated", rule: "1 cup per 1 people", price: "$0.00" },
];

const packageAddItems = [
  { name: "Grilled chicken", category: "Buffet", rule: "1 tray per 30 people", price: "$0.00" },
  { name: "Challah rolls", category: "Plated", rule: "1 roll per 1 people", price: "$0.00" },
];

const buffetSections = [
  {
    title: "Appetizers",
    items: [
      { name: "Challah rolls", category: "Buffet", rule: "1 roll per 1 people", price: "$0.00" },
      { name: "Dips platter", category: "Buffet", rule: "1 set per 1 tables", price: "$0.00" },
    ],
  },
  { title: "Soups", items: [] },
  {
    title: "Mains",
    items: [
      { name: "Grilled chicken", category: "Buffet", rule: "1 tray per 30 people", price: "$0.00" },
    ],
  },
  {
    title: "Sides",
    items: [
      { name: "Potato kugel", category: "Buffet", rule: "1 tray per 30 people", price: "$0.00" },
    ],
  },
  {
    title: "Drinks",
    items: [
      { name: "Soda package", category: "Buffet", rule: "1 bottle per 8 people", price: "$0.00" },
    ],
  },
  { title: "Desserts", items: [] },
  { title: "Other", items: [] },
];

const platedSections = [
  { title: "Appetizers", items: [] },
  {
    title: "Soups",
    items: [
      { name: "Chicken soup", category: "Plated", rule: "1 bowl per 1 people", price: "$0.00" },
    ],
  },
  {
    title: "Mains",
    items: [
      { name: "Grilled chicken", category: "Plated", rule: "1 plate per 1 people", price: "$0.00" },
      { name: "Roasted vegetables", category: "Plated", rule: "1 portion per 1 people", price: "$0.00" },
    ],
  },
  { title: "Sides", items: [] },
  { title: "Drinks", items: [] },
  {
    title: "Desserts",
    items: [
      { name: "Dessert cups", category: "Plated", rule: "1 cup per 1 people", price: "$0.00" },
    ],
  },
  { title: "Other", items: [] },
];

const addOns = [
  {
    name: "Coffee station",
    description: "1 station per 1 event - Optional coffee and tea station",
    price: "$350.00",
    tag: "Parve",
  },
  {
    name: "Sweet table",
    description: "1 display per 1 event - Optional sweet table display",
    price: "$900.00",
    tag: "Parve",
  },
];

const categories = [
  { label: "All", count: 12 },
  { label: "Appetizer", count: 2 },
  { label: "Soup", count: 1 },
  { label: "Main", count: 3 },
  { label: "Side", count: 2 },
  { label: "Drink", count: 2 },
  { label: "Dessert", count: 2 },
  { label: "More", count: 0 },
];

function MenuItemCard({ category, name }: { category: string; name: string }) {
  return (
    <article className="flex h-50 overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
      <div className="flex w-full flex-col">
        <div className="relative flex flex-1 items-center justify-center bg-[#fbfcfd]">
          <span className="absolute left-3 top-3 rounded-full bg-white px-2 py-1 text-[10px] font-black text-[#17202a]">{category}</span>
          <span className="flex h-18 w-18 items-center justify-center rounded-full border border-[#b9c2cf] text-[#b9c2cf]">
            <span className="flex h-10 w-10 rounded-full border border-[#b9c2cf]" />
          </span>
        </div>
        <div className="flex h-12 items-center justify-center border-t border-[#d8dde5] px-3 text-center text-sm font-black leading-4 text-[#17202a]">
          {name}
        </div>
      </div>
    </article>
  );
}

function AddItemCard() {
  return (
    <button className="flex h-50 overflow-hidden rounded-lg border border-dashed border-[#d8dde5] bg-[#fbfcfd] text-[#17202a]" type="button">
      <div className="flex w-full flex-col">
        <div className="flex flex-1 items-center justify-center">
          <span className="flex h-18 w-18 items-center justify-center rounded-xl border border-dashed border-[#b9c2cf] bg-white">
            <LineIcon name="plus" className="h-5 w-5" />
          </span>
        </div>
        <div className="flex h-12 items-center justify-center border-t border-[#d8dde5] text-sm font-black">Add item</div>
      </div>
    </button>
  );
}

function PackageAddCard({ category, name, rule, price }: { category: string; name: string; rule: string; price: string }) {
  return (
    <article className="flex h-50 w-38 overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
      <div className="flex w-full flex-col">
        <div className="relative flex flex-1 items-center justify-center bg-[#fbfcfd]">
          <span className="absolute left-3 top-3 rounded-full bg-white px-2 py-1 text-[10px] font-black text-[#17202a]">{category}</span>
          <span className="flex h-18 w-18 items-center justify-center rounded-full border border-[#b9c2cf] text-[#b9c2cf]">
            <span className="flex h-10 w-10 rounded-full border border-[#b9c2cf]" />
          </span>
        </div>
        <div className="flex h-16 flex-col items-center justify-center border-t border-[#d8dde5] px-2 text-center">
          <p className="text-sm font-black leading-4 text-[#17202a]">{name}</p>
          <p className="mt-1 text-xs leading-4 text-[#6a7483]">{rule}</p>
          <p className="text-xs leading-4 text-[#6a7483]">{price}</p>
        </div>
      </div>
    </article>
  );
}

function MenuRuleCard({ category, name, rule, price }: { category: string; name: string; rule: string; price: string }) {
  return (
    <article className="flex h-50 w-38 overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
      <div className="flex w-full flex-col">
        <div className="relative flex flex-1 items-center justify-center bg-[#fbfcfd]">
          <span className="absolute left-3 top-3 rounded-full bg-white px-2 py-1 text-[10px] font-black text-[#17202a]">{category}</span>
          <span className="flex h-18 w-18 items-center justify-center rounded-full border border-[#b9c2cf] text-[#b9c2cf]">
            <span className="flex h-10 w-10 rounded-full border border-[#b9c2cf]" />
          </span>
        </div>
        <div className="flex h-16 flex-col items-center justify-center border-t border-[#d8dde5] px-2 text-center">
          <p className="text-sm font-black leading-4 text-[#17202a]">{name}</p>
          <p className="mt-1 text-xs leading-4 text-[#6a7483]">{rule}</p>
          <p className="text-xs leading-4 text-[#6a7483]">{price}</p>
        </div>
      </div>
    </article>
  );
}

function MenuRuleSection({ title, items }: { title: string; items: Array<{ name: string; category: string; rule: string; price: string }> }) {
  return (
    <section className="min-h-21 overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
      <header className="flex h-10 items-center justify-between gap-3 border-b border-[#d8dde5] px-3">
        <h3 className="text-sm font-black text-[#17202a]">{title}</h3>
        <span className="rounded-full border border-[#b9c2cf] bg-[#eef4fa] px-2 py-1 text-[10px] font-black text-[#1f4d73]">{items.length} items</span>
      </header>
      {items.length ? (
        <div className="flex flex-col gap-10 p-3">
          {items.map((item) => (
            <MenuRuleCard key={`${title}-${item.name}`} category={item.category} name={item.name} rule={item.rule} price={item.price} />
          ))}
        </div>
      ) : (
        <p className="px-3 py-4 text-xs text-[#516174]">No items in this section yet.</p>
      )}
    </section>
  );
}

function AddOnCard({ name, description, price, tag }: { name: string; description: string; price: string; tag: string }) {
  return (
    <article className="flex min-h-25 rounded-lg border border-[#d8dde5] bg-white p-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-18 w-18 shrink-0 items-center justify-center rounded-lg border border-[#d8dde5] bg-[#fbfcfd]">
          <span className="flex h-10 w-10 rounded-full border border-[#b9c2cf]" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-black text-[#17202a]">{name}</h3>
          <p className="mt-1 max-w-48 text-xs leading-4 text-[#516174]">{description}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full border border-[#b9c2cf] bg-[#eef4fa] px-2 py-1 text-[10px] font-black text-[#1f4d73]">{price}</span>
            <span className="rounded-full border border-[#b9c2cf] bg-[#eef4fa] px-2 py-1 text-[10px] font-black text-[#17202a]">{tag}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

export function MenuPage() {
  const router = useRouter();
  const [syncData, setSyncData] = useState<SyncSignedInUserResponse | null>(null);
  const [activeTab, setActiveTab] = useState("Menu Library");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedPackage, setSelectedPackage] = useState(packages[0].name);

  useEffect(() => {
    let isMounted = true;
    const cachedSyncData = getCachedSyncedUser();

    if (cachedSyncData) {
      setSyncData(cachedSyncData);
    }

    async function loadUser() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.auth.getSession();

        if (error || !data.session?.access_token) {
          clearCachedSyncedUser();
          router.replace("/");
          return;
        }

        const synced = await syncSignedInUser(data.session.access_token);

        if (isMounted) {
          setSyncData(synced);
        }
      } catch {
        if (!cachedSyncData) {
          clearCachedSyncedUser();
          router.replace("/");
        }
      }
    }

    loadUser();

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (!syncData) {
    return <main className="min-h-screen bg-[#f5f6f8]" aria-busy="true" />;
  }

  const visibleItems = selectedCategory === "All" ? menuItems : menuItems.filter((item) => item.category === selectedCategory);
  const activePackage = packages.find((item) => item.name === selectedPackage) ?? packages[0];
  const isRuleMenu = activeTab === "Buffet Menu" || activeTab === "Plated Menu";
  const ruleSections = activeTab === "Plated Menu" ? platedSections : buffetSections;
  const ruleMode = activeTab === "Plated Menu" ? "plated" : "buffet";

  return (
    <div className="flex flex-col overflow-hidden bg-[#f5f6f8] text-[#17202a]">
      <div className="shrink-0 bg-white">
        <header className="flex min-h-16 flex-col gap-3 border-b border-[#d8dde5] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-black leading-6 text-[#17202a]">Menu</h1>
            <p className="mt-1 text-xs text-[#6a7483]">Menu library, packages, buffet, plated and add-ons.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
            <button
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#b9c2cf] bg-white px-4 text-sm font-black text-[#17202a] hover:bg-[#eef4fa]"
              type="button"
            >
              <LineIcon name="plus" className="h-4 w-4" />
              New library item
            </button>
            <button
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#1f4d73] bg-[#1f4d73] px-4 text-sm font-black text-white shadow-sm shadow-[#1f4d73]/20 hover:bg-[#15344f]"
              type="button"
            >
              <LineIcon name="box" className="h-4 w-4" />
              New package
            </button>
          </div>
        </header>

        <nav className="flex min-h-12 shrink-0 flex-wrap gap-2 overflow-hidden border-b border-[#d8dde5] px-4">
          {tabs.map((tab) => (
            <button
              key={tab.label}
              className={`inline-flex h-12 shrink-0 items-center gap-2 border-b-3 px-2 text-sm font-black ${
                activeTab === tab.label ? "border-[#1f4d73] text-[#17202a]" : "border-transparent text-[#17202a] hover:bg-[#eef4fa]"
              }`}
              type="button"
              onClick={() => setActiveTab(tab.label)}
            >
              <LineIcon name={tab.icon} className="h-4 w-4 text-[#516174]" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <main className="p-3">
        {activeTab === "Packages" ? (
          <div className="grid items-start gap-3 xl:grid-cols-[310px_minmax(0,1fr)]">
            <aside className="self-start overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
              <header className="flex h-14 items-center justify-between gap-3 border-b border-[#d8dde5] px-3">
                <div className="flex items-center gap-2">
                  <LineIcon name="box" className="h-4 w-4 text-[#17202a]" />
                  <h2 className="text-sm font-black text-[#17202a]">Packages</h2>
                </div>
                <button className="inline-flex h-8 items-center rounded-lg bg-[#1f4d73] px-3 text-xs font-black text-white hover:bg-[#15344f]" type="button">
                  New
                </button>
              </header>

              <div className="space-y-2 p-3">
                {packages.map((item) => {
                  const isActive = selectedPackage === item.name;

                  return (
                    <button
                      key={item.name}
                      className={`flex h-14 w-full items-center gap-3 overflow-hidden rounded-lg border px-3 text-left ${
                        isActive ? "border-[#1f4d73] bg-[#eef4fa]" : "border-[#d8dde5] bg-white hover:bg-[#eef4fa]"
                      }`}
                      type="button"
                      onClick={() => setSelectedPackage(item.name)}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#d8dde5] bg-[#fbfcfd] text-[#1f4d73]">
                        <LineIcon name="box" className="h-4 w-4" />
                      </span>
                      <span className="grid min-w-0 flex-1 gap-0.5">
                        <span className="truncate text-sm font-black leading-4 text-[#17202a]">{item.name}</span>
                        <span className="truncate text-xs leading-4 text-[#6a7483]">{item.type} - {item.summary}</span>
                      </span>
                      <span className="shrink-0 rounded-full border border-[#b9c2cf] bg-[#eef4fa] px-1.5 py-1 text-[10px] font-black leading-none text-[#1f4d73]">{item.price}</span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="self-start overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
              <div className="max-h-[calc(100vh-9rem)] overflow-y-auto">
                <header className="flex min-h-14 items-center justify-between gap-3 border-b border-[#d8dde5] px-3 py-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <LineIcon name="box" className="h-4 w-4 text-[#17202a]" />
                      <h2 className="truncate text-sm font-black text-[#17202a]">{activePackage.name}</h2>
                    </div>
                    <p className="mt-1 text-xs text-[#6a7483]">{activePackage.type} - Base {activePackage.price} - $95.00 per couple</p>
                  </div>
                  <button className="inline-flex h-8 shrink-0 items-center rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black text-[#17202a] hover:bg-[#eef4fa]" type="button">
                    Edit package
                  </button>
                </header>

                <div className="space-y-2 p-3">
                  {packageItems.map((item) => (
                    <article key={`${activePackage.name}-${item.name}`} className="flex min-h-14 items-center gap-3 rounded-lg border border-[#d8dde5] bg-white px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-black text-[#17202a]">{item.name}</h3>
                        <p className="mt-0.5 text-xs text-[#516174]">{item.mode} - {item.rule} - {item.price}</p>
                      </div>
                      <span className="w-22 shrink-0 rounded-full border border-[#d8dde5] bg-[#fbfcfd] px-3 py-1 text-center text-[10px] font-black text-[#1f4d73]">{item.mode}</span>
                      <button className="shrink-0 rounded-md border border-[#f0b4ae] bg-white px-2 py-1 text-xs font-black text-[#a62b24] hover:bg-[#fff5f4]" type="button">
                        Remove
                      </button>
                    </article>
                  ))}
                </div>

                <section className="mx-3 mb-3 overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
                  <header className="flex h-11 items-center border-b border-[#d8dde5] px-3">
                    <h3 className="text-sm font-black text-[#17202a]">Add Buffet or Plated items</h3>
                  </header>
                  <div className="flex flex-wrap gap-3 p-3">
                    {packageAddItems.map((item) => (
                      <PackageAddCard key={item.name} category={item.category} name={item.name} rule={item.rule} price={item.price} />
                    ))}
                  </div>
                </section>
              </div>
            </section>
          </div>
        ) : isRuleMenu ? (
          <section className="self-start overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
            <div className="max-h-[calc(100vh-9rem)] overflow-y-auto">
              <header className="flex min-h-14 items-center justify-between gap-3 border-b border-[#d8dde5] px-3 py-2">
                <div>
                  <div className="flex items-center gap-2">
                    <LineIcon name="document" className="h-4 w-4 text-[#17202a]" />
                    <h2 className="text-sm font-black text-[#17202a]">{activeTab}</h2>
                  </div>
                  <p className="mt-1 text-xs text-[#6a7483]">Select a Menu Library item, then add the rule and price.</p>
                </div>
                <button className="inline-flex h-8 shrink-0 items-center rounded-lg bg-[#1f4d73] px-3 text-xs font-black text-white hover:bg-[#15344f]" type="button">
                  Add {ruleMode} item
                </button>
              </header>

              <div className="grid items-start gap-3 p-3 md:grid-cols-2 2xl:grid-cols-4">
                {ruleSections.map((section) => (
                  <MenuRuleSection key={`${activeTab}-${section.title}`} title={section.title} items={section.items} />
                ))}
              </div>
            </div>
          </section>
        ) : activeTab === "Add-ons" ? (
          <section className="self-start overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
            <header className="flex min-h-14 items-center justify-between gap-3 border-b border-[#d8dde5] px-3 py-2">
              <div>
                <div className="flex items-center gap-2">
                  <LineIcon name="dollar" className="h-4 w-4 text-[#17202a]" />
                  <h2 className="text-sm font-black text-[#17202a]">Add-ons</h2>
                </div>
                <p className="mt-1 text-xs text-[#6a7483]">Separate add-on items. Add-ons are not pulled from Buffet Menu or Plated Menu.</p>
              </div>
              <button className="inline-flex h-8 shrink-0 items-center rounded-lg bg-[#1f4d73] px-3 text-xs font-black text-white hover:bg-[#15344f]" type="button">
                New add-on
              </button>
            </header>

            <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-[repeat(2,325px)]">
              {addOns.map((item) => (
                <AddOnCard key={item.name} name={item.name} description={item.description} price={item.price} tag={item.tag} />
              ))}
            </div>
          </section>
        ) : (
        <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="self-start overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
            <div className="max-h-[calc(100vh-9rem)] overflow-y-auto">
              <header className="flex items-start justify-between gap-3 border-b border-[#d8dde5] px-3 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <LineIcon name="document" className="h-4 w-4 text-[#17202a]" />
                    <h1 className="text-sm font-black text-[#17202a]">Menu Library</h1>
                  </div>
                  <p className="mt-1 text-xs text-[#6a7483]">Base food items only. No rules, no prices, no hall usage.</p>
                </div>
                <button className="inline-flex h-8 shrink-0 items-center rounded-lg bg-[#1f4d73] px-3 text-xs font-black text-white hover:bg-[#15344f]" type="button">
                  New item
                </button>
              </header>

              <div className="border-b border-[#d8dde5] p-3">
                <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_150px_140px]">
                  <input
                    className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm text-[#17202a] outline-none placeholder:text-[#6a7483] focus:border-[#1f4d73]"
                    placeholder="Search menu items"
                    type="search"
                  />
                  <select
                    className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm text-[#17202a] outline-none focus:border-[#1f4d73]"
                    value={selectedCategory}
                    onChange={(event) => setSelectedCategory(event.target.value)}
                  >
                    {categories.map((category) => (
                      <option key={category.label} value={category.label}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                  <select className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm text-[#17202a] outline-none focus:border-[#1f4d73]" defaultValue="All">
                    <option>All</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
                {visibleItems.map((item) => (
                  <MenuItemCard key={item.name} category={item.category} name={item.name} />
                ))}
                <AddItemCard />
              </div>
            </div>
          </section>

          <aside className="self-start overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
            <header className="flex h-11 items-center gap-2 border-b border-[#d8dde5] px-4">
              <LineIcon name="filter" className="h-4 w-4 text-[#17202a]" />
              <h2 className="text-sm font-black text-[#17202a]">Categories</h2>
            </header>

            <div className="space-y-2 p-3">
              {categories.map((category) => {
                const isActive = selectedCategory === category.label;

                return (
                  <button
                    key={category.label}
                    className={`flex h-13.5 w-full items-center gap-3 rounded-lg border px-3 text-left ${
                      isActive ? "border-[#1f4d73] bg-[#eef4fa]" : "border-[#d8dde5] bg-white hover:bg-[#eef4fa]"
                    }`}
                    type="button"
                    onClick={() => setSelectedCategory(category.label)}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#d8dde5] bg-[#fbfcfd] text-[#1f4d73]">
                      <LineIcon name="document" className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-sm font-black text-[#17202a]">{category.label}</span>
                      <span className="ml-0.5 text-xs text-[#6a7483]">{category.count} items</span>
                    </span>
                    <LineIcon name="chevron" className="h-4 w-4 shrink-0 text-[#17202a]" />
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
