"use client";

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
import { DASHBOARD_PAGE_SEARCH_EVENT } from "@/features/dashboard/hooks/use-dashboard-page-search";
import { useDashboardAccess } from "@/features/dashboard/hooks/use-dashboard-permission";
import { DashboardTrialBadge } from "@/components/layout/dashboard-trial-pill";
import { isHiddenDashboardRoute } from "@/lib/ui/mvp-features";
export { DashboardTopbarBrand } from "@/components/layout/dashboard-topbar-brand";

type DashboardTopbarProps = {
  title: string;
  subtitle?: string;
  onTodayNotes?: () => void;
  todayNotesNeedRevision?: boolean;
  onNewBooking?: () => void;
  actionsSlot?: ReactNode;
  compactMobileActions?: boolean;
  showDefaultActions?: boolean;
  showNewBookingAction?: boolean;
  rightSlot?: ReactNode;
  showSearch?: boolean;
};

type SearchTarget = {
  label: string;
  description: string;
  route: string;
  keywords: string[];
};

const allSearchTargets: SearchTarget[] = [
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

// Dropped to the modules the MVP ships (see lib/ui/mvp-features): offering a
// jump to a page that redirects straight back out is a worse answer than no
// match at all.
const searchTargets: SearchTarget[] = allSearchTargets.filter(
  (target) => !isHiddenDashboardRoute(target.route)
);

const searchPlaceholders: Record<string, string> = {
  Kitchen: "Search kitchen events and items",
  Calendar: "Search bookings, clients and halls",
  "Event Manager": "Search clients, halls and event types",
  Menu: "Search menu items and packages",
  Clients: "Search clients and contact details",
  Vendors: "Search vendors and categories",
  Staff: "Search staff, roles and departments",
  Settings: "Search settings"
};

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

export function DashboardTopbar({
  title,
  subtitle,
  onTodayNotes,
  todayNotesNeedRevision = false,
  onNewBooking,
  actionsSlot,
  compactMobileActions = false,
  showDefaultActions = true,
  showNewBookingAction = true,
  rightSlot,
  showSearch = true
}: DashboardTopbarProps) {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchInputId = useId();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileSearchExpanded, setIsMobileSearchExpanded] = useState(false);
  const { canAccessRoute, hasPermission } = useDashboardAccess();
  const canCreateBooking = hasPermission("canCreateBooking");
  const visibleSearchTargets = useMemo(
    () => searchTargets.filter((target) => canAccessRoute(target.route)),
    [canAccessRoute]
  );

  const searchResults = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return visibleSearchTargets.slice(0, 6);
    }

    return visibleSearchTargets
      .filter((target) => {
        const haystack = [target.label, target.description, ...target.keywords]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .slice(0, 6);
  }, [searchQuery, visibleSearchTargets]);

  const goToSearchTarget = (target: SearchTarget) => {
    setSearchQuery("");
    setIsSearchOpen(false);
    setIsMobileSearchExpanded(false);
    router.push(target.route as Parameters<typeof router.push>[0], {
      scroll: false
    });
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    searchInputRef.current?.blur();
    setIsMobileSearchExpanded(false);
  };

  const updatePageSearch = (query: string) => {
    setSearchQuery(query);
    setIsSearchOpen(false);
    window.dispatchEvent(
      new CustomEvent(DASHBOARD_PAGE_SEARCH_EVENT, {
        detail: { scope: title, query }
      })
    );
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
    };

    window.addEventListener("keydown", focusSearchFromShortcut);

    return () => {
      window.removeEventListener("keydown", focusSearchFromShortcut);
    };
  }, []);

  return (
    <>
      <header className="dashboard-topbar-content fixed right-0 top-0 z-50 bg-[#ffffff]/95 backdrop-blur-xl">
        <div className="flex min-h-14 items-stretch xl:min-h-20">
          <div
            className={`relative flex min-w-0 flex-1 flex-col border-b border-[#d8dde5] pl-20 pr-4 lg:pl-4 xl:flex-row xl:items-center xl:gap-6 xl:px-0 xl:py-0 xl:pl-6 xl:pr-8 ${
              compactMobileActions ? "gap-0 pb-3 pt-3" : "gap-0 pb-3 pt-3"
            }`}
          >
            <div className="order-1 flex min-h-9 min-w-0 shrink items-center pr-26 xl:order-0 xl:block xl:h-auto xl:grow xl:pr-0">
              <div className="flex min-w-0 flex-col xl:flex-row xl:items-center xl:gap-3">
                <h1 className="truncate text-base font-black tracking-tight text-[#17202a] sm:text-lg xl:text-2xl">
                  {title}
                </h1>
                <span className="hidden xl:inline-flex">
                  <DashboardTrialBadge />
                </span>
                <span className="mt-1 inline-flex xl:hidden">
                  <DashboardTrialBadge />
                </span>
              </div>
              {subtitle ? (
                <p className="mt-1 hidden truncate text-sm font-medium text-[#6a7483] xl:block">
                  {subtitle}
                </p>
              ) : null}
            </div>

            <div className="order-2 flex w-full min-w-0 flex-col gap-2 xl:ml-auto xl:w-auto xl:shrink-0 xl:flex-row xl:items-center xl:gap-3">
              {showSearch ? (
                <form
                  className={`z-60 w-auto xl:relative xl:left-auto xl:right-auto xl:top-auto xl:z-auto xl:block ${
                    isMobileSearchExpanded
                      ? "absolute left-4 right-4 top-14 block"
                      : "hidden"
                  }`}
                  onSubmit={submitSearch}
                >
                  <label
                    className="flex h-10 w-full min-w-0 cursor-text items-center gap-2 rounded-xl border border-[#b9c2cf] bg-white px-3 text-sm text-[#6a7483] shadow-sm transition focus-within:border-[#1f4d73] focus-within:bg-[#fbfcfd] xl:h-11 xl:w-72 xl:gap-3 xl:px-4 2xl:w-96"
                    htmlFor={searchInputId}
                  >
                    <TopbarIcon name="search" />
                    <input
                      id={searchInputId}
                      ref={searchInputRef}
                      className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#17202a] outline-none placeholder:text-[#6a7483]"
                      placeholder={
                        searchPlaceholders[title] ??
                        `Search ${title.toLowerCase()}`
                      }
                      type="search"
                      value={searchQuery}
                      onBlur={() =>
                        window.setTimeout(() => {
                          setIsSearchOpen(false);
                          setIsMobileSearchExpanded(false);
                        }, 120)
                      }
                      onChange={(event) => updatePageSearch(event.target.value)}
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
                className={`flex min-w-0 gap-0.5 xl:static xl:w-auto xl:shrink-0 xl:gap-2 ${
                  actionsSlot && !compactMobileActions
                    ? "w-full"
                    : "absolute right-4 top-3 w-auto"
                }`}
              >
                {showSearch ? (
                  <button
                    aria-expanded={isMobileSearchExpanded}
                    aria-label="Search"
                    className="flex h-9 w-8 items-center justify-center bg-transparent text-[#17202a] transition hover:text-[#1f4d73] xl:hidden"
                    onClick={() => {
                      const nextExpanded = !isMobileSearchExpanded;
                      setIsMobileSearchExpanded(nextExpanded);
                      if (nextExpanded) {
                        window.setTimeout(
                          () => searchInputRef.current?.focus(),
                          0
                        );
                      }
                    }}
                    title="Search"
                    type="button"
                  >
                    <TopbarIcon className="h-6 w-6" name="search" />
                  </button>
                ) : null}

                {actionsSlot ??
                  (showDefaultActions ? (
                    <>
                      <button
                        aria-label="Open today notes"
                        type="button"
                        onClick={onTodayNotes}
                        title="Today notes"
                        className="dashboard-topbar-icon-action revision-gradient-stroke flex h-9 w-8 items-center justify-center whitespace-nowrap bg-transparent p-0 text-xs font-bold text-[#17202a] transition hover:text-[#1f4d73] sm:text-sm xl:h-11 xl:w-auto xl:flex-none xl:rounded-xl xl:border xl:border-[#b9c2cf] xl:bg-white xl:px-4 xl:shadow-sm xl:hover:bg-[#eef4fa] 2xl:px-5"
                        data-needs-revision={
                          todayNotesNeedRevision || undefined
                        }
                      >
                        <TopbarIcon
                          className="h-6 w-6 xl:h-4 xl:w-4"
                          name="notes"
                        />
                        <span className="relative z-1 hidden xl:inline">
                          Today notes
                        </span>
                      </button>

                      {showNewBookingAction ? (
                        <button
                          aria-label="Create new booking"
                          type="button"
                          disabled={!canCreateBooking}
                          onClick={onNewBooking}
                          title="New booking"
                          className="flex h-9 w-8 items-center justify-center whitespace-nowrap bg-transparent p-0 text-xs font-bold text-[#1f4d73] transition hover:text-[#15344f] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-[#1f4d73] sm:text-sm xl:h-11 xl:w-auto xl:flex-none xl:gap-2 xl:rounded-xl xl:bg-[#1f4d73] xl:px-4 xl:text-white xl:shadow-lg xl:shadow-[#17202a]/15 xl:hover:-translate-y-0.5 xl:hover:bg-[#15344f] xl:hover:text-white disabled:xl:hover:translate-y-0 disabled:xl:hover:bg-[#1f4d73] 2xl:px-5"
                        >
                          <TopbarIcon
                            className="h-6.5 w-6.5 xl:h-4 xl:w-4"
                            name="plus"
                          />
                          <span className="hidden xl:inline">New booking</span>
                        </button>
                      ) : null}
                    </>
                  ) : null)}
              </div>

              {rightSlot}
            </div>
          </div>
        </div>
      </header>

      <div className="h-21 xl:h-20" aria-hidden="true" />
    </>
  );
}
