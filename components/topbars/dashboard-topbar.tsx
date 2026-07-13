"use client";

import Image from "next/image";
import { useId, useMemo, useRef, useState, useEffect, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type DashboardTopbarProps = {
  title: string;
  subtitle?: string;
  onTodayNotes?: () => void;
  onNewBooking?: () => void;
  actionsSlot?: ReactNode;
  rightSlot?: ReactNode;
};

type SearchTarget = {
  label: string;
  description: string;
  route: string;
  keywords: string[];
};

const searchTargets: SearchTarget[] = [
  { label: "Dashboard", description: "Operating day overview", route: "/dashboard", keywords: ["home", "overview", "schedule", "kpis"] },
  { label: "Kitchen", description: "Kitchen production board", route: "/dashboard/kitchen", keywords: ["food", "prep", "production", "items"] },
  { label: "Calendar", description: "Room availability and bookings", route: "/dashboard/calendar", keywords: ["booking", "date", "month", "rooms"] },
  { label: "Events", description: "Event manager and event files", route: "/dashboard/events", keywords: ["event", "client", "wedding", "files"] },
  { label: "Menu", description: "Library, packages, buffet, plated, add-ons", route: "/dashboard/menu", keywords: ["menu", "packages", "buffet", "plated", "addons", "add-ons"] },
  { label: "Client Portal", description: "Client-facing portal tools", route: "/dashboard/client-portal", keywords: ["client", "portal", "share", "link"] },
  { label: "Billing", description: "Invoices, balances, transactions", route: "/dashboard/billing", keywords: ["invoice", "payment", "balance", "money", "transactions"] },
  { label: "Dining Manager", description: "Dining room operations", route: "/dashboard/dining-manager", keywords: ["dining", "tables", "service"] },
  { label: "Hall Room Map", description: "Hall layouts and room map", route: "/dashboard/hall-room-map", keywords: ["hall", "map", "layout", "rooms"] },
  { label: "Settings", description: "Rules, users, pricing, templates", route: "/dashboard/settings", keywords: ["settings", "admin", "users", "pricing"] },
];

function TopbarIcon({ name, className = "h-4 w-4" }: { name: "search" | "plus"; className?: string }) {
  if (name === "search") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
        <path d="m21 21-4.3-4.3" />
        <circle cx="11" cy="11" r="7" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function getCurrentSidebarCollapsed() {
  if (typeof document === "undefined") {
    return false;
  }

  const sidebarState = document.documentElement.dataset.dashboardSidebar;

  if (sidebarState === "collapsed") {
    return true;
  }

  if (sidebarState === "expanded") {
    return false;
  }

  return false;
}

export function DashboardTopbarBrand() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(getCurrentSidebarCollapsed);

  useEffect(() => {
    const sidebarState = document.documentElement.dataset.dashboardSidebar;
    setIsSidebarCollapsed(
      sidebarState ? getCurrentSidebarCollapsed() : window.localStorage.getItem("sidebarCollapsed") === "true"
    );

    const handleSidebarChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ collapsed: boolean }>;
      setIsSidebarCollapsed(Boolean(customEvent.detail?.collapsed));
    };

    window.addEventListener("dashboard-sidebar-change", handleSidebarChange);

    return () => {
      window.removeEventListener("dashboard-sidebar-change", handleSidebarChange);
    };
  }, []);

  const toggleSidebar = () => {
    if (window.matchMedia("(max-width: 1023px)").matches) {
      window.dispatchEvent(new CustomEvent("dashboard-mobile-sidebar-toggle"));
      return;
    }

    const nextCollapsed = !isSidebarCollapsed;

    setIsSidebarCollapsed(nextCollapsed);
    window.dispatchEvent(
      new CustomEvent("dashboard-sidebar-toggle", {
        detail: { collapsed: nextCollapsed },
      })
    );
  };

  return (
    <div className="dashboard-topbar-brand fixed left-0 top-0 z-60 flex h-20 shrink-0 items-center justify-between gap-3 border-b border-r border-[#d8dde5] bg-[#ffffff]/95 px-4 backdrop-blur-xl sm:px-6">
      <Image
        src="/hms-logo-header.png"
        alt="Hall Management SaaS"
        width={1160}
        height={300}
        priority
        unoptimized
        className="dashboard-topbar-logo h-14 w-auto object-contain sm:h-16"
      />

      <button
        className={`dashboard-sidebar-toggle group relative flex shrink-0 items-center justify-center overflow-hidden transition hover:-translate-y-0.5 focus:outline-none focus-visible:outline-none focus-visible:ring-0 ${
          isSidebarCollapsed
            ? "h-11 w-11 rounded-xl border border-transparent bg-transparent shadow-none hover:border-[#d8dde5] hover:bg-[#eef4fa] hover:shadow-sm"
            : "h-9 w-9 rounded-xl border border-[#d8dde5] bg-white text-[#17202a] shadow-sm hover:bg-[#eef4fa]"
        }`}
        type="button"
        onClick={toggleSidebar}
        aria-label={isSidebarCollapsed ? "Expand sidebar" : "Open navigation"}
        title={isSidebarCollapsed ? "Expand sidebar" : "Open navigation"}
      >
        <Image
          src="/logo.png"
          alt=""
          width={44}
          height={44}
          unoptimized
          className={`absolute h-11 w-11 object-contain transition-[opacity,transform] duration-90 ease-in-out group-hover:opacity-0 ${
            isSidebarCollapsed ? "scale-100 opacity-100" : "scale-95 opacity-0"
          }`}
        />
        <Image
          src="/sidebar-right.png"
          alt=""
          width={24}
          height={24}
          unoptimized
          className={`absolute h-5 w-5 object-contain transition-[opacity,transform] duration-90 ease-in-out ${
            isSidebarCollapsed ? "scale-100 opacity-0 group-hover:opacity-100" : "scale-95 opacity-0"
          }`}
        />
        <Image
          src="/sidebar-left.png"
          alt=""
          width={20}
          height={20}
          unoptimized
          className={`absolute h-5 w-5 object-contain transition-[opacity,transform] duration-70 ease-in-out ${
            isSidebarCollapsed ? "scale-90 opacity-0" : "scale-100 opacity-100"
          }`}
        />
      </button>
    </div>
  );
}

export function DashboardTopbar({ title, subtitle, onTodayNotes, onNewBooking, actionsSlot, rightSlot }: DashboardTopbarProps) {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchInputId = useId();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const searchResults = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return searchTargets.slice(0, 6);
    }

    return searchTargets
      .filter((target) => {
        const haystack = [target.label, target.description, ...target.keywords].join(" ").toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .slice(0, 6);
  }, [searchQuery]);

  const goToSearchTarget = (target: SearchTarget) => {
    setSearchQuery("");
    setIsSearchOpen(false);
    router.push(target.route as Parameters<typeof router.push>[0]);
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const [firstResult] = searchResults;
    if (firstResult) {
      goToSearchTarget(firstResult);
    }
  };

  useEffect(() => {
    const focusSearchFromShortcut = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const target = event.target;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (isTyping) {
        return;
      }

      event.preventDefault();
      searchInputRef.current?.focus();
      setIsSearchOpen(true);
    };

    window.addEventListener("keydown", focusSearchFromShortcut);

    return () => {
      window.removeEventListener("keydown", focusSearchFromShortcut);
    };
  }, []);

  return (
    <>
      <header className="dashboard-topbar-content fixed right-0 top-20 z-50 bg-[#ffffff]/95 backdrop-blur-xl lg:top-0">
        <div className="flex min-h-20 items-stretch">
          <div className="flex min-w-0 flex-1 items-center gap-3 border-b border-[#d8dde5] px-4 sm:px-6 lg:pl-6 lg:pr-8 xl:gap-6">
            <div className="min-w-0 shrink grow">
              <h1 className="truncate text-xl font-black tracking-tight text-[#17202a] sm:text-2xl">{title}</h1>
              {subtitle ? <p className="mt-1 hidden truncate text-sm font-medium text-[#6a7483] sm:block">{subtitle}</p> : null}
            </div>

            <div className="ml-auto hidden min-w-0 shrink-0 items-center gap-2 lg:flex xl:gap-3">
              <form className="relative" onSubmit={submitSearch}>
                <label
                  className="flex h-11 w-56 min-w-0 cursor-text items-center gap-3 rounded-xl border border-[#b9c2cf] bg-white px-4 text-sm text-[#6a7483] shadow-sm transition focus-within:border-[#1f4d73] focus-within:bg-[#fbfcfd] xl:w-72 2xl:w-96"
                  htmlFor={searchInputId}
                >
                  <TopbarIcon name="search" />
                  <input
                    id={searchInputId}
                    ref={searchInputRef}
                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#17202a] outline-none placeholder:text-[#6a7483]"
                    placeholder="Search events, clients, invoices"
                    type="search"
                    value={searchQuery}
                    onBlur={() => window.setTimeout(() => setIsSearchOpen(false), 120)}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setIsSearchOpen(true);
                    }}
                    onFocus={() => setIsSearchOpen(true)}
                  />
                </label>

                {isSearchOpen ? (
                  <div className="absolute left-0 right-0 top-13 z-50 overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-xl shadow-[#17202a]/12">
                    {searchResults.length ? (
                      <div className="p-1.5">
                        {searchResults.map((target) => (
                          <button
                            key={target.route}
                            className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-[#eef4fa]"
                            type="button"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              goToSearchTarget(target);
                            }}
                          >
                            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#d8dde5] bg-[#fbfcfd] text-[#1f4d73]">
                              <TopbarIcon name="search" className="h-3.5 w-3.5" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-black text-[#17202a]">{target.label}</span>
                              <span className="block truncate text-xs font-semibold text-[#6a7483]">{target.description}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="px-4 py-3 text-sm font-semibold text-[#6a7483]">No matches found.</div>
                    )}
                  </div>
                ) : null}
              </form>

              {actionsSlot ?? (
                <>
                  <button
                    type="button"
                    onClick={onTodayNotes}
                    className="h-11 whitespace-nowrap rounded-xl border border-[#b9c2cf] bg-white px-4 text-sm font-bold text-[#17202a] shadow-sm transition hover:border-[#1f4d73]/60 hover:bg-[#eef4fa] 2xl:px-5"
                  >
                    Today notes
                  </button>

                  <button
                    type="button"
                    onClick={onNewBooking}
                    className="flex h-11 items-center gap-2 whitespace-nowrap rounded-xl bg-[#1f4d73] px-4 text-sm font-bold text-white shadow-lg shadow-[#17202a]/15 transition hover:-translate-y-0.5 hover:bg-[#15344f] 2xl:px-5"
                  >
                    <TopbarIcon name="plus" />
                    New booking
                  </button>
                </>
              )}

              {rightSlot}
            </div>
          </div>
        </div>
      </header>

      <div className="h-40 lg:h-20" aria-hidden="true" />
    </>
  );
}
