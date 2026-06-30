"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { clearCachedSyncedUser, getCachedSyncedUser, syncSignedInUser, type SyncSignedInUserResponse } from "@/lib/auth/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function DashboardAuthGuard() {
  const router = useRouter();
  const [syncData, setSyncData] = useState<SyncSignedInUserResponse | null>(() => getCachedSyncedUser());
  const [status, setStatus] = useState("Preparing your dashboard...");

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.auth.getSession();

        if (error || !data.session?.access_token) {
          clearCachedSyncedUser();
          router.replace("/");
          return;
        }

        const synced = await syncSignedInUser(data.session.access_token);

        if (isMounted) {
          setSyncData(synced);
        }
      } catch (error) {
        clearCachedSyncedUser();

        if (isMounted) {
          setStatus(error instanceof Error ? error.message : "Unable to load dashboard.");
        }

        router.replace("/");
      }
    }

    loadUser();

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (!syncData) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7F4ED] px-6 text-center text-[#0F172A]">
        <section className="border border-[#E5E0D6] bg-white p-8 shadow-xl shadow-[#B9974D]/10">
          <h1 className="text-2xl font-black">Hall Management SaaS</h1>
          <p className="mt-4 font-semibold text-[#64748B]">{status}</p>
        </section>
      </main>
    );
  }

  return <DashboardShell access={syncData.access} user={syncData.user} />;
}
