import {
  MVP_LANDING_ROUTE,
  isHiddenDashboardRoute
} from "@/lib/ui/mvp-features";

export type DashboardReturnPath = "/dashboard" | `/dashboard${string}`;

export function getSafeDashboardReturnPath(
  value: string | null | undefined
): DashboardReturnPath {
  // Not just the fallback for a missing or unsafe path: a `next=` pointing at a
  // module the MVP hides is answered with the landing page too, so a bookmarked
  // login link cannot walk a user into a page that would redirect them out
  // again. See lib/ui/mvp-features.
  const landing = MVP_LANDING_ROUTE as DashboardReturnPath;

  if (!value) return landing;

  const path = value.trim();
  if (!path.startsWith("/dashboard") || path.startsWith("//")) {
    return landing;
  }

  try {
    const url = new URL(path, "https://event-core.local");
    if (url.origin !== "https://event-core.local") return landing;
    if (isHiddenDashboardRoute(url.pathname)) return landing;
    return `${url.pathname}${url.search}${url.hash}` as DashboardReturnPath;
  } catch {
    return landing;
  }
}

export function getDashboardLoginPath(
  returnPath: string
): `/login?next=${string}` {
  return `/login?next=${encodeURIComponent(getSafeDashboardReturnPath(returnPath))}`;
}

/**
 * Where an account we refused is sent, once its Supabase session has been ended.
 *
 * Deliberately carries a `reason` CODE and never the server's prose. The value
 * is attacker-supplied by the time the login page reads it back - anyone can
 * type a `?reason=` - so it is mapped through a fixed table there, and an
 * unrecognized code shows nothing at all. `next` is dropped on purpose: the
 * destination is what was just refused.
 */
export function getRejectedLoginPath(
  reason: string | undefined,
  isDesktopApp: boolean
): `/login${string}` {
  const params = new URLSearchParams();

  if (isDesktopApp) params.set("desktop", "1");
  if (reason) params.set("reason", reason);

  const query = params.toString();

  return query ? `/login?${query}` : "/login";
}

/**
 * The page a beta applicant is shown, instead of a sign-in error.
 *
 * A refused applicant is not somebody who mistyped a password, and a login form
 * with a red message on it says the wrong thing entirely - they have no action
 * to take there. This is a page about the beta, and it is where both entry
 * points send them: the sign-up form after registering, and the session sync
 * after refusing.
 *
 * Carries a STATUS CODE and never the server's prose, for the same reason
 * `getRejectedLoginPath` does: by the time the page reads it back it is
 * attacker-supplied - anyone can type a `?status=` - so it is mapped through a
 * fixed table there, and anything unrecognized renders the pending copy, which
 * is the variant that says less.
 */
export function getBetaPendingPath(
  code: string | undefined
): `/beta-pending${string}` {
  return code === "beta_access_rejected"
    ? "/beta-pending?status=rejected"
    : "/beta-pending";
}

/** Whether this refusal is one the beta page explains better than /login does. */
export function isBetaAccessCode(code: string | undefined) {
  return code === "beta_access_pending" || code === "beta_access_rejected";
}

export function getPasswordSetupPath(
  returnPath: string
): `/set-password?flow=required&next=${string}` {
  return `/set-password?flow=required&next=${encodeURIComponent(getSafeDashboardReturnPath(returnPath))}`;
}
