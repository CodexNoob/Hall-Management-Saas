"use client";

import { useMemo, useState } from "react";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { TodayNotesDrawer } from "@/components/shared/today-notes-drawer";
import { AsyncState } from "@/components/ui/async-state";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { useDashboardPageSearch } from "@/features/dashboard/hooks/use-dashboard-page-search";
import { useDashboardPermission } from "@/features/dashboard/hooks/use-dashboard-permission";

import {
  CategoryBadge,
  Icon,
  MetricCard,
  SectionHeader,
  StatusBadge,
  secondaryButton,
  type Vendor,
  type VendorsResponse,
  type VendorStatus
} from "@/features/vendors/components/vendors-shared";
export function VendorsPage() {
  const canEdit = useDashboardPermission("canEditVendors");
  const vendorsQuery = useAuthenticatedQuery<VendorsResponse>("/api/vendors");
  const [isTodayNotesOpen, setIsTodayNotesOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useDashboardPageSearch("Vendors");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"All" | VendorStatus>("All");
  const [ratingFilter, setRatingFilter] = useState("All");
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const vendors = useMemo<Vendor[]>(
    () =>
      (vendorsQuery.data?.vendors ?? []).map((vendor, index) => ({
        id: vendor.id,
        initials: vendor.name
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part[0])
          .join("")
          .toUpperCase(),
        name: vendor.name,
        description: vendor.description ?? vendor.category,
        category: vendor.category,
        contact: vendor.contactName ?? "Not provided",
        phone: vendor.phone ?? "Not provided",
        email: vendor.email ?? "Not provided",
        status:
          vendor.status === "Active"
            ? "Active"
            : vendor.status === "Pending"
              ? "Pending"
              : "Inactive",
        rating: Number(vendor.rating ?? 0),
        color: ["bg-[#31905b]", "bg-[#568fcb]", "bg-[#db6da6]", "bg-[#8f6ac6]"][
          index % 4
        ]
      })),
    [vendorsQuery.data]
  );

  const categories = useMemo(
    () => [
      "All",
      ...Array.from(new Set(vendors.map((vendor) => vendor.category)))
    ],
    [vendors]
  );
  const filteredVendors = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return vendors.filter((vendor) => {
      const matchesSearch =
        !query ||
        `${vendor.name} ${vendor.contact} ${vendor.category}`
          .toLowerCase()
          .includes(query);
      return (
        matchesSearch &&
        (categoryFilter === "All" || vendor.category === categoryFilter) &&
        (statusFilter === "All" || vendor.status === statusFilter) &&
        (ratingFilter === "All" || vendor.rating >= Number(ratingFilter))
      );
    });
  }, [categoryFilter, ratingFilter, searchQuery, statusFilter, vendors]);
  const selectedVendor =
    vendors.find((vendor) => vendor.id === selectedVendorId) ?? vendors[0];

  if (vendorsQuery.isLoading || vendorsQuery.error || !selectedVendor) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#f5f6f8] p-4">
        <AsyncState
          error={vendorsQuery.error}
          isEmpty={
            !vendorsQuery.isLoading &&
            !vendorsQuery.error &&
            vendors.length === 0
          }
          isLoading={vendorsQuery.isLoading}
          emptyTitle="No vendors yet"
          onRetry={vendorsQuery.refetch}
        />
      </main>
    );
  }

  return (
    <div className="dashboard-readable-page flex h-dvh min-h-0 flex-col overflow-hidden bg-[#f5f6f8] text-[#17202a]">
      <DashboardTopbar
        title="Vendors"
        subtitle="Manage suppliers, service providers, contacts, contracts, and vendor activity."
        actionsSlot={
          <>
            <button
              className={secondaryButton}
              onClick={() => setIsTodayNotesOpen(true)}
              type="button"
            >
              Today notes
            </button>
            <button
              className={secondaryButton}
              disabled={!canEdit}
              type="button"
            >
              <Icon name="export" />
              Export
            </button>
            <button className={secondaryButton} type="button">
              <Icon name="users" />
              Assign to event
            </button>
            <button
              className="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-[#1f4d73] px-3 text-xs font-black text-white shadow-sm hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canEdit}
              type="button"
            >
              <Icon name="plus" />
              Add vendor
            </button>
          </>
        }
      />

      <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4">
        <div className="mx-auto grid w-full max-w-450 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-4">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Total vendors"
                value={String(vendors.length)}
                description="All vendor records"
              />
              <MetricCard
                label="Active vendors"
                value={String(
                  vendors.filter((vendor) => vendor.status === "Active").length
                )}
                description="Verified and active"
              />
              <MetricCard
                label="Inactive vendors"
                value={String(
                  vendors.filter((vendor) => vendor.status !== "Active").length
                )}
                description="Pending or inactive"
              />
              <MetricCard
                label="Categories"
                value={String(Math.max(0, categories.length - 1))}
                description="Service categories"
              />
            </section>

            <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
              <SectionHeader
                title="Vendor directory"
                subtitle={`${vendors.length} vendors`}
                action={
                  <div className="flex gap-2">
                    <button
                      className={secondaryButton}
                      onClick={() => {
                        setSearchQuery("");
                        setCategoryFilter("All");
                        setStatusFilter("All");
                        setRatingFilter("All");
                      }}
                      type="button"
                    >
                      × Clear filters
                    </button>
                    <button
                      className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!canEdit}
                      type="button"
                    >
                      New vendor
                    </button>
                  </div>
                }
              />

              <div className="grid gap-2 border-b border-[#d8dde5] p-3 md:grid-cols-[minmax(180px,1fr)_160px_140px_130px_42px]">
                <label
                  className="flex h-9 items-center gap-2 rounded-lg border border-[#c7d0dc] px-3 text-[#6a7483]"
                  htmlFor="vendor-search"
                >
                  <Icon name="search" />
                  <input
                    className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-[#17202a] outline-none"
                    id="vendor-search"
                    name="vendorSearch"
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search vendors"
                    type="search"
                    value={searchQuery}
                  />
                </label>
                <select
                  className="h-9 rounded-lg border border-[#c7d0dc] bg-white px-3 text-xs font-bold"
                  name="vendorCategory"
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  value={categoryFilter}
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category === "All" ? "All categories" : category}
                    </option>
                  ))}
                </select>
                <select
                  className="h-9 rounded-lg border border-[#c7d0dc] bg-white px-3 text-xs font-bold"
                  name="vendorStatus"
                  onChange={(event) =>
                    setStatusFilter(event.target.value as "All" | VendorStatus)
                  }
                  value={statusFilter}
                >
                  <option value="All">All status</option>
                  <option value="Active">Active</option>
                  <option value="Pending">Pending</option>
                </select>
                <select
                  className="h-9 rounded-lg border border-[#c7d0dc] bg-white px-3 text-xs font-bold"
                  name="vendorRating"
                  onChange={(event) => setRatingFilter(event.target.value)}
                  value={ratingFilter}
                >
                  <option value="All">All ratings</option>
                  <option value="4">4+ stars</option>
                  <option value="3">3+ stars</option>
                </select>
                <button
                  aria-label="Additional filters"
                  className="flex h-9 items-center justify-center rounded-lg border border-[#c7d0dc] bg-white"
                  type="button"
                >
                  <Icon name="filter" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-212.5 border-collapse text-left">
                  <thead className="bg-[#fbfcfd] text-[9px] font-black uppercase tracking-[0.08em] text-[#687588]">
                    <tr>
                      <th className="px-4 py-3">Vendor</th>
                      <th className="px-3 py-3">Category</th>
                      <th className="px-3 py-3">Contact</th>
                      <th className="px-3 py-3">Phone</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Rating</th>
                      <th className="px-3 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVendors.map((vendor) => (
                      <tr
                        className={`cursor-pointer border-t border-[#e2e6ec] transition hover:bg-[#f7fafc] ${selectedVendor.id === vendor.id ? "bg-[#f8fbfe]" : ""}`}
                        key={vendor.id}
                        onClick={() => setSelectedVendorId(vendor.id)}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white ${vendor.color}`}
                            >
                              {vendor.initials}
                            </span>
                            <span>
                              <strong className="block text-[11px]">
                                {vendor.name}
                              </strong>
                              <span className="mt-0.5 block text-[9px] text-[#6a7483]">
                                {vendor.description}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <CategoryBadge category={vendor.category} />
                        </td>
                        <td className="px-3 py-2.5 text-[10px]">
                          {vendor.contact}
                        </td>
                        <td className="px-3 py-2.5 text-[10px]">
                          {vendor.phone}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge status={vendor.status} />
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="whitespace-nowrap text-[10px]">
                            <span className="tracking-wide text-[#ffae00]">
                              ★★★★
                            </span>
                            <span className="text-[#bfc6ce]">★</span>
                            <span className="ml-2 text-[#536172]">
                              {vendor.rating}
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            aria-label={`Actions for ${vendor.name}`}
                            disabled={!canEdit}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#eef4fa]"
                            onClick={(event) => event.stopPropagation()}
                            type="button"
                          >
                            <Icon name="more" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <footer className="flex items-center justify-between border-t border-[#d8dde5] px-4 py-2 text-[10px] text-[#6a7483]">
                <span>
                  Showing 1 to {filteredVendors.length} of {vendors.length}{" "}
                  vendors
                </span>
                <div className="flex gap-2">
                  <button
                    className="h-7 w-8 rounded border border-[#d3dae3]"
                    type="button"
                  >
                    ‹
                  </button>
                  <button
                    className="h-7 w-8 rounded bg-[#1f4d73] font-black text-white"
                    type="button"
                  >
                    1
                  </button>
                  <button
                    className="h-7 w-8 rounded border border-[#d3dae3]"
                    type="button"
                  >
                    2
                  </button>
                  <button
                    className="h-7 w-8 rounded border border-[#d3dae3]"
                    type="button"
                  >
                    ›
                  </button>
                </div>
              </footer>
            </section>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <section className="rounded-xl border border-[#d8dde5] bg-white shadow-sm">
                <SectionHeader title="Linked events (next 60 days)" />
                <div className="space-y-3 p-4 text-[10px]">
                  {[
                    ["Friedman Wedding", "Jul 8, 2026 · Grand Hall"],
                    ["Weiss Bar Mitzvah", "Jul 14, 2026 · Terrace Room"],
                    ["Klein Sheva Brachos", "Jul 11, 2026 · Nachlas Yehuda A"]
                  ].map(([name, detail]) => (
                    <div className="flex justify-between gap-3" key={name}>
                      <div>
                        <strong>{name}</strong>
                        <p className="mt-1 text-[#6a7483]">{detail}</p>
                      </div>
                      <StatusBadge status="Active" />
                    </div>
                  ))}
                </div>
              </section>
              <section className="rounded-xl border border-[#d8dde5] bg-white shadow-sm">
                <SectionHeader title="Vendor history (recent)" />
                <div className="space-y-4 p-4 text-[10px]">
                  <div>
                    <strong>Invoice #INV-2031 paid</strong>
                    <p className="mt-1 text-[#6a7483]">Jun 12, 2026</p>
                  </div>
                  <div>
                    <strong>Service completed · Friedman Wedding</strong>
                    <p className="mt-1 text-[#6a7483]">Jun 8, 2026</p>
                  </div>
                  <div>
                    <strong>Contract renewed</strong>
                    <p className="mt-1 text-[#6a7483]">
                      Extended to Aug 31, 2026
                    </p>
                  </div>
                </div>
              </section>
              <section className="rounded-xl border border-[#d8dde5] bg-white shadow-sm">
                <SectionHeader title="Contract reminder" />
                <div className="m-3 rounded-lg border border-[#e3b76d] bg-[#fff8eb] p-4">
                  <div className="flex gap-3 text-[#a45f00]">
                    <Icon name="warning" />
                    <div>
                      <strong className="text-xs">
                        Contract expires in 52 days
                      </strong>
                      <p className="mt-2 text-[10px] font-black text-[#17202a]">
                        Gourmet Delights Catering
                      </p>
                      <p className="mt-1 text-[9px] text-[#6a7483]">
                        Expires on Aug 31, 2026
                      </p>
                    </div>
                  </div>
                </div>
              </section>
              <section className="rounded-xl border border-[#d8dde5] bg-white shadow-sm">
                <SectionHeader title="Categories overview" />
                <div className="space-y-3 p-4 text-[10px]">
                  {[
                    ["Catering", 4],
                    ["Linens", 2],
                    ["Flowers", 2],
                    ["Rentals", 2],
                    ["AV Services", 1]
                  ].map(([category, count]) => (
                    <div
                      className="flex items-center justify-between"
                      key={String(category)}
                    >
                      <span>{category}</span>
                      <span className="rounded-full bg-[#eef1f4] px-2 py-0.5 font-black">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>

          <aside className="h-fit space-y-4 xl:sticky xl:top-4">
            <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
              <header className="flex items-start justify-between border-b border-[#d8dde5] p-4">
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-full text-base font-black text-white ${selectedVendor.color}`}
                  >
                    {selectedVendor.initials}
                  </span>
                  <div>
                    <h2 className="text-sm font-black">
                      {selectedVendor.name}
                    </h2>
                    {selectedVendor.preferred ? (
                      <span className="mt-2 inline-flex rounded-full bg-[#effaf5] px-2 py-1 text-[9px] font-black text-[#147653]">
                        ★ Preferred vendor
                      </span>
                    ) : null}
                  </div>
                </div>
                <button
                  aria-label="Vendor actions"
                  className="flex h-8 w-8 items-center justify-center"
                  type="button"
                >
                  <Icon name="more" />
                </button>
              </header>
              <dl className="space-y-4 p-4 text-[10px]">
                <div className="grid grid-cols-[20px_90px_1fr] gap-2">
                  <Icon name="users" />
                  <dt>Contact person</dt>
                  <dd>{selectedVendor.contact}</dd>
                </div>
                <div className="grid grid-cols-[20px_90px_1fr] gap-2">
                  <Icon name="phone" />
                  <dt>Phone</dt>
                  <dd>{selectedVendor.phone}</dd>
                </div>
                <div className="grid grid-cols-[20px_90px_1fr] gap-2">
                  <Icon name="mail" />
                  <dt>Email</dt>
                  <dd className="truncate">{selectedVendor.email}</dd>
                </div>
                <div className="grid grid-cols-[20px_90px_1fr] gap-2">
                  <Icon name="briefcase" />
                  <dt>Service type</dt>
                  <dd>{selectedVendor.description}</dd>
                </div>
                <div className="grid grid-cols-[20px_90px_1fr] gap-2">
                  <Icon name="calendar" />
                  <dt>Contract status</dt>
                  <dd>
                    <strong className="text-[#147653]">Active</strong> · Expires
                    Aug 31, 2026
                  </dd>
                </div>
                <div className="grid grid-cols-[20px_90px_1fr] gap-2">
                  <Icon name="calendar" />
                  <dt>Linked events</dt>
                  <dd className="font-black text-[#1f4d73]">5 upcoming</dd>
                </div>
              </dl>
            </section>
            <section className="rounded-xl border border-[#d8dde5] bg-white p-4 shadow-sm">
              <h2 className="text-sm font-black">Quick actions</h2>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  className={secondaryButton}
                  disabled={!canEdit}
                  type="button"
                >
                  <Icon name="edit" />
                  Edit vendor
                </button>
                <button
                  className={secondaryButton}
                  disabled={!canEdit}
                  type="button"
                >
                  <Icon name="users" />
                  Assign to event
                </button>
                <button className={secondaryButton} type="button">
                  <Icon name="history" />
                  View history
                </button>
                <button
                  className={secondaryButton}
                  disabled={!canEdit}
                  type="button"
                >
                  <Icon name="more" />
                  More actions
                </button>
              </div>
            </section>
          </aside>
        </div>
      </main>

      <TodayNotesDrawer
        onClose={() => setIsTodayNotesOpen(false)}
        open={isTodayNotesOpen}
      />
    </div>
  );
}
