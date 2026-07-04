"use client";

import { useRouter } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import type { SyncedUser, SyncedUserAccess } from "@/lib/auth/client";

type DashboardShellProps = {
  user: SyncedUser;
  access: SyncedUserAccess;
};

type ScheduleRow = {
  time: string;
  event: string;
  details: string;
  room: string;
  owner: string;
  status: "Confirmed" | "Menu review" | "On hold" | "Balance due";
  next: string;
};

function formatRole(role: string) {
  return role
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

const kpis = [
  { label: "Events today", value: "6", description: "3 confirmed, 2 in setup, 1 on hold" },
  { label: "Open balance", value: "$18.7k", description: "Includes two retainers due" }
];

const scheduleRows: ScheduleRow[] = [
  {
    time: "5:30 PM",
    event: "Rosenberg Bar Mitzvah",
    details: "240 portions",
    room: "Grand Hall",
    owner: "M. Mandelbaum",
    status: "Confirmed",
    next: "Dining setup 4:45 PM"
  },
  {
    time: "6:15 PM",
    event: "Klein Sheva Brachos",
    details: "96 couples",
    room: "Nachlas Yehuda A",
    owner: "Y. Waldman",
    status: "Menu review",
    next: "Kitchen quantities"
  },
  {
    time: "7:00 PM",
    event: "Levy Lchaim",
    details: "160 portions",
    room: "Terrace Room",
    owner: "J. Klein",
    status: "On hold",
    next: "Retainer payment"
  },
  {
    time: "8:30 PM",
    event: "Friedman Dinner",
    details: "72 couples",
    room: "Small Hall",
    owner: "M. Mandelbaum",
    status: "Balance due",
    next: "Billing follow-up"
  }
];

function StatusBadge({ status }: { status: ScheduleRow["status"] }) {
  const classes = {
    Confirmed: "border-[#A7F3D0] bg-[#ECFDF5] text-[#027A48]",
    "Menu review": "border-[#EBD6A7] bg-[#FFF8E8] text-[#B07A12]",
    "On hold": "border-[#BBD7FF] bg-[#EEF7FF] text-[#1D6BFF]",
    "Balance due": "border-[#FCA5A5] bg-[#FEF2F2] text-[#DC2626]"
  };

  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${classes[status]}`}>{status}</span>;
}

export function DashboardShell({ user }: DashboardShellProps) {
  const router = useRouter();
  const roleLabel = formatRole(user.role);

  return (
    <main className="min-h-screen bg-[#F4F2EE] text-[#111827]">
      <DashboardSidebar user={user} roleLabel={roleLabel} activeLabel="Dashboard" />

      <section className="dashboard-shell-main min-h-screen lg:pl-70">
        <DashboardTopbar
          title="Dashboard"
          subtitle="Current operating day overview for halls, kitchen, dining, events, billing, and staff."
          onNewBooking={() => console.log("New booking clicked")}
        />

        <div className="px-4 py-6 sm:px-6">
          <div className="grid gap-4 md:grid-cols-2">
            {kpis.map((kpi) => (
              <article key={kpi.label} className="rounded-2xl border border-[#D8DEE8] bg-white p-5 shadow-sm shadow-[#0F172A]/4">
                <p className="text-sm font-black text-[#64748B]">{kpi.label}</p>
                <p className="mt-4 text-3xl font-black tracking-tight text-[#111827]">{kpi.value}</p>
                <p className="mt-3 text-sm font-medium text-[#64748B]">{kpi.description}</p>
              </article>
            ))}
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,0.75fr)]">
            <section className="overflow-hidden rounded-2xl border border-[#D8DEE8] bg-white shadow-sm shadow-[#0F172A]/4">
              <div className="flex flex-col gap-4 border-b border-[#D8DEE8] p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-black text-[#111827]">Operating schedule</h2>
                  <p className="mt-1 text-sm font-medium text-[#64748B]">Live work list for office, kitchen, and dining room managers.</p>
                </div>
                <button className="h-10 rounded-xl border border-[#CBD5E1] bg-white px-4 text-sm font-black text-[#0F172A] transition hover:bg-[#F7F4ED]" type="button" onClick={() => router.push("/dashboard/event-manager")}>
                  Open events
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full table-fixed text-left">
                  <thead className="border-b border-[#D8DEE8] bg-[#F8FAFC] text-xs font-black uppercase tracking-[0.04em] text-[#64748B]">
                    <tr>
                      <th className="w-[10%] px-4 py-4">Time</th>
                      <th className="w-[23%] px-4 py-4">Event</th>
                      <th className="w-[17%] px-4 py-4">Room</th>
                      <th className="w-[16%] px-4 py-4">Owner</th>
                      <th className="w-[15%] px-4 py-4">Status</th>
                      <th className="w-[19%] px-4 py-4">Next item</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D8DEE8]">
                    {scheduleRows.map((row) => (
                      <tr key={`${row.time}-${row.event}`} className="align-middle">
                        <td className="px-4 py-4 text-sm font-semibold text-[#111827]">{row.time}</td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-black text-[#111827]">{row.event}</p>
                          <p className="mt-1 text-sm font-medium text-[#64748B]">{row.details}</p>
                        </td>
                        <td className="px-4 py-4 text-sm font-medium text-[#111827]">{row.room}</td>
                        <td className="px-4 py-4 text-sm font-medium text-[#111827]">{row.owner}</td>
                        <td className="px-4 py-4"><StatusBadge status={row.status} /></td>
                        <td className="px-4 py-4 text-sm font-medium text-[#111827]">{row.next}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="space-y-5">
              <section className="overflow-hidden rounded-2xl border border-[#D8DEE8] bg-white shadow-sm shadow-[#0F172A]/4">
                <div className="border-b border-[#D8DEE8] p-5">
                  <h2 className="text-base font-black text-[#111827]">Attention needed</h2>
                  <p className="mt-1 text-xs font-medium text-[#64748B]">Issues blocking a clean operating day.</p>
                </div>
                <div className="space-y-2.5 p-4">
                  <div className="rounded-xl border border-[#F5C37B] bg-[#FFF8E8] p-3 text-xs leading-5 text-[#92400E]">
                    <strong>Nachlas Yehuda menu lock:</strong> Second room booking must follow the first menu for the night.
                  </div>
                  <div className="rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] p-3 text-xs leading-5 text-[#991B1B]">
                    <strong>Friedman Dinner:</strong> Final balance remains open. Event starts 8:30 PM.
                  </div>
                  <div className="rounded-xl border border-[#BBD7FF] bg-[#EEF7FF] p-3 text-xs leading-5 text-[#1E3A8A]">
                    <strong>Vendor delivery:</strong> Linen order for Grand Hall marked ready, not received.
                  </div>
                </div>
              </section>

            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
