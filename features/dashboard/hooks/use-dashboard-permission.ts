"use client";

import { useMemo } from "react";
import { getCachedAuthSession, type SessionUserAccess } from "@/lib/auth/client";
import { isAdministrativeRole } from "@/lib/auth/roles";
import { canAccessDashboardRoute } from "@/lib/auth/dashboard-routes";

type PermissionCheck = keyof SessionUserAccess | Array<keyof SessionUserAccess>;

// Resolves the signed-in user's permission snapshot synchronously (no effect
// delay). Safe because every consumer only mounts after app/dashboard/layout.tsx
// has already fetched + cached the session, so there's no flash to guard against.
export function useDashboardAccess() {
  return useMemo(() => {
    const authSession = getCachedAuthSession();
    const membershipRole = authSession?.organizations.find(
      (organization) => organization.id === authSession.activeOrganizationId
    )?.role;

    return {
      hasPermission: (permission: PermissionCheck) =>
        isAdministrativeRole(membershipRole) ||
        (Array.isArray(permission) ? permission : [permission]).some(
          (key) => authSession?.access?.[key] === true
        ),
      canAccessRoute: (route: string) =>
        canAccessDashboardRoute(route, authSession?.access, membershipRole)
    };
  }, []);
}

export function useDashboardPermission(permission: PermissionCheck) {
  return useDashboardAccess().hasPermission(permission);
}
