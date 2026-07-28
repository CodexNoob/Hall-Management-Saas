"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  clearCachedSyncedUser,
  getCachedSyncedUser,
  syncSignedInUser,
  type SyncSignedInUserResponse
} from "@/lib/auth/client";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { DashboardStartupScreen } from "@/components/layout/dashboard-startup-screen";
import { DashboardTopbarBrand } from "@/components/layout/dashboard-topbar";
import type { ReactNode } from "react";

function formatRole(role: string) {
  return role
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function getDashboardActiveLabel(pathname: string | null): string {
  if (!pathname) {
    return "Dashboard";
  }

  const path = pathname.replace(/\/$/, "");

  if (path === "/dashboard") return "Dashboard";
  if (
    path.startsWith("/dashboard/clients") ||
    path.startsWith("/dashboard/client-portal")
  )
    return "Clients";
  if (path.startsWith("/dashboard/dining-manager")) return "Dining Manager";
  if (path.startsWith("/dashboard/hall-room-map")) return "Hall Room Map";
  if (path.startsWith("/dashboard/files")) return "Files";
  if (path.startsWith("/dashboard/billing")) return "Billing";
  if (path.startsWith("/dashboard/menu")) return "Menu";
  if (path.startsWith("/dashboard/kitchen")) return "Kitchen";
  if (path.startsWith("/dashboard/calendar")) return "Calendar";
  if (path.startsWith("/dashboard/events")) return "Events";
  if (path.startsWith("/dashboard/staff")) return "Staff";
  if (path.startsWith("/dashboard/vendors")) return "Vendors";
  if (path.startsWith("/dashboard/help-center")) return "Help Center";
  if (path.startsWith("/dashboard/release-notes")) return "Help Center";
  if (path.startsWith("/dashboard/download-apps")) return "Help Center";
  if (path.startsWith("/dashboard/terms-of-service")) return "Help Center";
  if (path.startsWith("/dashboard/privacy-policy")) return "Help Center";

  return "Dashboard";
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [syncData, setSyncData] = useState<SyncSignedInUserResponse | null>(
    null
  );
  const [status, setStatus] = useState("Preparing your dashboard...");

  useEffect(() => {
    let isMounted = true;
    const cachedSyncData = getCachedSyncedUser();

    if (cachedSyncData) {
      setSyncData(cachedSyncData);
    }

    async function loadUser() {
      try {
        if (isMounted && !cachedSyncData) {
          setStatus("Checking your session...");
        }

        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.auth.getSession();

        if (error || !data.session?.access_token) {
          clearCachedSyncedUser();
          const isDesktopApp =
            window.localStorage.getItem("eventCoreDesktopApp") === "true";
          router.replace(isDesktopApp ? "/login?desktop=1" : "/");
          return;
        }

        if (isMounted && !cachedSyncData) {
          setStatus("Loading dashboard data...");
        }

        const synced = await syncSignedInUser(data.session.access_token);

        if (isMounted) {
          setSyncData(synced);
        }
      } catch {
        if (!cachedSyncData) {
          clearCachedSyncedUser();
          const isDesktopApp =
            window.localStorage.getItem("eventCoreDesktopApp") === "true";
          router.replace(isDesktopApp ? "/login?desktop=1" : "/");
        }
      }
    }

    loadUser();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <>
      <DashboardStartupScreen routeKey={pathname ?? "/dashboard"} />
      {!syncData ? (
        <main
          className="dashboard-font min-h-dvh bg-[#f5f6f8]"
          aria-busy="true"
          aria-label={status}
        />
      ) : (
        <main className="dashboard-font min-h-screen bg-[#f5f6f8] text-[#17202a]">
          <DashboardTopbarBrand />
          <DashboardSidebar
            user={syncData.user}
            roleLabel={formatRole(syncData.user.role)}
            activeLabel={getDashboardActiveLabel(pathname)}
          />

          <section className="dashboard-shell-main min-h-screen lg:pl-64">
            {children}
          </section>
        </main>
      )}
    </>
  );
}
