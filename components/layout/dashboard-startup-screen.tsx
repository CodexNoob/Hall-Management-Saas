"use client";

import { DashboardLoadingIndicator } from "@/components/ui/dashboard-loading-indicator";
import { useEffect, useRef, useState } from "react";

const MINIMUM_VISIBLE_MS = 350;
const MAXIMUM_VISIBLE_MS = 12_000;

export function DashboardStartupScreen({ routeKey }: { routeKey: string }) {
  const [isMounted, setIsMounted] = useState(true);
  const [isVisible, setIsVisible] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(true);
  const hasLoadedInitialRoute = useRef(false);

  useEffect(() => {
    setIsFullScreen(!hasLoadedInitialRoute.current);
    hasLoadedInitialRoute.current = true;
    setIsMounted(true);
    setIsVisible(true);

    let minimumElapsed = false;
    let settleTimer: number | undefined;
    let removeTimer: number | undefined;

    const finish = () => {
      if (!minimumElapsed || document.querySelector('[aria-busy="true"]')) {
        return;
      }

      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        setIsVisible(false);
        removeTimer = window.setTimeout(() => setIsMounted(false), 300);
      }, 100);
    };

    const observer = new MutationObserver(finish);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["aria-busy"],
      childList: true,
      subtree: true
    });

    const minimumTimer = window.setTimeout(() => {
      minimumElapsed = true;
      finish();
    }, MINIMUM_VISIBLE_MS);

    const maximumTimer = window.setTimeout(() => {
      setIsVisible(false);
      removeTimer = window.setTimeout(() => setIsMounted(false), 300);
    }, MAXIMUM_VISIBLE_MS);

    window.requestAnimationFrame(() => window.requestAnimationFrame(finish));

    return () => {
      observer.disconnect();
      window.clearTimeout(minimumTimer);
      window.clearTimeout(maximumTimer);
      window.clearTimeout(settleTimer);
      window.clearTimeout(removeTimer);
    };
  }, [routeKey]);

  if (!isMounted) return null;

  return (
    <div
      aria-label="Loading dashboard"
      aria-live="polite"
      className={`flex items-center justify-center bg-[#f5f6f8] transition-opacity duration-300 ${
        isFullScreen
          ? "fixed inset-0 z-2000"
          : "dashboard-route-loading-screen fixed bottom-0 right-0 top-15 z-35 lg:top-20"
      } ${
        isVisible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      role="status"
    >
      <DashboardLoadingIndicator />
      <span className="sr-only">Loading dashboard…</span>
    </div>
  );
}
