"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { EditProfileDialog } from "@/components/forms/edit-profile-dialog";
import { LogoutConfirmationDialog } from "@/components/forms/logout-confirmation-dialog";
import { UpgradePlanDialog } from "@/components/forms/upgrade-plan-dialog";
import { SettingsDialog } from "@/features/settings/components/settings-dialog";
import { HelpDialog } from "@/features/help/components/help-dialog";
import type { HelpPageKind } from "@/features/help/components/help-page";
import { clearCachedSyncedUser, type SyncedUser } from "@/lib/auth/client";
import { clearAuthenticatedQueryCache } from "@/features/dashboard/hooks/use-authenticated-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { DashboardSidebarMobileHeader } from "@/components/layout/dashboard-sidebar-mobile-header";

import {
  SidebarIcon,
  getInitials,
  sidebarSections
} from "@/components/layout/dashboard-sidebar-shared";

type DashboardSidebarProps = {
  user: SyncedUser;
  roleLabel: string;
  profileSubtitle?: string;
  activeLabel?: string;
};

export function DashboardSidebar({
  user,
  roleLabel,
  profileSubtitle,
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
  const [helpDialogKind, setHelpDialogKind] = useState<HelpPageKind | null>(
    null
  );
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
  const isUpgradePrompt = profileSubtitle === "Upgrade Now";

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
    if (!isMobileOpen) return;

    const scrollY = window.scrollY;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousHtmlOverscrollBehavior =
      document.documentElement.style.overscrollBehavior;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyPosition = document.body.style.position;
    const previousBodyTop = document.body.style.top;
    const previousBodyWidth = document.body.style.width;

    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.documentElement.style.overscrollBehavior =
        previousHtmlOverscrollBehavior;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.position = previousBodyPosition;
      document.body.style.top = previousBodyTop;
      document.body.style.width = previousBodyWidth;
      window.scrollTo(0, scrollY);
    };
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
    router.push(route as Parameters<typeof router.push>[0], { scroll: false });
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
    const isDesktopApp =
      window.localStorage.getItem("eventCoreDesktopApp") === "true";
    router.replace(isDesktopApp ? "/login?desktop=1" : "/");
    router.refresh();
  };

  const showCollapsed = isCollapsed && !isMobileOpen;

  return (
    <>
      <button
        aria-label="Close navigation"
        className={`fixed inset-x-0 top-0 z-55 h-dvh touch-pan-y bg-[#17202a]/45 backdrop-blur-[2px] transition-[opacity,backdrop-filter] duration-300 ease-out lg:hidden ${
          isMobileOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0 backdrop-blur-none"
        }`}
        onClick={() => setIsMobileOpen(false)}
        tabIndex={isMobileOpen ? 0 : -1}
        type="button"
      />
      <aside
        className={`app-sidebar fixed left-0 top-0 z-70 flex h-dvh max-h-dvh w-[min(76vw,17rem)] touch-pan-y flex-col overscroll-none border-r border-white/10 bg-[#061126] shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform lg:bottom-0 lg:top-20 lg:h-auto lg:max-h-none lg:z-40 lg:shadow-none lg:transition-[width] lg:duration-150 lg:ease-in-out sidebar-will-change-width ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${isSidebarTransitionReady ? "" : "transition-none"} ${
          showCollapsed
            ? "overflow-visible lg:w-18"
            : "overflow-visible lg:w-64"
        }`}
      >
        <DashboardSidebarMobileHeader onClose={() => setIsMobileOpen(false)} />

        <nav
          className={`flex-1 ${
            showCollapsed
              ? "overflow-visible px-2 py-4"
              : "space-y-5 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-4"
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
                                      >[0],
                                      { scroll: false }
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
                                item.route as Parameters<typeof router.push>[0],
                                { scroll: false }
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
                className={`absolute z-80 rounded-2xl border border-white/15 bg-[#061126] p-2 text-white shadow-[0_16px_40px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.08)] ${
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
                    className={`absolute z-90 w-44 whitespace-nowrap rounded-2xl border border-white/15 bg-[#061126] p-1.5 text-white shadow-[0_16px_40px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.08)] max-lg:bottom-13 max-lg:left-32 ${
                      showCollapsed
                        ? "bottom-13 left-full"
                        : "bottom-13 left-full"
                    }`}
                    role="menu"
                  >
                    {(
                      [
                        { label: "Help Center", kind: "help-center" },
                        {
                          label: "Release Notes",
                          kind: "release-notes"
                        },
                        {
                          label: "Download Apps",
                          kind: "download-apps"
                        },
                        {
                          label: "Terms of Service",
                          kind: "terms-of-service"
                        },
                        {
                          label: "Privacy Policy",
                          kind: "privacy-policy"
                        }
                      ] satisfies Array<{ label: string; kind: HelpPageKind }>
                    ).map((item) => (
                      <button
                        className={`relative block w-full whitespace-nowrap rounded-xl px-3 py-2 text-left text-[13px] font-semibold text-white/90 transition hover:bg-white/10 hover:text-white ${
                          item.label === "Download Apps"
                            ? "mb-1 after:absolute after:-bottom-0.5 after:left-3 after:right-3 after:h-px after:bg-white/25 after:content-['']"
                            : ""
                        }`}
                        key={item.label}
                        onClick={() => {
                          setIsHelpMenuOpen(false);
                          setIsProfileMenuOpen(false);
                          setIsMobileOpen(false);
                          setHelpDialogKind(item.kind as HelpPageKind);
                        }}
                        role="menuitem"
                        type="button"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="relative">
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
                    <span
                      className={`block truncate text-xs font-semibold ${
                        isUpgradePrompt ? "text-[#F1B84B]" : "text-white/60"
                      }`}
                    >
                      {profileSubtitle ?? roleLabel}
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
      <HelpDialog
        kind={helpDialogKind ?? "help-center"}
        onClose={() => setHelpDialogKind(null)}
        open={Boolean(helpDialogKind)}
      />
      <UpgradePlanDialog
        onClose={() => setIsUpgradePlanDialogOpen(false)}
        open={isUpgradePlanDialogOpen}
      />
    </>
  );
}
