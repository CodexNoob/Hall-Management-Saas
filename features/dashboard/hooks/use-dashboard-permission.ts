"use client";

import { useMemo } from "react";
import { getCachedSyncedUser, type SyncedUserAccess } from "@/lib/auth/client";
import { isAdministrativeRole } from "@/lib/auth/roles";
import { canAccessDashboardRoute } from "@/lib/auth/dashboard-routes";

type PermissionCheck = keyof SyncedUserAccess | Array<keyof SyncedUserAccess>;

// Resolves the signed-in user's permission snapshot synchronously (no effect
// delay). Safe because every consumer only mounts after app/dashboard/layout.tsx
// has already synced + cached the user, so there's no flash to guard against.
export function useDashboardAccess() {
  return useMemo(() => {
    const syncData = getCachedSyncedUser();
    const membershipRole = syncData?.organizations.find(
      (organization) => organization.id === syncData.activeOrganizationId
    )?.role;

    return {
      hasPermission: (permission: PermissionCheck) =>
        isAdministrativeRole(membershipRole) ||
        (Array.isArray(permission) ? permission : [permission]).some(
          (key) => syncData?.access?.[key] === true
        ),
      canAccessRoute: (route: string) =>
        canAccessDashboardRoute(route, syncData?.access, membershipRole)
    };
  }, []);
}

export function useDashboardPermission(permission: PermissionCheck) {
  return useDashboardAccess().hasPermission(permission);
}
