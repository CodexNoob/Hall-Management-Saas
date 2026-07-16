"use client";

import { useMemo, useState, type ReactNode } from "react";
import { TodayNotesDrawer } from "@/components/forms-and-modals/today-notes-drawer";
import { DashboardTopbar } from "@/components/topbars/dashboard-topbar";

type VendorStatus = "Active" | "Pending";
type VendorCategory = "Catering" | "Linens" | "Flowers" | "Rentals" | "AV Services" | "Staffing" | "Bakery";
type IconName = "plus" | "export" | "users" | "search" | "filter" | "more" | "phone" | "mail" | "briefcase" | "calendar" | "edit" | "history" | "warning";

type Vendor = {
  id: number;
  initials: string;
  name: string;
  description: string;
  category: VendorCategory;
  contact: string;
  phone: string;
  email: string;
  status: VendorStatus;
  rating: number;
  preferred?: boolean;
  color: string;
};

const vendors: Vendor[] = [
  { id: 1, initials: "G", name: "Gourmet Delights Catering", description: "Catering Services", category: "Catering", contact: "Sarah Goldstein", phone: "718-555-0142", email: "sarah@gourmetdelights.com", status: "Active", rating: 4.6, preferred: true, color: "bg-[#31905b]" },
  { id: 2, initials: "L", name: "Linen Touch", description: "Linen & Rentals", category: "Linens", contact: "Michael Levine", phone: "718-555-0198", email: "michael@linentouch.com", status: "Active", rating: 4.4, color: "bg-[#568fcb]" },
  { id: 3, initials: "B", name: "Blossom & Bloom", description: "Floral Design", category: "Flowers", contact: "Rachel Green", phone: "718-555-0233", email: "rachel@blossombloom.com", status: "Active", rating: 4.9, color: "bg-[#db6da6]" },
  { id: 4, initials: "P", name: "Premier Party Rentals", description: "Rentals & Decor", category: "Rentals", contact: "David Cohen", phone: "718-555-0177", email: "david@premierrentals.com", status: "Active", rating: 4.3, color: "bg-[#bba77d]" },
  { id: 5, initials: "AV", name: "AV Pro Solutions", description: "Audio Visual", category: "AV Services", contact: "Jason Patel", phone: "718-555-0288", email: "jason@avpro.com", status: "Active", rating: 4.5, color: "bg-[#8f6ac6]" },
  { id: 6, initials: "S", name: "Staffing Plus", description: "Staffing Services", category: "Staffing", contact: "Linda Morales", phone: "718-555-0311", email: "linda@staffingplus.com", status: "Pending", rating: 3.5, color: "bg-[#5c8585]" },
  { id: 7, initials: "S", name: "Sweet Endings Bakery", description: "Bakery & Desserts", category: "Bakery", contact: "Avi Stern", phone: "718-555-0204", email: "avi@sweetendings.com", status: "Active", rating: 4.7, color: "bg-[#dc765d]" },
  { id: 8, initials: "K", name: "Kosher Kitchen", description: "Kosher Catering", category: "Catering", contact: "Mendel Katz", phone: "718-555-0148", email: "mendel@kosherkitchen.com", status: "Active", rating: 4.2, color: "bg-[#343a40]" },
];

const categoryColors: Record<VendorCategory, string> = {
  Catering: "border-[#a9dfc9] bg-[#effaf5] text-[#147653]",
  Linens: "border-[#b9d5ef] bg-[#eef6fd] text-[#246b9f]",
  Flowers: "border-[#e7c5e4] bg-[#fff2fc] text-[#a54d9d]",
  Rentals: "border-[#efd39d] bg-[#fff7e8] text-[#a45f00]",
  "AV Services": "border-[#d2c6f7] bg-[#f5f2ff] text-[#6550c4]",
  Staffing: "border-[#efd39d] bg-[#fff7e8] text-[#a45f00]",
  Bakery: "border-[#efc7b9] bg-[#fff4ef] text-[#a84d2c]",
};

function Icon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  const common = { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  const icons: Record<IconName, ReactNode> = {
    plus: <path d="M12 5v14M5 12h14" />,
    export: <><path d="M12 16V3M7 8l5-5 5 5" /><path d="M5 13v7h14v-7" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a5 5 0 0 1 10 0v2M16 6a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    filter: <path d="M4 5h16l-6 7v6l-4 2v-8Z" />,
    more: <><circle cx="12" cy="5" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="19" r="1" fill="currentColor" /></>,
    phone: <path d="M5 3h4l2 5-3 2a15 15 0 0 0 6 6l2-3 5 2v4c0 1-1 2-2 2A16 16 0 0 1 3 5c0-1 1-2 2-2Z" />,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V4h6v3M3 12h18" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></>,
    edit: <path d="m14 5 5 5M4 20l4-1 11-11-4-4L4 15Z" />,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
    warning: <><path d="M12 3 2 21h20Z" /><path d="M12 9v5M12 18h.01" /></>,
  };
  return <svg {...common}>{icons[name]}</svg>;
}

function MetricCard({ label, value, description, warning }: { label: string; value: string; description: string; warning?: boolean }) {
  return <article className="rounded-xl border border-[#d8dde5] bg-white p-4 shadow-sm"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#687588]">{label}</p><p className="mt-2 text-2xl font-black">{value}</p><p className={`mt-2 text-xs ${warning ? "font-bold text-[#b56a00]" : "text-[#6a7483]"}`}>{description}</p></article>;
}

function CategoryBadge({ category }: { category: VendorCategory }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[9px] font-black ${categoryColors[category]}`}>{category}</span>;
}

function StatusBadge({ status }: { status: VendorStatus }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-black ${status === "Active" ? "border-[#a9dfc9] bg-[#effaf5] text-[#147653]" : "border-[#efd39d] bg-[#fff7e8] text-[#a45f00]"}`}>{status}</span>;
}

function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return <header className="flex min-h-14 items-center justify-between gap-3 border-b border-[#d8dde5] px-4 py-3"><div><h2 className="text-sm font-black">{title}</h2>{subtitle ? <p className="mt-0.5 text-[10px] text-[#6a7483]">{subtitle}</p> : null}</div>{action}</header>;
}

const secondaryButton = "inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#c7d0dc] bg-white px-3 text-xs font-black text-[#233144] shadow-sm transition hover:bg-[#eef4fa]";

export function VendorsPage() {
  const [isTodayNotesOpen, setIsTodayNotesOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"All" | VendorStatus>("All");
  const [ratingFilter, setRatingFilter] = useState("All");
  const [selectedVendorId, setSelectedVendorId] = useState(1);

  const categories = useMemo(() => ["All", ...Array.from(new Set(vendors.map((vendor) => vendor.category)))], []);
  const filteredVendors = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return vendors.filter((vendor) => {
      const matchesSearch = !query || `${vendor.name} ${vendor.contact} ${vendor.category}`.toLowerCase().includes(query);
      return matchesSearch && (categoryFilter === "All" || vendor.category === categoryFilter) && (statusFilter === "All" || vendor.status === statusFilter) && (ratingFilter === "All" || vendor.rating >= Number(ratingFilter));
    });
  }, [categoryFilter, ratingFilter, searchQuery, statusFilter]);
  const selectedVendor = vendors.find((vendor) => vendor.id === selectedVendorId) ?? vendors[0];

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#f5f6f8] text-[#17202a]">
      <DashboardTopbar
        title="Vendors"
        subtitle="Manage suppliers, service providers, contacts, contracts, and vendor activity."
        actionsSlot={<><button className={secondaryButton} onClick={() => setIsTodayNotesOpen(true)} type="button">Today notes</button><button className={secondaryButton} type="button"><Icon name="export" />Export</button><button className={secondaryButton} type="button"><Icon name="users" />Assign to event</button><button className="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-[#1f4d73] px-3 text-xs font-black text-white shadow-sm hover:bg-[#15344f]" type="button"><Icon name="plus" />Add vendor</button></>}
      />

      <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4">
        <div className="mx-auto grid w-full max-w-450 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-4">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Active vendors" value="16" description="All verified and active" />
              <MetricCard label="Preferred vendors" value="8" description="Marked as preferred" />
              <MetricCard label="Pending approvals" value="3" description="Awaiting review" />
              <MetricCard label="Expiring contracts" value="4" description="Within next 60 days" warning />
            </section>

            <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
              <SectionHeader title="Vendor directory" subtitle="16 vendors" action={<div className="flex gap-2"><button className={secondaryButton} onClick={() => { setSearchQuery(""); setCategoryFilter("All"); setStatusFilter("All"); setRatingFilter("All"); }} type="button">× Clear filters</button><button className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white" type="button">New vendor</button></div>} />

              <div className="grid gap-2 border-b border-[#d8dde5] p-3 md:grid-cols-[minmax(180px,1fr)_160px_140px_130px_42px]">
                <label className="flex h-9 items-center gap-2 rounded-lg border border-[#c7d0dc] px-3 text-[#6a7483]" htmlFor="vendor-search"><Icon name="search" /><input className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-[#17202a] outline-none" id="vendor-search" name="vendorSearch" onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search vendors" type="search" value={searchQuery} /></label>
                <select className="h-9 rounded-lg border border-[#c7d0dc] bg-white px-3 text-xs font-bold" name="vendorCategory" onChange={(event) => setCategoryFilter(event.target.value)} value={categoryFilter}>{categories.map((category) => <option key={category} value={category}>{category === "All" ? "All categories" : category}</option>)}</select>
                <select className="h-9 rounded-lg border border-[#c7d0dc] bg-white px-3 text-xs font-bold" name="vendorStatus" onChange={(event) => setStatusFilter(event.target.value as "All" | VendorStatus)} value={statusFilter}><option value="All">All status</option><option value="Active">Active</option><option value="Pending">Pending</option></select>
                <select className="h-9 rounded-lg border border-[#c7d0dc] bg-white px-3 text-xs font-bold" name="vendorRating" onChange={(event) => setRatingFilter(event.target.value)} value={ratingFilter}><option value="All">All ratings</option><option value="4">4+ stars</option><option value="3">3+ stars</option></select>
                <button aria-label="Additional filters" className="flex h-9 items-center justify-center rounded-lg border border-[#c7d0dc] bg-white" type="button"><Icon name="filter" /></button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-212.5 border-collapse text-left">
                  <thead className="bg-[#fbfcfd] text-[9px] font-black uppercase tracking-[0.08em] text-[#687588]"><tr><th className="px-4 py-3">Vendor</th><th className="px-3 py-3">Category</th><th className="px-3 py-3">Contact</th><th className="px-3 py-3">Phone</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Rating</th><th className="px-3 py-3 text-center">Actions</th></tr></thead>
                  <tbody>{filteredVendors.map((vendor) => <tr className={`cursor-pointer border-t border-[#e2e6ec] transition hover:bg-[#f7fafc] ${selectedVendor.id === vendor.id ? "bg-[#f8fbfe]" : ""}`} key={vendor.id} onClick={() => setSelectedVendorId(vendor.id)}><td className="px-4 py-2.5"><div className="flex items-center gap-3"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white ${vendor.color}`}>{vendor.initials}</span><span><strong className="block text-[11px]">{vendor.name}</strong><span className="mt-0.5 block text-[9px] text-[#6a7483]">{vendor.description}</span></span></div></td><td className="px-3 py-2.5"><CategoryBadge category={vendor.category} /></td><td className="px-3 py-2.5 text-[10px]">{vendor.contact}</td><td className="px-3 py-2.5 text-[10px]">{vendor.phone}</td><td className="px-3 py-2.5"><StatusBadge status={vendor.status} /></td><td className="px-3 py-2.5"><span className="whitespace-nowrap text-[10px]"><span className="tracking-wide text-[#ffae00]">★★★★</span><span className="text-[#bfc6ce]">★</span><span className="ml-2 text-[#536172]">{vendor.rating}</span></span></td><td className="px-3 py-2.5 text-center"><button aria-label={`Actions for ${vendor.name}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#eef4fa]" onClick={(event) => event.stopPropagation()} type="button"><Icon name="more" /></button></td></tr>)}</tbody>
                </table>
              </div>
              <footer className="flex items-center justify-between border-t border-[#d8dde5] px-4 py-2 text-[10px] text-[#6a7483]"><span>Showing 1 to {filteredVendors.length} of 16 vendors</span><div className="flex gap-2"><button className="h-7 w-8 rounded border border-[#d3dae3]" type="button">‹</button><button className="h-7 w-8 rounded bg-[#1f4d73] font-black text-white" type="button">1</button><button className="h-7 w-8 rounded border border-[#d3dae3]" type="button">2</button><button className="h-7 w-8 rounded border border-[#d3dae3]" type="button">›</button></div></footer>
            </section>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <section className="rounded-xl border border-[#d8dde5] bg-white shadow-sm"><SectionHeader title="Linked events (next 60 days)" /><div className="space-y-3 p-4 text-[10px]">{[["Friedman Wedding", "Jul 8, 2026 · Grand Hall"], ["Weiss Bar Mitzvah", "Jul 14, 2026 · Terrace Room"], ["Klein Sheva Brachos", "Jul 11, 2026 · Nachlas Yehuda A"]].map(([name, detail]) => <div className="flex justify-between gap-3" key={name}><div><strong>{name}</strong><p className="mt-1 text-[#6a7483]">{detail}</p></div><StatusBadge status="Active" /></div>)}</div></section>
              <section className="rounded-xl border border-[#d8dde5] bg-white shadow-sm"><SectionHeader title="Vendor history (recent)" /><div className="space-y-4 p-4 text-[10px]"><div><strong>Invoice #INV-2031 paid</strong><p className="mt-1 text-[#6a7483]">Jun 12, 2026</p></div><div><strong>Service completed · Friedman Wedding</strong><p className="mt-1 text-[#6a7483]">Jun 8, 2026</p></div><div><strong>Contract renewed</strong><p className="mt-1 text-[#6a7483]">Extended to Aug 31, 2026</p></div></div></section>
              <section className="rounded-xl border border-[#d8dde5] bg-white shadow-sm"><SectionHeader title="Contract reminder" /><div className="m-3 rounded-lg border border-[#e3b76d] bg-[#fff8eb] p-4"><div className="flex gap-3 text-[#a45f00]"><Icon name="warning" /><div><strong className="text-xs">Contract expires in 52 days</strong><p className="mt-2 text-[10px] font-black text-[#17202a]">Gourmet Delights Catering</p><p className="mt-1 text-[9px] text-[#6a7483]">Expires on Aug 31, 2026</p></div></div></div></section>
              <section className="rounded-xl border border-[#d8dde5] bg-white shadow-sm"><SectionHeader title="Categories overview" /><div className="space-y-3 p-4 text-[10px]">{[["Catering", 4], ["Linens", 2], ["Flowers", 2], ["Rentals", 2], ["AV Services", 1]].map(([category, count]) => <div className="flex items-center justify-between" key={String(category)}><span>{category}</span><span className="rounded-full bg-[#eef1f4] px-2 py-0.5 font-black">{count}</span></div>)}</div></section>
            </div>
          </div>

          <aside className="h-fit space-y-4 xl:sticky xl:top-4">
            <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
              <header className="flex items-start justify-between border-b border-[#d8dde5] p-4"><div className="flex items-center gap-3"><span className={`flex h-12 w-12 items-center justify-center rounded-full text-base font-black text-white ${selectedVendor.color}`}>{selectedVendor.initials}</span><div><h2 className="text-sm font-black">{selectedVendor.name}</h2>{selectedVendor.preferred ? <span className="mt-2 inline-flex rounded-full bg-[#effaf5] px-2 py-1 text-[9px] font-black text-[#147653]">★ Preferred vendor</span> : null}</div></div><button aria-label="Vendor actions" className="flex h-8 w-8 items-center justify-center" type="button"><Icon name="more" /></button></header>
              <dl className="space-y-4 p-4 text-[10px]"><div className="grid grid-cols-[20px_90px_1fr] gap-2"><Icon name="users" /><dt>Contact person</dt><dd>{selectedVendor.contact}</dd></div><div className="grid grid-cols-[20px_90px_1fr] gap-2"><Icon name="phone" /><dt>Phone</dt><dd>{selectedVendor.phone}</dd></div><div className="grid grid-cols-[20px_90px_1fr] gap-2"><Icon name="mail" /><dt>Email</dt><dd className="truncate">{selectedVendor.email}</dd></div><div className="grid grid-cols-[20px_90px_1fr] gap-2"><Icon name="briefcase" /><dt>Service type</dt><dd>{selectedVendor.description}</dd></div><div className="grid grid-cols-[20px_90px_1fr] gap-2"><Icon name="calendar" /><dt>Contract status</dt><dd><strong className="text-[#147653]">Active</strong> · Expires Aug 31, 2026</dd></div><div className="grid grid-cols-[20px_90px_1fr] gap-2"><Icon name="calendar" /><dt>Linked events</dt><dd className="font-black text-[#1f4d73]">5 upcoming</dd></div></dl>
            </section>
            <section className="rounded-xl border border-[#d8dde5] bg-white p-4 shadow-sm"><h2 className="text-sm font-black">Quick actions</h2><div className="mt-4 grid grid-cols-2 gap-2"><button className={secondaryButton} type="button"><Icon name="edit" />Edit vendor</button><button className={secondaryButton} type="button"><Icon name="users" />Assign to event</button><button className={secondaryButton} type="button"><Icon name="history" />View history</button><button className={secondaryButton} type="button"><Icon name="more" />More actions</button></div></section>
          </aside>
        </div>
      </main>

      <TodayNotesDrawer onClose={() => setIsTodayNotesOpen(false)} open={isTodayNotesOpen} />
    </div>
  );
}
