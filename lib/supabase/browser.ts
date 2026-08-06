"use client";

import { createClient } from "@supabase/supabase-js";

let browserClient: ReturnType<typeof createClient> | null = null;
const REMEMBER_AUTH_KEY = "event-core.auth.remember";
const REMEMBER_AUTH_UNTIL_KEY = "event-core.auth.rememberUntil";
export const REMEMBER_AUTH_DAYS = 30;
const REMEMBER_AUTH_DURATION_MS = REMEMBER_AUTH_DAYS * 24 * 60 * 60 * 1000;

function isSupabaseAuthStorageKey(key: string) {
  return key.startsWith("sb-") && key.endsWith("-auth-token");
}

function shouldPersistAuthSession() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(REMEMBER_AUTH_KEY) !== "false";
}

export function isRememberedAuthSessionExpired() {
  if (typeof window === "undefined") return false;
  if (window.localStorage.getItem(REMEMBER_AUTH_KEY) !== "true") return false;
  const expiresAt = Number(
    window.localStorage.getItem(REMEMBER_AUTH_UNTIL_KEY)
  );
  return Number.isFinite(expiresAt) && expiresAt > 0 && Date.now() >= expiresAt;
}

const adaptiveAuthStorage = {
  getItem(key: string) {
    if (typeof window === "undefined") return null;
    if (isSupabaseAuthStorageKey(key) && isRememberedAuthSessionExpired()) {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
      return null;
    }
    const primary = shouldPersistAuthSession()
      ? window.localStorage
      : window.sessionStorage;
    const fallback = shouldPersistAuthSession()
      ? window.sessionStorage
      : window.localStorage;
    return primary.getItem(key) ?? fallback.getItem(key);
  },
  setItem(key: string, value: string) {
    if (typeof window === "undefined") return;
    const primary = shouldPersistAuthSession()
      ? window.localStorage
      : window.sessionStorage;
    const fallback = shouldPersistAuthSession()
      ? window.sessionStorage
      : window.localStorage;
    primary.setItem(key, value);
    fallback.removeItem(key);
  },
  removeItem(key: string) {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  }
};

export function setAuthSessionPersistence(remember: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REMEMBER_AUTH_KEY, String(remember));
  if (remember) {
    window.localStorage.setItem(
      REMEMBER_AUTH_UNTIL_KEY,
      String(Date.now() + REMEMBER_AUTH_DURATION_MS)
    );
  } else {
    window.localStorage.removeItem(REMEMBER_AUTH_UNTIL_KEY);
  }

  const source = remember ? window.sessionStorage : window.localStorage;
  const destination = remember ? window.localStorage : window.sessionStorage;
  const authKeys = Array.from({ length: source.length }, (_, index) =>
    source.key(index)
  ).filter((key): key is string =>
    Boolean(key && isSupabaseAuthStorageKey(key))
  );

  authKeys.forEach((key) => {
    const value = source.getItem(key);
    if (value !== null) destination.setItem(key, value);
    source.removeItem(key);
  });
}

function getSupabaseBrowserConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment."
    );
  }

  return { supabaseUrl, supabaseAnonKey };
}

export function createSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  const { supabaseUrl, supabaseAnonKey } = getSupabaseBrowserConfig();

  browserClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: adaptiveAuthStorage
    }
  });

  return browserClient;
}
