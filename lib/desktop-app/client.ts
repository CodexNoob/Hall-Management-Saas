"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const DESKTOP_APP_STORAGE_KEY = "eventCoreDesktopApp";

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

    setIsStoredDesktopApp(hasDesktopParam || storedDesktopApp);
  }, [hasDesktopParam]);

  return useMemo(
    () => hasDesktopParam || isStoredDesktopApp,
    [hasDesktopParam, isStoredDesktopApp]
  );
}

export function getDesktopAwareAuthPath(path: "/login" | "/forgot-password") {
  if (typeof window === "undefined") return path;

  const isDesktopApp =
    window.localStorage.getItem(DESKTOP_APP_STORAGE_KEY) === "true";

  return isDesktopApp ? `${path}?desktop=1` : path;
}
