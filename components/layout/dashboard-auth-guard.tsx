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
    async function loadUser() {
      try {
        if (isMounted) {
          setStatus("Checking your session...");
        }

        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.auth.getSession();

        if (error || !data.session?.access_token) {
          clearCachedSyncedUser();
          const isDesktopApp =
            window.localStorage.getItem("eventCoreDesktopApp") === "true";
          router.replace(
            isDesktopApp
              ? "/login?desktop=1"
              : getDashboardLoginPath("/dashboard")
          );
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
        clearCachedSyncedUser();
        const isDesktopApp =
          window.localStorage.getItem("eventCoreDesktopApp") === "true";
        router.replace(
          isDesktopApp
            ? "/login?desktop=1"
            : getDashboardLoginPath("/dashboard")
        );
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
