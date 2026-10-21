"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import {
  clearCachedAuthSession,
  fetchAuthSession,
  type AuthSessionResponse
} from "@/lib/auth/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getDashboardLoginPath } from "@/lib/auth/redirect";
import { useAppLanguage } from "@/components/providers/app-language-provider";
import type { MessageKey } from "@/lib/i18n/messages";

export function DashboardAuthGuard() {
  const { t } = useAppLanguage();
  const router = useRouter();
  const [authSession, setAuthSession] = useState<AuthSessionResponse | null>(
    null
  );
  const [statusKey, setStatusKey] = useState<MessageKey>(
    "shell.preparingDashboard"
  );

  useEffect(() => {
    let isMounted = true;

    const returnToLogin = () => {
      clearCachedAuthSession();
      const isDesktopApp =
        window.localStorage.getItem("eventCoreDesktopApp") === "true";
      router.replace(
        isDesktopApp ? "/login?desktop=1" : getDashboardLoginPath("/dashboard")
      );
    };

    async function loadUser() {
      try {
        if (isMounted) {
          setStatusKey("shell.checkingSession");
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
          setStatusKey("shell.loadingDashboardData");
        }

        const nextSession = await fetchAuthSession(data.session.access_token);

        if (isMounted) {
          setAuthSession(nextSession);
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

  if (!authSession) {
    return (
      <main
        className="min-h-screen bg-[#f5f6f8]"
        aria-busy="true"
        aria-label={t(statusKey)}
      />
    );
  }

  return (
    <DashboardShell
      activeOrganizationId={authSession.activeOrganizationId}
      organizations={authSession.organizations}
      user={authSession.user}
    />
  );
}
