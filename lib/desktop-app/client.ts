"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DESKTOP_APP_COOKIE } from "@/lib/supabase/cookie-policy";

const DESKTOP_APP_STORAGE_KEY = "eventCoreDesktopApp";
const DESKTOP_APP_COOKIE_MAX_AGE_S = 400 * 24 * 60 * 60;

/**
 * proxy.ts runs before any client code and cannot read localStorage, so the
 * flag has to exist as a cookie too or the desktop shell gets bounced to the
 * web sign-in page instead of /login?desktop=1.
 */
function mirrorDesktopModeToCookie(isDesktopApp: boolean) {
  if (typeof document === "undefined") return;

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const maxAge = isDesktopApp ? DESKTOP_APP_COOKIE_MAX_AGE_S : 0;

  document.cookie = `${DESKTOP_APP_COOKIE}=${isDesktopApp}; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function useDesktopAppMode() {
  const searchParams = useSearchParams();
  const hasDesktopParam = searchParams.get("desktop") === "1";
  const [isStoredDesktopApp, setIsStoredDesktopApp] = useState(() => {
    if (typeof window === "undefined") return false;

    return (
      hasDesktopParam ||
      window.localStorage.getItem(DESKTOP_APP_STORAGE_KEY) === "true"
    );
  });

  useEffect(() => {
    const storedDesktopApp =
      window.localStorage.getItem(DESKTOP_APP_STORAGE_KEY) === "true";

    if (hasDesktopParam && !storedDesktopApp) {
      window.localStorage.setItem(DESKTOP_APP_STORAGE_KEY, "true");
    }

    const isDesktopApp = hasDesktopParam || storedDesktopApp;

    mirrorDesktopModeToCookie(isDesktopApp);
    setIsStoredDesktopApp(isDesktopApp);
  }, [hasDesktopParam]);

  return useMemo(
    () => hasDesktopParam || isStoredDesktopApp,
    [hasDesktopParam, isStoredDesktopApp]
  );
}

export function getDesktopAwareAuthPath(
  path: "/login" | "/forgot-password" | "/set-password"
) {
  if (typeof window === "undefined") return path;

  const isDesktopApp =
    window.localStorage.getItem(DESKTOP_APP_STORAGE_KEY) === "true";

  return isDesktopApp ? `${path}?desktop=1` : path;
}
