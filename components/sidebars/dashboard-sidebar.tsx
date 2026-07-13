"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SyncedUser } from "@/lib/auth/client";
import { clearCachedSyncedUser } from "@/lib/auth/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type SidebarIconName =
  | "dashboard"
  | "kitchen"
  | "calendar"
  | "events"
  | "menu"
  | "portal"
  | "dining"
  | "map"
  | "files"
  | "billing"
  | "staff"
  | "vendor"
  | "settings";

type SidebarItem = {
  icon: SidebarIconName;
  label: string;
  count?: string;
  route?: string;
};

type DashboardSidebarProps = {
  user: SyncedUser;
  roleLabel: string;
  activeLabel?: string;
  onLogout?: () => void;
};

const sidebarSections: Array<{ title: string; items: SidebarItem[] }> = [
  {
    title: "Workspace",
    items: [
      { icon: "dashboard", label: "Dashboard", count: "12", route: "/dashboard" },
      { icon: "kitchen", label: "Kitchen", count: "34", route: "/dashboard/kitchen" },
      { icon: "calendar", label: "Calendar", count: "8", route: "/dashboard/calendar" },
      { icon: "events", label: "Events", count: "27", route: "/dashboard/events" },
      { icon: "menu", label: "Menu", count: "146", route: "/dashboard/menu" },
      { icon: "portal", label: "Client Portal", count: "5", route: "/dashboard/client-portal" },
    ],
  },
  {
    title: "Operations",
    items: [
      { icon: "dining", label: "Dining Manager", count: "9", route: "/dashboard/dining-manager" },
      { icon: "map", label: "Hall Room Map", count: "4", route: "/dashboard/hall-room-map" },
      { icon: "files", label: "Files", count: "12", route: "/dashboard/files" },
    ],
  },
  {
    title: "Office",
    items: [
      { icon: "billing", label: "Billing", count: "18", route: "/dashboard/billing" },
      { icon: "staff", label: "Staff", count: "42" },
      { icon: "vendor", label: "Vendors", count: "16" },
      { icon: "settings", label: "Settings", count: "18", route: "/dashboard/settings" },
    ],
  },
];

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

function SidebarIcon({ name, className = "h-4 w-4" }: { name: SidebarIconName; className?: string }) {
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

  const icons: Record<SidebarIconName, React.ReactNode> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
      </>
    ),
    kitchen: (
      <>
        <path d="M3 2h4" />
        <path d="M5 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V2" />
        <path d="M9 10v10" />
        <path d="M3 20h12" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </>
    ),
    events: (
      <>
        <path d="M8 2v4M16 2v4" />
        <rect x="3" y="5" width="18" height="15" rx="2" />
        <path d="M3 10h18M8 14h.01M12 14h.01M16 14h.01" />
      </>
    ),
    menu: (
      <>
        <path d="M4 6h16M4 12h16M4 18h16" />
      </>
    ),
    portal: (
      <>
        <path d="M3 7h18" />
        <path d="M5 7v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7" />
        <path d="M8 11h8" />
      </>
    ),
    dining: (
      <>
        <path d="M4 4h16" />
        <path d="M6 4v6a3 3 0 0 0 6 0V4" />
        <path d="M12 10v10M16 4v10" />
      </>
    ),
    map: (
      <>
        <path d="M3 6 9 3l6 3 6-3v15l-6 3-6-3-6 3Z" />
        <path d="M9 3v15M15 6v15" />
      </>
    ),

    files: (
      <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h8" />
      </>
    ),
    billing: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18M7 15h2" />
      </>
    ),
    staff: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    vendor: (
      <>
        <path d="M3 21V8l9-5 9 5v13" />
        <path d="M7 13h10M7 17h10" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.2a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z" />
      </>
    ),
  };

  return <svg {...common}>{icons[name]}</svg>;
}

export function DashboardSidebar({ user, roleLabel, activeLabel = "Dashboard", onLogout }: DashboardSidebarProps) {
  const router = useRouter();
  const initials = getInitials(user.name);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSidebarTransitionReady, setIsSidebarTransitionReady] = useState(false);

  useEffect(() => {
    const toggleMobileSidebar = () => setIsMobileOpen((current) => !current);
    window.addEventListener("dashboard-mobile-sidebar-toggle", toggleMobileSidebar);
    return () => window.removeEventListener("dashboard-mobile-sidebar-toggle", toggleMobileSidebar);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("sidebarCollapsed");
    if (saved === "true") {
      setIsCollapsed(true);
    }

    const frame = window.requestAnimationFrame(() => {
      setIsSidebarTransitionReady(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const handleSidebarToggle = (event: Event) => {
      const customEvent = event as CustomEvent<{ collapsed?: boolean }>;

      setIsCollapsed((current) =>
        typeof customEvent.detail?.collapsed === "boolean" ? customEvent.detail.collapsed : !current
      );
    };

    window.addEventListener("dashboard-sidebar-toggle", handleSidebarToggle);

    return () => {
      window.removeEventListener("dashboard-sidebar-toggle", handleSidebarToggle);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.dashboardSidebar = isCollapsed ? "collapsed" : "expanded";
    window.localStorage.setItem("sidebarCollapsed", String(isCollapsed));
    window.dispatchEvent(
      new CustomEvent("dashboard-sidebar-change", {
        detail: { collapsed: isCollapsed },
      })
    );
  }, [isCollapsed]);

  useEffect(() => {
    const routes = Array.from(
      new Set(sidebarSections.flatMap((section) => section.items.map((item) => item.route)).filter((route): route is string => Boolean(route)))
    );

    routes.forEach((route) => {
      router.prefetch(route as Parameters<typeof router.prefetch>[0]);
    });
  }, [router]);

  const logout = async () => {
    if (onLogout) {
      onLogout();
      return;
    }

    const supabase = createSupabaseBrowserClient();
    clearCachedSyncedUser();
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  };

  const showCollapsed = isCollapsed && !isMobileOpen;

  return (
    <>
      {isMobileOpen ? (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 top-20 z-40 bg-[#17202a]/45 backdrop-blur-[2px] lg:hidden"
          onClick={() => setIsMobileOpen(false)}
          type="button"
        />
      ) : null}
      <aside
      className={`app-sidebar fixed bottom-0 left-0 top-20 z-60 flex w-[min(86vw,20rem)] flex-col overflow-x-hidden border-r border-[#d8dde5] bg-[#ffffff] shadow-2xl transition-[transform,width] duration-200 ease-out lg:z-40 lg:shadow-none sidebar-will-change-width ${
        isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      } ${
        isSidebarTransitionReady ? "transition-[width] duration-150 ease-in-out" : "transition-none"
      } ${
        showCollapsed ? "lg:w-18" : "lg:w-64"
      }`}
    >
      <nav className={`flex-1 overflow-x-hidden overflow-y-auto ${showCollapsed ? "space-y-2 px-2 py-4" : "space-y-5 px-3 py-4"}`}>
        {sidebarSections.map((section) => (
          <section key={section.title}>
            {!showCollapsed ? (
              <h2 className="mb-3 px-2 text-xs font-black uppercase tracking-[0.12em] text-[#6a7483]">
                {section.title}
              </h2>
            ) : null}

            <div className={showCollapsed ? "space-y-2" : "space-y-1.5"}>
              {section.items.map((item) => {
                const isActive = item.label === activeLabel;

                return (
                  <button
                    key={`${section.title}-${item.label}`}
                    className={`group relative flex w-full items-center transition ${
                      showCollapsed
                        ? `h-11 justify-center rounded-xl ${
                            isActive ? "bg-[#eef4fa] text-[#17202a]" : "text-[#6a7483] hover:bg-[#eef4fa] hover:text-[#17202a]"
                          }`
                        : `gap-2.5 rounded-xl px-2.5 py-2 text-left ${
                            isActive ? "bg-[#eef4fa] text-[#17202a]" : "text-[#17202a] hover:bg-[#eef4fa]"
                          }`
                    }`}
                    type="button"
                    onClick={() => {
                      setIsMobileOpen(false);
                      if (item.route) router.push(item.route as Parameters<typeof router.push>[0]);
                    }}
                    aria-label={item.label}
                    title={isCollapsed ? item.label : undefined}
                  >
                    {showCollapsed && isActive ? (
                      <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-[#1f4d73]" />
                    ) : null}

                    <span
                      className={`flex shrink-0 items-center justify-center ${
                        showCollapsed
                          ? "h-9 w-9 rounded-xl"
                          : isActive
                            ? "text-[#1f4d73]"
                            : "text-[#6a7483]"
                      }`}
                    >
                      <SidebarIcon name={item.icon} className="h-4.5 w-4.5" />
                    </span>

                    {!showCollapsed ? (
                      <>
                        <span className={`min-w-0 flex-1 truncate text-sm ${isActive ? "font-black" : "font-semibold"}`}>
                          {item.label}
                        </span>
                        {item.count ? <span className="text-xs font-bold text-[#6a7483]">{item.count}</span> : null}
                      </>
                    ) : (
                      <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#1f4d73] px-3 py-2 text-xs font-bold text-white shadow-xl group-hover:block">
                        {item.label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      <div className="border-t border-[#d8dde5] p-3">
        <button
          className={`group relative flex w-full items-center rounded-xl text-left transition hover:bg-[#eef4fa] ${
            showCollapsed ? "justify-center p-1.5" : "gap-3 p-2"
          }`}
          type="button"
          onClick={logout}
          title={showCollapsed ? `${user.name} - ${roleLabel}` : "Sign out"}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eef4fa] text-sm font-black text-[#17202a]">
            {initials}
          </span>

          {!showCollapsed ? (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black text-[#17202a]">{user.name}</span>
                <span className="block truncate text-xs font-semibold text-[#6a7483]">{roleLabel}</span>
              </span>
              <span className="text-[#6a7483]">›</span>
            </>
          ) : (
            <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#1f4d73] px-3 py-2 text-xs font-bold text-white shadow-xl group-hover:block">
              {user.name} - {roleLabel}
            </span>
          )}
        </button>
      </div>
      </aside>
    </>
  );
}
