"use client";

import { type FormEvent, useEffect, useState } from "react";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { DashboardPageState } from "@/components/layout/dashboard-page-state";
import { TodayNotesDrawer } from "@/components/shared/today-notes-drawer";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { useDashboardPageSearch } from "@/features/dashboard/hooks/use-dashboard-page-search";
import { useDashboardAccess } from "@/features/dashboard/hooks/use-dashboard-permission";
import { invalidateAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import {
  StaffDialog,
  accessFromStaff,
  emptyForm,
  readMutationResponse,
  staffToForm,
  type StaffDialogMode,
  type StaffFormState,
  type StaffInvitation
} from "@/features/administration/components/staff-dialog";

import {
  LineIcon,
  RoleBadge,
  SectionHeader,
  StatusBadge,
  permissionColumns,
  roleColors,
  roleTemplates,
  secondaryButtonClass,
  type StaffMember,
  type StaffResponse,
  type StaffStatus
} from "@/features/administration/components/staff-shared";
import { parsePhoneInput } from "@/lib/validation/phone";
import { normalizeInviteEmails } from "@/features/administration/components/staff-invite-utils";
import { StaffProfileDialog } from "@/features/administration/components/staff-profile-dialog";
import { useStaffDirectory } from "@/features/administration/hooks/use-staff-directory";
import {
  accessForRole,
  activePermissionLabelsForRole,
  hasPermissionGroup,
  roleAccess,
  staffRoleValueByName,
  type RoleAccessMatrix,
  type StaffRoleValue
} from "@/lib/auth/permissions";

const apiUrl = "/api/staff";
export function StaffPage() {
  const [isTodayNotesOpen, setIsTodayNotesOpen] = useState(false);
  const { canAccessRoute, hasPermission } = useDashboardAccess();
  const canViewStaff = canAccessRoute("/dashboard/staff");
  const canEdit = hasPermission("canEditStaff");
  const staffQuery = useAuthenticatedQuery<StaffResponse>(apiUrl, canViewStaff);
  const [searchQuery, setSearchQuery] = useDashboardPageSearch("Staff");
  const [dialogMode, setDialogMode] = useState<StaffDialogMode>(null);
  const [form, setForm] = useState<StaffFormState>(emptyForm());
  const [inviteInput, setInviteInput] = useState("");
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [mutationError, setMutationError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  // Kept outside `notice` because it must not auto-dismiss: an unsent invitation
  // link is the only copy of that token the inviter will ever see.
  const [undeliveredInvites, setUndeliveredInvites] = useState<StaffInvitation[]>(
    []
  );
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [selectedAccess, setSelectedAccess] = useState<RoleAccessMatrix | null>(
    null
  );
  const [roleMatrixAccess, setRoleMatrixAccess] =
    useState<Record<StaffRoleValue, RoleAccessMatrix>>(roleAccess);

  const {
    currentPage, departmentFilter, departments, filteredStaff, paginatedStaff,
    selectedStaff, rowsPerPage, setCurrentPage, setDepartmentFilter,
    setSelectedStaffId, setStatusFilter, staffMembers, statusFilter, totalPages
  } = useStaffDirectory(staffQuery.data, searchQuery);
  const matrixRoles = staffQuery.data?.matrix?.roles ?? roleTemplates;
  const matrixColumns = staffQuery.data?.matrix?.columns ?? permissionColumns;
  const canCustomizePermissions =
    canEdit && staffQuery.data?.canCustomizePermissions === true;

  useEffect(() => {
    setSelectedAccess(selectedStaff ? accessFromStaff(selectedStaff) : null);
  }, [selectedStaff]);

  useEffect(() => {
    const matrixAccess = staffQuery.data?.matrix?.access;
    if (!matrixAccess) {
      setRoleMatrixAccess(roleAccess);
      return;
    }

    setRoleMatrixAccess(
      Object.fromEntries(
        Object.entries(roleAccess).map(([role, defaults]) => [
          role,
          {
            ...defaults,
            ...(matrixAccess[role] ?? {})
          }
        ])
      ) as Record<StaffRoleValue, RoleAccessMatrix>
    );
  }, [staffQuery.data?.matrix?.access]);

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  }

  async function copyInviteLink(link: string | null) {
    if (!link) return;

    try {
      await navigator.clipboard.writeText(link);
      showNotice("Invite link copied.");
    } catch {
      // Clipboard access is denied outside a secure context, so point at the
      // visible field rather than claiming the link was copied.
      showNotice("Could not copy automatically. Select the link and copy it.");
    }
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
      const role = staffRoleValueByName[form.role];

      // Same parser the route handler runs. Only the edit branch sends a
      // phone, so an invalid one is caught before the request goes out.
      const parsedPhone = parsePhoneInput(form.phone, {
        country: form.phoneCountry,
        label: "Phone number"
      });

      if (dialogMode === "edit" && parsedPhone.status === "invalid") {
        setMutationError(parsedPhone.message);
        return;
      }

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
                // Normalized, so the stored value matches every other surface.
                phone:
                  parsedPhone.status === "valid" ? parsedPhone.value : "",
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
      const payload = await readMutationResponse(response);
      setDialogMode(null);
      setInviteInput("");
      setInviteEmails([]);

      if (dialogMode !== "add") {
        await refreshStaff("Staff member updated.");
        return;
      }

      const undelivered = (payload?.invites ?? []).filter(
        (invite) => !invite.emailSent
      );
      setUndeliveredInvites(undelivered);
      await refreshStaff(
        undelivered.length
          ? `Staff access created, but ${undelivered.length} invitation email${undelivered.length > 1 ? "s" : ""} could not be sent.`
          : "Staff invitation email sent. They can use the invite link to join."
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

  function togglePermissionGroup(
    permissions: Array<keyof RoleAccessMatrix>,
    checked: boolean
  ) {
    if (!canCustomizePermissions || !selectedAccess) return;

    setSelectedAccess((current) => {
      if (!current) return current;
      return permissions.reduce(
        (nextAccess, permission) => ({
          ...nextAccess,
          [permission]: checked
        }),
        { ...current }
      );
    });
  }

  function toggleRolePermissionGroup(
    role: StaffRoleValue,
    permissions: Array<keyof RoleAccessMatrix>,
    checked: boolean
  ) {
    if (!canCustomizePermissions) return;

    setRoleMatrixAccess((current) => ({
      ...current,
      [role]: permissions.reduce(
        (nextAccess, permission) => ({
          ...nextAccess,
          [permission]: checked
        }),
        { ...current[role] }
      )
    }));

    if (selectedStaff && staffRoleValueByName[selectedStaff.role] === role) {
      setSelectedAccess((current) => {
        const base = current ?? roleMatrixAccess[role] ?? roleAccess[role];
        return permissions.reduce(
          (nextAccess, permission) => ({
            ...nextAccess,
            [permission]: checked
          }),
          { ...base }
        );
      });
    }
  }

  async function saveRoleMatrixPermissions() {
    if (!canCustomizePermissions) return;

    setIsSaving(true);
    try {
      const response = await authenticatedFetch(apiUrl, {
        method: "PATCH",
        body: JSON.stringify({
          roleAccessOverrides: roleMatrixAccess
        })
      });
      await readMutationResponse(response);
      await refreshStaff("Permission matrix updated.");
    } catch (error) {
      showNotice(
        error instanceof Error
          ? error.message
          : "Unable to save permission matrix."
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!canViewStaff || staffQuery.isLoading || staffQuery.error || !selectedStaff) {
    return (
      <DashboardPageState
        emptyMessage={
          canViewStaff
            ? undefined
            : "You do not have permission to view staff members. Contact an administrator if you need access."
        }
        emptyTitle={canViewStaff ? "No staff members yet" : "Access restricted"}
        error={canViewStaff ? staffQuery.error : null}
        isEmpty={
          !canViewStaff ||
          (!staffQuery.isLoading &&
            !staffQuery.error &&
            staffMembers.length === 0)
        }
        isLoading={canViewStaff && staffQuery.isLoading}
        onRetry={canViewStaff ? staffQuery.refetch : undefined}
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
        <div className="mx-auto grid w-full max-w-450 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_290px]">
          <div className="min-w-0 space-y-4">
            {notice ? (
              <div className="rounded-xl border border-[#a9dfc9] bg-[#effaf5] px-4 py-3 text-xs font-black text-[#147653] shadow-sm">
                {notice}
              </div>
            ) : null}

            {undeliveredInvites.length ? (
              <div className="rounded-xl border border-[#e8c982] bg-[#fdf8ec] px-4 py-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-black text-[#8a6412]">
                    Staff access is active, but these invitation emails were not
                    delivered. Share each link directly instead - every link works
                    once and expires.
                  </p>
                  <button
                    className="shrink-0 text-[10px] font-black uppercase tracking-[0.08em] text-[#8a6412] underline"
                    onClick={() => setUndeliveredInvites([])}
                    type="button"
                  >
                    Dismiss
                  </button>
                </div>

                <ul className="mt-3 space-y-2">
                  {undeliveredInvites.map((invite) => (
                    <li
                      className="rounded-lg border border-[#efe0bd] bg-white px-3 py-2"
                      key={invite.email}
                    >
                      <p className="text-xs font-black text-[#0f172a]">
                        {invite.email}
                      </p>
                      {invite.error ? (
                        <p className="mt-0.5 text-[11px] font-semibold text-[#8a6412]">
                          {invite.error}
                        </p>
                      ) : null}
                      {invite.inviteLink ? (
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            className="min-w-0 flex-1 rounded-md border border-[#d8dde5] bg-[#f8fafc] px-2 py-1.5 text-[11px] text-[#334155]"
                            onFocus={(event) => event.currentTarget.select()}
                            readOnly
                            value={invite.inviteLink}
                          />
                          <button
                            className={secondaryButtonClass}
                            onClick={() => copyInviteLink(invite.inviteLink)}
                            type="button"
                          >
                            Copy
                          </button>
                        </div>
                      ) : (
                        <p className="mt-1 text-[11px] font-semibold text-[#b3261e]">
                          No invite link could be generated. Reopen Add staff for
                          this address to try again.
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
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
                        ...(selectedStaff
                          ? staffToForm(selectedStaff)
                          : emptyForm()),
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
                    : (Math.min(currentPage, totalPages) - 1) * rowsPerPage +
                      1}{" "}
                  to{" "}
                  {Math.min(
                    Math.min(currentPage, totalPages) * rowsPerPage,
                    filteredStaff.length
                  )}{" "}
                  of {filteredStaff.length} results
                </span>
                <div className="flex w-full max-w-full justify-center gap-1 overflow-x-auto pb-1 sm:w-auto sm:justify-start sm:gap-2">
                  <button
                    className="h-7 w-8 rounded border border-[#d3dae3] disabled:opacity-40"
                    disabled={currentPage <= 1}
                    onClick={() =>
                      setCurrentPage((page) => Math.max(1, page - 1))
                    }
                    type="button"
                  >
                    &lsaquo;
                  </button>
                  {Array.from(
                    { length: totalPages },
                    (_, index) => index + 1
                  ).map((page) => (
                    <button
                      className={`h-7 w-8 rounded border text-[10px] font-black ${page === currentPage ? "border-[#1f4d73] bg-[#1f4d73] text-white" : "border-[#d3dae3]"}`}
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      type="button"
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    className="h-7 w-8 rounded border border-[#d3dae3] disabled:opacity-40"
                    disabled={currentPage >= totalPages}
                    onClick={() =>
                      setCurrentPage((page) => Math.min(totalPages, page + 1))
                    }
                    type="button"
                  >
                    &rsaquo;
                  </button>
                </div>
              </footer>
            </section>

            <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
              <SectionHeader
                title="Permission matrix"
                subtitle="Overview of role permissions across key modules."
              />
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eef1f5] px-4 py-3 text-[10px] text-[#6a7483]">
                <span>
                  Admins and organization owners can click any checkmark to
                  customize each role.
                </span>
                <button
                  className="rounded-lg border border-[#b9c2cf] px-3 py-1.5 text-[10px] font-black text-[#1f4d73] transition hover:bg-[#edf3f8] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canCustomizePermissions || isSaving}
                  onClick={saveRoleMatrixPermissions}
                  type="button"
                >
                  Save matrix
                </button>
              </div>
              {!canCustomizePermissions ? (
                <p className="mx-4 mb-3 rounded-lg border border-[#f1d49a] bg-[#fff8e8] px-3 py-2 text-[10px] font-bold leading-snug text-[#9a6400]">
                  Only an admin or organization owner can edit staff
                  permissions.
                </p>
              ) : null}
              <div className="overflow-x-auto">
                <table className="w-full min-w-185 text-left">
                  <thead className="bg-[#fbfcfd] text-[9px] font-black uppercase text-[#687588]">
                    <tr>
                      <th className="px-4 py-3">Role</th>
                      {matrixColumns.map((column) => (
                        <th
                          className="px-3 py-3 text-center"
                          key={column.label}
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrixRoles.map((template) => {
                      const roleValue = staffRoleValueByName[template.role];
                      const rowAccess =
                        roleMatrixAccess[roleValue] ?? accessForRole(roleValue);

                      return (
                        <tr
                          className="border-t border-[#e2e6ec]"
                          key={template.role}
                        >
                          <td className="px-4 py-3">
                            <RoleBadge role={template.role} />
                          </td>
                          {matrixColumns.map((column) => {
                            const isChecked = hasPermissionGroup(
                              rowAccess,
                              column.permissions
                            );

                            return (
                              <td
                                className={`px-3 py-3 text-center ${
                                  canCustomizePermissions
                                    ? "cursor-pointer hover:bg-[#edf3f8]"
                                    : ""
                                }`}
                                key={column.label}
                                onClick={() =>
                                  toggleRolePermissionGroup(
                                    roleValue,
                                    column.permissions,
                                    !isChecked
                                  )
                                }
                                title={
                                  canCustomizePermissions
                                    ? `Toggle ${column.label} for ${template.role}`
                                    : column.description
                                }
                              >
                                {isChecked ? (
                                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#70c9a5] text-[#078a58]">
                                    <LineIcon
                                      name="check"
                                      className="h-3 w-3"
                                    />
                                  </span>
                                ) : (
                                  <span className="text-[#c1c8d0]">
                                    &mdash;
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
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
                  {
                    activePermissionLabelsForRole(
                      staffRoleValueByName[selectedStaff.role]
                    ).length
                  }{" "}
                  permission groups
                </p>
              </div>
            </div>

            <section className="mx-3 rounded-xl border border-[#d8dde5] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xs font-black">Permission summary</h3>
                  <p className="mt-1 text-[9px] leading-snug text-[#6a7483]">
                    Current access for the selected staff member.
                  </p>
                </div>
              </div>
              <label className="mt-3 block">
                <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.12em] text-[#687588]">
                  Permission group
                </span>
                <select
                  className="h-10 w-full rounded-lg border border-[#c7d0dc] bg-white px-3 text-xs font-bold text-[#17202a] outline-none focus:border-[#1f4d73]"
                  id={`staff-permission-summary-${selectedStaff.id}`}
                  name="staffPermissionSummary"
                >
                  {matrixColumns.map((permission) => {
                    const hasAccess = hasPermissionGroup(
                      selectedAccess ??
                        selectedStaff.access ??
                        accessForRole(staffRoleValueByName[selectedStaff.role]),
                      permission.permissions
                    );

                    return (
                      <option key={permission.label} value={permission.label}>
                        {permission.label} -{" "}
                        {hasAccess ? "Allowed" : "No access"}
                      </option>
                    );
                  })}
                </select>
              </label>
              <p className="mt-2 text-[9px] leading-snug text-[#6a7483]">
                Edit access by clicking the checkmarks in the Permission matrix.
              </p>
              <ul className="hidden">
                {matrixColumns.map((permission) => (
                  <li
                    className="flex items-start justify-between gap-3 rounded-lg border border-[#edf0f4] p-2 transition hover:bg-[#f8fafc]"
                    key={permission.label}
                  >
                    <label className="flex min-w-0 flex-1 cursor-default items-start gap-2">
                      <input
                        checked={hasPermissionGroup(
                          selectedAccess ??
                            selectedStaff.access ??
                            accessForRole(
                              staffRoleValueByName[selectedStaff.role]
                            ),
                          permission.permissions
                        )}
                        className="hidden"
                        disabled
                        id={`staff-permission-${selectedStaff.id}-${permission.label
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")}`}
                        name={`staffPermission${permission.label.replace(
                          /[^a-zA-Z0-9]+/g,
                          ""
                        )}`}
                        onChange={(event) =>
                          togglePermissionGroup(
                            permission.permissions,
                            event.target.checked
                          )
                        }
                        type="checkbox"
                      />
                      <span className="flex min-w-0 items-start gap-2">
                        <LineIcon name="shield" />
                        <span>
                          <span className="block font-black">
                            {permission.label}
                          </span>
                          <span className="mt-0.5 block text-[9px] leading-snug text-[#6a7483]">
                            {permission.description}
                          </span>
                        </span>
                      </span>
                    </label>
                    {hasPermissionGroup(
                      selectedAccess ??
                        selectedStaff.access ??
                        accessForRole(staffRoleValueByName[selectedStaff.role]),
                      permission.permissions
                    ) ? (
                      <LineIcon
                        name="check"
                        className="h-4 w-4 text-[#078a58]"
                      />
                    ) : (
                      <span className="text-[#c1c8d0]">&mdash;</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <section className="m-3 mt-4 rounded-xl border border-[#d8dde5] p-3">
              <h3 className="text-xs font-black">Quick actions</h3>
              <div className="mt-3 grid grid-cols-1 gap-2">
                <button
                  className={`${secondaryButtonClass} w-full min-w-0 justify-start overflow-hidden px-4`}
                  disabled={!canEdit}
                  onClick={() => openEditDialog()}
                  type="button"
                >
                  <LineIcon name="edit" />
                  <span className="min-w-0 truncate">Edit staff</span>
                </button>
                <button
                  className={`${secondaryButtonClass} w-full min-w-0 justify-start overflow-hidden px-4`}
                  disabled={!canEdit}
                  onClick={() => openRoleDialog()}
                  type="button"
                >
                  <LineIcon name="users" />
                  <span className="min-w-0 truncate">Change role</span>
                </button>
                <button
                  className={`${secondaryButtonClass} w-full min-w-0 justify-start overflow-hidden px-4`}
                  onClick={() => setIsProfileOpen(true)}
                  type="button"
                >
                  <LineIcon name="eye" />
                  <span className="min-w-0 truncate">View profile</span>
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
          const normalized = normalizeInviteEmails(inviteInput).filter(
            (email) => email.includes("@")
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
      <StaffProfileDialog
        onClose={() => setIsProfileOpen(false)}
        open={isProfileOpen}
        permissionLabels={activePermissionLabelsForRole(
          staffRoleValueByName[selectedStaff.role]
        )}
        staff={selectedStaff}
      />
      <TodayNotesDrawer
        onClose={() => setIsTodayNotesOpen(false)}
        open={isTodayNotesOpen}
      />
    </div>
  );
}
