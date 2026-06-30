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
  canAssignWorkers: boolean;
  canUpdateKitchenStatus: boolean;
  canAddKitchenEvents: boolean;
  canManageSchoolSchedule: boolean;
  canSeeSchoolEvents: boolean;
  canSeeSimchaEvents: boolean;
  canViewPaymentInfo: boolean;
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
};

export type SyncSignedInUserResponse = {
  user: SyncedUser;
  access: SyncedUserAccess;
};

const SYNCED_USER_CACHE_KEY = "hms.syncedUser";

function isSyncSignedInUserResponse(value: unknown): value is SyncSignedInUserResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<SyncSignedInUserResponse>;
  return Boolean(payload.user && payload.access && typeof payload.user === "object" && typeof payload.access === "object");
}

export function cacheSyncedUser(syncData: SyncSignedInUserResponse) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(SYNCED_USER_CACHE_KEY, JSON.stringify(syncData));
}

export function getCachedSyncedUser() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawSyncData = window.sessionStorage.getItem(SYNCED_USER_CACHE_KEY);

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

  window.sessionStorage.removeItem(SYNCED_USER_CACHE_KEY);
}

export async function syncSignedInUser(accessToken: string) {
  const response = await fetch("/api/auth/sync-user", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Unable to sync the signed-in user with the Hall Management database.");
  }

  const syncData = (await response.json()) as SyncSignedInUserResponse;
  cacheSyncedUser(syncData);

  return syncData;
}

export async function signInWithOAuthProvider(provider: Extract<Provider, "google" | "azure">) {
  const supabase = createSupabaseBrowserClient();
  const redirectTo = `${window.location.origin}/auth/callback`;

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
