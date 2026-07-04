"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import { clearCachedSyncedUser, getCachedSyncedUser, syncSignedInUser, type SyncSignedInUserResponse } from "@/lib/auth/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type IconName = "home" | "bell" | "help" | "grid" | "chevron" | "plus" | "serving" | "users" | "leaf" | "edit" | "trash";

function formatRole(role: string) {
  return role
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function LineIcon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  };

  const paths: Record<IconName, ReactNode> = {
    home: <path d="M4 11 12 4l8 7v9h-5v-6H9v6H4Z" />,
    bell: <><path d="M6 10a6 6 0 0 1 12 0v5l2 3H4l2-3Z" /><path d="M10 21h4" /></>,
    help: <><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" /><path d="M9.8 9a2.4 2.4 0 0 1 4.4 1.3c0 1.8-2.2 2-2.2 3.7M12 17h.01" /></>,
    grid: <><path d="M4 4h6v6H4ZM14 4h6v6h-6ZM4 14h6v6H4ZM14 14h6v6h-6Z" /></>,
    chevron: <path d="m6 9 6 6 6-6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    serving: <><path d="M5 17h14" /><path d="M7 17a5 5 0 0 1 10 0" /><path d="M12 8v2" /><path d="M8.5 6.5c1.4 1.3-.8 2.4.7 3.7M12 5.5c1.4 1.3-.8 2.4.7 3.7M15.5 6.5c1.4 1.3-.8 2.4.7 3.7" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9" /></>,
    leaf: <><path d="M20 5c-7.5 0-12 4.5-12 12" /><path d="M20 5c0 7.5-4.5 12-12 12" /><path d="M8 17c-2.5-2.5-2.5-6 0-8s6-2.5 8 0" /></>,
    edit: <><path d="m14 5 5 5L9 20H4v-5Z" /><path d="m12 7 5 5" /></>,
    trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></>
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function MenuBadge({ icon, label, tone }: { icon: "users" | "leaf"; label: string; tone: "blue" | "green" }) {
  const classes = {
    blue: "border-[#BBD7FF] bg-[#EEF7FF] text-[#1D6BFF]",
    green: "border-[#A7F3D0] bg-[#ECFDF5] text-[#027A48]"
  };

  return (
    <span className={`inline-flex h-11 items-center gap-2 rounded-xl border px-5 text-sm font-black ${classes[tone]}`}>
      <LineIcon name={icon} className="h-5 w-5" />
      {label}
    </span>
  );
}

function ActionButton({ icon, label, tone }: { icon: "edit" | "trash"; label: string; tone: "outline" | "danger" }) {
  const classes = {
    outline: "border-[#0F172A]/35 bg-white text-[#0F172A] hover:bg-[#F7F4ED]",
    danger: "border-[#FCA5A5] bg-white text-[#DC2626] hover:bg-[#FEF2F2]"
  };

  return (
    <button className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl border px-5 text-sm font-black transition hover:-translate-y-0.5 ${classes[tone]}`} type="button">
      <LineIcon name={icon} className="h-5 w-5" />
      {label}
    </button>
  );
}

const tabs = ["Menu Items", "Packages", "Add-ons", "Hall Menu Items"];

export function MenuPage() {
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
    return <main className="min-h-screen bg-[#F7F4ED]" aria-busy="true" />;
  }

  const user = syncData.user;
  const roleLabel = formatRole(user.role);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F7F4ED] text-[#0F172A]">
      <DashboardSidebar user={user} roleLabel={roleLabel} activeLabel="Menu" />

      <section className="dashboard-shell-main min-h-screen lg:pl-70">
        <DashboardTopbar
          title="Menu"
        />

        <section className="relative overflow-hidden px-4 py-8 sm:px-8 lg:px-12">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-linear-to-b from-[#E7E3DA]/70 to-transparent" />
        <svg className="pointer-events-none absolute right-0 top-0 hidden h-96 w-180 max-w-full text-[#B9974D]/20 sm:block" viewBox="0 0 720 360" fill="none" aria-hidden="true">
          {Array.from({ length: 9 }).map((_, index) => (
            <path key={index} d={`M0 ${90 + index * 22}c142-90 242 44 384-46 128-80 214-30 336-98`} stroke="currentColor" />
          ))}
        </svg>

        <div className="relative mx-auto max-w-[1600px]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-black uppercase tracking-[0.32em] text-[#B9974D]">Route / Menu</p>
              <p className="mt-5 max-w-5xl text-base leading-8 text-[#64748B] sm:text-lg">
                Menu, packages, add-ons, and hall menu permissions can be configured per organization and per hall.
              </p>
            </div>
          </div>

          <section className="dashboard-gradient-card mt-8 overflow-hidden shadow-xl shadow-[#0F172A]/8">
            <div className="relative z-1 space-y-7 p-5 sm:p-6 lg:p-7">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap gap-3">
                  {tabs.map((tab, index) => (
                    <button
                      key={tab}
                      className={`h-14 rounded-xl border px-6 text-base font-black shadow-sm shadow-[#0F172A]/4 transition hover:-translate-y-0.5 ${index === 0 ? "border-[#0F172A] bg-[#0F172A] text-white" : "border-[#E5E0D6] bg-white text-[#0F172A] hover:border-[#B9974D]"}`}
                      type="button"
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <button className="inline-flex h-14 items-center justify-center gap-3 rounded-xl bg-[#B9974D] px-7 text-base font-black text-white shadow-xl shadow-[#B9974D]/20 transition hover:-translate-y-0.5 hover:bg-[#A98537]" type="button">
                  <LineIcon name="plus" />
                  Add
                </button>
              </div>

              <article className="flex flex-col gap-5 rounded-2xl border border-[#E5E0D6] bg-white p-5 shadow-lg shadow-[#0F172A]/5 xl:flex-row xl:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-5 sm:items-center">
                  <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-[#E5E0D6] bg-[#F7F4ED] text-[#B9974D]">
                    <LineIcon name="serving" className="h-10 w-10" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-2xl font-black tracking-tight text-[#0F172A]">Potato Kugel</h2>
                    <p className="mt-3 text-base font-semibold text-[#64748B]">Side Dish&nbsp; · &nbsp;Simcha</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 xl:min-w-110 xl:justify-start">
                  <MenuBadge icon="users" label="1 pan / 25 couples" tone="blue" />
                  <MenuBadge icon="leaf" label="Fleishig" tone="green" />
                </div>

                <div className="flex flex-wrap gap-4 xl:justify-end">
                  <ActionButton icon="edit" label="Edit" tone="outline" />
                  <ActionButton icon="trash" label="Delete" tone="danger" />
                </div>
              </article>
            </div>
          </section>
        </div>
      </section>
      </section>
    </main>
  );
}
