"use client";

import Image from "next/image";
import {
  useId,
  useMemo,
  useRef,
  useState,
  useEffect,
  type FormEvent,
  type ReactNode
} from "react";
import { useRouter } from "next/navigation";

type DashboardTopbarProps = {
  title: string;
  subtitle?: string;
  onTodayNotes?: () => void;
  todayNotesNeedRevision?: boolean;
  onNewBooking?: () => void;
  actionsSlot?: ReactNode;
  compactMobileActions?: boolean;
  rightSlot?: ReactNode;
  showSearch?: boolean;
};

type SearchTarget = {
  label: string;
  description: string;
  route: string;
  keywords: string[];
};

const searchTargets: SearchTarget[] = [
  {
    label: "Dashboard",
    description: "Operating day overview",
    route: "/dashboard",
    keywords: ["home", "overview", "schedule", "kpis"]
  },
  {
    label: "Kitchen",
    description: "Kitchen production board",
    route: "/dashboard/kitchen",
    keywords: ["food", "prep", "production", "items"]
  },
  {
    label: "Calendar",
    description: "Room availability and bookings",
    route: "/dashboard/calendar",
    keywords: ["booking", "date", "month", "rooms"]
  },
  {
    label: "Events",
    description: "Event manager and event files",
    route: "/dashboard/events",
    keywords: ["event", "client", "wedding", "files"]
  },
  {
    label: "Menu",
    description: "Library, packages, buffet, plated, add-ons",
    route: "/dashboard/menu",
    keywords: ["menu", "packages", "buffet", "plated", "addons", "add-ons"]
  },
  {
    label: "Clients",
    description: "Client directory, events and balances",
    route: "/dashboard/clients",
    keywords: ["client", "crm", "contacts", "history"]
  },
  {
    label: "Billing",
    description: "Invoices, balances, transactions",
    route: "/dashboard/billing",
    keywords: ["invoice", "payment", "balance", "money", "transactions"]
  },
  {
    label: "Dining Manager",
    description: "Dining room operations",
    route: "/dashboard/dining-manager",
    keywords: ["dining", "tables", "service"]
  },
  {
    label: "Hall Room Map",
    description: "Hall layouts and room map",
    route: "/dashboard/hall-room-map",
    keywords: ["hall", "map", "layout", "rooms"]
  }
];

function TopbarIcon({
  name,
  className = "h-4 w-4"
}: {
  name: "search" | "plus" | "notes";
  className?: string;
}) {
  if (name === "search") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        className={className}
      >
        <path d="m21 21-4.3-4.3" />
        <circle cx="11" cy="11" r="7" />
      </svg>
    );
  }

  if (name === "notes") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 2v4M15 2v4M8.5 10h7M8.5 14h7M8.5 18h4.5" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className={className}
    >
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

function setDashboardSidebarState(collapsed: boolean) {
  document.documentElement.dataset.dashboardSidebar = collapsed
    ? "collapsed"
    : "expanded";
  window.localStorage.setItem("sidebarCollapsed", String(collapsed));
  window.dispatchEvent(
    new CustomEvent("dashboard-sidebar-change", {
      detail: { collapsed }
    })
  );
}

export function DashboardTopbarBrand() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    getCurrentSidebarCollapsed
  );
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    const sidebarState = document.documentElement.dataset.dashboardSidebar;
    setIsSidebarCollapsed(
      sidebarState
        ? getCurrentSidebarCollapsed()
        : window.localStorage.getItem("sidebarCollapsed") === "true"
    );

    const handleSidebarChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ collapsed: boolean }>;
      setIsSidebarCollapsed(Boolean(customEvent.detail?.collapsed));
    };

    window.addEventListener("dashboard-sidebar-change", handleSidebarChange);

    return () => {
      window.removeEventListener(
        "dashboard-sidebar-change",
        handleSidebarChange
      );
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const updateViewport = () => setIsMobileViewport(mediaQuery.matches);
    const handleMobileSidebarChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ open?: boolean }>;
      setIsMobileSidebarOpen(Boolean(customEvent.detail?.open));
    };

    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);
    window.addEventListener(
      "dashboard-mobile-sidebar-change",
      handleMobileSidebarChange
    );

    return () => {
      mediaQuery.removeEventListener("change", updateViewport);
      window.removeEventListener(
        "dashboard-mobile-sidebar-change",
        handleMobileSidebarChange
      );
    };
  }, []);

  const toggleSidebar = () => {
    if (window.matchMedia("(max-width: 1023px)").matches) {
      window.dispatchEvent(
        new CustomEvent("dashboard-mobile-sidebar-toggle", {
          detail: { open: !isMobileSidebarOpen }
        })
      );
      return;
    }

    const nextCollapsed = !getCurrentSidebarCollapsed();

    setIsSidebarCollapsed(nextCollapsed);
    setDashboardSidebarState(nextCollapsed);
    window.dispatchEvent(
      new CustomEvent("dashboard-sidebar-toggle", {
        detail: { collapsed: nextCollapsed }
      })
    );
  };

  const sidebarToggleLabel = isMobileViewport
    ? isMobileSidebarOpen
      ? "Close navigation"
      : "Open navigation"
    : isSidebarCollapsed
      ? "Expand sidebar"
      : "Close Sidebar";

  return (
    <div className="dashboard-topbar-brand fixed left-0 top-0 z-60 flex h-14 shrink-0 items-center justify-center gap-3 border-b border-r border-white/10 bg-[#061126] px-4 backdrop-blur-xl sm:px-6 lg:h-20 lg:justify-between">
      <button
        aria-label={sidebarToggleLabel}
        className="dashboard-topbar-logo-shell relative hidden h-20 shrink-0 cursor-pointer overflow-visible border-0 bg-transparent p-0 text-left transition-[margin,width] duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 lg:flex"
        onClick={toggleSidebar}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleSidebar();
          }
        }}
        type="button"
      >
        <span
          aria-hidden="true"
          className="dashboard-topbar-logo dashboard-topbar-logo-full"
        />
        <span
          aria-hidden="true"
          className="dashboard-topbar-logo dashboard-topbar-logo-mark"
        />
      </button>
      <button
        className="dashboard-sidebar-toggle group absolute left-4 flex h-10 w-10 shrink-0 items-center justify-center overflow-visible border border-transparent bg-transparent text-[#17202a] shadow-none transition-transform duration-150 ease-out hover:bg-transparent active:scale-90 focus:outline-none focus-visible:outline-none focus-visible:ring-0 lg:hidden"
        type="button"
        onClick={toggleSidebar}
        aria-label={sidebarToggleLabel}
        aria-expanded={isMobileViewport ? isMobileSidebarOpen : !isSidebarCollapsed}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute hidden h-10 w-10 rounded-lg bg-transparent transition-colors group-hover:bg-white/10 lg:block"
        />
        <span className="relative h-5 w-6 lg:hidden" aria-hidden="true">
          <span className="absolute left-0 top-0.5 h-0.5 w-6 rounded-full bg-current" />
          <span className="absolute left-0 top-2.25 h-0.5 w-6 rounded-full bg-current" />
          <span className="absolute left-0 top-4 h-0.5 w-6 rounded-full bg-current" />
        </span>
        <span
          aria-hidden="true"
          className={`absolute hidden h-8 w-8 bg-contain bg-center bg-no-repeat transition-[opacity,transform] duration-90 ease-in-out group-hover:opacity-0 lg:block lg:brightness-0 lg:invert ${
            isSidebarCollapsed ? "scale-100 opacity-100" : "scale-95 opacity-0"
          }`}
          style={{
            backgroundImage: "url('/images/branding/logo.png?v=20260722')",
            backgroundPosition: "38% center",
            backgroundSize: "190% 190%"
          }}
        />
        <Image
          src="/images/icons/sidebar-right.png"
          alt=""
          width={24}
          height={24}
          unoptimized
          className={`absolute hidden h-7 w-7 object-contain transition-[opacity,transform] duration-90 ease-in-out lg:block lg:brightness-0 lg:invert ${
            isSidebarCollapsed
              ? "scale-100 opacity-0 group-hover:opacity-100"
              : "scale-95 opacity-0"
          }`}
        />
        <Image
          src="/images/icons/sidebar-left.png"
          alt=""
          width={20}
          height={20}
          unoptimized
          className={`absolute hidden h-7 w-7 object-contain transition-[opacity,transform] duration-70 ease-in-out lg:block lg:brightness-0 lg:invert ${
            isSidebarCollapsed ? "scale-90 opacity-0" : "scale-100 opacity-100"
          }`}
        />
        {isSidebarCollapsed ? (
          <span className="pointer-events-none fixed z-50 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#1f4d73] px-3 py-2 text-xs font-bold text-white shadow-xl shadow-[#17202a]/20 lg:left-19 lg:top-10 lg:group-hover:block">
            {sidebarToggleLabel}
          </span>
        ) : null}
      </button>
    </div>
  );
}

export function DashboardTopbar({
  title,
  subtitle,
  onTodayNotes,
  todayNotesNeedRevision = false,
  onNewBooking,
  actionsSlot,
  compactMobileActions = false,
  rightSlot,
  showSearch = true
}: DashboardTopbarProps) {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchInputId = useId();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileSearchExpanded, setIsMobileSearchExpanded] = useState(false);

  const searchResults = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return searchTargets.slice(0, 6);
    }

    return searchTargets
      .filter((target) => {
        const haystack = [target.label, target.description, ...target.keywords]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .slice(0, 6);
  }, [searchQuery]);

  const goToSearchTarget = (target: SearchTarget) => {
    setSearchQuery("");
    setIsSearchOpen(false);
    setIsMobileSearchExpanded(false);
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
      <header className="dashboard-topbar-content fixed right-0 top-0 z-50 bg-[#ffffff]/95 backdrop-blur-xl">
        <div className="flex min-h-14 items-stretch lg:min-h-20">
          <div
            className={`relative flex min-w-0 flex-1 flex-col border-b border-[#d8dde5] pl-20 pr-4 lg:flex-row lg:items-center lg:gap-2 lg:px-0 lg:py-0 lg:pl-6 lg:pr-8 xl:gap-6 ${
              compactMobileActions
                ? "gap-0 pb-3 pt-3"
                : "gap-0 pb-3 pt-3"
            }`}
          >
            <div className="order-1 flex h-9 min-w-0 shrink items-center pr-26 lg:order-0 lg:block lg:h-auto lg:grow lg:pr-0">
              <h1 className="truncate text-base font-black tracking-tight text-[#17202a] sm:text-lg lg:text-2xl">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-1 hidden truncate text-sm font-medium text-[#6a7483] lg:block">
                  {subtitle}
                </p>
              ) : null}
            </div>

            <div className="order-2 flex w-full min-w-0 flex-col gap-2 lg:ml-auto lg:w-auto lg:shrink-0 lg:flex-row lg:items-center xl:gap-3">
              {showSearch ? (
                <form
                  className={`z-60 w-auto lg:relative lg:left-auto lg:right-auto lg:top-auto lg:z-auto lg:block ${
                    isMobileSearchExpanded
                      ? "absolute left-4 right-4 top-14 block"
                      : "hidden"
                  }`}
                  onSubmit={submitSearch}
                >
                  <label
                    className="flex h-10 w-full min-w-0 cursor-text items-center gap-2 rounded-xl border border-[#b9c2cf] bg-white px-3 text-sm text-[#6a7483] shadow-sm transition focus-within:border-[#1f4d73] focus-within:bg-[#fbfcfd] lg:h-11 lg:w-56 lg:gap-3 lg:px-4 xl:w-72 2xl:w-96"
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
                      onBlur={() =>
                        window.setTimeout(() => {
                          setIsSearchOpen(false);
                          setIsMobileSearchExpanded(false);
                        }, 120)
                      }
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
                                <TopbarIcon
                                  name="search"
                                  className="h-3.5 w-3.5"
                                />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-black text-[#17202a]">
                                  {target.label}
                                </span>
                                <span className="block truncate text-xs font-semibold text-[#6a7483]">
                                  {target.description}
                                </span>
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="px-4 py-3 text-sm font-semibold text-[#6a7483]">
                          No matches found.
                        </div>
                      )}
                    </div>
                  ) : null}
                </form>
              ) : null}

              <div
                className={`flex min-w-0 gap-0.5 lg:static lg:w-auto lg:shrink-0 lg:gap-2 ${
                  actionsSlot && !compactMobileActions
                    ? "w-full"
                    : "absolute right-4 top-3 w-auto"
                }`}
              >
                {showSearch ? (
                  <button
                    aria-expanded={isMobileSearchExpanded}
                    aria-label="Search"
                    className="flex h-9 w-8 items-center justify-center bg-transparent text-[#17202a] transition hover:text-[#1f4d73] lg:hidden"
                    onClick={() => {
                      const nextExpanded = !isMobileSearchExpanded;
                      setIsMobileSearchExpanded(nextExpanded);
                      setIsSearchOpen(nextExpanded);
                      if (nextExpanded) {
                        window.setTimeout(() => searchInputRef.current?.focus(), 0);
                      }
                    }}
                    title="Search"
                    type="button"
                  >
                    <TopbarIcon className="h-6 w-6" name="search" />
                  </button>
                ) : null}

                {actionsSlot ?? (
                  <>
                  <button
                    aria-label="Open today notes"
                    type="button"
                    onClick={onTodayNotes}
                    title="Today notes"
                    className="dashboard-topbar-icon-action revision-gradient-stroke flex h-9 w-8 items-center justify-center whitespace-nowrap bg-transparent p-0 text-xs font-bold text-[#17202a] transition hover:text-[#1f4d73] sm:text-sm lg:h-11 lg:w-auto lg:flex-none lg:rounded-xl lg:border lg:border-[#b9c2cf] lg:bg-white lg:px-4 lg:shadow-sm lg:hover:bg-[#eef4fa] 2xl:px-5"
                    data-needs-revision={todayNotesNeedRevision || undefined}
                  >
                    <TopbarIcon className="h-6 w-6 lg:h-4 lg:w-4" name="notes" />
                    <span className="relative z-1 hidden lg:inline">Today notes</span>
                  </button>

                  <button
                    aria-label="Create new booking"
                    type="button"
                    onClick={onNewBooking}
                    title="New booking"
                    className="flex h-9 w-8 items-center justify-center whitespace-nowrap bg-transparent p-0 text-xs font-bold text-[#1f4d73] transition hover:text-[#15344f] sm:text-sm lg:h-11 lg:w-auto lg:flex-none lg:gap-2 lg:rounded-xl lg:bg-[#1f4d73] lg:px-4 lg:text-white lg:shadow-lg lg:shadow-[#17202a]/15 lg:hover:-translate-y-0.5 lg:hover:bg-[#15344f] lg:hover:text-white 2xl:px-5"
                  >
                    <TopbarIcon className="h-6.5 w-6.5 lg:h-4 lg:w-4" name="plus" />
                    <span className="hidden lg:inline">New booking</span>
                  </button>
                  </>
                )}
              </div>

              {rightSlot}
            </div>
          </div>
        </div>
      </header>

      <div className="h-14 lg:h-20" aria-hidden="true" />
    </>
  );
}
