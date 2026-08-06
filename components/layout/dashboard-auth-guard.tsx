"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import {
  clearCachedSyncedUser,
  syncSignedInUser,
  type SyncSignedInUserResponse
} from "@/lib/auth/client";
import {
  createSupabaseBrowserClient,
  isRememberedAuthSessionExpired
} from "@/lib/supabase/browser";
import { getDashboardLoginPath } from "@/lib/auth/redirect";

export function DashboardAuthGuard() {
  const router = useRouter();
  const [syncData, setSyncData] = useState<SyncSignedInUserResponse | null>(
    null
  );
  const [status, setStatus] = useState("Preparing your dashboard...");

  useEffect(() => {
    let isMounted = true;
    let expirationCheck: number | null = null;

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

        const supabase = createSupabaseBrowserClient();
        if (isRememberedAuthSessionExpired()) {
          await supabase.auth.signOut({ scope: "local" });
          returnToLogin();
          return;
        }
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
        expirationCheck = window.setInterval(async () => {
          if (!isRememberedAuthSessionExpired()) return;
          await supabase.auth.signOut({ scope: "local" });
          if (isMounted) returnToLogin();
        }, 60_000);
      } catch {
        returnToLogin();
      }
    }

    loadUser();

    return () => {
      isMounted = false;
      if (expirationCheck) window.clearInterval(expirationCheck);
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
