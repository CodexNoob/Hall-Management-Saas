"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { clearCachedSyncedUser, type SyncedUser, type SyncedUserAccess } from "@/lib/auth/client";

type DashboardShellProps = {
  user: SyncedUser;
  access: SyncedUserAccess;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

function formatRole(role: string) {
  return role
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}
type DashboardCard = {
  title: string;
  description: string;
  variant: "gradient" | "light";
  icon: "settings" | "hall" | "kitchen" | "calendar" | "event" | "menu" | "sliders";
  route?: string;
  pills: Array<{
    label: string;
    icon?: "tag" | "globe" | "check" | "plus" | "calendar" | "clock" | "user" | "bolt" | "box" | "matrix";
  }>;
};

const mainCards: DashboardCard[] = [
  {
    title: "Platform Settings",
    description: "Rename the platform, upload logo, control colors, date/time, PDF branding, email branding, and default settings.",
    variant: "gradient",
    icon: "settings",
    route: "/dashboard/settings",
    pills: [
      { label: "White-label ready", icon: "tag" },
      { label: "Dynamic branding", icon: "globe" }
    ]
  },
  {
    title: "Hall 1 / Hall 2 Defaults",
    description: "Every new setup starts with Hall 1 and Hall 2. Rename them, add more halls, and customize each hall's behavior.",
    variant: "gradient",
    icon: "hall",
    pills: [
      { label: "Hall 1 active", icon: "check" },
      { label: "Hall 2 active", icon: "check" },
      { label: "Add more", icon: "plus" }
    ]
  },
  {
    title: "Kitchen Dashboard",
    description: "Today, This Week, 4 Weeks, worker assignment, item status, and kitchen notifications.",
    variant: "light",
    icon: "kitchen",
    pills: [
      { label: "4 Today", icon: "calendar" },
      { label: "18 Pending", icon: "clock" }
    ]
  }
];

const secondaryCards: DashboardCard[] = [
  {
    title: "Event Calendar",
    description: "Month view, Hebrew dates, Full tag, On Hold, plus booking, and event details.",
    variant: "light",
    icon: "calendar",
    pills: [
      { label: "2 Holds", icon: "calendar" },
      { label: "9 This Week", icon: "user" }
    ]
  },
  {
    title: "Event Manager",
    description: "Search, edit, payment, menu, customize, PDF, and status control.",
    variant: "light",
    icon: "event",
    pills: [
      { label: "37 Events", icon: "calendar" },
      { label: "Quick Actions", icon: "bolt" }
    ]
  },
  {
    title: "Menu",
    description: "Menu items, packages, add-ons, and hall menu item access.",
    variant: "light",
    icon: "menu",
    pills: [
      { label: "86 Items", icon: "calendar" },
      { label: "12 Packages", icon: "box" }
    ]
  },
  {
    title: "Settings",
    description: "Platform, halls, user types, user access, feature access, integrations, and school cycles.",
    variant: "light",
    icon: "sliders",
    pills: [
      { label: "Role Templates", icon: "matrix" },
      { label: "Feature Matrix", icon: "matrix" }
    ]
  }
];

function DashboardIcon({ name, className = "h-8 w-8" }: { name: DashboardCard["icon"]; className?: string }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  };

  if (name === "settings") {
    return (
      <svg {...common}>
        <path d="M12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2Z" />
        <path d="M19.4 15a8.2 8.2 0 0 0 .1-1.2 8.2 8.2 0 0 0-.1-1.2l2-1.5-2-3.5-2.4 1a8.8 8.8 0 0 0-2-1.2L14.6 5h-4.1L10 7.4a8.8 8.8 0 0 0-2 1.2l-2.4-1-2 3.5 2 1.5a8.2 8.2 0 0 0-.1 1.2 8.2 8.2 0 0 0 .1 1.2l-2 1.5 2 3.5 2.4-1a8.8 8.8 0 0 0 2 1.2l.5 2.4h4.1l.5-2.4a8.8 8.8 0 0 0 2-1.2l2.4 1 2-3.5Z" />
      </svg>
    );
  }

  if (name === "hall") {
    return (
      <svg {...common}>
        <path d="M4 20h16M6 20V9l6-4 6 4v11" />
        <path d="M9 20v-6h6v6M9 11h6M7 9h10" />
      </svg>
    );
  }

  if (name === "kitchen") {
    return (
      <svg {...common}>
        <path d="M8 4v5M12 4v5M16 4v5M7 9h10l-1 11H8Z" />
        <path d="M5 13H3v3h3M19 13h2v3h-3" />
      </svg>
    );
  }

  if (name === "calendar") {
    return (
      <svg {...common}>
        <path d="M4 6h16v14H4ZM8 3v5M16 3v5M4 11h16M8 15h3M14 15h2" />
      </svg>
    );
  }

  if (name === "event") {
    return (
      <svg {...common}>
        <path d="M6 3h9l3 3v15H6Z" />
        <path d="M15 3v4h4M9 11h6M9 15h6M9 18h3" />
      </svg>
    );
  }

  if (name === "menu") {
    return (
      <svg {...common}>
        <path d="M7 3v18M11 3v7a4 4 0 0 1-8 0V3M17 3v18M17 3c2 1.5 3 4 3 7v2h-3" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M4 7h7M15 7h5M4 17h5M13 17h7M9 4v6M15 14v6" />
      <path d="M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM15 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
    </svg>
  );
}

function PillIcon({ name }: { name: NonNullable<DashboardCard["pills"][number]["icon"]> }) {
  const common = {
    className: "h-4 w-4",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  };

  const paths: Record<typeof name, ReactNode> = {
    tag: <path d="M20 12 12 20 4 12V4h8Z M8 8h.01" />,
    globe: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3.5 9h17M3.5 15h17M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />,
    check: <path d="M20 6 9 17l-5-5" />,
    plus: <path d="M12 5v14M5 12h14" />,
    calendar: <path d="M4 6h16v14H4ZM8 3v5M16 3v5M4 11h16" />,
    clock: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2" />,
    user: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0" />,
    bolt: <path d="m13 2-8 12h6l-1 8 9-13h-6Z" />,
    box: <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9ZM4 7.5l8 4.5 8-4.5M12 12v9" />,
    matrix: <path d="M4 5h5v5H4ZM15 5h5v5h-5ZM4 15h5v5H4ZM15 15h5v5h-5" />
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function TopbarIconButton({ children, label, badge }: { children: ReactNode; label: string; badge?: string }) {
  return (
    <button
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#E5E0D6] bg-white text-[#64748B] shadow-sm shadow-[#B9974D]/5 transition hover:-translate-y-0.5 hover:border-[#B9974D] hover:text-[#B9974D] hover:shadow-lg hover:shadow-[#B9974D]/10 sm:h-12 sm:w-12"
      type="button"
      aria-label={label}
    >
      {children}
      {badge ? (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-linear-to-r from-[#B9974D] to-[#0F172A] px-1.5 text-xs font-black text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function FeatureCard({ card, className = "" }: { card: DashboardCard; className?: string }) {
  const isGradient = card.variant === "gradient";
  const router = useRouter();

  return (
    <button
      className={`group min-h-0 w-full min-w-0 rounded-3xl border p-5 text-left transition duration-300 hover:-translate-y-1 sm:rounded-4xl sm:p-6 lg:min-h-65 lg:p-7 ${
        isGradient
          ? "relative overflow-hidden border-transparent bg-linear-to-br from-[#0F172A] to-[#243551] text-white shadow-2xl shadow-[#0F172A]/18"
          : "border-[#E5E0D6] bg-white/92 text-[#0F172A] shadow-xl shadow-[#B9974D]/7 hover:border-[#B9974D] hover:shadow-2xl hover:shadow-[#B9974D]/13"
      } ${className}`}
      type="button"
      onClick={() => (card.route ? router.push(card.route as Parameters<typeof router.push>[0]) : console.log(`${card.title} clicked`))}
    >
      {isGradient ? (
        <>
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/12 blur-2xl" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-56 w-80 rounded-[50%] bg-[#B9974D]/20 blur-xl" />
          <svg className="pointer-events-none absolute bottom-0 right-0 h-44 w-full text-white/10" viewBox="0 0 500 160" fill="none" aria-hidden="true">
            <path d="M0 142c92-74 146 30 238-45 96-78 154 2 262-67" stroke="currentColor" strokeWidth="1" />
            <path d="M0 118c92-74 146 30 238-45 96-78 154 2 262-67" stroke="currentColor" strokeWidth="1" />
            <path d="M0 94c92-74 146 30 238-45 96-78 154 2 262-67" stroke="currentColor" strokeWidth="1" />
          </svg>
        </>
      ) : null}

      <div className="relative">
        <div
          className={`flex h-13 w-13 items-center justify-center rounded-full sm:h-16 sm:w-16 lg:h-20 lg:w-20 ${
            isGradient ? "bg-white/12 text-[#B9974D] shadow-lg shadow-black/10" : "bg-[#F7F4ED] text-[#B9974D]"
          }`}
        >
          <DashboardIcon name={card.icon} className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8" />
        </div>

        <h3 className={`mt-5 overflow-wrap-anywhere text-xl font-black tracking-tight sm:mt-6 sm:text-2xl ${isGradient ? "text-white" : "text-[#0F172A]"}`}>
          {card.title}
        </h3>
        <p className={`mt-3 max-w-md text-sm leading-7 sm:mt-4 sm:text-base sm:leading-8 ${isGradient ? "text-white/88" : "text-[#64748B]"}`}>
          {card.description}
        </p>

        <div className="mt-5 flex flex-wrap gap-3 sm:mt-7 sm:gap-4">
          {card.pills.map((pill) => (
            <span
              key={pill.label}
              className={`inline-flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black sm:gap-3 sm:px-4 sm:py-3 sm:text-sm ${
                isGradient ? "border-white/10 bg-white/16 text-white" : "border-[#E5E0D6] bg-[#F7F4ED] text-[#B9974D]"
              }`}
            >
              {pill.icon ? <PillIcon name={pill.icon} /> : null}
              {pill.label}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

export function DashboardShell({ user }: DashboardShellProps) {
  const router = useRouter();
  const initials = getInitials(user.name);
  const roleLabel = formatRole(user.role);

  const logout = async () => {
    const supabase = createSupabaseBrowserClient();
    clearCachedSyncedUser();
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  };

  return (
    <main className="min-h-screen overflow-x-hidden text-[#0F172A] [background:linear-gradient(135deg,rgba(185,151,77,0.13),transparent_34%),linear-gradient(315deg,rgba(15,23,42,0.08),transparent_32%),#F7F4ED]">
      <header className="sticky top-0 z-30 border-b border-[#E5E0D6] bg-white/92 backdrop-blur-xl">
        <div className="mx-auto flex min-h-18 max-w-[1600px] items-center justify-between gap-3 px-4 py-3 sm:min-h-20 sm:gap-5 sm:px-8 lg:px-12">
          <Image src="/hms-logo-header.png" alt="Hall Management SaaS" width={1160} height={300} priority unoptimized className="h-11 w-auto max-w-37.5 object-contain sm:h-14 sm:max-w-none lg:h-16" />

          <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
            <button
              className="hidden items-center gap-3 rounded-2xl bg-[#0F172A] px-5 py-3 text-sm font-black text-white transition hover:bg-[#243551] md:inline-flex"
              type="button"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M4 11 12 4l8 7v9h-5v-6H9v6H4Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Dashboard
            </button>

            <TopbarIconButton label="Notifications" badge="3">
              <svg className="h-5 w-5 sm:h-6 sm:w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                <path d="M6 10a6 6 0 0 1 12 0v5l2 3H4l2-3Z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10 21h4" strokeLinecap="round" />
              </svg>
            </TopbarIconButton>

            <TopbarIconButton label="Help">
              <svg className="h-5 w-5 sm:h-6 sm:w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
                <path d="M9.8 9a2.4 2.4 0 0 1 4.4 1.3c0 1.8-2.2 2-2.2 3.7M12 17h.01" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </TopbarIconButton>

            <button
              className="flex items-center gap-3 rounded-3xl px-2 py-1 transition hover:bg-[#F7F4ED] sm:pl-3 sm:pr-4"
              type="button"
              onClick={logout}
              title="Sign out"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#B9974D] to-[#E7E3DA] text-base font-black text-[#0F172A] sm:h-12 sm:w-12 sm:text-lg">
                {initials}
              </span>
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

      <section className="relative overflow-hidden px-4 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-9">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-linear-to-b from-[#E7E3DA]/70 to-transparent" />
        <div className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-[#B9974D]/12 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 top-20 h-96 w-96 rounded-full bg-[#0F172A]/10 blur-3xl" />
        <svg className="pointer-events-none absolute right-0 top-0 hidden h-96 w-180 max-w-full text-[#B9974D]/20 sm:block" viewBox="0 0 720 360" fill="none" aria-hidden="true">
          {Array.from({ length: 9 }).map((_, index) => (
            <path key={index} d={`M0 ${90 + index * 22}c142-90 242 44 384-46 128-80 214-30 336-98`} stroke="currentColor" />
          ))}
        </svg>

        <div className="relative mx-auto max-w-[1600px]">
          <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="overflow-wrap-anywhere text-base font-black text-[#B9974D] sm:text-xl">Welcome back, {user.name}!</p>
              <h1 className="mt-3 overflow-wrap-anywhere text-3xl font-black tracking-tight text-[#0F172A] sm:mt-4 sm:text-5xl lg:text-6xl">Hall Management Platform</h1>
              <p className="mt-4 max-w-4xl text-sm leading-7 text-[#64748B] sm:mt-5 sm:text-lg sm:leading-8">
                Default multi-hall operations platform with configurable platform name, Hall 1 / Hall 2 defaults, hall performance
                settings, user types, and feature-by-feature access control.
              </p>
            </div>

            <button
              className="inline-flex h-12 w-full shrink-0 items-center justify-center gap-3 rounded-2xl bg-[#B9974D] px-6 text-base font-black text-white shadow-2xl shadow-[#0F172A]/15 transition hover:-translate-y-1 hover:bg-[#9C7D37] sm:h-14 sm:w-auto sm:px-8 sm:text-lg lg:h-16"
              type="button"
              onClick={() => console.log("New Booking clicked")}
            >
              <span className="text-2xl font-light leading-none sm:text-3xl">+</span>
              New Booking
            </button>
          </div>

          <div className="mt-6 grid min-w-0 gap-4 sm:mt-8 sm:gap-5 lg:grid-cols-2 xl:grid-cols-[1.08fr_1fr_0.7fr] xl:gap-6">
            {mainCards.map((card) => (
              <FeatureCard key={card.title} card={card} />
            ))}
          </div>

          <div className="mt-4 grid min-w-0 gap-4 sm:mt-5 sm:gap-5 md:grid-cols-2 xl:mt-6 xl:grid-cols-4 xl:gap-6">
            {secondaryCards.map((card) => (
              <FeatureCard key={card.title} card={card} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
