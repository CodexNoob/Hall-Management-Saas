"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  startRealtimeSync,
  stopRealtimeSync
} from "@/lib/realtime/realtime-sync";
import {
  clearCachedAuthSession,
  fetchAuthSession,
  isTerminalAuthSessionError,
  signOutCurrentSession,
  type AuthSessionResponse
} from "@/lib/auth/client";
import { MfaGate } from "@/features/auth/components/mfa-gate";
import { InactivityWarning } from "@/components/layout/inactivity-warning";
import { DeviceGate } from "@/features/auth/components/device-gate";
import { resolveDashboardGate } from "@/lib/auth/dashboard-gate";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { DashboardStartupScreen } from "@/components/layout/dashboard-startup-screen";
import { DashboardTopbarBrand } from "@/components/layout/dashboard-topbar";
import { DashboardTrialProvider } from "@/components/layout/dashboard-trial-pill";
import { DashboardPageState } from "@/components/layout/dashboard-page-state";
import {
  canAccessDashboardRoute,
  resolveLandingRoute,
  resolveRevocationRedirect
} from "@/lib/auth/dashboard-routes";
import { startAuthorizationRefreshFallbacks } from "@/lib/auth/authorization-refresh";
import { useAuthSession } from "@/features/dashboard/hooks/use-dashboard-permission";
import {
  MVP_LANDING_ROUTE,
  isHiddenDashboardRoute
} from "@/lib/ui/mvp-features";
import { getSubscriptionPlan } from "@/lib/subscription/plans";
import { isTesterBypassEmail } from "@/lib/subscription/trial";
import {
  getBetaPendingPath,
  getDashboardLoginPath,
  getPasswordSetupPath,
  getRejectedLoginPath,
  isBetaAccessCode
} from "@/lib/auth/redirect";
import type { ReactNode } from "react";
import {
  APP_LANGUAGE_CHANGE_EVENT,
  useAppLanguage
} from "@/components/providers/app-language-provider";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * What the sidebar puts under somebody's name.
 *
 * A JOB TITLE, NOT A ROLE. The old label read the membership role string, which
 * no longer exists - and reading a role NAME here would put one back on the
 * client for the next person to branch on. `users.title` is the field that
 * always wanted to be here: it describes the person, and nothing decides
 * anything from it.
 */
function getProfileTitle(
  authSession: AuthSessionResponse,
  t: (key: MessageKey) => string
) {
  return authSession.user.title?.trim() || t("shell.teamMember");
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
  // Both, because Access is a tab inside Staff now and `/dashboard/access` is a
  // redirect onto it. Highlighting a sidebar entry that no longer exists would
  // leave nothing highlighted for the moment the redirect is in flight.
  if (
    path.startsWith("/dashboard/staff") ||
    path.startsWith("/dashboard/access")
  )
    return "Staff";
  if (path.startsWith("/dashboard/settings")) return "Settings";  if (path.startsWith("/dashboard/vendors")) return "Vendors";

  return "Events";
}

function getSidebarProfileSubtitle(
  authSession: AuthSessionResponse,
  t: (key: MessageKey) => string
) {
  const title = getProfileTitle(authSession, t);
  const activeOrganization =
    authSession.organizations.find(
      (organization) => organization.id === authSession.activeOrganizationId
    ) ?? authSession.organizations[0];

  if (!activeOrganization) {
    return title;
  }

  // The upgrade prompt goes to whoever can actually act on it - the person who
  // may change the organization's settings and plan - rather than to whoever
  // holds a role called "owner" (INV-1). A tenant that invented a Founder role
  // gets the prompt with no code change here.
  const canManageSubscription =
    authSession.permissions.includes("settings.update");

  if (!canManageSubscription) {
    return title;
  }

  const isTrialing =
    activeOrganization.subscriptionStatus === "trialing" &&
    !isTesterBypassEmail(authSession.user.email);

  if (isTrialing) {
    return t("shell.upgradeNow");
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

  return title;
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { t } = useAppLanguage();
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
  const [statusKey, setStatusKey] = useState<MessageKey>(
    "shell.preparingDashboard"
  );
  const [startupError, setStartupError] = useState("");
  // A failure this layout words itself is held as a key, so the card follows
  // the language. A message thrown from below is already a sentence and is
  // kept verbatim in `startupError`.
  const [startupErrorKey, setStartupErrorKey] = useState<MessageKey | null>(
    null
  );
  const [retryKey, setRetryKey] = useState(0);
  /**
   * The LIVE session, as opposed to the one this layout loaded at startup.
   *
   * `authSession` above is the startup gate - null means "still loading, keep
   * the startup screen up". It is deliberately not the thing rendered from any
   * more: an administrator granting a role updates the cached session, and a
   * copy held in this component's state would keep the old permissions until
   * something else happened to re-run the loader. That was the bug.
   */
  const liveAuthSession = useAuthSession();
  const activeAuthSession = authSession ? liveAuthSession ?? authSession : null;
  // The kitchen board takes the whole screen. Its sidebar remains mounted as a
  // closed overlay so the board's own Open sidebar button is the only control
  // that reveals it; opening navigation never shrinks the operations board.
  const isKitchenRoute = pathname?.startsWith("/dashboard/kitchen") ?? false;
  const [isKitchenSidebarOpen, setIsKitchenSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isKitchenRoute) {
      setIsKitchenSidebarOpen(false);
      return;
    }

    const handleSidebarChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ open?: boolean }>;
      setIsKitchenSidebarOpen(Boolean(customEvent.detail?.open));
    };
    window.addEventListener(
      "dashboard-mobile-sidebar-change",
      handleSidebarChange
    );
    return () =>
      window.removeEventListener(
        "dashboard-mobile-sidebar-change",
        handleSidebarChange
      );
  }, [isKitchenRoute]);

  useEffect(() => {
    if (!isHiddenRoute) return;
    router.replace(MVP_LANDING_ROUTE);
  }, [isHiddenRoute, router]);

  /**
   * The fallbacks for everything realtime does not deliver.
   *
   * Three things it misses, and each on its own would put somebody back to
   * signing out and in: realtime is OFF by default in development
   * (`NEXT_PUBLIC_ENABLE_REALTIME_SYNC`), the socket can drop unnoticed, and a
   * sleeping laptop receives nothing. Mounted here rather than beside the
   * realtime sync precisely so it runs whether or not realtime is enabled.
   */
  useEffect(() => startAuthorizationRefreshFallbacks(), []);

  /**
   * ACCESS REVOKED WHILE SOMEBODY WAS STANDING ON THE PAGE.
   *
   * Only that case. `previousPermissions` is what makes it "the route they were
   * allowed to see a moment ago", rather than "any route they cannot see" -
   * typing a url for a page you never had access to still gets the refusal card
   * below, because hiding navigation and refusing direct navigation are
   * different jobs and conflating them would turn one into the other.
   *
   * Not a security control in either direction. The API refuses on its own
   * authority; this exists so somebody who was mid-task is put somewhere usable
   * instead of watching the screen they were reading turn into an error.
   */
  const previousPermissions = useRef<readonly string[] | null>(null);

  useEffect(() => {
    const permissions = activeAuthSession?.permissions;

    if (!permissions) return;

    const previous = previousPermissions.current;
    previousPermissions.current = permissions;

    const destination = resolveRevocationRedirect({
      pathname,
      previous,
      current: permissions,
      isHidden: isHiddenDashboardRoute
    });

    // Null means "leave them where they are" - either nothing was taken away,
    // or they hold nothing that opens any page, in which case the
    // restricted-access card below is the honest answer.
    if (destination) {
      router.replace(destination as Parameters<typeof router.replace>[0]);
    }
  }, [activeAuthSession, pathname, router]);

  useEffect(() => {
    let isMounted = true;
    async function loadUser() {
      try {
        setStartupError("");
        setStartupErrorKey(null);
        if (isMounted) {
          setStatusKey("shell.checkingSession");
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
          setStatusKey("shell.loadingDashboardData");
        }

        const nextSession = await fetchAuthSession(data.session.access_token);

        // The provider above this layout starts in English because nobody
        // knows the organization yet. This is the moment that changes.
        if (nextSession.language) {
          window.dispatchEvent(
            new CustomEvent(APP_LANGUAGE_CHANGE_EVENT, {
              detail: { language: nextSession.language }
            })
          );
        }

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

        /**
         * Nobody lands on a page they cannot open.
         *
         * `MVP_LANDING_ROUTE` is `/dashboard/events`, and it is where every
         * default path leads - a sign-in with no `next`, a hidden module's
         * redirect, leaving the onboarding form. That was safe only while
         * every role held `event.read`. Kitchen Manager and Kitchen Staff no
         * longer do, so without this a cook signs in and is shown "Access
         * restricted" for doing nothing but arriving.
         *
         * Deliberately narrow: ONLY the landing route is redirected away from,
         * and only when the caller cannot open it. Typing any other route they
         * lack the key for still gets the refusal card below - hiding a nav
         * item and refusing direct navigation are different jobs and both have
         * to hold.
         */
        if (
          initialPathname.current === MVP_LANDING_ROUTE &&
          !canAccessDashboardRoute(MVP_LANDING_ROUTE, nextSession.permissions)
        ) {
          const landing = resolveLandingRoute(
            nextSession.permissions,
            isHiddenDashboardRoute
          );

          if (landing) {
            router.replace(landing as Parameters<typeof router.replace>[0]);
            return;
          }
        }

        if (isMounted) {
          setAuthSession(nextSession);
          // Only once the session is committed: before this point the
          // organization is not settled, and subscribing to the wrong one
          // would refetch against an organization the user is about to leave.
          //
          // And only once every gate is cleared. A browser still owing its
          // second factor or its device confirmation loads NO dashboard data,
          // live updates included. Clearing a gate reruns this loader, which
          // is when the subscription starts.
          if (
            nextSession.activeOrganizationId &&
            resolveDashboardGate(nextSession) === "dashboard"
          ) {
            startRealtimeSync(nextSession.activeOrganizationId);
          }
        }
      } catch (error) {
        // A refusal no retry can clear - most often a social sign-in whose
        // address has no seat here. The Supabase session is valid, so showing
        // the error card and stopping would trap the person on it: "Try again"
        // repeats the same 403, and proxy.ts bounces /login back to /dashboard
        // for as long as that session exists. End it, then send them to sign in
        // with the reason spelled out.
        if (isTerminalAuthSessionError(error)) {
          clearCachedAuthSession();
          stopRealtimeSync();
          // Never let a failed sign-out swallow the redirect: leaving the person
          // on the error card is the outcome this whole branch exists to avoid,
          // and the cookie expires on its own.
          await signOutCurrentSession().catch(() => undefined);

          // A beta applicant is not somebody who got their password wrong, so
          // they do not go to a sign-in form with a red message on it - there
          // is no action for them to take there. They go to the page that
          // explains the beta.
          router.replace(
            (isBetaAccessCode(error.code)
              ? getBetaPendingPath(error.code)
              : getRejectedLoginPath(
                  error.code,
                  window.localStorage.getItem("eventCoreDesktopApp") === "true"
                )) as Parameters<typeof router.replace>[0]
          );
          return;
        }

        if (isMounted) {
          if (error instanceof Error) {
            setStartupError(error.message);
          } else {
            setStartupErrorKey("shell.couldNotFinishLoading");
          }
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

  /**
   * Signed out for being idle.
   *
   * Ends the local Supabase session and leaves, rather than letting the page
   * sit on a dashboard whose every request now answers 401. Carries a reason
   * CODE - the login page maps it through a fixed table - so the person is told
   * why they are back there rather than wondering whether something happened to
   * their account.
   */
  const signOutForInactivity = useCallback(async () => {
    clearCachedAuthSession();
    stopRealtimeSync();
    await signOutCurrentSession().catch(() => undefined);
    router.replace(
      getRejectedLoginPath("session_expired", false) as Parameters<
        typeof router.replace
      >[0]
    );
  }, [router]);

  const startupMessage =
    startupError || (startupErrorKey ? t(startupErrorKey) : "");

  // Held blank rather than rendering the page under the redirect: these modules
  // fetch on mount, and a frame of Billing's chrome on the way to Events reads
  // as a page that exists and then thought better of it.
  if (isHiddenRoute) {
    return (
      <main
        aria-busy="true"
        aria-label={t("shell.openingEvents")}
        className="dashboard-font min-h-dvh bg-[#f5f6f8]"
      />
    );
  }

  return (
    <>
      {!activeAuthSession ? (
        <>
          {!startupMessage ? (
            <DashboardStartupScreen routeKey="initial-dashboard-load" />
          ) : null}
          <main
            className="dashboard-font flex min-h-dvh items-center justify-center bg-[#f5f6f8] p-6"
            aria-busy={!startupMessage}
            aria-label={startupMessage || t(statusKey)}
          >
            {startupMessage ? (
              <DashboardStartupError
                message={startupMessage}
                onRetry={() => setRetryKey((current) => current + 1)}
              />
            ) : null}
          </main>
        </>
      ) : resolveDashboardGate(activeAuthSession) === "mfa" ? (
        /**
         * Held here rather than shown a dashboard that 403s at every panel.
         *
         * The server has already decided: `resolveUserActor` refuses an `aal1`
         * request from an enrolled account, and refuses any account with no
         * factor in an organization that requires one. This branch is what
         * turns that refusal into something a person can act on. It is NOT the
         * enforcement - rendering the dashboard anyway would change nothing
         * about what the API allows.
         *
         * Above the onboarding branch on purpose. A brand-new owner in an
         * organization that mandates 2FA has to clear it before naming their
         * venue, or the setup form is a screen whose save is refused.
         */
        <MfaGate
          // `resolveDashboardGate` returned "mfa", so something is owed.
          obligation={
            activeAuthSession.mfa?.obligation === "enroll" ? "enroll" : "challenge"
          }
          onSatisfied={() => {
            // The cached session still says what was owed. Drop it and run the
            // loader again - the fresh one is what reports `satisfied`.
            clearCachedAuthSession();
            setAuthSession(null);
            setRetryKey((current) => current + 1);
          }}
          onSignOut={async () => {
            clearCachedAuthSession();
            stopRealtimeSync();
            await signOutCurrentSession().catch(() => undefined);
            router.replace(getDashboardLoginPath("/dashboard"));
          }}
        />
      ) : resolveDashboardGate(activeAuthSession) === "device" ? (
        /**
         * The third gate: password and 2FA are done, this browser is not a
         * confirmed device yet. Rendered INSTEAD of the dashboard - no
         * sidebar, no page, no data requests behind it - and the server
         * refuses this browser's data anyway (`device_confirmation_required`).
         *
         * Confirming reruns the loader exactly as clearing 2FA does: the fresh
         * session reports the device trusted, and the page underneath - the
         * one somebody was opening - renders at the same URL.
         */
        <DeviceGate
          onConfirmed={() => {
            clearCachedAuthSession();
            setAuthSession(null);
            setRetryKey((current) => current + 1);
          }}
          onSignOut={async () => {
            clearCachedAuthSession();
            stopRealtimeSync();
            await signOutCurrentSession().catch(() => undefined);
            router.replace(getDashboardLoginPath("/dashboard"));
          }}
          pendingConfirmation={Boolean(activeAuthSession.device?.pendingConfirmation)}
        />
      ) : isOnboardingRoute ? (
        // No sidebar, topbar, trial pill, or permission gate: there is no
        // workspace to navigate yet, and the owner cannot leave this form.
        children
      ) : (
        <main className="dashboard-font min-h-dvh bg-[#f5f6f8] text-[#17202a]">
          {!isKitchenRoute ? <DashboardTopbarBrand /> : null}
          <DashboardSidebar
            user={activeAuthSession.user}
            roleLabel={getProfileTitle(activeAuthSession, t)}
            profileSubtitle={getSidebarProfileSubtitle(activeAuthSession, t)}
            activeLabel={getDashboardActiveLabel(pathname)}
            forceOverlay={isKitchenRoute}
          />

          <section
            className={`dashboard-shell-main min-h-dvh ${
              isKitchenRoute
                ? `kitchen-fullscreen-shell ${isKitchenSidebarOpen ? "kitchen-sidebar-open" : ""}`
                : "lg:pl-64"
            }`}
          >
            {/* Above every screen, so it cannot be missed behind a drawer.
                Draws nothing until the last sixty seconds. */}
            <InactivityWarning onExpired={signOutForInactivity} />
            <DashboardTrialProvider authSession={activeAuthSession}>
              {canAccessDashboardRoute(pathname, activeAuthSession.permissions) ? (
                children
              ) : (
                <DashboardPageState
                  emptyMessage={t("shell.noPagePermission")}
                  emptyTitle={t("common.accessRestricted")}
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

/**
 * The startup failure card. Split out of the layout so it sits *inside*
 * `AppLanguageProvider` and can translate: the layout renders the provider,
 * so a `useAppLanguage()` call in its own body would read the default
 * English context instead.
 */
function DashboardStartupError({
  message,
  onRetry
}: {
  message: string;
  onRetry: () => void;
}) {
  const { t } = useAppLanguage();

  return (
    <section className="w-full max-w-md rounded-2xl border border-[#d8dde5] bg-white p-6 text-center shadow-sm">
      <h1 className="text-xl font-black text-[#172033]">
        {t("shell.dashboardFailed")}
      </h1>
      <p className="mt-2 text-sm leading-6 text-[#64748b]">{message}</p>
      <button
        className="mt-5 min-h-11 rounded-xl bg-[#1f557d] px-5 py-2.5 text-sm font-black text-white transition hover:bg-[#174362]"
        onClick={onRetry}
        type="button"
      >
        {t("common.tryAgain")}
      </button>
    </section>
  );
}
