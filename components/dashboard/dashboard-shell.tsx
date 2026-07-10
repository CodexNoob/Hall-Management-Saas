"use client";

import { useRouter } from "next/navigation";
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
    Confirmed: "border-[#146c43] bg-[#eef4fa] text-[#146c43]",
    "Menu review": "border-[#9a5b00] bg-[#fbfcfd] text-[#9a5b00]",
    "On hold": "border-[#b9c2cf] bg-[#eef4fa] text-[#1f4d73]",
    "Balance due": "border-[#a62b24] bg-[#fbfcfd] text-[#a62b24]"
  };

  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${classes[status]}`}>{status}</span>;
}

export function DashboardShell({}: DashboardShellProps) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#f5f6f8] text-[#17202a]">
      <DashboardTopbar
        title="Dashboard"
        subtitle="Current operating day overview for halls, kitchen, dining, events, billing, and staff."
        onNewBooking={() => console.log("New booking clicked")}
      />

      <div className="px-4 py-6 sm:px-6">
          <div className="grid gap-4 md:grid-cols-2">
            {kpis.map((kpi) => (
              <article key={kpi.label} className="rounded-2xl border border-[#d8dde5] bg-white p-5 shadow-sm shadow-[#17202a]/4">
                <p className="text-sm font-black text-[#6a7483]">{kpi.label}</p>
                <p className="mt-4 text-3xl font-black tracking-tight text-[#17202a]">{kpi.value}</p>
                <p className="mt-3 text-sm font-medium text-[#6a7483]">{kpi.description}</p>
              </article>
            ))}
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,0.75fr)]">
            <section className="overflow-hidden rounded-2xl border border-[#d8dde5] bg-white shadow-sm shadow-[#17202a]/4">
              <div className="flex flex-col gap-4 border-b border-[#d8dde5] p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-black text-[#17202a]">Operating schedule</h2>
                  <p className="mt-1 text-sm font-medium text-[#6a7483]">Live work list for office, kitchen, and dining room managers.</p>
                </div>
                <button className="h-10 rounded-xl border border-[#b9c2cf] bg-white px-4 text-sm font-black text-[#17202a] transition hover:bg-[#eef4fa]" type="button" onClick={() => router.push("/dashboard/event-manager")}>
                  Open events
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full table-fixed text-left">
                  <thead className="border-b border-[#d8dde5] bg-[#fbfcfd] text-xs font-black uppercase tracking-[0.04em] text-[#6a7483]">
                    <tr>
                      <th className="w-[10%] px-4 py-4">Time</th>
                      <th className="w-[23%] px-4 py-4">Event</th>
                      <th className="w-[17%] px-4 py-4">Room</th>
                      <th className="w-[16%] px-4 py-4">Owner</th>
                      <th className="w-[15%] px-4 py-4">Status</th>
                      <th className="w-[19%] px-4 py-4">Next item</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#d8dde5]">
                    {scheduleRows.map((row) => (
                      <tr key={`${row.time}-${row.event}`} className="align-middle">
                        <td className="px-4 py-4 text-sm font-semibold text-[#17202a]">{row.time}</td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-black text-[#17202a]">{row.event}</p>
                          <p className="mt-1 text-sm font-medium text-[#6a7483]">{row.details}</p>
                        </td>
                        <td className="px-4 py-4 text-sm font-medium text-[#17202a]">{row.room}</td>
                        <td className="px-4 py-4 text-sm font-medium text-[#17202a]">{row.owner}</td>
                        <td className="px-4 py-4"><StatusBadge status={row.status} /></td>
                        <td className="px-4 py-4 text-sm font-medium text-[#17202a]">{row.next}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="space-y-5">
              <section className="overflow-hidden rounded-2xl border border-[#d8dde5] bg-white shadow-sm shadow-[#17202a]/4">
                <div className="border-b border-[#d8dde5] p-5">
                  <h2 className="text-base font-black text-[#17202a]">Attention needed</h2>
                  <p className="mt-1 text-xs font-medium text-[#6a7483]">Issues blocking a clean operating day.</p>
                </div>
                <div className="space-y-2.5 p-4">
                  <div className="rounded-xl border border-[#9a5b00] bg-[#fbfcfd] p-3 text-xs leading-5 text-[#9a5b00]">
                    <strong>Nachlas Yehuda menu lock:</strong> Second room booking must follow the first menu for the night.
                  </div>
                  <div className="rounded-xl border border-[#a62b24] bg-[#fbfcfd] p-3 text-xs leading-5 text-[#a62b24]">
                    <strong>Friedman Dinner:</strong> Final balance remains open. Event starts 8:30 PM.
                  </div>
                  <div className="rounded-xl border border-[#b9c2cf] bg-[#eef4fa] p-3 text-xs leading-5 text-[#1f4d73]">
                    <strong>Vendor delivery:</strong> Linen order for Grand Hall marked ready, not received.
                  </div>
                </div>
              </section>

            </div>
          </div>
      </div>
    </div>
  );
}
