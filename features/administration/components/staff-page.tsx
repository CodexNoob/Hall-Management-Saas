"use client";

import { type FormEvent, useMemo, useState } from "react";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { DashboardPageState } from "@/components/layout/dashboard-page-state";
import { TodayNotesDrawer } from "@/components/shared/today-notes-drawer";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { useDashboardPageSearch } from "@/features/dashboard/hooks/use-dashboard-page-search";
import { useDashboardPermission } from "@/features/dashboard/hooks/use-dashboard-permission";
import {
  invalidateAuthenticatedQuery
} from "@/features/dashboard/hooks/use-authenticated-query";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";

import {
  LineIcon,
  RoleBadge,
  SectionHeader,
  StatusBadge,
  permissionColumns,
  roleColors,
  roleTemplates,
  secondaryButtonClass,
  type RoleName,
  type StaffMember,
  type StaffResponse,
  type StaffStatus
} from "@/features/administration/components/staff-shared";
import { normalizeInviteEmails } from "@/features/administration/components/staff-invite-utils";

const apiUrl = "/api/staff";
const rowsPerPage = 10;

const roleValueByName: Record<RoleName, string> = {
  Administrator: "admin",
  "Event Manager": "manager",
  "Kitchen Staff": "kitchen",
  "Billing Staff": "billing",
  Viewer: "viewer"
};

const roleNameByValue: Record<string, RoleName> = {
  owner: "Administrator",
  admin: "Administrator",
  administrator: "Administrator",
  manager: "Event Manager",
  kitchen: "Kitchen Staff",
  billing: "Billing Staff",
  viewer: "Viewer",
  member: "Viewer"
};

const permissionByRole: Record<RoleName, string[]> = {
  Administrator: [
    "Dashboard",
    "Events",
    "Kitchen",
    "Menu",
    "Billing",
    "Staff",
    "Files",
    "Clients",
    "Settings"
  ],
  "Event Manager": [
    "Dashboard",
    "Events",
    "Kitchen",
    "Menu",
    "Files",
    "Clients"
  ],
  "Kitchen Staff": ["Dashboard", "Kitchen", "Menu"],
  "Billing Staff": ["Dashboard", "Events", "Billing", "Files", "Clients"],
  Viewer: ["Dashboard", "Events", "Kitchen", "Menu"]
};

type StaffDialogMode = "add" | "edit" | "role" | null;

type StaffFormState = {
  name: string;
  email: string;
  phone: string;
  department: string;
  role: RoleName;
};

function initialsForName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatStaffRole(role: string): RoleName {
  return roleNameByValue[role.toLowerCase()] ?? "Viewer";
}

function emptyForm(): StaffFormState {
  return {
    name: "",
    email: "",
    phone: "",
    department: "General",
    role: "Viewer"
  };
}

function staffToForm(staff: StaffMember): StaffFormState {
  return {
    name: staff.name,
    email: staff.email,
    phone: staff.phone === "Not provided" ? "" : staff.phone,
    department: staff.department,
    role: staff.role
  };
}

async function readMutationResponse(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Unable to update staff.");
  }
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#687588]">
      {label}
      {children}
    </label>
  );
}

function StaffDialog({
  canEdit,
  form,
  mode,
  mutationError,
  isSaving,
  selectedStaff,
  setForm,
  inviteInput,
  inviteEmails,
  onInviteInputChange,
  onAddInviteEmail,
  onRemoveInviteEmail,
  onClose,
  onSubmit
}: {
  canEdit: boolean;
  form: StaffFormState;
  mode: StaffDialogMode;
  mutationError: string;
  isSaving: boolean;
  selectedStaff: StaffMember | null;
  setForm: (form: StaffFormState) => void;
  inviteInput: string;
  inviteEmails: string[];
  onInviteInputChange: (value: string) => void;
  onAddInviteEmail: () => void;
  onRemoveInviteEmail: (email: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!mode) return null;

  const title =
    mode === "add"
      ? "Invite staff"
      : mode === "role"
        ? "Assign role"
        : "Edit staff";
  const subtitle =
    mode === "add"
      ? "Add one or more staff emails. Each address will be invited to this organization."
      : selectedStaff
        ? `Update ${selectedStaff.name}'s access inside this organization.`
        : "Update staff access.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061126]/55 p-3 backdrop-blur-sm">
      <form
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-[#d8dde5] bg-white shadow-2xl"
        onSubmit={onSubmit}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#d8dde5] px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#1f4d73]">
              Staff access
            </p>
            <h2 className="mt-1 text-xl font-black text-[#17202a]">{title}</h2>
            <p className="mt-1 max-w-lg text-sm text-[#64748b]">{subtitle}</p>
          </div>
          <button
            aria-label="Close staff dialog"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#233144] transition hover:bg-[#eef4fa]"
            onClick={onClose}
            type="button"
          >
            <svg
              aria-hidden="true"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                d="M5 5 19 19M19 5 5 19"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2.25"
              />
            </svg>
          </button>
        </header>

        <div className={`grid gap-4 p-5 ${mode === "add" ? "" : "sm:grid-cols-2"}`}>
          {mode === "add" ? (
            <Field label="Staff Gmail / email">
              <div className="flex items-center gap-2 rounded-lg border border-[#c7d0dc] px-2 py-1.5 focus-within:border-[#1f4d73]">
                <input
                  className="h-9 flex-1 border-0 bg-transparent px-1 text-sm font-semibold normal-case tracking-normal text-[#17202a] outline-none"
                  onChange={(event) => onInviteInputChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      onAddInviteEmail();
                    }
                  }}
                  placeholder="staff@gmail.com"
                  type="email"
                  value={inviteInput}
                />
                <button
                  className="inline-flex h-8 items-center justify-center rounded-md bg-[#1f4d73] px-3 text-xs font-black text-white shadow-sm transition hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!inviteInput.trim()}
                  onClick={onAddInviteEmail}
                  type="button"
                >
                  Add
                </button>
              </div>
              {inviteEmails.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {inviteEmails.map((email) => (
                    <button
                      className="inline-flex items-center gap-1 rounded-full border border-[#d8dde5] bg-[#f7f9fb] px-2.5 py-1 text-[11px] font-black text-[#17202a]"
                      key={email}
                      onClick={() => onRemoveInviteEmail(email)}
                      type="button"
                    >
                      {email}
                      <span className="text-[#64748b]">×</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </Field>
          ) : mode !== "role" ? (
            <>
              <Field label="Full name">
                <input
                  className="h-11 rounded-lg border border-[#c7d0dc] px-3 text-sm font-semibold normal-case tracking-normal text-[#17202a] outline-none focus:border-[#1f4d73]"
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  placeholder="Example: Sarah Cohen"
                  required
                  value={form.name}
                />
              </Field>
              <Field label="Gmail / email invite">
                <input
                  className="h-11 rounded-lg border border-[#c7d0dc] px-3 text-sm font-semibold normal-case tracking-normal text-[#17202a] outline-none focus:border-[#1f4d73]"
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                  placeholder="staff@gmail.com"
                  required
                  type="email"
                  value={form.email}
                />
              </Field>
              <Field label="Phone">
                <input
                  className="h-11 rounded-lg border border-[#c7d0dc] px-3 text-sm font-semibold normal-case tracking-normal text-[#17202a] outline-none focus:border-[#1f4d73]"
                  onChange={(event) =>
                    setForm({ ...form, phone: event.target.value })
                  }
                  placeholder="Optional"
                  value={form.phone}
                />
              </Field>
              <Field label="Department">
                <input
                  className="h-11 rounded-lg border border-[#c7d0dc] px-3 text-sm font-semibold normal-case tracking-normal text-[#17202a] outline-none focus:border-[#1f4d73]"
                  onChange={(event) =>
                    setForm({ ...form, department: event.target.value })
                  }
                  placeholder="Kitchen, Billing, Events..."
                  value={form.department}
                />
              </Field>
            </>
          ) : null}
          {mode !== "add" ? (
            <>
              <Field label="Role">
                <select
                  className="h-11 rounded-lg border border-[#c7d0dc] bg-white px-3 text-sm font-semibold normal-case tracking-normal text-[#17202a] outline-none focus:border-[#1f4d73]"
                  onChange={(event) =>
                    setForm({ ...form, role: event.target.value as RoleName })
                  }
                  value={form.role}
                >
                  {roleTemplates.map((template) => (
                    <option key={template.role} value={template.role}>
                      {template.role}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="rounded-xl border border-[#d8dde5] bg-[#fbfcfd] p-3 text-xs text-[#425166] sm:col-span-2">
                <strong className="text-[#17202a]">Role preview:</strong>{" "}
                {permissionByRole[form.role].join(", ")}
              </div>
            </>
          ) : null}
          {mutationError ? (
            <p className="rounded-lg border border-[#f2b7ba] bg-[#fff2f2] px-3 py-2 text-xs font-bold text-[#c2262f] sm:col-span-2">
              {mutationError}
            </p>
          ) : null}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-[#d8dde5] px-5 py-4 sm:flex-row sm:justify-end">
          <button
            className={secondaryButtonClass}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#1f4d73] px-4 text-sm font-black text-white shadow-sm hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canEdit || isSaving}
            type="submit"
          >
            <LineIcon name={mode === "add" ? "mail" : "check"} />
            {isSaving
              ? "Saving..."
              : mode === "add"
                ? "Invite staff"
                : "Save changes"}
          </button>
        </footer>
      </form>
    </div>
  );
}

export function StaffPage() {
  const canEdit = useDashboardPermission("canEditStaff");
  const staffQuery = useAuthenticatedQuery<StaffResponse>(apiUrl);
  const [isTodayNotesOpen, setIsTodayNotesOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useDashboardPageSearch("Staff");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"All" | StaffStatus>("All");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [dialogMode, setDialogMode] = useState<StaffDialogMode>(null);
  const [form, setForm] = useState<StaffFormState>(emptyForm());
  const [inviteInput, setInviteInput] = useState("");
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [mutationError, setMutationError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const staffMembers = useMemo<StaffMember[]>(
    () =>
      (staffQuery.data?.staff ?? []).map((staff, index) => ({
        id: staff.id,
        initials: initialsForName(staff.name),
        name: staff.name,
        email: staff.email,
        department: staff.department,
        role: formatStaffRole(staff.role),
        status: staff.status,
        lastLogin: "Invited / login tracked after sign-in",
        phone: staff.phone ?? "Not provided",
        color: [
          "bg-[#397fc2]",
          "bg-[#4eb18c]",
          "bg-[#e4a332]",
          "bg-[#7665d5]"
        ][index % 4],
        access: staff.access ?? null
      })),
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

  const totalPages = Math.max(1, Math.ceil(filteredStaff.length / rowsPerPage));
  const paginatedStaff = filteredStaff.slice(
    (Math.min(currentPage, totalPages) - 1) * rowsPerPage,
    Math.min(currentPage, totalPages) * rowsPerPage
  );
  const selectedStaff =
    staffMembers.find((staff) => staff.id === selectedStaffId) ??
    staffMembers[0] ??
    null;

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  }

  function openAddDialog() {
    setMutationError("");
    setForm(emptyForm());
    setInviteInput("");
    setInviteEmails([]);
    setDialogMode("add");
  }

  function openEditDialog(staff: StaffMember | null = selectedStaff) {
    if (!staff) return;
    setSelectedStaffId(staff.id);
    setMutationError("");
    setForm(staffToForm(staff));
    setDialogMode("edit");
  }

  function openRoleDialog(staff: StaffMember | null = selectedStaff) {
    if (!staff) return;
    setSelectedStaffId(staff.id);
    setMutationError("");
    setForm(staffToForm(staff));
    setDialogMode("role");
  }

  async function refreshStaff(message: string) {
    invalidateAuthenticatedQuery(apiUrl);
    await staffQuery.refetch();
    showNotice(message);
  }

  async function submitStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMutationError("");
    setIsSaving(true);

    try {
      const role = roleValueByName[form.role];
      const body =
        dialogMode === "role"
          ? { id: selectedStaff?.id, role }
          : dialogMode === "add"
            ? {
                emails: inviteEmails.length
                  ? inviteEmails
                  : normalizeInviteEmails(inviteInput),
                role
              }
            : {
                id: selectedStaff?.id,
                name: form.name,
                email: form.email,
                phone: form.phone,
                department: form.department,
                role
              };

      if (dialogMode === "add") {
        const emailList = Array.isArray(body.emails)
          ? body.emails.filter(Boolean)
          : [];
        if (!emailList.length) {
          setMutationError("Add at least one valid email address.");
          return;
        }
      }

      const response = await authenticatedFetch(apiUrl, {
        method: dialogMode === "add" ? "POST" : "PATCH",
        body: JSON.stringify(body)
      });
      await readMutationResponse(response);
      setDialogMode(null);
      setInviteInput("");
      setInviteEmails([]);
      await refreshStaff(
        dialogMode === "add"
          ? "Staff invitation created. They can sign in with that email."
          : "Staff member updated."
      );
    } catch (error) {
      setMutationError(
        error instanceof Error ? error.message : "Unable to save staff."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function updateStaffStatus(staff: StaffMember, status: StaffStatus) {
    if (!canEdit) return;
    setIsSaving(true);

    try {
      const response = await authenticatedFetch(apiUrl, {
        method: "PATCH",
        body: JSON.stringify({ id: staff.id, status })
      });
      await readMutationResponse(response);
      await refreshStaff(
        status === "Active" ? "Staff member activated." : "Staff deactivated."
      );
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Unable to update.");
    } finally {
      setIsSaving(false);
    }
  }

  async function removeStaff(staff: StaffMember) {
    if (!canEdit) return;

    const confirmed = window.confirm(
      `Deactivate ${staff.name}? They will no longer have access to this organization.`
    );
    if (!confirmed) return;

    setIsSaving(true);
    try {
      const response = await authenticatedFetch(
        `${apiUrl}?id=${encodeURIComponent(staff.id)}`,
        { method: "DELETE" }
      );
      await readMutationResponse(response);
      await refreshStaff("Staff member deactivated.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Unable to remove.");
    } finally {
      setIsSaving(false);
    }
  }

  if (staffQuery.isLoading || staffQuery.error || !selectedStaff) {
    return (
      <DashboardPageState
        emptyTitle="No staff members yet"
        error={staffQuery.error}
        isEmpty={
          !staffQuery.isLoading &&
          !staffQuery.error &&
          staffMembers.length === 0
        }
        isLoading={staffQuery.isLoading}
        onRetry={staffQuery.refetch}
        subtitle="Manage staff members, roles, departments, and permissions."
        title="Staff"
      />
    );
  }

  return (
    <div className="dashboard-readable-page flex h-dvh min-h-0 flex-col overflow-hidden bg-[#f5f6f8] text-[#17202a]">
      <DashboardTopbar
        compactMobileActions
        title="Staff"
        subtitle="Manage staff members, roles, departments, and permissions."
        actionsSlot={
          <>
            <button
              aria-label="Open today notes"
              className="inline-flex h-9 w-8 shrink-0 items-center justify-center bg-transparent p-0 text-[#17202a] hover:text-[#1f4d73] lg:h-9 lg:w-auto lg:gap-2 lg:rounded-lg lg:border lg:border-[#c7d0dc] lg:bg-white lg:px-3 lg:text-xs lg:font-black lg:shadow-sm lg:hover:bg-[#eef4fa]"
              onClick={() => setIsTodayNotesOpen(true)}
              type="button"
            >
              <LineIcon name="mail" className="h-6 w-6 lg:h-4 lg:w-4" />
              <span className="hidden lg:inline">Today notes</span>
            </button>
            <button
              aria-label="Add staff"
              className="inline-flex h-9 w-8 shrink-0 items-center justify-center bg-transparent p-0 text-[#1f4d73] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto lg:gap-2 lg:whitespace-nowrap lg:rounded-lg lg:bg-[#1f4d73] lg:px-3 lg:text-xs lg:font-black lg:text-white lg:shadow-sm lg:hover:bg-[#15344f] lg:hover:text-white"
              disabled={!canEdit}
              onClick={openAddDialog}
              type="button"
            >
              <LineIcon name="plus" className="h-6 w-6 lg:h-4 lg:w-4" />
              <span className="hidden lg:inline">Add staff</span>
            </button>
            <button
              className="hidden h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-[#1f4d73] px-3 text-xs font-black text-white shadow-sm hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-50 lg:inline-flex"
              disabled={!canEdit}
              onClick={() => openRoleDialog()}
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
            {notice ? (
              <div className="rounded-xl border border-[#a9dfc9] bg-[#effaf5] px-4 py-3 text-xs font-black text-[#147653] shadow-sm">
                {notice}
              </div>
            ) : null}

            <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
              <SectionHeader
                title="Role templates"
                subtitle="Click a role to assign it to the selected staff member."
                action={
                  <button
                    className={secondaryButtonClass}
                    disabled={!canEdit}
                    onClick={() => openRoleDialog()}
                    type="button"
                  >
                    Manage roles
                  </button>
                }
              />
              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
                {roleTemplates.map((template) => (
                  <button
                    className={`rounded-lg border px-4 py-3 text-left transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 ${roleColors[template.role]}`}
                    disabled={!canEdit}
                    key={template.role}
                    onClick={() => {
                      setForm({
                        ...(selectedStaff ? staffToForm(selectedStaff) : emptyForm()),
                        role: template.role
                      });
                      setDialogMode("role");
                    }}
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
                  <div className="grid w-full gap-2 sm:flex sm:w-auto sm:items-center">
                    <label
                      className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#c7d0dc] px-3 text-[#6a7483] sm:w-72"
                      htmlFor="staff-search"
                    >
                      <LineIcon name="search" />
                      <input
                        id="staff-search"
                        name="staffSearch"
                        className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-[#17202a] outline-none"
                        onChange={(event) => {
                          setSearchQuery(event.target.value);
                          setCurrentPage(1);
                        }}
                        placeholder="Search staff by name, role, or department"
                        type="search"
                        value={searchQuery}
                      />
                    </label>
                    <select
                      aria-label="Filter by department"
                      className="h-9 rounded-lg border border-[#c7d0dc] bg-white px-3 text-xs font-bold"
                      name="staffDepartmentFilter"
                      onChange={(event) => {
                        setDepartmentFilter(event.target.value);
                        setCurrentPage(1);
                      }}
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
                      onChange={(event) => {
                        setStatusFilter(
                          event.target.value as "All" | StaffStatus
                        );
                        setCurrentPage(1);
                      }}
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
                      <th className="px-3 py-3">Invite / login</th>
                      <th className="px-3 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedStaff.map((staff) => (
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
                        <td className="px-3 py-2.5">
                          <div className="flex justify-center gap-1">
                            <button
                              aria-label={`Edit ${staff.name}`}
                              disabled={!canEdit}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#eef4fa] disabled:opacity-40"
                              onClick={(event) => {
                                event.stopPropagation();
                                openEditDialog(staff);
                              }}
                              type="button"
                            >
                              <LineIcon name="edit" />
                            </button>
                            <button
                              aria-label={`Change role for ${staff.name}`}
                              disabled={!canEdit}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#eef4fa] disabled:opacity-40"
                              onClick={(event) => {
                                event.stopPropagation();
                                openRoleDialog(staff);
                              }}
                              type="button"
                            >
                              <LineIcon name="users" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#d8dde5] px-4 py-3 text-[10px] text-[#6a7483]">
                <span className="block w-full text-center sm:w-auto sm:text-left">
                  Showing{" "}
                  {filteredStaff.length === 0
                    ? 0
                    : (Math.min(currentPage, totalPages) - 1) * rowsPerPage + 1}{" "}
                  to {Math.min(Math.min(currentPage, totalPages) * rowsPerPage, filteredStaff.length)} of{" "}
                  {filteredStaff.length} results
                </span>
                <div className="flex w-full max-w-full justify-center gap-1 overflow-x-auto pb-1 sm:w-auto sm:justify-start sm:gap-2">
                  <button
                    className="h-7 w-8 rounded border border-[#d3dae3] disabled:opacity-40"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    type="button"
                  >
                    ‹
                  </button>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                    (page) => (
                      <button
                        className={`h-7 w-8 rounded border text-[10px] font-black ${page === currentPage ? "border-[#1f4d73] bg-[#1f4d73] text-white" : "border-[#d3dae3]"}`}
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        type="button"
                      >
                        {page}
                      </button>
                    )
                  )}
                  <button
                    className="h-7 w-8 rounded border border-[#d3dae3] disabled:opacity-40"
                    disabled={currentPage >= totalPages}
                    onClick={() =>
                      setCurrentPage((page) => Math.min(totalPages, page + 1))
                    }
                    type="button"
                  >
                    ›
                  </button>
                </div>
              </footer>
            </section>

            <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
              <SectionHeader
                title="Permission matrix"
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
                    {roleTemplates.map((template) => (
                      <tr
                        className="border-t border-[#e2e6ec]"
                        key={template.role}
                      >
                        <td className="px-4 py-3">
                          <RoleBadge role={template.role} />
                        </td>
                        {permissionColumns.map((column) => (
                          <td className="px-3 py-3 text-center" key={column}>
                            {permissionByRole[template.role].includes(column) ? (
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
                  {permissionByRole[selectedStaff.role].length} permissions
                </p>
              </div>
            </div>

            <section className="mx-3 rounded-xl border border-[#d8dde5] p-3">
              <h3 className="text-xs font-black">Permission summary</h3>
              <ul className="mt-3 space-y-3 text-[10px]">
                {permissionColumns.map((permission) => (
                  <li
                    className="flex items-center justify-between gap-3"
                    key={permission}
                  >
                    <span className="flex items-center gap-2">
                      <LineIcon name="shield" />
                      {permission}
                    </span>
                    {permissionByRole[selectedStaff.role].includes(permission) ? (
                      <LineIcon name="check" className="h-4 w-4 text-[#078a58]" />
                    ) : (
                      <span className="text-[#c1c8d0]">—</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <section className="m-3 mt-4 rounded-xl border border-[#d8dde5] p-3">
              <h3 className="text-xs font-black">Quick actions</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <button
                  className={`${secondaryButtonClass} justify-start`}
                  disabled={!canEdit}
                  onClick={() => openEditDialog()}
                  type="button"
                >
                  <LineIcon name="edit" />
                  Edit staff
                </button>
                <button
                  className={`${secondaryButtonClass} justify-start`}
                  disabled={!canEdit}
                  onClick={() => openRoleDialog()}
                  type="button"
                >
                  <LineIcon name="users" />
                  Change role
                </button>
                <button
                  className={`${secondaryButtonClass} justify-start`}
                  onClick={() => showNotice(`${selectedStaff.name}'s profile is selected.`)}
                  type="button"
                >
                  <LineIcon name="eye" />
                  View profile
                </button>
                {selectedStaff.status === "Active" ? (
                  <button
                    className="inline-flex h-9 items-center justify-start gap-2 whitespace-nowrap rounded-lg border border-[#efb7bb] bg-white px-3 text-xs font-black text-[#d63740] hover:bg-[#fff4f4] disabled:opacity-40"
                    disabled={!canEdit || isSaving}
                    onClick={() => updateStaffStatus(selectedStaff, "Inactive")}
                    type="button"
                  >
                    <LineIcon name="trash" />
                    Deactivate
                  </button>
                ) : (
                  <button
                    className={`${secondaryButtonClass} justify-start`}
                    disabled={!canEdit || isSaving}
                    onClick={() => updateStaffStatus(selectedStaff, "Active")}
                    type="button"
                  >
                    <LineIcon name="check" />
                    Activate
                  </button>
                )}
                <button
                  className="inline-flex h-9 items-center justify-start gap-2 whitespace-nowrap rounded-lg border border-[#efb7bb] bg-white px-3 text-xs font-black text-[#d63740] hover:bg-[#fff4f4] disabled:opacity-40 sm:col-span-2 xl:col-span-1 2xl:col-span-2"
                  disabled={!canEdit || isSaving}
                  onClick={() => removeStaff(selectedStaff)}
                  type="button"
                >
                  <LineIcon name="trash" />
                  Remove access
                </button>
              </div>
            </section>
          </aside>
        </div>
      </main>

      <StaffDialog
        canEdit={canEdit}
        form={form}
        mode={dialogMode}
        mutationError={mutationError}
        isSaving={isSaving}
        selectedStaff={selectedStaff}
        setForm={setForm}
        inviteInput={inviteInput}
        inviteEmails={inviteEmails}
        onInviteInputChange={setInviteInput}
        onAddInviteEmail={() => {
          const normalized = normalizeInviteEmails(inviteInput).filter((email) =>
            email.includes("@")
          );
          if (!normalized.length) return;
          setInviteEmails((current) => {
            const seen = new Set(current);
            const next = [...current];
            normalized.forEach((email) => {
              if (!seen.has(email)) {
                next.push(email);
                seen.add(email);
              }
            });
            return next;
          });
          setInviteInput("");
        }}
        onRemoveInviteEmail={(email) =>
          setInviteEmails((current) => current.filter((item) => item !== email))
        }
        onClose={() => setDialogMode(null)}
        onSubmit={submitStaff}
      />
    </div>
  );
}
