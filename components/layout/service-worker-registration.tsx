"use client";

import { useEffect } from "react";

export function AppServiceWorkerRegistration() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Install support is optional; the web app still works if registration fails.
    });
  }, []);

  return null;
}
