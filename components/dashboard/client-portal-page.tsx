"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { DashboardTopbar } from "@/components/topbars/dashboard-topbar";
import {
  clearCachedSyncedUser,
  getCachedSyncedUser,
  syncSignedInUser,
  type SyncSignedInUserResponse,
} from "@/lib/auth/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type IconName = "portal" | "calendar" | "file" | "payment" | "message" | "link" | "plus" | "check";

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
    <article className="rounded-2xl border border-[#d8dde5] bg-white p-5 shadow-sm shadow-[#17202a]/4">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f5f6f8] text-[#1f4d73]">
        <LineIcon name={icon} />
      </div>
      <p className="mt-5 text-sm font-black text-[#6a7483]">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-tight text-[#17202a]">{value}</p>
      <p className="mt-2 text-sm font-medium text-[#6a7483]">{description}</p>
    </article>
  );
}

function PortalBadge({ children, tone }: { children: ReactNode; tone: "green" | "blue" | "gold" }) {
  const classes = {
    green: "border-[#146c43] bg-[#eef4fa] text-[#146c43]",
    blue: "border-[#b9c2cf] bg-[#eef4fa] text-[#1f4d73]",
    gold: "border-[#9a5b00] bg-[#fbfcfd] text-[#9a5b00]",
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
    return <main className="min-h-screen bg-[#f5f6f8]" aria-busy="true" />;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f5f6f8] text-[#17202a]">
      <DashboardTopbar
        title="Client Portal"
      />

      <section className="relative overflow-hidden px-4 py-8 sm:px-8 lg:px-12">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-linear-to-b from-[#fbfcfd]/70 to-transparent" />

          <div className="relative mx-auto max-w-[1600px]">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.32em] text-[#1f4d73]">
                  Route / Client Portal
                </p>
                <p className="mt-5 max-w-4xl text-base leading-8 text-[#6a7483] sm:text-lg">
                  Give clients a clean portal to review event details, payment status, shared documents,
                  and booking messages.
                </p>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="inline-flex h-12 items-center gap-2 rounded-xl border border-[#b9c2cf] bg-white px-5 text-sm font-black text-[#17202a] shadow-sm transition hover:bg-[#eef4fa]"
                >
                  <LineIcon name="link" className="h-4 w-4" />
                  Copy portal link
                </button>

                <button
                  type="button"
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#1f4d73] px-5 text-sm font-black text-white shadow-lg shadow-[#1f4d73]/20 transition hover:-translate-y-0.5 hover:bg-[#9a5b00]"
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

            <section className="dashboard-gradient-card mt-6 overflow-hidden shadow-xl shadow-[#17202a]/8">
              <div className="relative z-1 p-5 sm:p-6 lg:p-7">
                <div className="flex flex-col gap-3 border-b border-[#d8dde5] pb-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-black tracking-tight text-[#17202a]">Client Access</h2>
                    <p className="mt-1 text-sm font-medium text-[#6a7483]">
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
                      className="flex flex-col gap-4 rounded-2xl border border-[#d8dde5] bg-white p-5 shadow-sm shadow-[#17202a]/4 xl:flex-row xl:items-center"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-4">
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#f5f6f8] text-[#1f4d73]">
                          <LineIcon name="portal" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-black text-[#17202a]">{client.name}</h3>
                          <p className="mt-1 text-sm font-semibold text-[#6a7483]">{client.event}</p>
                          <p className="mt-1 text-xs font-bold uppercase tracking-[0.08em] text-[#6a7483]">{client.date}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <PortalBadge tone={client.status === "Active" ? "green" : "gold"}>{client.status}</PortalBadge>
                        <PortalBadge tone={client.payment === "Deposit Paid" ? "blue" : "gold"}>{client.payment}</PortalBadge>
                      </div>

                      <div className="flex flex-wrap gap-3 xl:justify-end">
                        <button
                          type="button"
                          className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#b9c2cf] bg-white px-4 text-sm font-black text-[#17202a] transition hover:bg-[#eef4fa]"
                        >
                          <LineIcon name="message" className="h-4 w-4" />
                          Message
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#1f4d73] px-4 text-sm font-black text-white transition hover:bg-[#15344f]"
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
    </div>
  );
}
