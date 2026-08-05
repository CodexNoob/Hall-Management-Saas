"use client";

import type { Provider } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type SyncedUserAccess = {
  id: string;
  userId: string;
  canViewHome: boolean;
  canViewCalendar: boolean;
  canCreateBooking: boolean;
  canViewEventManager: boolean;
  canViewKitchenDashboard: boolean;
  canViewMenu: boolean;
  canEditMenu: boolean;
  canViewSettings: boolean;
  canEditSettings: boolean;
  canEditStaff: boolean;
  canEditVendors: boolean;
  canEditClients: boolean;
  canEditFiles: boolean;
  canAssignWorkers: boolean;
  canUpdateKitchenStatus: boolean;
  canAddKitchenEvents: boolean;
  canManageSchoolSchedule: boolean;
  canSeeSchoolEvents: boolean;
  canSeeSimchaEvents: boolean;
  canViewPaymentInfo: boolean;
  canManagePayments: boolean;
  canSendPaymentEmail: boolean;
  canUseNiceHomeBackground: boolean;
  allowedHallIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type SyncedUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  venueName: string | null;
  role: string;
  organizationId: string;
};

export type SyncedOrganization = {
  id: string;
  name: string;
  slug: string;
  role: string;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  subscriptionStatus: string;
  subscriptionPlan: string | null;
  subscriptionStartedAt: string | null;
  subscriptionEndsAt: string | null;
};

export type SyncSignedInUserResponse = {
  user: SyncedUser;
  access: SyncedUserAccess;
  activeOrganizationId: string;
  organizations: SyncedOrganization[];
};

const SYNCED_USER_CACHE_KEY = "hms.syncedUser";
const SYNCED_USER_CACHE_SUBJECT_KEY = "hms.syncedUser.subject";
const SYNCED_USER_CACHE_TIME_KEY = "hms.syncedUser.syncedAt";
const SYNC_TIMEOUT_MS = 12000;
const SYNC_CACHE_MAX_AGE_MS = 5 * 60 * 1000;

let syncInFlight: {
  subject: string | null;
  promise: Promise<SyncSignedInUserResponse>;
} | null = null;

function getAccessTokenSubject(accessToken: string) {
  try {
    const encodedPayload = accessToken.split(".")[1];
    if (!encodedPayload) return null;

    const normalizedPayload = encodedPayload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(encodedPayload.length / 4) * 4, "=");
    const payload = JSON.parse(window.atob(normalizedPayload)) as {
      sub?: unknown;
    };

    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

function isSyncSignedInUserResponse(
  value: unknown
): value is SyncSignedInUserResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<SyncSignedInUserResponse>;
  return Boolean(
    payload.user &&
    payload.access &&
    typeof payload.user === "object" &&
    typeof payload.access === "object" &&
    typeof payload.activeOrganizationId === "string" &&
    Array.isArray(payload.organizations)
  );
}

export function cacheSyncedUser(
  syncData: SyncSignedInUserResponse,
  subject?: string | null
) {
  if (typeof window === "undefined") {
    return;
  }

  const payload = JSON.stringify(syncData);
  window.localStorage.setItem(SYNCED_USER_CACHE_KEY, payload);
  window.sessionStorage.setItem(SYNCED_USER_CACHE_KEY, payload);
  window.localStorage.setItem(SYNCED_USER_CACHE_TIME_KEY, String(Date.now()));

  if (subject) {
    window.localStorage.setItem(SYNCED_USER_CACHE_SUBJECT_KEY, subject);
  }
}

export function setActiveOrganization(organizationId: string) {
  const syncData = getCachedSyncedUser();

  if (
    !syncData?.organizations.some(
      (organization) => organization.id === organizationId
    )
  ) {
    throw new Error("You do not have access to that organization.");
  }

  cacheSyncedUser({ ...syncData, activeOrganizationId: organizationId });
}

export function getCachedSyncedUser() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawSyncData =
    window.localStorage.getItem(SYNCED_USER_CACHE_KEY) ??
    window.sessionStorage.getItem(SYNCED_USER_CACHE_KEY);

  if (!rawSyncData) {
    return null;
  }

  try {
    const syncData = JSON.parse(rawSyncData) as unknown;
    return isSyncSignedInUserResponse(syncData) ? syncData : null;
  } catch {
    window.sessionStorage.removeItem(SYNCED_USER_CACHE_KEY);
    return null;
  }
}

export function clearCachedSyncedUser() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SYNCED_USER_CACHE_KEY);
  window.sessionStorage.removeItem(SYNCED_USER_CACHE_KEY);
  window.localStorage.removeItem(SYNCED_USER_CACHE_SUBJECT_KEY);
  window.localStorage.removeItem(SYNCED_USER_CACHE_TIME_KEY);
}

export function syncSignedInUser(
  accessToken: string,
  options: { force?: boolean } = {}
) {
  const subject = getAccessTokenSubject(accessToken);
  const cachedUser = getCachedSyncedUser();
  const cachedSubject = window.localStorage.getItem(
    SYNCED_USER_CACHE_SUBJECT_KEY
  );
  const cachedAt = Number(
    window.localStorage.getItem(SYNCED_USER_CACHE_TIME_KEY) ?? 0
  );
  const cacheIsFresh =
    cachedAt > 0 && Date.now() - cachedAt < SYNC_CACHE_MAX_AGE_MS;

  if (
    !options.force &&
    cachedUser &&
    cacheIsFresh &&
    subject &&
    cachedSubject === subject
  ) {
    return Promise.resolve(cachedUser);
  }

  if (syncInFlight && syncInFlight.subject === subject) {
    return syncInFlight.promise;
  }

  const promise = (async () => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      SYNC_TIMEOUT_MS
    );

    const response = await fetch("/api/auth/sync-user", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }).finally(() => window.clearTimeout(timeoutId));

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(
        payload?.error ??
          "Unable to sync the signed-in user with the Hall Management database."
      );
    }

    const syncData = (await response.json()) as SyncSignedInUserResponse;
    cacheSyncedUser(syncData, subject);
    return syncData;
  })();

  syncInFlight = { subject, promise };
  const clearInFlight = () => {
    if (syncInFlight?.promise === promise) {
      syncInFlight = null;
    }
  };
  void promise.then(clearInFlight, clearInFlight);

  return promise;
}

export async function signInWithOAuthProvider(
  provider: Extract<Provider, "google" | "azure">,
  returnPath = "/dashboard"
) {
  const supabase = createSupabaseBrowserClient();
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnPath)}`;

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo
    }
  });

  if (error) {
    throw error;
  }
}
