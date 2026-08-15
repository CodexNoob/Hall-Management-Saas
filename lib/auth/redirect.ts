export type DashboardReturnPath = "/dashboard" | `/dashboard${string}`;

export function getSafeDashboardReturnPath(
  value: string | null | undefined
): DashboardReturnPath {
  if (!value) return "/dashboard";

  const path = value.trim();
  if (!path.startsWith("/dashboard") || path.startsWith("//")) {
    return "/dashboard";
  }

  try {
    const url = new URL(path, "https://event-core.local");
    if (url.origin !== "https://event-core.local") return "/dashboard";
    return `${url.pathname}${url.search}${url.hash}` as DashboardReturnPath;
  } catch {
    return "/dashboard";
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
