"use client";

import { useMemo, useState, type ReactNode } from "react";
import { TodayNotesDrawer } from "@/components/forms-and-modals/today-notes-drawer";
import { DashboardTopbar } from "@/components/topbars/dashboard-topbar";
import { AsyncState } from "@/components/ui/async-state";
import { useAuthenticatedQuery } from "@/lib/hooks/use-authenticated-query";
import { useDashboardPermission } from "@/lib/hooks/use-dashboard-permission";

type StaffStatus = "Active" | "Inactive";
type RoleName =
  | "Administrator"
  | "Event Manager"
  | "Kitchen Staff"
  | "Billing Staff"
  | "Viewer";
type IconName =
  | "users"
  | "building"
  | "roles"
  | "search"
  | "more"
  | "phone"
  | "folder"
  | "shield"
  | "check"
  | "edit"
  | "eye"
  | "plus";

type StaffMember = {
  id: string;
  initials: string;
  name: string;
  email: string;
  department: string;
  role: RoleName;
  status: StaffStatus;
  lastLogin: string;
  phone: string;
  color: string;
};

type StaffResponse = {
  staff: Array<{
    id: string;
    name: string;
    email: string;
    phone: string | null;
    department: string;
    role: string;
    status: StaffStatus;
    createdAt: string;
  }>;
};

const roleTemplates: Array<{ role: RoleName; description: string }> = [
  { role: "Administrator", description: "Full access" },
  { role: "Event Manager", description: "Manage events" },
  { role: "Kitchen Staff", description: "Kitchen access" },
  { role: "Billing Staff", description: "Billing access" },
  { role: "Viewer", description: "Read only" }
];

const roleColors: Record<RoleName, string> = {
  Administrator: "border-[#9bc8f2] bg-[#edf6ff] text-[#1769aa]",
  "Event Manager": "border-[#a9dfc9] bg-[#effaf5] text-[#147653]",
  "Kitchen Staff": "border-[#efd39d] bg-[#fff7e8] text-[#a45f00]",
  "Billing Staff": "border-[#d2c6f7] bg-[#f5f2ff] text-[#6550c4]",
  Viewer: "border-[#cdd5df] bg-[#f4f6f8] text-[#536172]"
};

const permissionColumns = [
  "Dashboard",
  "Events",
  "Kitchen",
  "Menu",
  "Billing",
  "Staff",
  "Files",
  "Clients",
  "Settings"
];

function LineIcon({
  name,
  className = "h-4 w-4"
}: {
  name: IconName;
  className?: string;
}) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  };
  const icons: Record<IconName, ReactNode> = {
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19v-1.5A4.5 4.5 0 0 1 8 13h2a4.5 4.5 0 0 1 4.5 4.5V19M16 5.5a3 3 0 0 1 0 5.5M17 13a4.5 4.5 0 0 1 3.5 4.4V19" />
      </>
    ),
    building: (
      <>
        <path d="M4 21V6l8-3 8 3v15M8 9h2M14 9h2M8 13h2M14 13h2M9 21v-4h6v4" />
      </>
    ),
    roles: (
      <>
        <circle cx="8" cy="8" r="3" />
        <path d="M3 20v-2a5 5 0 0 1 10 0v2M16 7h5M18.5 4.5v5M16 14h5M16 18h5" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    more: (
      <>
        <circle cx="12" cy="5" r="1" fill="currentColor" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
        <circle cx="12" cy="19" r="1" fill="currentColor" />
      </>
    ),
    phone: (
      <path d="M5 3h4l2 5-3 2a15 15 0 0 0 6 6l2-3 5 2v4c0 1-1 2-2 2A16 16 0 0 1 3 5c0-1 1-2 2-2Z" />
    ),
    folder: <path d="M3 6h7l2 2h9v11H3Z" />,
    shield: (
      <>
        <path d="M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6Z" />
        <path d="m9 12 2 2 4-5" />
      </>
    ),
    check: <path d="m6 12 4 4 8-9" />,
    edit: (
      <>
        <path d="m14 5 5 5M4 20l4-1 11-11-4-4L4 15Z" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />
  };
  return <svg {...common}>{icons[name]}</svg>;
}

function MetricCard({
  label,
  value,
  description,
  accent
}: {
  label: string;
  value: string;
  description: string;
  accent?: boolean;
}) {
  return (
    <article className="min-h-27 rounded-xl border border-[#d8dde5] bg-white p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#687588]">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-black ${accent ? "text-[#078a58]" : "text-[#17202a]"}`}
      >
        {value}
      </p>
      <p className="mt-2 text-xs text-[#6a7483]">{description}</p>
    </article>
  );
}

function RoleBadge({ role }: { role: RoleName }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-md border px-2 py-1 text-[10px] font-black ${roleColors[role]}`}
    >
      {role}
    </span>
  );
}

function StatusBadge({ status }: { status: StaffStatus }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-black ${status === "Active" ? "border-[#a9dfc9] bg-[#effaf5] text-[#147653]" : "border-[#f2b7ba] bg-[#fff2f2] text-[#d63740]"}`}
    >
      {status}
    </span>
  );
}

function SectionHeader({
  title,
  subtitle,
  action
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex min-h-14 items-center justify-between gap-3 border-b border-[#d8dde5] px-4 py-3">
      <div>
        <h2 className="text-sm font-black">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-[10px] text-[#6a7483]">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </header>
  );
}

const secondaryButtonClass =
  "inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#c7d0dc] bg-white px-3 text-xs font-black text-[#233144] shadow-sm transition hover:bg-[#eef4fa]";

export function StaffPage() {
  const canEdit = useDashboardPermission("canEditStaff");
  const staffQuery = useAuthenticatedQuery<StaffResponse>("/api/staff");
  const [isTodayNotesOpen, setIsTodayNotesOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"All" | StaffStatus>("All");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const staffMembers = useMemo<StaffMember[]>(
    () =>
      (staffQuery.data?.staff ?? []).map((staff, index) => {
        const roles: Record<string, RoleName> = {
          admin: "Administrator",
          manager: "Event Manager",
          kitchen: "Kitchen Staff",
          billing: "Billing Staff",
          viewer: "Viewer"
        };
        return {
          id: staff.id,
          initials: staff.name
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0])
            .join("")
            .toUpperCase(),
          name: staff.name,
          email: staff.email,
          department: staff.department,
          role: roles[staff.role.toLowerCase()] ?? "Viewer",
          status: staff.status,
          lastLogin: "Session activity unavailable",
          phone: staff.phone ?? "Not provided",
          color: [
            "bg-[#397fc2]",
            "bg-[#4eb18c]",
            "bg-[#e4a332]",
            "bg-[#7665d5]"
          ][index % 4]
        };
      }),
    [staffQuery.data]
  );

  const departments = useMemo(
    () => [
      "All",
      ...Array.from(new Set(staffMembers.map((staff) => staff.department)))
    ],
    [staffMembers]
  );
  const filteredStaff = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return staffMembers.filter((staff) => {
      const matchesSearch =
        !query ||
        `${staff.name} ${staff.email} ${staff.role} ${staff.department}`
          .toLowerCase()
          .includes(query);
      return (
        matchesSearch &&
        (departmentFilter === "All" || staff.department === departmentFilter) &&
        (statusFilter === "All" || staff.status === statusFilter)
      );
    });
  }, [departmentFilter, searchQuery, staffMembers, statusFilter]);
  const selectedStaff =
    staffMembers.find((staff) => staff.id === selectedStaffId) ??
    staffMembers[0];

  if (staffQuery.isLoading || staffQuery.error || !selectedStaff) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#f5f6f8] p-4">
        <AsyncState
          error={staffQuery.error}
          isEmpty={
            !staffQuery.isLoading &&
            !staffQuery.error &&
            staffMembers.length === 0
          }
          isLoading={staffQuery.isLoading}
          emptyTitle="No staff members yet"
          onRetry={staffQuery.refetch}
        />
      </main>
    );
  }

  return (
    <div className="dashboard-readable-page flex h-dvh min-h-0 flex-col overflow-hidden bg-[#f5f6f8] text-[#17202a]">
      <DashboardTopbar
        title="Staff"
        subtitle="Manage staff members, roles, departments, and permissions."
        actionsSlot={
          <>
            <button
              className={secondaryButtonClass}
              onClick={() => setIsTodayNotesOpen(true)}
              type="button"
            >
              Today notes
            </button>
            <button
              className="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-[#1f4d73] px-3 text-xs font-black text-white shadow-sm hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canEdit}
              type="button"
            >
              <LineIcon name="plus" />
              Add staff
            </button>
            <button
              className="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-[#1f4d73] px-3 text-xs font-black text-white shadow-sm hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canEdit}
              type="button"
            >
              <LineIcon name="users" />
              Assign role
            </button>
          </>
        }
      />

      <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4">
        <div className="mx-auto grid w-full max-w-450 gap-4 xl:grid-cols-[minmax(0,1fr)_290px]">
          <div className="min-w-0 space-y-4">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Total staff"
                value={String(staffMembers.length)}
                description="All staff members"
              />
              <MetricCard
                label="Active staff"
                value={String(
                  staffMembers.filter((staff) => staff.status === "Active")
                    .length
                )}
                description="Currently active"
                accent
              />
              <MetricCard
                label="Departments"
                value={String(Math.max(0, departments.length - 1))}
                description="Across all operations"
              />
              <MetricCard
                label="Role templates"
                value={String(roleTemplates.length)}
                description="Permission templates"
              />
            </section>

            <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
              <SectionHeader
                title="Role templates"
                subtitle="Predefined roles with permission sets."
                action={
                  <button
                    className={secondaryButtonClass}
                    disabled={!canEdit}
                    type="button"
                  >
                    Manage roles
                  </button>
                }
              />
              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
                {roleTemplates.map((template) => (
                  <button
                    className={`rounded-lg border px-4 py-3 text-left transition hover:-translate-y-0.5 ${roleColors[template.role]}`}
                    key={template.role}
                    type="button"
                  >
                    <strong className="block text-xs">{template.role}</strong>
                    <span className="mt-1 block text-[10px] opacity-80">
                      {template.description}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
              <SectionHeader
                title="Staff directory"
                subtitle={`${staffMembers.length} records`}
                action={
                  <div className="flex items-center gap-2">
                    <label
                      className="flex h-9 w-72 items-center gap-2 rounded-lg border border-[#c7d0dc] px-3 text-[#6a7483]"
                      htmlFor="staff-search"
                    >
                      <LineIcon name="search" />
                      <input
                        id="staff-search"
                        name="staffSearch"
                        className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-[#17202a] outline-none"
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search staff by name, role, or department"
                        type="search"
                        value={searchQuery}
                      />
                    </label>
                    <select
                      aria-label="Filter by department"
                      className="h-9 rounded-lg border border-[#c7d0dc] bg-white px-3 text-xs font-bold"
                      name="staffDepartmentFilter"
                      onChange={(event) =>
                        setDepartmentFilter(event.target.value)
                      }
                      value={departmentFilter}
                    >
                      {departments.map((department) => (
                        <option key={department} value={department}>
                          {department === "All"
                            ? "All departments"
                            : department}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Filter by status"
                      className="h-9 rounded-lg border border-[#c7d0dc] bg-white px-3 text-xs font-bold"
                      name="staffStatusFilter"
                      onChange={(event) =>
                        setStatusFilter(
                          event.target.value as "All" | StaffStatus
                        )
                      }
                      value={statusFilter}
                    >
                      <option value="All">All status</option>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                }
              />

              <div className="overflow-x-auto">
                <table className="w-full min-w-185 border-collapse text-left">
                  <thead className="bg-[#fbfcfd] text-[9px] font-black uppercase tracking-[0.08em] text-[#687588]">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-3 py-3">Department</th>
                      <th className="px-3 py-3">Role</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Last login</th>
                      <th className="px-3 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStaff.map((staff) => (
                      <tr
                        className={`cursor-pointer border-t border-[#e2e6ec] transition hover:bg-[#f7fafc] ${selectedStaff.id === staff.id ? "bg-[#f8fbfe]" : ""}`}
                        key={staff.id}
                        onClick={() => setSelectedStaffId(staff.id)}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white ${staff.color}`}
                            >
                              {staff.initials}
                            </span>
                            <span>
                              <strong className="block text-[11px]">
                                {staff.name}
                              </strong>
                              <span className="mt-0.5 block text-[9px] text-[#6a7483]">
                                {staff.email}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-[10px]">
                          {staff.department}
                        </td>
                        <td className="px-3 py-2.5">
                          <RoleBadge role={staff.role} />
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge status={staff.status} />
                        </td>
                        <td className="px-3 py-2.5 text-[10px]">
                          {staff.lastLogin}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            aria-label={`Actions for ${staff.name}`}
                            disabled={!canEdit}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#eef4fa]"
                            onClick={(event) => event.stopPropagation()}
                            type="button"
                          >
                            <LineIcon name="more" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#d8dde5] px-4 py-2 text-[10px] text-[#6a7483]">
                <span>
                  Showing 1 to {filteredStaff.length} of {staffMembers.length}{" "}
                  results
                </span>
                <div className="flex gap-2">
                  <button
                    className="h-7 w-8 rounded border border-[#d3dae3]"
                    type="button"
                  >
                    ‹
                  </button>
                  {[1, 2, 3, 4, 5].map((page) => (
                    <button
                      className={`h-7 w-8 rounded border text-[10px] font-black ${page === 1 ? "border-[#1f4d73] bg-[#1f4d73] text-white" : "border-[#d3dae3]"}`}
                      key={page}
                      type="button"
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    className="h-7 w-8 rounded border border-[#d3dae3]"
                    type="button"
                  >
                    ›
                  </button>
                </div>
                <label className="flex items-center gap-2">
                  Rows per page
                  <select
                    className="h-7 rounded border border-[#d3dae3] bg-white px-2"
                    name="staffRowsPerPage"
                  >
                    <option>10</option>
                    <option>25</option>
                    <option>50</option>
                  </select>
                </label>
              </footer>
            </section>

            <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
              <SectionHeader
                title="Permission matrix (overview)"
                subtitle="Overview of role permissions across key modules."
              />
              <div className="overflow-x-auto">
                <table className="w-full min-w-185 text-left">
                  <thead className="bg-[#fbfcfd] text-[9px] font-black uppercase text-[#687588]">
                    <tr>
                      <th className="px-4 py-3">Role</th>
                      {permissionColumns.map((column) => (
                        <th className="px-3 py-3 text-center" key={column}>
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {roleTemplates.map((template, rowIndex) => (
                      <tr
                        className="border-t border-[#e2e6ec]"
                        key={template.role}
                      >
                        <td className="px-4 py-3">
                          <RoleBadge role={template.role} />
                        </td>
                        {permissionColumns.map((column, columnIndex) => (
                          <td className="px-3 py-3 text-center" key={column}>
                            {rowIndex === 0 ||
                            columnIndex < 4 ||
                            (rowIndex === 3 && column === "Billing") ? (
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#70c9a5] text-[#078a58]">
                                <LineIcon name="check" className="h-3 w-3" />
                              </span>
                            ) : (
                              <span className="text-[#c1c8d0]">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <aside className="h-fit overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm xl:sticky xl:top-4">
            <SectionHeader title="Selected staff" />
            <div className="p-4">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-13 w-13 shrink-0 items-center justify-center rounded-full text-base font-black text-white ${selectedStaff.color}`}
                >
                  {selectedStaff.initials}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-sm font-black">
                      {selectedStaff.name}
                    </h2>
                    <StatusBadge status={selectedStaff.status} />
                  </div>
                  <p className="mt-1 truncate text-[10px] text-[#6a7483]">
                    {selectedStaff.email}
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-3 text-[11px] text-[#425166]">
                <p className="flex items-center gap-3">
                  <LineIcon name="phone" />
                  {selectedStaff.phone}
                </p>
                <p className="flex items-center gap-3">
                  <LineIcon name="folder" />
                  {selectedStaff.department}
                </p>
                <p className="flex items-center gap-3">
                  <LineIcon name="users" />
                  {selectedStaff.role}
                </p>
                <p className="flex items-center gap-3">
                  <LineIcon name="shield" />
                  Full access
                </p>
              </div>
            </div>

            <section className="mx-3 rounded-xl border border-[#d8dde5] p-3">
              <h3 className="text-xs font-black">Permission summary</h3>
              <ul className="mt-3 space-y-3 text-[10px]">
                {[
                  "Manage all events",
                  "View & edit billing",
                  "Manage staff & roles",
                  "Access reports",
                  "System settings"
                ].map((permission) => (
                  <li
                    className="flex items-center justify-between gap-3"
                    key={permission}
                  >
                    <span className="flex items-center gap-2">
                      <LineIcon name="shield" />
                      {permission}
                    </span>
                    <LineIcon name="check" className="h-4 w-4 text-[#078a58]" />
                  </li>
                ))}
              </ul>
            </section>

            <section className="m-3 mt-4 rounded-xl border border-[#d8dde5] p-3">
              <h3 className="text-xs font-black">Quick actions</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  className={`${secondaryButtonClass} justify-start`}
                  type="button"
                >
                  <LineIcon name="edit" />
                  Edit staff
                </button>
                <button
                  className={`${secondaryButtonClass} justify-start`}
                  type="button"
                >
                  <LineIcon name="users" />
                  Change role
                </button>
                <button
                  className={`${secondaryButtonClass} justify-start`}
                  type="button"
                >
                  <LineIcon name="eye" />
                  View full profile
                </button>
                <button
                  className="inline-flex h-9 items-center justify-start gap-2 whitespace-nowrap rounded-lg border border-[#efb7bb] bg-white px-3 text-xs font-black text-[#d63740] hover:bg-[#fff4f4]"
                  type="button"
                >
                  <LineIcon name="users" />
                  Deactivate staff
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
