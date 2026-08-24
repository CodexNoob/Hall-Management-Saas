"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  startRealtimeSync,
  stopRealtimeSync
} from "@/lib/realtime/realtime-sync";
import {
  clearCachedAuthSession,
  fetchAuthSession,
  type AuthSessionResponse
} from "@/lib/auth/client";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { DashboardStartupScreen } from "@/components/layout/dashboard-startup-screen";
import { DashboardTopbarBrand } from "@/components/layout/dashboard-topbar";
import { DashboardTrialProvider } from "@/components/layout/dashboard-trial-pill";
import { DashboardPageState } from "@/components/layout/dashboard-page-state";
import { canAccessDashboardRoute } from "@/lib/auth/dashboard-routes";
import {
  MVP_LANDING_ROUTE,
  isHiddenDashboardRoute
} from "@/lib/ui/mvp-features";
import { getSubscriptionPlan } from "@/lib/subscription/plans";
import { isTesterBypassEmail } from "@/lib/subscription/trial";
import {
  getDashboardLoginPath,
  getPasswordSetupPath
} from "@/lib/auth/redirect";
import type { ReactNode } from "react";

function formatRole(role: string) {
  return role
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

// Names the sidebar's highlighted item and titles the access-restricted state.
// The hidden modules are left out and "Events" is the fallback rather than
// "Dashboard", because the overview is one of them - a path that matches nothing
// here is on its way to MVP_LANDING_ROUTE anyway.
function getDashboardActiveLabel(pathname: string | null): string {
  if (!pathname) {
    return "Events";
  }

  const path = pathname.replace(/\/$/, "");

  if (
    path.startsWith("/dashboard/clients") ||
    path.startsWith("/dashboard/client-portal")
  )
    return "Clients";
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

  return "Events";
}

function getSidebarProfileSubtitle(authSession: AuthSessionResponse) {
  const roleLabel = formatRole(authSession.user.role);
  const activeOrganization =
    authSession.organizations.find(
      (organization) => organization.id === authSession.activeOrganizationId
    ) ?? authSession.organizations[0];

  if (!activeOrganization) {
    return roleLabel;
  }

  const isOrganizationOwner = activeOrganization.role === "owner";

  if (!isOrganizationOwner) {
    return roleLabel;
  }

  const isTrialing =
    activeOrganization.subscriptionStatus === "trialing" &&
    !isTesterBypassEmail(authSession.user.email);

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
  // The organization-setup form is intentionally left out of
  // `dashboardRoutePermissions`: it renders without dashboard chrome and its real
  // gate is `mustCompleteOnboarding` below plus the owner check in
  // POST /api/onboarding/organization.
  const isOnboardingRoute = pathname === "/dashboard/new";
  // The overview, Billing, Dining Manager, Hall Room Map and Files are out of
  // the MVP (see lib/ui/mvp-features). Withdrawing their sidebar and search
  // entries is not enough on its own - a bookmark, an old prefetch or a typed
  // url still reaches them - so the route itself answers with the landing page.
  const isHiddenRoute = isHiddenDashboardRoute(pathname);
  const [authSession, setAuthSession] = useState<AuthSessionResponse | null>(
    null
  );
  const [status, setStatus] = useState("Preparing your dashboard...");
  const [startupError, setStartupError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!isHiddenRoute) return;
    router.replace(MVP_LANDING_ROUTE);
  }, [isHiddenRoute, router]);

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
          clearCachedAuthSession();
          // The socket outlives a signed-out session otherwise, and would keep
          // refetching protected endpoints for the organization just left.
          stopRealtimeSync();
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

        const nextSession = await fetchAuthSession(data.session.access_token);

        // Invited staff reach here with a session but no password of their own.
        // Return without setAuthSession so the startup screen stays up until the
        // redirect lands, instead of flashing dashboard chrome.
        if (nextSession.mustSetPassword) {
          router.replace(
            getPasswordSetupPath(initialPathname.current) as Parameters<
              typeof router.replace
            >[0]
          );
          return;
        }

        // Owners who have not named their organization yet are held on the setup
        // form. Same reasoning as the password branch above: return without
        // setAuthSession so the startup screen covers the redirect.
        if (nextSession.mustCompleteOnboarding && !isOnboardingRoute) {
          router.replace("/dashboard/new");
          return;
        }

        // ...and once it is set up, the form is a dead end.
        if (!nextSession.mustCompleteOnboarding && isOnboardingRoute) {
          router.replace(MVP_LANDING_ROUTE);
          return;
        }

        if (isMounted) {
          setAuthSession(nextSession);
          // Only once the session is committed: before this point the
          // organization is not settled, and subscribing to the wrong one
          // would refetch against an organization the user is about to leave.
          if (nextSession.activeOrganizationId) {
            startRealtimeSync(nextSession.activeOrganizationId);
          }
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
    // `isOnboardingRoute` is a boolean, so this only re-runs when the setup form
    // is entered or left - not on every dashboard navigation.
  }, [isOnboardingRoute, retryKey, router]);

  // Held blank rather than rendering the page under the redirect: these modules
  // fetch on mount, and a frame of Billing's chrome on the way to Events reads
  // as a page that exists and then thought better of it.
  if (isHiddenRoute) {
    return (
      <main
        aria-busy="true"
        aria-label="Opening events"
        className="dashboard-font min-h-dvh bg-[#f5f6f8]"
      />
    );
  }

  return (
    <>
      {!authSession ? (
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
      ) : isOnboardingRoute ? (
        // No sidebar, topbar, trial pill, or permission gate: there is no
        // workspace to navigate yet, and the owner cannot leave this form.
        children
      ) : (
        <main className="dashboard-font min-h-dvh bg-[#f5f6f8] text-[#17202a]">
          <DashboardTopbarBrand />
          <DashboardSidebar
            user={authSession.user}
            roleLabel={formatRole(authSession.user.role)}
            profileSubtitle={getSidebarProfileSubtitle(authSession)}
            activeLabel={getDashboardActiveLabel(pathname)}
          />

          <section className="dashboard-shell-main min-h-dvh lg:pl-64">
            <DashboardTrialProvider authSession={authSession}>
              {canAccessDashboardRoute(
                pathname,
                authSession.access,
                authSession.organizations.find(
                  (organization) =>
                    organization.id === authSession.activeOrganizationId
                )?.role
              ) ? (
                children
              ) : (
                <DashboardPageState
                  emptyMessage="Your role doesn't include access to this page. Contact an administrator if you need it."
                  emptyTitle="Access restricted"
                  isEmpty
                  showSearch={false}
                  subtitle=""
                  title={getDashboardActiveLabel(pathname)}
                />
              )}
            </DashboardTrialProvider>
          </section>
        </main>
      )}
    </>
  );
}
