"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  getAuthSessionServerSnapshot,
  getAuthSessionSnapshot,
  subscribeToAuthSession
} from "@/lib/auth/client";
import type { PermissionKey } from "@/lib/authz/catalog";
import { canAccessDashboardRoute } from "@/lib/auth/dashboard-routes";
import type { ScopeFilter } from "@/lib/authz/types";

/**
 * The browser reads KEYS, never roles (INV-1).
 *
 * There is no client-side administrator branch, because there is no
 * administrator concept on the client - or anywhere else. `useAccess` is the
 * whole API.
 *
 * CLIENT HINTS ARE FOR RENDERING ONLY. Every mutation re-decides server-side. A
 * hidden button is a courtesy; the 403 is the control. Nothing here may ever be
 * the last thing standing between a caller and a write.
 *
 * Resolves synchronously from the subscribed session, with no effect delay -
 * and re-renders when that session changes, so a permission granted while
 * somebody is looking at the screen reaches them without a sign-out. Safe
 * because every consumer mounts after app/dashboard/layout.tsx has fetched and
 * cached it, so there is no flash to guard against.
 */

type PermissionCheck = PermissionKey | PermissionKey[];

export type DashboardAccess = {
  /** True when the signed-in principal holds the key - or any of several. */
  hasPermission: (permission: PermissionCheck) => boolean;
  /** True when they hold every one of them. */
  hasEveryPermission: (permissions: PermissionCheck) => boolean;
  canAccessRoute: (route: string) => boolean;
  /** The rendering hint. Never a decision - see `AuthSessionResponse.scope`. */
  scope: ScopeFilter;
  permissions: readonly PermissionKey[];
  /** The epoch these hints were computed under. */
  epoch: number;
};

/**
 * The signed-in session, as a reactive value.
 *
 * `useSyncExternalStore` rather than state-plus-effect: the cache is written
 * from places that are not components - the fetch wrapper's epoch check, the
 * realtime invalidation, the session sync - and this is React's own way of
 * reading a store like that without tearing during a concurrent render.
 */
export function useAuthSession() {
  return useSyncExternalStore(
    subscribeToAuthSession,
    getAuthSessionSnapshot,
    getAuthSessionServerSnapshot
  );
}

export function useDashboardAccess(): DashboardAccess {
  /*
   * WAS `useMemo(..., [])`, AND THAT WAS THE BUG.
   *
   * An empty dependency array meant this read the cached session once at mount
   * and never again. An administrator could grant a role, the session could
   * refetch correctly, the new permissions could land in storage - and every
   * component asking this hook would keep answering from what it read when it
   * mounted. Signing out and back in was the only way to see a new permission,
   * because only a fresh mount re-read the cache.
   *
   * The session is now subscribed to, so the dependency is the session itself.
   */
  const authSession = useAuthSession();

  return useMemo(() => {
    const permissions = authSession?.permissions ?? [];
    const held = new Set<string>(permissions);

    const asList = (permission: PermissionCheck) =>
      Array.isArray(permission) ? permission : [permission];

    return {
      hasPermission: (permission) =>
        asList(permission).some((key) => held.has(key)),
      hasEveryPermission: (permission) =>
        asList(permission).every((key) => held.has(key)),
      canAccessRoute: (route) => canAccessDashboardRoute(route, permissions),
      scope: authSession?.scope ?? { hallIds: "all", eventTypeIds: "all" },
      permissions,
      epoch: authSession?.epoch ?? 0
    };
  }, [authSession]);
}

/**
 * The one call site shape the whole client uses.
 *
 * `useAccess("event.create")` replaces every role check that used to be written
 * by hand. Passing an array means "any of these", which is what a page gated on
 * two different reads needs.
 */
export function useAccess(permission: PermissionCheck): boolean {
  return useDashboardAccess().hasPermission(permission);
}

/** Kept as the previous name so the existing call sites read unchanged. */
export const useDashboardPermission = useAccess;
