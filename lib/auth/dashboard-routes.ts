import type { AccessPermissionKey } from "@/lib/auth/permissions";
import { isAdministrativeRole } from "@/lib/auth/roles";

type PermissionCheck = AccessPermissionKey | AccessPermissionKey[];

// Mirrors each route's GET requirePermission/requireAnyPermission call
// (see app/api/**/route.ts and features/administration/server/staff-route-handlers.ts).
// This is a UX layer only - the API routes remain the real enforcement boundary.
export const dashboardRoutePermissions: Record<string, PermissionCheck> = {
  "/dashboard": ["canViewCalendar", "canViewEventManager"],
  "/dashboard/calendar": ["canViewCalendar", "canViewEventManager"],
  "/dashboard/events": ["canViewCalendar", "canViewEventManager"],
  "/dashboard/event-manager": ["canViewCalendar", "canViewEventManager"],
  "/dashboard/kitchen": "canViewKitchenDashboard",
  "/dashboard/menu": "canViewMenu",
  "/dashboard/dining-manager": ["canViewEventManager", "canViewKitchenDashboard"],
  "/dashboard/hall-room-map": ["canViewEventManager", "canViewCalendar"],
  "/dashboard/files": "canViewEventManager",
  "/dashboard/clients": [
    "canViewEventManager",
    "canViewCalendar",
    "canViewPaymentInfo"
  ],
  "/dashboard/client-portal": [
    "canViewEventManager",
    "canViewCalendar",
    "canViewPaymentInfo"
  ],
  "/dashboard/vendors": ["canViewEventManager", "canViewSettings"],
  "/dashboard/billing": "canViewPaymentInfo",
  "/dashboard/staff": ["canEditStaff", "canViewSettings", "canEditSettings"],
  "/dashboard/settings": "canViewSettings"
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
  access: Partial<Record<AccessPermissionKey, unknown>> | null | undefined,
  membershipRole: string | null | undefined
): boolean {
  if (isAdministrativeRole(membershipRole)) return true;

  const permission = getRequiredDashboardPermission(route);
  if (!permission) return true;

  const required = Array.isArray(permission) ? permission : [permission];
  return required.some((key) => access?.[key] === true);
}
