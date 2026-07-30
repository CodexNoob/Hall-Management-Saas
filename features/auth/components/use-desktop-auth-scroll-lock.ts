"use client";

import { useEffect } from "react";

export function useDesktopAuthScrollLock(isDesktopApp: boolean) {
  useEffect(() => {
    if (!isDesktopApp) {
      return;
    }

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [isDesktopApp]);
}
