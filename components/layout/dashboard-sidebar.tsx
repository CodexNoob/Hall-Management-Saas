"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { HelpPageKind } from "@/features/help/components/help-page";
import { signOutCurrentSession, type SessionUser } from "@/lib/auth/client";
import { clearAuthenticatedQueryCache } from "@/features/dashboard/hooks/use-authenticated-query";
import { useDashboardAccess } from "@/features/dashboard/hooks/use-dashboard-permission";
import { DashboardSidebarMobileHeader } from "@/components/layout/dashboard-sidebar-mobile-header";
import { useAppLanguage } from "@/components/providers/app-language-provider";
import type { MessageKey } from "@/lib/i18n/messages";

import {
  SidebarIcon,
  getInitials,
  sidebarSections
} from "@/components/layout/dashboard-sidebar-shared";

const AccountDialog = dynamic(() =>
  import("@/features/account/components/account-dialog").then(
    (module) => module.AccountDialog
  )
);
const LogoutConfirmationDialog = dynamic(() =>
  import("@/components/forms/logout-confirmation-dialog").then(
    (module) => module.LogoutConfirmationDialog
  )
);
const UpgradePlanDialog = dynamic(() =>
  import("@/components/forms/upgrade-plan-dialog").then(
    (module) => module.UpgradePlanDialog
  )
);
const HelpDialog = dynamic(() =>
  import("@/features/help/components/help-dialog").then(
    (module) => module.HelpDialog
  )
);

type DashboardSidebarProps = {
  user: SessionUser;
  roleLabel: string;
  profileSubtitle?: string;
  activeLabel?: string;
  forceOverlay?: boolean;
};

const sidebarTranslationKeys: Record<string, MessageKey> = {
  Workspace: "nav.workspace",
  Operations: "nav.operations",
  Office: "nav.office",
  Dashboard: "nav.dashboard",
  Kitchen: "nav.kitchen",
  Calendar: "nav.calendar",
  Events: "nav.events",
  Menu: "nav.menu",
  "Dining Manager": "nav.dining",
  "Hall Room Map": "nav.hallMap",
  Files: "nav.files",
  Billing: "nav.billing",
  Staff: "nav.staff",
  Settings: "nav.settings",
  "Upgrade Plan": "profile.upgrade",
  "My Account": "profile.myAccount",
  Help: "profile.help",
  Logout: "profile.logout"
};

export function DashboardSidebar({
  user,
  roleLabel,
  profileSubtitle,
  forceOverlay = false,
  // Only a fallback - app/dashboard/layout.tsx always passes one. "Events"
  // rather than "Dashboard" because the overview is hidden for the MVP, and a
  // default naming no section would highlight nothing.
  activeLabel = "Events"
}: DashboardSidebarProps) {
  const { t } = useAppLanguage();
  const translated = (value: string) => {
    const key = sidebarTranslationKeys[value];
    return key ? t(key) : value;
  };
  const router = useRouter();
  const profileMenuRef = useRef<HTMLDivElement>(null);
  // Straight from the session, which My Account refreshes after a save - so a
  // renamed person sees the new name here without reloading.
  const profileName = user.name;
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [isHelpMenuOpen, setIsHelpMenuOpen] = useState(false);
  const [helpDialogKind, setHelpDialogKind] = useState<HelpPageKind | null>(
    null
  );
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isUpgradePlanDialogOpen, setIsUpgradePlanDialogOpen] = useState(false);
  const { canAccessRoute } = useDashboardAccess();
  const visibleSidebarSections = useMemo(
    () =>
      sidebarSections
        .map((section) => ({
          ...section,
          items: section.items.filter(
            (item) => !item.route || canAccessRoute(item.route)
          )
        }))
        .filter((section) => section.items.length > 0),
    [canAccessRoute]
  );
  const profileMenuItems = useMemo(
    () => [
      {
        label: "Upgrade Plan",
        iconSrc: "/images/icons/profile-menu/upgrade-plan.png",
        route: null
      },
      {
        // The person's own account, where every SaaS keeps it: under their
        // name. A dialog rather than a page, so it never takes anybody away
        // from what they were doing. Not permission-gated - it reaches only
        // their own rows.
        label: "My Account",
        iconSrc: "/images/icons/profile-menu/profile.png",
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
    ],
    []
  );
  const [expandedSidebarSections, setExpandedSidebarSections] = useState(() =>
    visibleSidebarSections.map((section) => section.title)
  );
  /**
   * Sections this component has offered before, so a NEW one arrives open.
   *
   * The initialiser above runs once. That was invisible while everybody signed
   * in already holding their permissions - but an invited user signs in before
   * anybody has given them a role, mounts this with no sections at all, and is
   * then granted one. Without this, the section header appeared and its items
   * did not: the title was never in `expandedSidebarSections`, so it rendered
   * collapsed, and the only way to see the pages somebody had just been given
   * was to click a heading nobody would think to click.
   *
   * A set of titles rather than a length comparison, so a section the user
   * COLLAPSED ON PURPOSE is not re-opened every time the session refreshes.
   * Seen once, left alone thereafter.
   */
  const knownSidebarSections = useRef<Set<string> | null>(null);

  if (knownSidebarSections.current === null) {
    knownSidebarSections.current = new Set(
      visibleSidebarSections.map((section) => section.title)
    );
  }

  useEffect(() => {
    const known = knownSidebarSections.current;

    if (!known) return;

    const unseen = visibleSidebarSections
      .map((section) => section.title)
      .filter((title) => !known.has(title));

    if (unseen.length === 0) return;

    for (const title of unseen) known.add(title);
    setExpandedSidebarSections((current) => [...current, ...unseen]);
  }, [visibleSidebarSections]);
  const [isSidebarTransitionReady, setIsSidebarTransitionReady] =
    useState(false);
  const initials = getInitials(profileName);
  const isUpgradePrompt = profileSubtitle === t("shell.upgradeNow");

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

  useLayoutEffect(() => {
    // Opening Kitchen's full-width drawer is an explicit request for expanded
    // navigation. Forget a collapse inherited from Event Manager so the next
    // destination does not immediately shrink the sidebar again.
    if (forceOverlay) {
      if (isMobileOpen && isCollapsed) setIsCollapsed(false);
      return;
    }

    // On desktop the Kitchen drawer stays open while routing so the normal
    // sidebar can take over without sliding in a second time. Once that route
    // has rendered, clear the drawer-only state before paint. Otherwise a later
    // collapse narrows the rail while `showCollapsed` still renders the wide
    // navigation, leaving section labels clipped inside a 72px sidebar.
    if (
      !isMobileOpen ||
      typeof window.matchMedia !== "function" ||
      !window.matchMedia("(min-width: 1024px)").matches
    ) {
      return;
    }

    setIsMobileOpen(false);
  }, [forceOverlay, isCollapsed, isMobileOpen]);

  useEffect(() => {
    // The kitchen board is `h-dvh` with its own inner scrollers, so there is no
    // page scroll to lock there - and pinning `body` to `position: fixed` (plus
    // the `scrollTo` on the way out) forces a layout pass in the same frame the
    // drawer starts moving, which is felt as a stutter at the start of the
    // slide.
    if (!isMobileOpen || forceOverlay) return;

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
  }, [forceOverlay, isMobileOpen]);

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
        visibleSidebarSections
          .flatMap((section) => section.items.map((item) => item.route))
          .filter((route): route is string => Boolean(route))
      )
    );

    routes.forEach((route) => {
      router.prefetch(route as Parameters<typeof router.prefetch>[0]);
    });
  }, [router, visibleSidebarSections]);

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

  const isDesktopKitchenSidebar = () =>
    forceOverlay &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(min-width: 1024px)").matches;

  const closeFloatingSidebar = () => {
    if (!isDesktopKitchenSidebar()) setIsMobileOpen(false);
  };

  const openProfileDestination = (route: string) => {
    setIsProfileMenuOpen(false);
    closeFloatingSidebar();
    router.push(route as Parameters<typeof router.push>[0], { scroll: false });
  };

  const openNavigationDestination = (route: string) => {
    // The Kitchen sidebar is docked on desktop. Closing it before navigation
    // made it slide left, then the destination's normal sidebar slid straight
    // back in. Keep the same mounted panel visible across that route change.
    // Phones still close their drawer after choosing a destination.
    closeFloatingSidebar();
    router.push(route as Parameters<typeof router.push>[0], { scroll: false });
  };

  const logout = async () => {
    setIsHelpMenuOpen(false);
    setIsProfileMenuOpen(false);

    // Clears the Supabase cookies AND the event-core.* ones, before the
    // navigation below - so the server render that follows sees no session
    // rather than a half-cleared one.
    await signOutCurrentSession();

    clearAuthenticatedQueryCache();
    setIsLogoutDialogOpen(false);
    const isDesktopApp =
      window.localStorage.getItem("eventCoreDesktopApp") === "true";
    router.replace(isDesktopApp ? "/login?desktop=1" : "/");
    router.refresh();
  };

  const showCollapsed = !forceOverlay && isCollapsed && !isMobileOpen;

  return (
    <>
      <button
        aria-label={t("nav.closeNavigation")}
        // No backdrop blur behind the kitchen's drawer. Blurring a full-screen
        // board of cards is the most expensive thing on the frame, and it was
        // being animated alongside the panel's slide; the dim alone reads the
        // same and the board stays legible to somebody standing back from the
        // screen.
        className={`fixed inset-x-0 top-0 z-55 h-dvh touch-pan-y bg-[#17202a]/45 duration-300 ease-out ${
          forceOverlay
            ? "transition-opacity lg:hidden"
            : "backdrop-blur-[2px] transition-[opacity,backdrop-filter] lg:hidden"
        } ${
          isMobileOpen
            ? "pointer-events-auto opacity-100"
            : `pointer-events-none opacity-0 ${forceOverlay ? "" : "backdrop-blur-none"}`
        }`}
        onClick={() => setIsMobileOpen(false)}
        tabIndex={isMobileOpen ? 0 : -1}
        type="button"
      />
      <aside
        className={`app-sidebar fixed left-0 top-0 flex h-dvh max-h-dvh w-[min(76vw,17rem)] touch-pan-y flex-col overscroll-none border-r border-white/10 bg-[#061126] shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${forceOverlay ? "app-sidebar-overlay z-70" : "sidebar-will-change-width z-70 lg:bottom-0 lg:top-20 lg:h-auto lg:max-h-none lg:z-40 lg:shadow-none lg:transition-[width] lg:duration-150 lg:ease-in-out"} ${
          isMobileOpen
            ? "translate-x-0"
            : forceOverlay
              ? "-translate-x-full"
              : "-translate-x-full lg:translate-x-0"
        } ${isSidebarTransitionReady ? "" : "transition-none"} ${
          showCollapsed
            ? "overflow-visible lg:w-18"
            : "overflow-visible lg:w-64"
        }`}
      >
        <DashboardSidebarMobileHeader
          onClose={() => setIsMobileOpen(false)}
          overlay={forceOverlay}
        />

        <nav
          className={`flex-1 ${
            showCollapsed
              ? "space-y-3 overflow-visible px-2 py-4"
              : "space-y-5 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-4"
          }`}
        >
          {visibleSidebarSections.map((section, sectionIndex) => (
            <section
              // A 4.5rem rail has no room for a heading, so the grouping the
              // headings carry survives as a hairline between the last icon of
              // one section and the first of the next.
              className={
                showCollapsed && sectionIndex > 0
                  ? "border-t border-white/10 pt-3"
                  : undefined
              }
              key={section.title}
            >
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
                  <span>{translated(section.title)}</span>
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

              {/* Folding a section away shortens a column of labels. The rail
                  has no headings to fold, so honouring that choice there would
                  leave those destinations with nothing at all to click - not
                  even an icon - until the sidebar is expanded again. The rail
                  therefore always lists every item. */}
              {showCollapsed ||
              expandedSidebarSections.includes(section.title) ? (
                <div className="space-y-1.5">
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
                          if (item.route) openNavigationDestination(item.route);
                        }}
                        aria-label={translated(item.label)}
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
                              className={`object-contain brightness-0 invert ${
                                showCollapsed
                                  ? "h-5 w-5"
                                  : "h-4.5 w-4.5 opacity-80"
                              }`}
                              height={24}
                              src={item.iconSrc}
                              width={24}
                            />
                          ) : (
                            <SidebarIcon
                              className={
                                showCollapsed ? "h-5 w-5" : "h-4.5 w-4.5"
                              }
                              name={item.icon}
                              strokeWidth={showCollapsed ? 2.4 : 2}
                            />
                          )}
                        </span>

                        {!showCollapsed ? (
                          <span className="min-w-0 flex-1 truncate text-sm font-normal">
                              {translated(item.label)}
                          </span>
                        ) : (
                          <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#1f4d73] px-3 py-2 text-xs font-bold text-white shadow-xl group-hover:block">
                            {translated(item.label)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </section>
          ))}
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
                aria-label={t("nav.profileMenu")}
                className={`absolute z-80 rounded-2xl border border-white/15 bg-[#061126] p-2 text-white shadow-[0_16px_40px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.08)] ${
                  showCollapsed
                    ? "bottom-2 left-[calc(100%+0.5rem)] w-48"
                    : "bottom-[calc(100%+0.5rem)] left-3 right-3 max-lg:right-auto max-lg:w-52"
                }`}
                role="menu"
              >
                {profileMenuItems.map((item) => (
                  <button
                    aria-expanded={
                      item.label === "Help" ? isHelpMenuOpen : undefined
                    }
                    aria-haspopup={item.label === "Help" ? "menu" : undefined}
                    className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-white/90 transition hover:bg-white/10 hover:text-white ${
                      item.label === "My Account"
                        ? "mb-1 after:absolute after:-bottom-0.5 after:left-3 after:right-3 after:h-px after:bg-white/25 after:content-['']"
                        : ""
                    }`}
                    key={item.label}
                    onClick={() => {
                      if (item.label === "Upgrade Plan") {
                        setIsProfileMenuOpen(false);
                        closeFloatingSidebar();
                        setIsUpgradePlanDialogOpen(true);
                        return;
                      }

                      if (item.label === "My Account") {
                        setIsProfileMenuOpen(false);
                        closeFloatingSidebar();
                        setIsAccountDialogOpen(true);
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
                    {translated(item.label)}
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
                    aria-label={t("nav.helpLinks")}
                    className={`absolute z-90 w-44 whitespace-nowrap rounded-2xl border border-white/15 bg-[#061126] p-1.5 text-white shadow-[0_16px_40px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.08)] max-lg:bottom-13 max-lg:left-32 ${
                      showCollapsed
                        ? "bottom-13 left-full"
                        : "bottom-13 left-full"
                    }`}
                    role="menu"
                  >
                    {(
                      [
                        {
                          label: t("shell.reportProblem"),
                          kind: "report-problem"
                        },
                        { label: t("shell.helpCenter"), kind: "help-center" },
                        {
                          label: t("shell.releaseNotes"),
                          kind: "release-notes"
                        },
                        {
                          label: t("shell.termsOfService"),
                          kind: "terms-of-service"
                        },
                        {
                          label: t("shell.privacyPolicy"),
                          kind: "privacy-policy"
                        }
                      ] satisfies Array<{ label: string; kind: HelpPageKind }>
                    ).map((item) => (
                      <button
                        className={`relative block w-full whitespace-nowrap rounded-xl px-3 py-2 text-left text-[13px] font-semibold text-white/90 transition hover:bg-white/10 hover:text-white ${
                          item.kind === "release-notes"
                            ? "mb-1 after:absolute after:-bottom-0.5 after:left-3 after:right-3 after:h-px after:bg-white/25 after:content-['']"
                            : ""
                        }`}
                        key={item.label}
                        onClick={() => {
                          setIsHelpMenuOpen(false);
                          setIsProfileMenuOpen(false);
                          closeFloatingSidebar();
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
              aria-label={t("shell.openProfileMenu", { name: profileName })}
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

      {isAccountDialogOpen ? (
        <AccountDialog onClose={() => setIsAccountDialogOpen(false)} />
      ) : null}
      {isLogoutDialogOpen ? (
        <LogoutConfirmationDialog
          onClose={() => setIsLogoutDialogOpen(false)}
          onConfirm={logout}
          open
        />
      ) : null}
      {helpDialogKind ? (
        <HelpDialog
          kind={helpDialogKind}
          onClose={() => setHelpDialogKind(null)}
          open
        />
      ) : null}
      {isUpgradePlanDialogOpen ? (
        <UpgradePlanDialog
          onClose={() => setIsUpgradePlanDialogOpen(false)}
          open
        />
      ) : null}
    </>
  );
}
