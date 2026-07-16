"use client";

import { useEffect, useState } from "react";
import { getCachedSyncedUser, type SyncedUserAccess } from "@/lib/auth/client";
import { isAdministrativeRole } from "@/lib/auth/roles";

export function useDashboardPermission(permission: keyof SyncedUserAccess) {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const syncData = getCachedSyncedUser();
    const membershipRole = syncData?.organizations.find(
      (organization) => organization.id === syncData.activeOrganizationId
    )?.role;
    setAllowed(
      isAdministrativeRole(membershipRole) ||
        syncData?.access?.[permission] === true
    );
  }, [permission]);

  return allowed;
}
