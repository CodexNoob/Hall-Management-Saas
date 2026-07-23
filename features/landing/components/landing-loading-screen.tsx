"use client";

import { DashboardLoadingIndicator } from "@/components/ui/dashboard-loading-indicator";
import { useEffect, useState } from "react";

export function LandingLoadingScreen() {
  const [isMounted, setIsMounted] = useState(true);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const hideTimer = window.setTimeout(() => setIsVisible(false), 450);
    const removeTimer = window.setTimeout(() => setIsMounted(false), 750);

    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (!isMounted) return null;

  return (
    <div
      aria-label="Loading website"
      aria-live="polite"
      className={`fixed inset-0 z-2000 flex items-center justify-center bg-[#f5f6f8] transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      role="status"
    >
      <DashboardLoadingIndicator />
      <span className="sr-only">Loading website…</span>
    </div>
  );
}
