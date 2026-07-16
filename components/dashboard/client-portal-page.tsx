"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { DashboardTopbar } from "@/components/topbars/dashboard-topbar";
import {
  clearCachedSyncedUser,
  getCachedSyncedUser,
  syncSignedInUser,
  type SyncSignedInUserResponse,
} from "@/lib/auth/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type IconName =
  | "users"
  | "send"
  | "file"
  | "task"
  | "search"
  | "more"
  | "mail"
  | "phone"
  | "calendar"
  | "dollar"
  | "key"
  | "external"
  | "settings"
  | "plus"
  | "download"
  | "message";

type PortalStatus = "Active" | "Pending" | "Inactive";

type PortalClient = {
  id: number;
  initials: string;
  name: string;
  email: string;
  status: PortalStatus;
  event: string;
  eventDate: string;
  eventTime: string;
  hall: string;
  files: number;
  balance: number;
  balanceNote: string;
  lastLogin: string;
  lastLoginTime: string;
};

const clients: PortalClient[] = [
  {
    id: 1,
    initials: "F",
    name: "Friedman Family",
    email: "friedman@example.com",
    status: "Active",
    event: "Friedman Wedding",
    eventDate: "Jul 8, 2026",
    eventTime: "6:30 PM",
    hall: "Grand Hall",
    files: 18,
    balance: 30200,
    balanceNote: "Due Jul 22, 2026",
    lastLogin: "Today",
    lastLoginTime: "10:24 AM",
  },
  {
    id: 2,
    initials: "K",
    name: "Klein Family",
    email: "klein@example.com",
    status: "Active",
    event: "Klein Sheva Brachos",
    eventDate: "Jul 11, 2026",
    eventTime: "8:45 PM",
    hall: "Nachlas Yehuda A",
    files: 10,
    balance: 15100,
    balanceNote: "Due Jul 25, 2026",
    lastLogin: "Yesterday",
    lastLoginTime: "7:18 PM",
  },
  {
    id: 3,
    initials: "W",
    name: "Weiss Family",
    email: "weiss@example.com",
    status: "Pending",
    event: "Weiss Bar Mitzvah",
    eventDate: "Jul 14, 2026",
    eventTime: "12:30 PM",
    hall: "Terrace Room",
    files: 6,
    balance: 0,
    balanceNote: "No balance",
    lastLogin: "—",
    lastLoginTime: "Never",
  },
  {
    id: 4,
    initials: "N",
    name: "Nachlas Family",
    email: "nachlas@example.com",
    status: "Active",
    event: "Nachlas Bar Mitzvah",
    eventDate: "Aug 23, 2026",
    eventTime: "6:00 PM",
    hall: "Nachlas Yehuda B",
    files: 12,
    balance: 8750,
    balanceNote: "Due Aug 9, 2026",
    lastLogin: "Jul 6, 2026",
    lastLoginTime: "9:41 AM",
  },
  {
    id: 5,
    initials: "S",
    name: "Stern Family",
    email: "stern@example.com",
    status: "Inactive",
    event: "Stern Wedding",
    eventDate: "Sep 19, 2026",
    eventTime: "7:00 PM",
    hall: "Small Hall",
    files: 4,
    balance: 0,
    balanceNote: "Paid in full",
    lastLogin: "Jun 20, 2026",
    lastLoginTime: "3:12 PM",
  },
];

const recentActivity = [
  { icon: "download" as const, title: "Friedman Family uploaded 3 documents", detail: "Menu selections.pdf, Layout.pdf, GuestList.xlsx", date: "Today", time: "9:58 AM" },
  { icon: "file" as const, title: "Klein Family viewed invoice #INV-1024", detail: "Invoice total $15,100.00", date: "Yesterday", time: "8:12 PM" },
  { icon: "users" as const, title: "Weiss Family accepted portal invitation", detail: "Invitation sent by J. Klein", date: "Jul 6, 2026", time: "4:33 PM" },
  { icon: "download" as const, title: "Nachlas Family downloaded Floor Plan.pdf", detail: "", date: "Jul 5, 2026", time: "11:07 AM" },
];

const sharedDocuments = [
  { name: "Event Timeline.pdf", detail: "Uploaded by J. Klein", date: "Today", time: "9:50 AM" },
  { name: "Menu Selections.pdf", detail: "Uploaded by Friedman Family", date: "Today", time: "9:41 AM" },
  { name: "Floor Plan.pdf", detail: "Uploaded by J. Klein", date: "Yesterday", time: "6:20 PM" },
  { name: "Payment Schedule.xlsx", detail: "Uploaded by Friedman Family", date: "Jul 6, 2026", time: "3:14 PM" },
];

const messages = [
  { initials: "F", name: "Friedman Family", text: "Can we confirm the final guest count by Friday?", date: "Today 10:02 AM" },
  { initials: "K", name: "Klein Family", text: "Please send us the updated layout.", date: "Yesterday 7:45 PM" },
  { initials: "W", name: "Weiss Family", text: "Thanks for the invitation. Looking forward!", date: "Jul 6, 2026 2:11 PM" },
];

function LineIcon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  const paths: Record<IconName, ReactNode> = {
    users: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19v-1.5A4.5 4.5 0 0 1 8 13h2a4.5 4.5 0 0 1 4.5 4.5V19M16 5.5a3 3 0 0 1 0 5.5M17 13a4.5 4.5 0 0 1 3.5 4.4V19" /></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
    file: <><path d="M6 3h9l3 3v15H6Z" /><path d="M15 3v4h4M9 12h6M9 16h6" /></>,
    task: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V2h6v2M9 11l2 2 4-4M9 17h6" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    more: <><circle cx="12" cy="5" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="19" r="1" fill="currentColor" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
    phone: <path d="M5 3h4l2 5-3 2a15 15 0 0 0 6 6l2-3 5 2v4c0 1-1 2-2 2A16 16 0 0 1 3 5c0-1 1-2 2-2Z" />,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></>,
    dollar: <><path d="M12 2v20M17 6.5C16 5.5 14.4 5 12.5 5 10 5 8 6.2 8 8s1.7 2.8 4.5 3.5S17 13 17 16s-2 3-4.5 3c-2 0-3.7-.6-4.8-1.8" /></>,
    key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M16 7l2 2M14 9l2 2" /></>,
    external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 13v6H5V6h6" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.4 3a7 7 0 0 0-1.7 1L5 6.1 3 9.5 5 11a7 7 0 0 0 0 2l-2 1.5L5 18l2.4-1a7 7 0 0 0 1.7 1l.4 3h5l.4-3a7 7 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5a7 7 0 0 0 0-2Z" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    download: <><path d="M12 3v12M7 10l5 5 5-5M4 21h16" /></>,
    message: <><path d="M4 5h16v12H8l-4 4Z" /><path d="M8 9h8M8 13h5" /></>,
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function StatCard({ icon, label, value, description, tone }: { icon: IconName; label: string; value: string; description: string; tone: "blue" | "gold" | "red" }) {
  const tones = {
    blue: "bg-[#eef4fa] text-[#1f5c8a]",
    gold: "bg-[#fff5e7] text-[#a9660c]",
    red: "bg-[#fff0f0] text-[#d84a4a]",
  };

  return (
    <article className="flex min-h-28 items-start justify-between rounded-xl border border-[#d8dde5] bg-white p-4 shadow-sm">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#6a7483]">{label}</p>
        <p className="mt-1 text-2xl font-black text-[#17202a]">{value}</p>
        <p className="mt-1 text-xs font-medium text-[#6a7483]">{description}</p>
      </div>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${tones[tone]}`}>
        <LineIcon name={icon} className="h-6 w-6" />
      </span>
    </article>
  );
}

function StatusBadge({ status }: { status: PortalStatus }) {
  const colors: Record<PortalStatus, string> = {
    Active: "border-[#9edbc1] bg-[#edfbf4] text-[#067647]",
    Pending: "border-[#efd49b] bg-[#fff8e8] text-[#9a5b00]",
    Inactive: "border-[#cbd3dc] bg-[#f4f6f8] text-[#536172]",
  };

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black ${colors[status]}`}>{status}</span>;
}

function PanelHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="flex min-h-14 items-center justify-between gap-3 border-b border-[#d8dde5] px-4 py-3">
      <div>
        <h2 className="text-sm font-black text-[#17202a]">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-[#6a7483]">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

const smallButtonClass = "inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#c7d0dc] bg-white px-3 text-xs font-black text-[#233144] shadow-sm transition hover:bg-[#eef4fa]";

export function ClientPortalPage() {
  const router = useRouter();
  const [syncData, setSyncData] = useState<SyncSignedInUserResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | PortalStatus>("All");
  const [selectedClientId, setSelectedClientId] = useState(1);

  useEffect(() => {
    let isMounted = true;
    const cachedSyncData = getCachedSyncedUser();

    if (cachedSyncData) setSyncData(cachedSyncData);

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
        if (isMounted) setSyncData(synced);
      } catch {
        if (!cachedSyncData) {
          clearCachedSyncedUser();
          router.replace("/");
        }
      }
    }

    loadUser();
    return () => { isMounted = false; };
  }, [router]);

  const filteredClients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return clients.filter((client) => {
      const matchesSearch = !query || `${client.name} ${client.email} ${client.event}`.toLowerCase().includes(query);
      return matchesSearch && (statusFilter === "All" || client.status === statusFilter);
    });
  }, [searchQuery, statusFilter]);

  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? clients[0];

  if (!syncData) return <main className="min-h-screen bg-[#f5f6f8]" aria-busy="true" />;

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#f5f6f8] text-[#17202a]">
      <DashboardTopbar
        title="Client Portal"
        subtitle="Manage portal access, shared files, event visibility, payments, and client communication."
        actionsSlot={
          <>
            <button className={smallButtonClass} type="button"><LineIcon name="plus" />Invite client</button>
            <button className={smallButtonClass} type="button"><LineIcon name="external" />Preview portal</button>
            <button className="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-[#1f4d73] px-3 text-xs font-black text-white shadow-sm hover:bg-[#15344f]" type="button"><LineIcon name="settings" />Portal settings</button>
          </>
        }
      />

      <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4">
        <div className="mx-auto grid w-full max-w-450 gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0 space-y-4">
            <section className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
              <StatCard icon="users" label="Portal users" value="28" description="Active portal accounts" tone="blue" />
              <StatCard icon="send" label="Active invitations" value="6" description="Pending client invitations" tone="gold" />
              <StatCard icon="file" label="Shared documents" value="84" description="Files shared with clients" tone="blue" />
              <StatCard icon="task" label="Open client actions" value="9" description="Tasks needing attention" tone="red" />
            </section>

            <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
              <PanelHeader
                title="Client Portal Accounts"
                subtitle="Manage client access and portal activity."
                action={
                  <div className="flex items-center gap-2">
                    <label className="flex h-9 w-48 items-center gap-2 rounded-lg border border-[#c7d0dc] px-3 text-[#6a7483]" htmlFor="portal-client-search">
                      <LineIcon name="search" />
                      <input id="portal-client-search" name="portalClientSearch" className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-[#17202a] outline-none" placeholder="Search clients" type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
                    </label>
                    <select aria-label="Filter clients by status" className="h-9 rounded-lg border border-[#c7d0dc] bg-white px-3 text-xs font-bold outline-none" name="portalStatusFilter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "All" | PortalStatus)}>
                      <option value="All">All status</option>
                      <option value="Active">Active</option>
                      <option value="Pending">Pending</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                }
              />

              <div className="overflow-x-auto">
                <table className="w-full min-w-210 border-collapse text-left">
                  <thead className="bg-[#fbfcfd] text-[10px] font-black uppercase tracking-[0.08em] text-[#687588]">
                    <tr><th className="px-5 py-3">Client</th><th className="px-3 py-3">Portal status</th><th className="px-3 py-3">Linked events</th><th className="px-3 py-3">Shared files</th><th className="px-3 py-3">Balance</th><th className="px-3 py-3">Last login</th><th className="px-3 py-3 text-center">Actions</th></tr>
                  </thead>
                  <tbody>
                    {filteredClients.map((client) => (
                      <tr className={`cursor-pointer border-t border-[#e2e6ec] transition hover:bg-[#f7fafc] ${selectedClient.id === client.id ? "bg-[#f8fbfe]" : ""}`} key={client.id} onClick={() => setSelectedClientId(client.id)}>
                        <td className="px-5 py-3"><div className="flex items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eaf0f6] text-xs font-black text-[#60758c]">{client.initials}</span><span><strong className="block text-xs">{client.name}</strong><span className="mt-0.5 block text-[10px] text-[#6a7483]">{client.email}</span></span></div></td>
                        <td className="px-3 py-3"><StatusBadge status={client.status} /></td>
                        <td className="px-3 py-3"><strong className="block text-xs">{client.event}</strong><span className="mt-0.5 block text-[10px] text-[#6a7483]">{client.eventDate}</span></td>
                        <td className="px-3 py-3 text-xs font-bold">{client.files}</td>
                        <td className="px-3 py-3"><strong className={`block text-xs ${client.balance ? "text-[#dc3d45]" : "text-[#078a58]"}`}>{client.balance.toLocaleString("en-US", { style: "currency", currency: "USD" })}</strong><span className="mt-0.5 block text-[10px] text-[#6a7483]">{client.balanceNote}</span></td>
                        <td className="px-3 py-3"><strong className="block text-xs">{client.lastLogin}</strong><span className="mt-0.5 block text-[10px] text-[#6a7483]">{client.lastLoginTime}</span></td>
                        <td className="px-3 py-3 text-center"><button aria-label={`Actions for ${client.name}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#cbd3dd] bg-white hover:bg-[#eef4fa]" onClick={(event) => event.stopPropagation()} type="button"><LineIcon name="more" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <footer className="flex items-center justify-between border-t border-[#e2e6ec] px-5 py-2 text-[10px] text-[#6a7483]"><span>Showing {filteredClients.length} of {clients.length} clients</span><div className="flex gap-1"><button className="h-7 w-7 rounded border border-[#d3dae3]" type="button">‹</button><button className="h-7 w-7 rounded bg-[#1f4d73] font-black text-white" type="button">1</button><button className="h-7 w-7 rounded border border-[#d3dae3]" type="button">›</button></div></footer>
            </section>

            <div className="grid gap-4 lg:grid-cols-3">
              <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
                <PanelHeader title="Recent portal activity" subtitle="Latest client portal activity." action={<button className={smallButtonClass} type="button">View all</button>} />
                <div className="divide-y divide-[#e5e9ee] px-3">
                  {recentActivity.map((item) => <article className="flex gap-3 py-3" key={item.title}><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef4fa] text-[#3677a9]"><LineIcon name={item.icon} /></span><div className="min-w-0 flex-1"><strong className="block truncate text-[11px]">{item.title}</strong><p className="mt-1 truncate text-[10px] text-[#6a7483]">{item.detail}</p></div><time className="shrink-0 text-right text-[9px] text-[#6a7483]">{item.date}<br />{item.time}</time></article>)}
                </div>
              </section>

              <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
                <PanelHeader title="Shared documents (latest)" action={<button className={smallButtonClass} type="button">View all</button>} />
                <div className="divide-y divide-[#e5e9ee] px-3">
                  {sharedDocuments.map((document) => <article className="flex gap-3 py-3" key={document.name}><span className="mt-0.5 text-[#52677d]"><LineIcon name="file" /></span><div className="min-w-0 flex-1"><strong className="block truncate text-[11px]">{document.name}</strong><p className="mt-1 truncate text-[10px] text-[#6a7483]">{document.detail}</p></div><time className="shrink-0 text-right text-[9px] text-[#6a7483]">{document.date}<br />{document.time}</time></article>)}
                </div>
              </section>

              <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
                <PanelHeader title="Client messages" action={<button className={smallButtonClass} type="button">View all</button>} />
                <div className="divide-y divide-[#e5e9ee] px-3">
                  {messages.map((message) => <article className="flex gap-3 py-3" key={message.name}><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eaf0f6] text-xs font-black text-[#60758c]">{message.initials}</span><div className="min-w-0 flex-1"><strong className="block text-[11px]">{message.name}</strong><p className="mt-1 text-[10px] leading-4 text-[#6a7483]">{message.text}</p></div><time className="shrink-0 text-right text-[9px] text-[#6a7483]">{message.date}</time></article>)}
                </div>
                <button className="flex w-full items-center justify-between border-t border-[#d8dde5] px-4 py-3 text-[10px] font-black text-[#1f4d73]" type="button">Go to client messages <span>›</span></button>
              </section>
            </div>
          </div>

          <aside className="h-fit overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm xl:sticky xl:top-4">
            <header className="flex items-start justify-between border-b border-[#d8dde5] p-4"><div><h2 className="text-sm font-black">{selectedClient.name}</h2><div className="mt-2"><StatusBadge status={selectedClient.status} /></div></div><button aria-label={`Actions for ${selectedClient.name}`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d1d8e1]" type="button"><LineIcon name="more" /></button></header>

            <section className="border-b border-[#d8dde5] p-4"><h3 className="text-xs font-black">Contact information</h3><div className="mt-3 space-y-2 text-[10px] text-[#47576a]"><p className="flex items-center gap-2"><LineIcon name="phone" />718-555-0142</p><p className="flex items-center gap-2"><LineIcon name="mail" />office@friedman.example</p><p className="flex items-center gap-2"><LineIcon name="users" />M. Stern (Primary contact)</p></div></section>

            <section className="border-b border-[#d8dde5] p-4"><h3 className="text-xs font-black">Linked events</h3><div className="mt-3 flex items-start gap-2"><LineIcon name="calendar" /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><strong className="truncate text-[11px]">{selectedClient.event}</strong><span className="rounded-full bg-[#edfbf4] px-2 py-0.5 text-[8px] font-black text-[#067647]">Confirmed</span></div><p className="mt-1 text-[9px] text-[#6a7483]">{selectedClient.eventDate} at {selectedClient.eventTime}</p><p className="mt-1 text-[9px] text-[#6a7483]">{selectedClient.hall} · 278 guests</p><button className={`${smallButtonClass} mt-3`} type="button">View event</button></div></div></section>

            <section className="border-b border-[#d8dde5] p-4"><h3 className="flex items-center gap-2 text-xs font-black"><LineIcon name="dollar" />Outstanding payments</h3><dl className="mt-3 space-y-2 text-[10px]"><div className="flex justify-between"><dt>Total balance</dt><dd className="font-black text-[#dc3d45]">$30,200.00</dd></div><div className="flex justify-between"><dt>Deposits paid</dt><dd className="font-black text-[#078a58]">$10,000.00</dd></div><div className="flex justify-between"><dt>Remaining due</dt><dd className="font-black text-[#dc3d45]">$20,200.00</dd></div><div className="flex justify-between"><dt>Next due date</dt><dd className="font-black">Jul 22, 2026</dd></div></dl></section>

            <section className="border-b border-[#d8dde5] p-4"><h3 className="text-xs font-black">Portal access</h3><dl className="mt-3 space-y-2 text-[10px]"><div className="flex justify-between"><dt>Role</dt><dd className="font-bold">Primary Contact</dd></div><div className="flex justify-between"><dt>Access level</dt><dd className="font-bold">Full access</dd></div><div className="flex justify-between"><dt>Last login</dt><dd className="font-bold">{selectedClient.lastLoginTime}</dd></div></dl></section>

            <section className="p-4"><h3 className="text-xs font-black">Quick actions</h3><div className="mt-3 grid gap-2"><button className={`${smallButtonClass} w-full justify-start`} type="button"><LineIcon name="key" />Reset password</button><button className={`${smallButtonClass} w-full justify-start`} type="button"><LineIcon name="send" />Resend invite</button><button className={`${smallButtonClass} w-full justify-start`} type="button"><LineIcon name="external" />View portal</button><button className="inline-flex h-9 w-full items-center gap-2 rounded-lg border border-[#efb7bb] bg-white px-3 text-xs font-black text-[#d63740] hover:bg-[#fff4f4]" type="button"><LineIcon name="key" />Disable access</button></div></section>
          </aside>
        </div>
      </main>
    </div>
  );
}
