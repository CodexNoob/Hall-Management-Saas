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

export function getPasswordSetupPath(
  returnPath: string
): `/set-password?flow=required&next=${string}` {
  return `/set-password?flow=required&next=${encodeURIComponent(getSafeDashboardReturnPath(returnPath))}`;
}
