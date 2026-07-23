"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { EditProfileDialog } from "@/components/forms/edit-profile-dialog";
import { LogoutConfirmationDialog } from "@/components/forms/logout-confirmation-dialog";
import { UpgradePlanDialog } from "@/components/forms/upgrade-plan-dialog";
import { SettingsDialog } from "@/features/settings/components/settings-dialog";
import { clearCachedSyncedUser, type SyncedUser } from "@/lib/auth/client";
import { clearAuthenticatedQueryCache } from "@/features/dashboard/hooks/use-authenticated-query";
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
  iconSrc?: string;
  label: string;
  route?: string;
};

type SidebarSection = {
  title: string;
  icon: SidebarIconName;
  collapsedIconSrc?: string;
  items: SidebarItem[];
};

type DashboardSidebarProps = {
  user: SyncedUser;
  roleLabel: string;
  activeLabel?: string;
};

const sidebarSections: SidebarSection[] = [
  {
    title: "Workspace",
    icon: "dashboard",
    items: [
      {
        icon: "dashboard",
        label: "Dashboard",
        route: "/dashboard"
      },
      {
        icon: "kitchen",
        iconSrc: "/images/icons/sidebar/kitchen-cutlery.png",
        label: "Kitchen",
        route: "/dashboard/kitchen"
      },
      {
        icon: "calendar",
        label: "Calendar",
        route: "/dashboard/calendar"
      },
      {
        icon: "events",
        label: "Events",
        route: "/dashboard/events"
      },
      { icon: "menu", label: "Menu", route: "/dashboard/menu" },
    ]
  },
  {
    title: "Operations",
    icon: "dining",
    collapsedIconSrc: "/images/icons/sidebar/operations-cogwheel.png",
    items: [
      {
        icon: "dining",
        iconSrc: "/images/icons/sidebar/dining-manager-table.png",
        label: "Dining Manager",
        route: "/dashboard/dining-manager"
      },
      {
        icon: "map",
        label: "Hall Room Map",
        route: "/dashboard/hall-room-map"
      },
      { icon: "files", label: "Files", route: "/dashboard/files" }
    ]
  },
  {
    title: "Office",
    icon: "billing",
    collapsedIconSrc: "/images/icons/sidebar/office-location.png",
    items: [
      {
        icon: "billing",
        label: "Billing",
        route: "/dashboard/billing"
      },
      { icon: "staff", label: "Staff", route: "/dashboard/staff" }
    ]
  }
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

function SidebarIcon({
  name,
  className = "h-4 w-4",
  strokeWidth = 2
}: {
  name: SidebarIconName;
  className?: string;
  strokeWidth?: number;
}) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
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
    )
  };

  return <svg {...common}>{icons[name]}</svg>;
}

export function DashboardSidebar({
  user,
  roleLabel,
  activeLabel = "Dashboard"
}: DashboardSidebarProps) {
  const router = useRouter();
  const collapsedNavigationRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [profileName, setProfileName] = useState(user.name);
  const [profileUsername, setProfileUsername] = useState(
    user.email.split("@")[0] || user.name.toLowerCase().replace(/\s+/g, "")
  );
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isEditProfileDialogOpen, setIsEditProfileDialogOpen] = useState(false);
  const [isHelpMenuOpen, setIsHelpMenuOpen] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [isUpgradePlanDialogOpen, setIsUpgradePlanDialogOpen] = useState(false);
  const [expandedSidebarSections, setExpandedSidebarSections] = useState(() =>
    sidebarSections.map((section) => section.title)
  );
  const [openCollapsedSection, setOpenCollapsedSection] = useState<
    string | null
  >(null);
  const [isSidebarTransitionReady, setIsSidebarTransitionReady] =
    useState(false);
  const initials = getInitials(profileName);

  useEffect(() => {
    const toggleMobileSidebar = (event: Event) => {
      const customEvent = event as CustomEvent<{ open?: boolean }>;
      setIsMobileOpen((current) =>
        typeof customEvent.detail?.open === "boolean"
          ? customEvent.detail.open
          : !current
      );
    };
    window.addEventListener(
      "dashboard-mobile-sidebar-toggle",
      toggleMobileSidebar
    );
    return () =>
      window.removeEventListener(
        "dashboard-mobile-sidebar-toggle",
        toggleMobileSidebar
      );
  }, []);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("dashboard-mobile-sidebar-change", {
        detail: { open: isMobileOpen }
      })
    );
  }, [isMobileOpen]);

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
        typeof customEvent.detail?.collapsed === "boolean"
          ? customEvent.detail.collapsed
          : !current
      );
    };

    window.addEventListener("dashboard-sidebar-toggle", handleSidebarToggle);

    return () => {
      window.removeEventListener(
        "dashboard-sidebar-toggle",
        handleSidebarToggle
      );
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.dashboardSidebar = isCollapsed
      ? "collapsed"
      : "expanded";
    window.localStorage.setItem("sidebarCollapsed", String(isCollapsed));
    window.dispatchEvent(
      new CustomEvent("dashboard-sidebar-change", {
        detail: { collapsed: isCollapsed }
      })
    );
  }, [isCollapsed]);

  useEffect(() => {
    const routes = Array.from(
      new Set(
        sidebarSections
          .flatMap((section) => section.items.map((item) => item.route))
          .filter((route): route is string => Boolean(route))
      )
    );

    routes.forEach((route) => {
      router.prefetch(route as Parameters<typeof router.prefetch>[0]);
    });
  }, [router]);

  useEffect(() => {
    if (!openCollapsedSection) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !collapsedNavigationRef.current?.contains(event.target)
      ) {
        setOpenCollapsedSection(null);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenCollapsedSection(null);
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [openCollapsedSection]);

  useEffect(() => {
    if (!isCollapsed || isMobileOpen) setOpenCollapsedSection(null);
  }, [isCollapsed, isMobileOpen]);

  useEffect(() => {
    if (!isProfileMenuOpen) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !profileMenuRef.current?.contains(event.target)
      ) {
        setIsProfileMenuOpen(false);
        setIsHelpMenuOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      if (isHelpMenuOpen) {
        setIsHelpMenuOpen(false);
        return;
      }

      setIsProfileMenuOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isHelpMenuOpen, isProfileMenuOpen]);

  useEffect(() => {
    if (isCollapsed) {
      setIsProfileMenuOpen(false);
      setIsHelpMenuOpen(false);
    }
  }, [isCollapsed]);

  const openProfileDestination = (route: string) => {
    setIsProfileMenuOpen(false);
    setIsMobileOpen(false);
    router.push(route as Parameters<typeof router.push>[0]);
  };

  const logout = async () => {
    setIsHelpMenuOpen(false);
    setIsProfileMenuOpen(false);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    clearAuthenticatedQueryCache();
    clearCachedSyncedUser();
    setIsLogoutDialogOpen(false);
    router.replace("/");
    router.refresh();
  };

  const showCollapsed = isCollapsed && !isMobileOpen;

  return (
    <>
      {isMobileOpen ? (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-55 bg-[#17202a]/45 backdrop-blur-[2px] transition-opacity duration-300 ease-out lg:hidden"
          onClick={() => setIsMobileOpen(false)}
          type="button"
        />
      ) : null}
      <aside
        className={`app-sidebar fixed bottom-0 left-0 top-0 z-70 flex w-[min(76vw,17rem)] flex-col border-r border-white/10 bg-[#061126] shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform lg:top-20 lg:z-40 lg:shadow-none lg:transition-[width] lg:duration-150 lg:ease-in-out sidebar-will-change-width ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${
          isSidebarTransitionReady
            ? ""
            : "transition-none"
        } ${
          showCollapsed
            ? "overflow-visible lg:w-18"
            : "overflow-visible lg:w-64"
        }`}
      >
        <div className="flex h-20 shrink-0 items-center justify-between border-b border-white/10 px-4 lg:hidden">
          <Image
            src="/images/branding/Footer-logo.png?v=20260722"
            alt="Hall Management SaaS"
            width={612}
            height={408}
            priority
            unoptimized
            className="h-14 w-auto object-contain"
          />

          <button
            aria-label="Close navigation"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-white transition hover:bg-white/10"
            onClick={() => setIsMobileOpen(false)}
            type="button"
          >
            <span className="relative h-5 w-5" aria-hidden="true">
              <span className="absolute left-0 top-2 h-0.5 w-5 rotate-45 rounded-full bg-current" />
              <span className="absolute left-0 top-2 h-0.5 w-5 -rotate-45 rounded-full bg-current" />
            </span>
          </button>
        </div>

        <nav
          className={`flex-1 ${
            showCollapsed
              ? "overflow-visible px-2 py-4"
              : "space-y-5 overflow-x-hidden overflow-y-auto px-3 py-4"
          }`}
        >
          {showCollapsed ? (
            <div className="space-y-3" ref={collapsedNavigationRef}>
              {sidebarSections.map((section) => {
                const isActiveSection = section.items.some(
                  (item) => item.label === activeLabel
                );
                const isOpen = openCollapsedSection === section.title;

                return (
                  <div className="relative" key={section.title}>
                    <button
                      aria-label={`${section.title} navigation`}
                      aria-expanded={isOpen}
                      aria-haspopup="menu"
                      className={`group relative flex h-11 w-full items-center justify-center rounded-xl transition ${
                        isActiveSection
                          ? "bg-white/15 text-white"
                          : "text-white/70 hover:bg-white/10 hover:text-white"
                      }`}
                      onClick={() =>
                        setOpenCollapsedSection((current) =>
                          current === section.title ? null : section.title
                        )
                      }
                      type="button"
                    >
                      {isActiveSection ? (
                        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-white" />
                      ) : null}

                      {section.collapsedIconSrc ? (
                        <Image
                          alt=""
                          aria-hidden="true"
                          className="h-6 w-6 object-contain brightness-0 invert drop-shadow-[0_0_0.7px_white]"
                          height={24}
                          src={section.collapsedIconSrc}
                          width={24}
                        />
                      ) : (
                        <SidebarIcon
                          className="h-6 w-6"
                          name={section.icon}
                          strokeWidth={2.6}
                        />
                      )}

                      {!isOpen ? (
                        <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#1f4d73] px-3 py-2 text-xs font-bold text-white shadow-xl group-hover:block">
                          {section.title}
                        </span>
                      ) : null}
                    </button>

                    {isOpen ? (
                      <div
                        aria-label={`${section.title} links`}
                        className="absolute left-[calc(100%+0.5rem)] top-0 z-80 w-60 overflow-hidden rounded-2xl border border-[#15344f] bg-[#1f4d73] p-2 text-white shadow-xl shadow-[#17202a]/20"
                        role="menu"
                      >
                        <h2 className="mb-2 border-b border-white/20 px-3 pb-2 pt-1 text-sm font-medium">
                          {section.title}
                        </h2>

                        <div className="space-y-1">
                          {section.items.map((item) => {
                            const isActive = item.label === activeLabel;

                            return (
                              <button
                                className={`relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-normal transition ${
                                  isActive
                                    ? "bg-white/15 text-white"
                                    : "text-white/90 hover:bg-white/10 hover:text-white"
                                }`}
                                key={item.label}
                                onClick={() => {
                                  setOpenCollapsedSection(null);
                                  if (item.route) {
                                    router.push(
                                      item.route as Parameters<
                                        typeof router.push
                                      >[0]
                                    );
                                  }
                                }}
                                role="menuitem"
                                type="button"
                              >
                                {isActive ? (
                                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-[#eef4fa]" />
                                ) : null}
                                {item.iconSrc ? (
                                  <Image
                                    alt=""
                                    aria-hidden="true"
                                    className="h-4 w-4 shrink-0 object-contain brightness-0 invert"
                                    height={16}
                                    src={item.iconSrc}
                                    width={16}
                                  />
                                ) : (
                                  <SidebarIcon
                                    className="h-4 w-4 shrink-0"
                                    name={item.icon}
                                  />
                                )}
                                <span>{item.label}</span>
                              </button>
                            );
                          })}
                        </div>

                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            sidebarSections.map((section) => (
              <section key={section.title}>
                {!showCollapsed ? (
                  <button
                    aria-expanded={expandedSidebarSections.includes(
                      section.title
                    )}
                    className="mb-1 flex w-full items-center justify-between rounded-lg px-2 py-0.5 text-left text-[11px] font-medium tracking-[0.04em] text-white/55 transition hover:bg-white/10 hover:text-white"
                    onClick={() =>
                      setExpandedSidebarSections((current) =>
                        current.includes(section.title)
                          ? current.filter((title) => title !== section.title)
                          : [...current, section.title]
                      )
                    }
                    type="button"
                  >
                    <span>{section.title}</span>
                    <span
                      aria-hidden="true"
                      className={`text-sm leading-none transition-transform ${
                        expandedSidebarSections.includes(section.title)
                          ? "rotate-90"
                          : "rotate-0"
                      }`}
                    >
                      ›
                    </span>
                  </button>
                ) : null}

                {expandedSidebarSections.includes(section.title) ? (
                  <div className={showCollapsed ? "space-y-2" : "space-y-1.5"}>
                    {section.items.map((item) => {
                      const isActive = item.label === activeLabel;

                      return (
                        <button
                          key={`${section.title}-${item.label}`}
                          className={`group relative flex w-full items-center transition ${
                            showCollapsed
                              ? `h-11 justify-center rounded-xl ${
                                  isActive
                                    ? "bg-white/15 text-white"
                                    : "text-white/70 hover:bg-white/10 hover:text-white"
                                }`
                              : `gap-2.5 rounded-xl px-2.5 py-2 text-left ${
                                  isActive
                                    ? "bg-white/15 text-white"
                                    : "text-white/80 hover:bg-white/10 hover:text-white"
                                }`
                          }`}
                          type="button"
                          onClick={() => {
                            setIsMobileOpen(false);
                            if (item.route)
                              router.push(
                                item.route as Parameters<typeof router.push>[0]
                              );
                          }}
                          aria-label={item.label}
                          title={isCollapsed ? item.label : undefined}
                        >
                          {isActive ? (
                            <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-white" />
                          ) : null}

                          <span
                            className={`flex shrink-0 items-center justify-center ${
                              showCollapsed
                                ? "h-9 w-9 rounded-xl"
                                : isActive
                                  ? "text-white"
                                  : "text-white/65"
                            }`}
                          >
                            {item.iconSrc ? (
                              <Image
                                alt=""
                                aria-hidden="true"
                                className="h-4.5 w-4.5 object-contain brightness-0 invert opacity-80"
                                height={18}
                                src={item.iconSrc}
                                width={18}
                              />
                            ) : (
                              <SidebarIcon
                                className="h-4.5 w-4.5"
                                name={item.icon}
                              />
                            )}
                          </span>

                          {!showCollapsed ? (
                            <>
                              <span className="min-w-0 flex-1 truncate text-sm font-normal">
                                {item.label}
                              </span>
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
                ) : null}
              </section>
            ))
          )}
        </nav>

        {!showCollapsed || isProfileMenuOpen ? (
          <div
            className={`relative border-t border-white/10 ${
              showCollapsed ? "p-2" : "p-3"
            }`}
            ref={profileMenuRef}
          >
            {isProfileMenuOpen ? (
              <div
                aria-label="Profile menu"
                className={`absolute z-80 rounded-2xl border border-[#15344f] bg-[#1f4d73] p-2 text-white shadow-xl shadow-[#17202a]/20 ${
                  showCollapsed
                    ? "bottom-2 left-[calc(100%+0.5rem)] w-48"
                    : "bottom-[calc(100%+0.5rem)] left-3 right-3 max-lg:right-auto max-lg:w-52"
                }`}
                role="menu"
              >
                {[
                  {
                    label: "Upgrade Plan",
                    iconSrc: "/images/icons/profile-menu/upgrade-plan.png",
                    route: null
                  },
                  {
                    label: "Profile",
                    iconSrc: "/images/icons/profile-menu/profile.png",
                    route: null
                  },
                  {
                    label: "Settings",
                    iconSrc: "/images/icons/profile-menu/settings.png",
                    route: null
                  },
                  {
                    label: "Help",
                    iconSrc: "/images/icons/profile-menu/help.png",
                    route: null
                  },
                  {
                    label: "Logout",
                    iconSrc: "/images/icons/profile-menu/logout.png",
                    route: null
                  }
                ].map((item) => (
                  <button
                    aria-expanded={
                      item.label === "Help" ? isHelpMenuOpen : undefined
                    }
                    aria-haspopup={item.label === "Help" ? "menu" : undefined}
                    className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-white/90 transition hover:bg-white/10 hover:text-white ${
                      item.label === "Settings"
                        ? "mb-1 after:absolute after:-bottom-0.5 after:left-3 after:right-3 after:h-px after:bg-white/25 after:content-['']"
                        : ""
                    }`}
                    key={item.label}
                    onClick={() => {
                      if (item.label === "Upgrade Plan") {
                        setIsProfileMenuOpen(false);
                        setIsMobileOpen(false);
                        setIsUpgradePlanDialogOpen(true);
                        return;
                      }

                      if (item.label === "Settings") {
                        setIsProfileMenuOpen(false);
                        setIsMobileOpen(false);
                        setIsSettingsDialogOpen(true);
                        return;
                      }

                      if (item.label === "Profile") {
                        setIsProfileMenuOpen(false);
                        setIsMobileOpen(false);
                        setIsEditProfileDialogOpen(true);
                        return;
                      }

                      if (item.label === "Help") {
                        setIsHelpMenuOpen((current) => !current);
                        return;
                      }

                      if (item.label === "Logout") {
                        setIsHelpMenuOpen(false);
                        setIsProfileMenuOpen(false);
                        setIsLogoutDialogOpen(true);
                        return;
                      }

                      if (item.route) openProfileDestination(item.route);
                    }}
                    role="menuitem"
                    type="button"
                  >
                    <Image
                      alt=""
                      aria-hidden="true"
                      className="h-4.5 w-4.5 shrink-0 object-contain invert opacity-90"
                      height={18}
                      src={item.iconSrc}
                      width={18}
                    />
                    {item.label}
                    {item.label === "Help" ? (
                      <span
                        aria-hidden="true"
                        className={`ml-auto text-lg leading-none transition-transform ${
                          isHelpMenuOpen ? "rotate-90" : "rotate-0"
                        }`}
                      >
                        ›
                      </span>
                    ) : null}
                  </button>
                ))}

                {isHelpMenuOpen ? (
                  <div
                    aria-label="Help links"
                    className={`absolute z-90 w-44 whitespace-nowrap rounded-2xl border border-[#15344f] bg-[#1f4d73] p-1.5 text-white shadow-[0_12px_32px_rgba(23,32,42,0.3)] max-lg:bottom-13 max-lg:left-32 ${
                      showCollapsed
                        ? "bottom-13 left-full"
                        : "bottom-13 left-full"
                    }`}
                    role="menu"
                  >
                    {[
                      "Help Center",
                      "Release Notes",
                      "Download Apps",
                      "Terms of Service",
                      "Privacy Policy"
                    ].map((label) => (
                      <button
                        className={`relative block w-full whitespace-nowrap rounded-xl px-3 py-2 text-left text-[13px] font-semibold text-white/90 transition hover:bg-white/10 hover:text-white ${
                          label === "Download Apps"
                            ? "mb-1 after:absolute after:-bottom-0.5 after:left-3 after:right-3 after:h-px after:bg-white/25 after:content-['']"
                            : ""
                        }`}
                        key={label}
                        onClick={() => {
                          setIsHelpMenuOpen(false);
                          setIsProfileMenuOpen(false);
                        }}
                        role="menuitem"
                        type="button"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <button
              className={`group relative flex w-full items-center rounded-xl text-left transition hover:bg-white/10 ${
                showCollapsed ? "justify-center p-1.5" : "gap-3 p-2"
              }`}
              type="button"
              aria-expanded={isProfileMenuOpen}
              aria-haspopup="menu"
              onClick={() => {
                setIsHelpMenuOpen(false);
                setIsProfileMenuOpen((current) => !current);
              }}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-[#061126]">
                {initials}
              </span>

              {!showCollapsed ? (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-white">
                      {profileName}
                    </span>
                    <span className="block truncate text-xs font-semibold text-white/60">
                      {roleLabel}
                    </span>
                  </span>
                  <span className="text-white/55">›</span>
                </>
              ) : !isProfileMenuOpen ? (
                <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#1f4d73] px-3 py-2 text-xs font-bold text-white shadow-xl group-hover:block">
                  {profileName}
                </span>
              ) : null}
            </button>
          </div>
        ) : (
          <div className="border-t border-white/10 p-2">
            <button
              aria-label={`Open ${profileName} profile menu`}
              aria-expanded={isProfileMenuOpen}
              aria-haspopup="menu"
              className="group relative flex h-12 w-full items-center justify-center rounded-xl transition hover:bg-white/10"
              onClick={() => {
                setIsHelpMenuOpen(false);
                setIsProfileMenuOpen((current) => !current);
              }}
              type="button"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-xs font-medium text-[#061126]">
                {initials}
              </span>
              <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#1f4d73] px-3 py-2 text-xs font-normal text-white shadow-xl group-hover:block">
                {profileName}
              </span>
            </button>
          </div>
        )}
      </aside>

      <EditProfileDialog
        initialValues={{
          displayName: profileName,
          username: profileUsername
        }}
        initials={initials}
        onClose={() => setIsEditProfileDialogOpen(false)}
        onSave={(values) => {
          setProfileName(values.displayName);
          setProfileUsername(values.username);
          setIsEditProfileDialogOpen(false);
        }}
        open={isEditProfileDialogOpen}
      />
      <LogoutConfirmationDialog
        onClose={() => setIsLogoutDialogOpen(false)}
        onConfirm={logout}
        open={isLogoutDialogOpen}
      />
      <SettingsDialog
        onClose={() => setIsSettingsDialogOpen(false)}
        open={isSettingsDialogOpen}
      />
      <UpgradePlanDialog
        onClose={() => setIsUpgradePlanDialogOpen(false)}
        open={isUpgradePlanDialogOpen}
      />
    </>
  );
}
