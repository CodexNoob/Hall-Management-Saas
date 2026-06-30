"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearCachedSyncedUser, getCachedSyncedUser, syncSignedInUser, type SyncSignedInUserResponse } from "@/lib/auth/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type SidebarItem = {
  label: string;
  icon: "gear" | "hall" | "chart" | "users" | "shield" | "key" | "mail" | "calendar";
};

const sidebarItems: SidebarItem[] = [
  { label: "Platform Settings", icon: "gear" },
  { label: "Halls", icon: "hall" },
  { label: "Hall Performance", icon: "chart" },
  { label: "User Types", icon: "users" },
  { label: "User Access", icon: "shield" },
  { label: "Feature Access", icon: "key" },
  { label: "Payments / Gmail", icon: "mail" },
  { label: "Google Calendar", icon: "calendar" }
];

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

function formatRole(role: string) {
  return role
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function LineIcon({ name, className = "h-5 w-5" }: { name: SidebarItem["icon"] | "home" | "bell" | "help" | "save" | "back" | "upload" | "trash" | "info"; className?: string }) {
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

  const paths = {
    gear: <><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" /><path d="m19 15 2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.6-1L14.6 7h-5.2L9 10a7 7 0 0 0-1.6 1L5 10l-2 3.5L5 15a7 7 0 0 0 0 2l-2 1.5L5 22l2.4-1a7 7 0 0 0 1.6 1l.4 3h5.2l.4-3a7 7 0 0 0 1.6-1l2.4 1 2-3.5L19 17a7 7 0 0 0 0-2Z" /></>,
    hall: <><path d="M4 20h16M6 20V9l6-4 6 4v11" /><path d="M9 20v-6h6v6M8 11h8" /></>,
    chart: <><path d="M4 19h16M7 16V9M12 16V5M17 16v-7" /><path d="m15 7 2-2 2 2" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
    shield: <><path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6Z" /><path d="m9 12 2 2 4-5" /></>,
    key: <><path d="M15 7a4 4 0 1 0 2 3.5L22 5l-3-3-5.5 5Z" /><path d="m14 8 2 2" /></>,
    mail: <><path d="M4 6h16v12H4Z" /><path d="m4 7 8 6 8-6" /></>,
    calendar: <><path d="M4 6h16v14H4ZM8 3v5M16 3v5M4 11h16" /></>,
    home: <path d="M4 11 12 4l8 7v9h-5v-6H9v6H4Z" />,
    bell: <><path d="M6 10a6 6 0 0 1 12 0v5l2 3H4l2-3Z" /><path d="M10 21h4" /></>,
    help: <><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" /><path d="M9.8 9a2.4 2.4 0 0 1 4.4 1.3c0 1.8-2.2 2-2.2 3.7M12 17h.01" /></>,
    save: <><path d="M5 3h12l2 2v16H5Z" /><path d="M8 3v6h8V3M8 21v-7h8v7" /></>,
    back: <path d="M19 12H5M12 19l-7-7 7-7" />,
    upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M5 20h14" /></>,
    trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></>,
    info: <><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" /><path d="M12 11v5M12 8h.01" /></>
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function TopbarIconButton({ children, label, badge }: { children: React.ReactNode; label: string; badge?: string }) {
  return (
    <button className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#E5E0D6] bg-white text-[#64748B] shadow-sm shadow-[#B9974D]/5 transition hover:-translate-y-0.5 hover:border-[#B9974D] hover:text-[#B9974D] sm:h-12 sm:w-12" type="button" aria-label={label}>
      {children}
      {badge ? <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-linear-to-r from-[#B9974D] to-[#0F172A] px-1.5 text-xs font-black text-white">{badge}</span> : null}
    </button>
  );
}

function TextField({
  label,
  value,
  type = "text",
  swatchClassName
}: {
  label: string;
  value: string;
  type?: "text" | "select";
  swatchClassName?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-sm font-black text-[#0F172A]">{label}</span>
      <span className="mt-3 flex h-13 items-center gap-3 rounded-xl border border-[#E5E0D6] bg-white px-4 text-base font-semibold text-[#1E293B] shadow-sm shadow-[#B9974D]/3 transition focus-within:border-[#B9974D] focus-within:shadow-[0_0_0_4px_rgba(185,151,77,0.14)]">
        {swatchClassName ? <span className={`h-7 w-7 shrink-0 rounded-md ${swatchClassName}`} /> : null}
        {type === "select" ? (
          <>
            <span className="min-w-0 flex-1 truncate">{value}</span>
            <svg className="h-4 w-4 shrink-0 text-[#64748B]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        ) : (
          <input className="min-w-0 flex-1 bg-transparent outline-none" defaultValue={value} />
        )}
      </span>
    </label>
  );
}

export function PlatformSettingsPage() {
  const router = useRouter();
  const [syncData, setSyncData] = useState<SyncSignedInUserResponse | null>(() => getCachedSyncedUser());
  const [activeItem, setActiveItem] = useState("Platform Settings");

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
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
    }

    loadUser().catch(() => {
      clearCachedSyncedUser();
      router.replace("/");
    });

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (!syncData) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7F4ED] px-6 text-center text-[#0F172A]">
        <section className="rounded-3xl border border-[#E5E0D6] bg-white p-8 shadow-xl shadow-[#B9974D]/10">
          <h1 className="text-2xl font-black">Hall Management SaaS</h1>
          <p className="mt-4 font-semibold text-[#64748B]">Loading platform settings...</p>
        </section>
      </main>
    );
  }

  const user = syncData.user;
  const initials = getInitials(user.name);
  const roleLabel = formatRole(user.role);

  return (
    <main className="min-h-screen overflow-x-hidden text-[#0F172A] [background:linear-gradient(135deg,rgba(185,151,77,0.13),transparent_34%),linear-gradient(315deg,rgba(15,23,42,0.08),transparent_32%),#F7F4ED]">
      <header className="sticky top-0 z-30 border-b border-[#E5E0D6] bg-white/92 backdrop-blur-xl">
        <div className="mx-auto flex min-h-18 max-w-[1600px] items-center justify-between gap-3 px-4 py-3 sm:min-h-20 sm:gap-5 sm:px-8 lg:px-12">
          <Image src="/hms-logo-header.png" alt="Hall Management SaaS" width={1160} height={300} priority unoptimized className="h-11 w-auto max-w-37.5 object-contain sm:h-14 sm:max-w-none lg:h-16" />
          <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
            <button className="hidden items-center gap-3 rounded-2xl bg-[#0F172A] px-5 py-3 text-sm font-black text-white transition hover:bg-[#243551] md:inline-flex" type="button" onClick={() => router.push("/dashboard")}>
              <LineIcon name="home" />
              Dashboard
            </button>
            <TopbarIconButton label="Notifications" badge="3"><LineIcon name="bell" className="h-5 w-5 sm:h-6 sm:w-6" /></TopbarIconButton>
            <TopbarIconButton label="Help"><LineIcon name="help" className="h-5 w-5 sm:h-6 sm:w-6" /></TopbarIconButton>
            <button className="flex items-center gap-3 rounded-3xl px-2 py-1 transition hover:bg-[#F7F4ED] sm:pl-3 sm:pr-4" type="button">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#B9974D] to-[#E7E3DA] text-base font-black text-[#0F172A] sm:h-12 sm:w-12 sm:text-lg">{initials}</span>
              <span className="hidden text-left sm:block">
                <span className="block text-sm font-black text-[#0F172A]">{user.name}</span>
                <span className="block text-xs font-semibold text-[#64748B]">{roleLabel}</span>
              </span>
              <svg className="hidden h-4 w-4 text-[#64748B] sm:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden px-4 py-8 sm:px-8 lg:px-12">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-linear-to-b from-[#E7E3DA]/70 to-transparent" />
        <div className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-[#B9974D]/12 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 top-20 h-96 w-96 rounded-full bg-[#0F172A]/10 blur-3xl" />
        <svg className="pointer-events-none absolute right-0 top-0 hidden h-96 w-180 max-w-full text-[#B9974D]/20 sm:block" viewBox="0 0 720 360" fill="none" aria-hidden="true">
          {Array.from({ length: 9 }).map((_, index) => (
            <path key={index} d={`M0 ${90 + index * 22}c142-90 242 44 384-46 128-80 214-30 336-98`} stroke="currentColor" />
          ))}
        </svg>

        <div className="relative mx-auto max-w-[1600px]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-black uppercase tracking-[0.32em] text-[#B9974D]">Settings</p>
              <h1 className="mt-4 text-4xl font-black tracking-tight text-[#0F172A] sm:text-5xl lg:text-6xl">Platform Settings</h1>
              <p className="mt-5 max-w-4xl text-base leading-8 text-[#64748B] sm:text-lg">
                Configure your platform branding, halls, user access, integrations, and default system settings.
              </p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row">
              <button className="inline-flex h-14 items-center justify-center gap-3 rounded-2xl border border-[#E5E0D6] bg-white px-6 text-base font-black text-[#B9974D] shadow-lg shadow-[#B9974D]/6 transition hover:-translate-y-0.5 hover:border-[#B9974D]" type="button" onClick={() => router.push("/dashboard")}>
                <LineIcon name="back" />
                Back to Dashboard
              </button>
              <button className="inline-flex h-14 items-center justify-center gap-3 rounded-2xl bg-[#B9974D] px-6 text-base font-black text-white shadow-2xl shadow-[#0F172A]/15 transition hover:-translate-y-0.5 hover:bg-[#9C7D37]" type="button">
                <LineIcon name="save" />
                Save Platform Settings
              </button>
            </div>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[280px_minmax(0,1fr)_470px]">
            <aside className="rounded-4xl border border-[#E5E0D6] bg-white/94 p-5 shadow-xl shadow-[#B9974D]/7">
              <nav className="space-y-3">
                {sidebarItems.map((item) => {
                  const isActive = item.label === activeItem;
                  return (
                    <button
                      key={item.label}
                      className={`flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left text-base font-black transition ${
                        isActive ? "bg-[#0F172A] text-white shadow-lg shadow-[#0F172A]/20" : "bg-white text-[#64748B] hover:bg-[#F7F4ED] hover:text-[#B9974D]"
                      }`}
                      type="button"
                      onClick={() => setActiveItem(item.label)}
                    >
                      <LineIcon name={item.icon} />
                      <span className="min-w-0 truncate">{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </aside>

            <section className="rounded-4xl border border-[#E5E0D6] bg-white/94 p-6 shadow-xl shadow-[#B9974D]/7 sm:p-8">
              <h2 className="text-3xl font-black tracking-tight text-[#0F172A]">Platform Settings</h2>
              <div className="mt-7 grid gap-6 md:grid-cols-2">
                <TextField label="Platform Name" value="Hall Management Platform" />
                <TextField label="Organization Name" value="Default Hall Organization" />
                <TextField label="Short Display Name" value="Hall Platform" />
                <TextField label="Timezone" value="America/New_York" type="select" />
                <TextField label="Clock Format" value="12-hour" type="select" />
                <TextField label="Calendar Start Day" value="Sunday" type="select" />
                <TextField label="Primary Color" value="#0F172A" swatchClassName="bg-[#0F172A]" />
                <TextField label="Accent Color" value="#B9974D" swatchClassName="bg-[#B9974D]" />
              </div>

              <div className="mt-8 border-t border-[#E5E0D6] pt-7">
                <div className="grid gap-4 sm:grid-cols-3">
                  <button className="inline-flex h-13 items-center justify-center gap-3 rounded-2xl border border-[#E5E0D6] bg-white px-5 text-sm font-black text-[#B9974D] transition hover:-translate-y-0.5 hover:border-[#B9974D]" type="button">
                    <LineIcon name="upload" />
                    Upload Logo
                  </button>
                  <button className="inline-flex h-13 items-center justify-center gap-3 rounded-2xl border border-[#E5E0D6] bg-white px-5 text-sm font-black text-[#B9974D] transition hover:-translate-y-0.5 hover:border-[#B9974D]" type="button">
                    <LineIcon name="upload" />
                    Upload Favicon
                  </button>
                  <button className="inline-flex h-13 items-center justify-center gap-3 rounded-2xl border border-[#ffb8b8] bg-white px-5 text-sm font-black text-[#ef2020] transition hover:-translate-y-0.5 hover:bg-[#fff7f7]" type="button">
                    <LineIcon name="trash" />
                    Reset Theme
                  </button>
                </div>
              </div>
            </section>

            <aside className="rounded-4xl border border-[#E5E0D6] bg-white/94 p-6 shadow-xl shadow-[#B9974D]/7 sm:p-8 lg:col-span-2 2xl:col-span-1">
              <h2 className="text-3xl font-black tracking-tight text-[#0F172A]">Brand Preview</h2>
              <p className="mt-5 text-base leading-8 text-[#64748B]">
                This preview shows how the platform name and logo area will appear in the app, PDFs, and emails.
              </p>

              <div className="mt-8 flex min-h-48 items-center justify-center rounded-3xl border border-[#E5E0D6] bg-linear-to-br from-[#F7F4ED] to-[#F1F5F9] p-6">
                <div className="flex max-w-full flex-col items-center justify-center text-center">
                  <Image src="/hms-logo-header.png" alt="Hall Management SaaS logo" width={1160} height={300} unoptimized className="h-auto w-60 max-w-full object-contain sm:w-72" />
                  <p className="mt-3 text-sm font-semibold leading-5 text-[#64748B] sm:text-base">
                    Default Hall Organization
                  </p>
                </div>
              </div>

              <div className="mt-7 flex gap-4 rounded-2xl border border-[#E5E0D6] bg-[#F7F4ED] p-5 text-[#9C7D37]">
                <LineIcon name="info" className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="text-sm font-semibold leading-7">
                  Platform name, colors, logo, PDF header, and email header are controlled from this section.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
