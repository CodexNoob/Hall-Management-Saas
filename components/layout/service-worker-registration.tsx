"use client";

import { useEffect } from "react";

export function AppServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister()))
      )
      .catch(() => {
        // The web app still works if an old browser blocks service-worker cleanup.
      });

    if ("caches" in window) {
      window.caches
        .keys()
        .then((keys) => Promise.all(keys.map((key) => window.caches.delete(key))))
        .catch(() => {
          // Cache cleanup is best-effort only.
        });
    }
  }, []);

  return null;
}
