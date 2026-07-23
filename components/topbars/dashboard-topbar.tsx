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
  name: "search" | "plus";
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
    <div className="dashboard-topbar-brand fixed left-0 top-0 z-60 flex h-20 shrink-0 items-center justify-center gap-3 border-b border-r border-white/10 bg-[#061126] px-4 backdrop-blur-xl sm:px-6 lg:justify-between">
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
        className="dashboard-sidebar-toggle group absolute left-4 flex h-10 w-10 shrink-0 items-center justify-center overflow-visible border border-transparent bg-transparent text-[#17202a] shadow-none transition hover:bg-transparent focus:outline-none focus-visible:outline-none focus-visible:ring-0 lg:hidden"
        type="button"
        onClick={toggleSidebar}
        aria-label={sidebarToggleLabel}
        aria-expanded={isMobileViewport ? isMobileSidebarOpen : !isSidebarCollapsed}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute hidden h-10 w-10 rounded-lg bg-transparent transition-colors group-hover:bg-white/10 lg:block"
        />
        <span className="relative h-4 w-5 lg:hidden" aria-hidden="true">
          <span
            className={`absolute left-0 h-0.5 w-5 rounded-full bg-current transition-all duration-200 ${
              isMobileSidebarOpen ? "top-1.75 rotate-45" : "top-0.5"
            }`}
          />
          <span
            className={`absolute left-0 top-1.75 h-0.5 w-5 rounded-full bg-current transition-all duration-200 ${
              isMobileSidebarOpen ? "scale-x-0 opacity-0" : "scale-x-100 opacity-100"
            }`}
          />
          <span
            className={`absolute left-0 h-0.5 w-5 rounded-full bg-current transition-all duration-200 ${
              isMobileSidebarOpen ? "top-1.75 -rotate-45" : "top-3"
            }`}
          />
        </span>
        <span
          aria-hidden="true"
          className={`absolute hidden h-8 w-8 bg-contain bg-center bg-no-repeat transition-[opacity,transform] duration-90 ease-in-out group-hover:opacity-0 lg:block lg:brightness-0 lg:invert ${
            isSidebarCollapsed ? "scale-100 opacity-100" : "scale-95 opacity-0"
          }`}
          style={{
            backgroundImage: "url('/logo.png?v=20260722')",
            backgroundPosition: "38% center",
            backgroundSize: "190% 190%"
          }}
        />
        <Image
          src="/sidebar-right.png"
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
          src="/sidebar-left.png"
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
  rightSlot,
  showSearch = true
}: DashboardTopbarProps) {
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
        <div className="flex min-h-40 items-stretch lg:min-h-20">
          <div className="flex min-w-0 flex-1 flex-col gap-2 border-b border-[#d8dde5] pb-3 pl-20 pr-4 pt-5 sm:px-6 sm:pl-20 sm:pt-5 lg:flex-row lg:items-center lg:px-0 lg:py-0 lg:pl-6 lg:pr-8 xl:gap-6">
            <div className="order-3 min-w-0 shrink grow lg:order-0">
              <h1 className="truncate text-lg font-black tracking-tight text-[#17202a] sm:text-xl lg:text-2xl">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-1 hidden truncate text-sm font-medium text-[#6a7483] lg:block">
                  {subtitle}
                </p>
              ) : null}
            </div>

            <div className="flex w-full min-w-0 flex-col gap-2 lg:ml-auto lg:w-auto lg:shrink-0 lg:flex-row lg:items-center xl:gap-3">
              {showSearch ? (
                <form className="relative w-full lg:w-auto" onSubmit={submitSearch}>
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
                        window.setTimeout(() => setIsSearchOpen(false), 120)
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

              <div className="flex w-full min-w-0 gap-2 lg:w-auto lg:shrink-0">
                {actionsSlot ?? (
                  <>
                  <button
                    type="button"
                    onClick={onTodayNotes}
                    className="revision-gradient-stroke h-10 flex-1 whitespace-nowrap rounded-xl border border-[#b9c2cf] bg-white px-3 text-xs font-bold text-[#17202a] shadow-sm transition hover:bg-[#eef4fa] sm:text-sm lg:h-11 lg:flex-none lg:px-4 2xl:px-5"
                    data-needs-revision={todayNotesNeedRevision || undefined}
                  >
                    <span className="relative z-1">Today notes</span>
                  </button>

                  <button
                    type="button"
                    onClick={onNewBooking}
                    className="flex h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-[#1f4d73] px-3 text-xs font-bold text-white shadow-lg shadow-[#17202a]/15 transition hover:-translate-y-0.5 hover:bg-[#15344f] sm:text-sm lg:h-11 lg:flex-none lg:gap-2 lg:px-4 2xl:px-5"
                  >
                    <TopbarIcon name="plus" />
                    New booking
                  </button>
                  </>
                )}
              </div>

              {rightSlot}
            </div>
          </div>
        </div>
      </header>

      <div className="h-40 lg:h-20" aria-hidden="true" />
    </>
  );
}
