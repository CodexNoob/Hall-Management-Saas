"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";

type DashboardTopbarProps = {
  title: string;
  subtitle?: string;
  onNewBooking?: () => void;
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

export function DashboardTopbar({ title, subtitle, onNewBooking, rightSlot }: DashboardTopbarProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    setIsSidebarCollapsed(window.localStorage.getItem("sidebarCollapsed") === "true");

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
    setIsSidebarCollapsed((current) => {
      const nextCollapsed = !current;

      window.dispatchEvent(
        new CustomEvent("dashboard-sidebar-toggle", {
          detail: { collapsed: nextCollapsed },
        })
      );

      return nextCollapsed;
    });
  };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 bg-[#FFFEFB]/95 backdrop-blur-xl">
        <div className="flex min-h-20 items-stretch">
          <div className="dashboard-topbar-brand flex shrink-0 items-center justify-between gap-3 border-r border-[#D8DEE8] px-4 sm:px-6">
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
              className={`dashboard-sidebar-toggle group relative flex shrink-0 items-center justify-center overflow-hidden transition hover:-translate-y-0.5 ${
                isSidebarCollapsed
                  ? "h-11 w-11 rounded-xl border border-transparent bg-transparent shadow-none hover:border-[#D8DEE8] hover:bg-[#F7F4ED] hover:shadow-sm"
                  : "h-9 w-9 rounded-xl border border-[#D8DEE8] bg-white text-[#0F172A] shadow-sm hover:border-[#B9974D] hover:bg-[#F7F4ED]"
              }`}
              type="button"
              onClick={toggleSidebar}
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isSidebarCollapsed ? (
                <>
                  <Image
                    src="/logo.png"
                    alt=""
                    width={44}
                    height={44}
                    unoptimized
                    className="h-11 w-11 object-contain transition-opacity duration-200 group-hover:opacity-0"
                  />
                  <Image
                    src="/sidebar-right.png"
                    alt=""
                    width={24}
                    height={24}
                    unoptimized
                    className="absolute h-5 w-5 object-contain opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                  />
                </>
              ) : (
                <Image
                  src="/sidebar-left.png"
                  alt=""
                  width={20}
                  height={20}
                  unoptimized
                  className="h-5 w-5 object-contain"
                />
              )}
            </button>
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-6 border-b border-[#D8DEE8] pl-6 pr-4 sm:pr-6 lg:pr-8">
            <div className="min-w-0 shrink grow">
              <h1 className="truncate text-2xl font-black tracking-tight text-[#0F172A]">{title}</h1>
              {subtitle ? <p className="mt-1 truncate text-sm font-medium text-[#64748B]">{subtitle}</p> : null}
            </div>

            <div className="ml-auto hidden min-w-0 items-center gap-3 lg:flex">
              <div className="flex h-11 w-96 min-w-0 items-center gap-3 rounded-xl border border-[#CBD5E1] bg-white px-4 text-sm text-[#64748B] shadow-sm">
                <span className="font-bold text-[#0F172A]">/</span>
                <TopbarIcon name="search" />
                <span className="truncate">Search events, clients, invoices</span>
              </div>

              <button
                type="button"
                className="h-11 rounded-xl border border-[#CBD5E1] bg-white px-5 text-sm font-bold text-[#0F172A] shadow-sm transition hover:border-[#B9974D]/60 hover:bg-[#F7F4ED]"
              >
                Today notes
              </button>

              <button
                type="button"
                onClick={onNewBooking}
                className="flex h-11 items-center gap-2 rounded-xl bg-[#0F172A] px-5 text-sm font-bold text-white shadow-lg shadow-[#0F172A]/15 transition hover:-translate-y-0.5 hover:bg-[#17233A]"
              >
                <TopbarIcon name="plus" />
                New booking
              </button>

              {rightSlot}
            </div>
          </div>
        </div>
      </header>

      <div className="h-20" aria-hidden="true" />
    </>
  );
}
