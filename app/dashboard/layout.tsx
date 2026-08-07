"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  clearCachedSyncedUser,
  syncSignedInUser,
  type SyncSignedInUserResponse
} from "@/lib/auth/client";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { DashboardStartupScreen } from "@/components/layout/dashboard-startup-screen";
import { DashboardTopbarBrand } from "@/components/layout/dashboard-topbar";
import { DashboardTrialProvider } from "@/components/layout/dashboard-trial-pill";
import { getSubscriptionPlan } from "@/lib/subscription/plans";
import { isTesterBypassEmail } from "@/lib/subscription/trial";
import { getDashboardLoginPath } from "@/lib/auth/redirect";
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
  if (
    path.startsWith("/dashboard/events") ||
    path.startsWith("/dashboard/event-manager")
  )
    return "Events";
  if (path.startsWith("/dashboard/staff")) return "Staff";
  if (path.startsWith("/dashboard/vendors")) return "Vendors";

  return "Dashboard";
}

function getSidebarProfileSubtitle(syncData: SyncSignedInUserResponse) {
  const roleLabel = formatRole(syncData.user.role);
  const activeOrganization =
    syncData.organizations.find(
      (organization) => organization.id === syncData.activeOrganizationId
    ) ?? syncData.organizations[0];

  if (!activeOrganization) {
    return roleLabel;
  }

  const isOrganizationOwner = activeOrganization.role === "owner";

  if (!isOrganizationOwner) {
    return roleLabel;
  }

  const isTrialing =
    activeOrganization.subscriptionStatus === "trialing" &&
    !isTesterBypassEmail(syncData.user.email);

  if (isTrialing) {
    return "Upgrade Now";
  }

  const subscribedPlan = getSubscriptionPlan(
    activeOrganization.subscriptionPlan
  );

  if (
    subscribedPlan &&
    subscribedPlan.id !== "free_trial" &&
    activeOrganization.subscriptionStatus === "active"
  ) {
    return subscribedPlan.name;
  }

  return roleLabel;
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const initialPathname = useRef(pathname ?? "/dashboard");
  const [syncData, setSyncData] = useState<SyncSignedInUserResponse | null>(
    null
  );
  const [status, setStatus] = useState("Preparing your dashboard...");
  const [startupError, setStartupError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function loadUser() {
      try {
        setStartupError("");
        if (isMounted) {
          setStatus("Checking your session...");
        }

        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.auth.getSession();

        if (error || !data.session?.access_token) {
          clearCachedSyncedUser();
          const isDesktopApp =
            window.localStorage.getItem("eventCoreDesktopApp") === "true";
          router.replace(
            isDesktopApp
              ? "/login?desktop=1"
              : getDashboardLoginPath(initialPathname.current)
          );
          return;
        }

        if (isMounted) {
          setStatus("Loading dashboard data...");
        }

        const synced = await syncSignedInUser(data.session.access_token);

        if (isMounted) {
          setSyncData(synced);
        }
      } catch (error) {
        if (isMounted) {
          setStartupError(
            error instanceof Error
              ? error.message
              : "The dashboard could not finish loading."
          );
        }
      }
    }

    loadUser();

    return () => {
      isMounted = false;
    };
  }, [retryKey, router]);

  return (
    <>
      {!syncData ? (
        <>
          {!startupError ? (
            <DashboardStartupScreen routeKey="initial-dashboard-load" />
          ) : null}
          <main
            className="dashboard-font flex min-h-dvh items-center justify-center bg-[#f5f6f8] p-6"
            aria-busy={!startupError}
            aria-label={startupError || status}
          >
            {startupError ? (
              <section className="w-full max-w-md rounded-2xl border border-[#d8dde5] bg-white p-6 text-center shadow-sm">
                <h1 className="text-xl font-black text-[#172033]">
                  Dashboard couldn&apos;t load
                </h1>
                <p className="mt-2 text-sm leading-6 text-[#64748b]">
                  {startupError}
                </p>
                <button
                  className="mt-5 min-h-11 rounded-xl bg-[#1f557d] px-5 py-2.5 text-sm font-black text-white transition hover:bg-[#174362]"
                  onClick={() => setRetryKey((current) => current + 1)}
                  type="button"
                >
                  Try again
                </button>
              </section>
            ) : null}
          </main>
        </>
      ) : (
        <main className="dashboard-font min-h-dvh bg-[#f5f6f8] text-[#17202a]">
          <DashboardTopbarBrand />
          <DashboardSidebar
            user={syncData.user}
            roleLabel={formatRole(syncData.user.role)}
            profileSubtitle={getSidebarProfileSubtitle(syncData)}
            activeLabel={getDashboardActiveLabel(pathname)}
          />

          <section className="dashboard-shell-main min-h-dvh lg:pl-64">
            <DashboardTrialProvider syncData={syncData}>
              {children}
            </DashboardTrialProvider>
          </section>
        </main>
      )}
    </>
  );
}
