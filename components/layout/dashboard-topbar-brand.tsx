"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

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
        aria-expanded={
          isMobileViewport ? isMobileSidebarOpen : !isSidebarCollapsed
        }
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


