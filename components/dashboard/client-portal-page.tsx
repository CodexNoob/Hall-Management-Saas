"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import {
  clearCachedSyncedUser,
  getCachedSyncedUser,
  syncSignedInUser,
  type SyncSignedInUserResponse,
} from "@/lib/auth/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type IconName = "portal" | "calendar" | "file" | "payment" | "message" | "link" | "plus" | "check";

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
    "aria-hidden": true,
  };

  const paths: Record<IconName, ReactNode> = {
    portal: (
      <>
        <path d="M4 5h16v14H4Z" />
        <path d="M8 9h8M8 13h5" />
      </>
    ),
    calendar: (
      <>
        <path d="M4 6h16v14H4Z" />
        <path d="M8 3v5M16 3v5M4 11h16" />
      </>
    ),
    file: (
      <>
        <path d="M6 3h9l3 3v15H6Z" />
        <path d="M15 3v4h4M9 13h6M9 17h4" />
      </>
    ),
    payment: (
      <>
        <path d="M3 6h18v12H3Z" />
        <path d="M3 10h18M7 15h4" />
      </>
    ),
    message: (
      <>
        <path d="M4 5h16v11H8l-4 4Z" />
        <path d="M8 9h8M8 13h5" />
      </>
    ),
    link: (
      <>
        <path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />
        <path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    check: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12 2.5 2.5 4.5-5" />
      </>
    ),
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function StatCard({
  icon,
  label,
  value,
  description,
}: {
  icon: IconName;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <article className="rounded-2xl border border-[#D8DEE8] bg-white p-5 shadow-sm shadow-[#0F172A]/4">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F7F4ED] text-[#B9974D]">
        <LineIcon name={icon} />
      </div>
      <p className="mt-5 text-sm font-black text-[#64748B]">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-tight text-[#0F172A]">{value}</p>
      <p className="mt-2 text-sm font-medium text-[#64748B]">{description}</p>
    </article>
  );
}

function PortalBadge({ children, tone }: { children: ReactNode; tone: "green" | "blue" | "gold" }) {
  const classes = {
    green: "border-[#A7F3D0] bg-[#ECFDF5] text-[#027A48]",
    blue: "border-[#BBD7FF] bg-[#EEF7FF] text-[#1D6BFF]",
    gold: "border-[#EBD6A7] bg-[#FFF8E8] text-[#B07A12]",
  };

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${classes[tone]}`}>
      {children}
    </span>
  );
}

export function ClientPortalPage() {
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
      <DashboardSidebar user={user} roleLabel={roleLabel} activeLabel="Client Portal" />

      <section className="dashboard-shell-main min-h-screen lg:pl-70">
        <DashboardTopbar
          title="Client Portal"
        />

        <section className="relative overflow-hidden px-4 py-8 sm:px-8 lg:px-12">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-linear-to-b from-[#E7E3DA]/70 to-transparent" />

          <div className="relative mx-auto max-w-[1600px]">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.32em] text-[#B9974D]">
                  Route / Client Portal
                </p>
                <p className="mt-5 max-w-4xl text-base leading-8 text-[#64748B] sm:text-lg">
                  Give clients a clean portal to review event details, payment status, shared documents,
                  and booking messages.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="inline-flex h-12 items-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-5 text-sm font-black text-[#0F172A] shadow-sm transition hover:bg-[#F7F4ED]"
                >
                  <LineIcon name="link" className="h-4 w-4" />
                  Copy portal link
                </button>

                <button
                  type="button"
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#B9974D] px-5 text-sm font-black text-white shadow-lg shadow-[#B9974D]/20 transition hover:-translate-y-0.5 hover:bg-[#A98537]"
                >
                  <LineIcon name="plus" className="h-4 w-4" />
                  Invite client
                </button>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <StatCard icon="portal" label="Active clients" value="5" description="Clients with portal access" />
              <StatCard icon="file" label="Shared documents" value="12" description="Contracts, menus, and PDFs" />
              <StatCard icon="message" label="Unread messages" value="3" description="Client questions to review" />
            </div>

            <section className="dashboard-gradient-card mt-6 overflow-hidden shadow-xl shadow-[#0F172A]/8">
              <div className="relative z-1 p-5 sm:p-6 lg:p-7">
                <div className="flex flex-col gap-3 border-b border-[#E5E0D6] pb-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-black tracking-tight text-[#0F172A]">Client Access</h2>
                    <p className="mt-1 text-sm font-medium text-[#64748B]">
                      Review active portal invitations and shared booking workspaces.
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  {[
                    {
                      name: "Rosenberg Family",
                      event: "Rosenberg Bar Mitzvah",
                      status: "Active",
                      payment: "Deposit Paid",
                      date: "June 22, 2026",
                    },
                    {
                      name: "Klein Family",
                      event: "Klein Sheva Brachos",
                      status: "Invite Sent",
                      payment: "No Payment",
                      date: "June 29, 2026",
                    },
                  ].map((client) => (
                    <article
                      key={client.name}
                      className="flex flex-col gap-4 rounded-2xl border border-[#E5E0D6] bg-white p-5 shadow-sm shadow-[#0F172A]/4 xl:flex-row xl:items-center"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-4">
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#F7F4ED] text-[#B9974D]">
                          <LineIcon name="portal" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-black text-[#0F172A]">{client.name}</h3>
                          <p className="mt-1 text-sm font-semibold text-[#64748B]">{client.event}</p>
                          <p className="mt-1 text-xs font-bold uppercase tracking-[0.08em] text-[#94A3B8]">{client.date}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <PortalBadge tone={client.status === "Active" ? "green" : "gold"}>{client.status}</PortalBadge>
                        <PortalBadge tone={client.payment === "Deposit Paid" ? "blue" : "gold"}>{client.payment}</PortalBadge>
                      </div>

                      <div className="flex flex-wrap gap-3 xl:justify-end">
                        <button
                          type="button"
                          className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-4 text-sm font-black text-[#0F172A] transition hover:bg-[#F7F4ED]"
                        >
                          <LineIcon name="message" className="h-4 w-4" />
                          Message
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0F172A] px-4 text-sm font-black text-white transition hover:bg-[#17233A]"
                        >
                          <LineIcon name="check" className="h-4 w-4" />
                          Open portal
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </section>
      </section>
    </main>
  );
}
