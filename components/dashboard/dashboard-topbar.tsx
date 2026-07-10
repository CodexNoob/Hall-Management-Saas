"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";

type DashboardTopbarProps = {
  title: string;
  subtitle?: string;
  onNewBooking?: () => void;
  actionsSlot?: ReactNode;
  rightSlot?: ReactNode;
};

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
    const nextCollapsed = !isSidebarCollapsed;

    setIsSidebarCollapsed(nextCollapsed);
    window.dispatchEvent(
      new CustomEvent("dashboard-sidebar-toggle", {
        detail: { collapsed: nextCollapsed },
      })
    );
  };

  return (
    <div className="dashboard-topbar-brand fixed left-0 top-0 z-60 flex min-h-20 shrink-0 items-center justify-between gap-3 border-r border-[#d8dde5] bg-[#ffffff]/95 px-4 backdrop-blur-xl sm:px-6">
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
        aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
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

export function DashboardTopbar({ title, subtitle, onNewBooking, actionsSlot, rightSlot }: DashboardTopbarProps) {
  return (
    <>
      <header className="dashboard-topbar-content fixed right-0 top-0 z-50 bg-[#ffffff]/95 backdrop-blur-xl">
        <div className="flex min-h-20 items-stretch">
          <div className="flex min-w-0 flex-1 items-center gap-6 border-b border-[#d8dde5] pl-6 pr-4 sm:pr-6 lg:pr-8">
            <div className="min-w-0 shrink grow">
              <h1 className="truncate text-2xl font-black tracking-tight text-[#17202a]">{title}</h1>
              {subtitle ? <p className="mt-1 truncate text-sm font-medium text-[#6a7483]">{subtitle}</p> : null}
            </div>

            <div className="ml-auto hidden min-w-0 items-center gap-3 lg:flex">
              <div className="flex h-11 w-96 min-w-0 items-center gap-3 rounded-xl border border-[#b9c2cf] bg-white px-4 text-sm text-[#6a7483] shadow-sm">
                <span className="font-bold text-[#17202a]">/</span>
                <TopbarIcon name="search" />
                <span className="truncate">Search events, clients, invoices</span>
              </div>

              {actionsSlot ?? (
                <>
                  <button
                    type="button"
                    className="h-11 rounded-xl border border-[#b9c2cf] bg-white px-5 text-sm font-bold text-[#17202a] shadow-sm transition hover:border-[#1f4d73]/60 hover:bg-[#eef4fa]"
                  >
                    Today notes
                  </button>

                  <button
                    type="button"
                    onClick={onNewBooking}
                    className="flex h-11 items-center gap-2 rounded-xl bg-[#1f4d73] px-5 text-sm font-bold text-white shadow-lg shadow-[#17202a]/15 transition hover:-translate-y-0.5 hover:bg-[#15344f]"
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

      <div className="h-20" aria-hidden="true" />
    </>
  );
}
