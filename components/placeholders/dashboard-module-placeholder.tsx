"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearCachedSyncedUser, getCachedSyncedUser, syncSignedInUser, type SyncSignedInUserResponse } from "@/lib/auth/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type DashboardModulePlaceholderProps = {
  title: string;
  description: string;
};

export function DashboardModulePlaceholder({ title, description }: DashboardModulePlaceholderProps) {
  const router = useRouter();
  const [syncData, setSyncData] = useState<SyncSignedInUserResponse | null>(null);

  useEffect(() => {
    let isMounted = true;
    const cachedSyncData = getCachedSyncedUser();

    if (cachedSyncData) {
      setSyncData(cachedSyncData);
    }

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
      } catch {
        if (!cachedSyncData) {
          clearCachedSyncedUser();
          router.replace("/");
        }
      }
    }

    loadUser();

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (!syncData) {
    return <main className="min-h-screen bg-[#f5f6f8]" aria-busy="true" />;
  }

  return (
    <main className="min-h-screen overflow-x-hidden text-[#17202a] [background:linear-gradient(135deg,rgba(31,77,115,0.10),transparent_34%),linear-gradient(315deg,rgba(21,52,79,0.08),transparent_32%),#f5f6f8]">
      <header className="sticky top-0 z-30 border-b border-[#d8dde5] bg-white/92 backdrop-blur-xl">
        <div className="mx-auto flex min-h-18 max-w-[1600px] items-center justify-between gap-3 px-4 py-3 sm:min-h-20 sm:px-8 lg:px-12">
          <Image src="/hms-logo-header.png?v=20260722" alt="Hall Management SaaS" width={612} height={408} priority unoptimized className="h-16 w-auto max-w-37.5 object-contain sm:h-14 sm:max-w-none lg:h-16" />
          <button
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#1f4d73] px-5 text-sm font-black text-white transition hover:bg-[#15344f]"
            type="button"
            onClick={() => router.push("/dashboard")}
          >
            Main Menu
          </button>
        </div>
      </header>

      <section className="relative px-4 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[1600px]">
          <button
            className="mb-6 inline-flex h-12 items-center justify-center rounded-2xl border border-[#d8dde5] bg-white px-5 text-sm font-black text-[#1f4d73] shadow-lg shadow-[#1f4d73]/6 transition hover:-translate-y-0.5 hover:border-[#1f4d73]"
            type="button"
            onClick={() => router.push("/dashboard")}
          >
            Back to Dashboard
          </button>

          <div className="dashboard-gradient-card overflow-hidden shadow-xl shadow-[#17202a]/8">
            <div className="relative z-1 p-6 sm:p-8 lg:p-10">
              <p className="text-sm font-black uppercase tracking-[0.28em] text-[#1f4d73]">Dashboard Module</p>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-[#17202a] sm:text-5xl">{title}</h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-[#6a7483] sm:text-lg">{description}</p>
              <div className="mt-8 rounded-3xl border border-[#d8dde5] bg-[#f5f6f8]/70 p-5 text-sm font-bold text-[#6a7483]">
                This shortcut is ready. The full {title} workspace can be connected here in the next build phase.
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
