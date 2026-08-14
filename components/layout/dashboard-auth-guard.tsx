"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import {
  clearCachedSyncedUser,
  syncSignedInUser,
  type SyncSignedInUserResponse
} from "@/lib/auth/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getDashboardLoginPath } from "@/lib/auth/redirect";

export function DashboardAuthGuard() {
  const router = useRouter();
  const [syncData, setSyncData] = useState<SyncSignedInUserResponse | null>(
    null
  );
  const [status, setStatus] = useState("Preparing your dashboard...");

  useEffect(() => {
    let isMounted = true;

    const returnToLogin = () => {
      clearCachedSyncedUser();
      const isDesktopApp =
        window.localStorage.getItem("eventCoreDesktopApp") === "true";
      router.replace(
        isDesktopApp ? "/login?desktop=1" : getDashboardLoginPath("/dashboard")
      );
    };

    async function loadUser() {
      try {
        if (isMounted) {
          setStatus("Checking your session...");
        }

        // The 30-day "Remember me" ceiling used to be enforced here and by a
        // 60-second interval below. Both are gone: proxy.ts checks the window
        // on every navigation, before this component ever mounts, and the auth
        // cookie's own Max-Age is set to the remaining window so the browser
        // drops it at the deadline regardless.
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.auth.getSession();

        if (error || !data.session?.access_token) {
          returnToLogin();
          return;
        }

        if (isMounted) {
          setStatus("Loading dashboard data...");
        }

        const synced = await syncSignedInUser(data.session.access_token);

        if (isMounted) {
          setSyncData(synced);
        }
      } catch {
        returnToLogin();
      }
    }

    loadUser();

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (!syncData) {
    return (
      <main
        className="min-h-screen bg-[#f5f6f8]"
        aria-busy="true"
        aria-label={status}
      />
    );
  }

  return (
    <DashboardShell
      access={syncData.access}
      activeOrganizationId={syncData.activeOrganizationId}
      organizations={syncData.organizations}
      user={syncData.user}
    />
  );
}
