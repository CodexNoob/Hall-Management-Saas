import type { PermissionKey } from "@/lib/authz/catalog";

/**
 * Which permission a dashboard route needs, for navigation and redirects.
 *
 * KEYED BY PERMISSION, NEVER BY ROLE (INV-1). There is no administrator branch
 * here, because there is no administrator concept anywhere - a role that reaches
 * a new page is a data change, not an edit to this file.
 *
 * This is a UX layer only. The API routes remain the real enforcement boundary,
 * and every entry below mirrors the key its route's GET handler passes to
 * `authorize()`. A page reachable through a stale nav link still gets a 403 from
 * the data it tries to load.
 */

type PermissionCheck = PermissionKey | PermissionKey[];

export const dashboardRoutePermissions: Record<string, PermissionCheck> = {
  "/dashboard": ["calendar.read", "event.read"],
  "/dashboard/calendar": "calendar.read",
  "/dashboard/events": "event.read",
  "/dashboard/event-manager": "event.read",
  "/dashboard/kitchen": "kitchen.read",
  "/dashboard/menu": "menu.read",
  "/dashboard/dining-manager": "dining.read",
  "/dashboard/hall-room-map": "hallmap.read",
  "/dashboard/files": "file.read",
  "/dashboard/clients": "client.read",
  "/dashboard/client-portal": "client.read",
  "/dashboard/vendors": "vendor.read",
  "/dashboard/billing": "invoice.read",
  "/dashboard/staff": "staff.read",
  "/dashboard/access": "role.read",
  "/dashboard/settings": "settings.read"
};

const sortedDashboardRoutes = Object.keys(dashboardRoutePermissions).sort(
  (a, b) => b.length - a.length
);

export function getRequiredDashboardPermission(
  route: string | null | undefined
): PermissionCheck | null {
  if (!route) return null;

  const normalized = route.replace(/\/+$/, "") || "/dashboard";
  const match = sortedDashboardRoutes.find(
    (candidate) =>
      normalized === candidate || normalized.startsWith(`${candidate}/`)
  );

  return match ? dashboardRoutePermissions[match] : null;
}

export function canAccessDashboardRoute(
  route: string | null | undefined,
  permissions: readonly string[] | null | undefined
): boolean {
  const required = getRequiredDashboardPermission(route);
  if (!required) return true;

  const keys = Array.isArray(required) ? required : [required];

  return keys.some((key) => permissions?.includes(key) ?? false);
}
