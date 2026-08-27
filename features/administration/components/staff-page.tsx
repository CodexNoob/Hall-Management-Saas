"use client";

import { useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DashboardPageState } from "@/components/layout/dashboard-page-state";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { TodayNotesDrawer } from "@/components/shared/today-notes-drawer";
import {
  invalidateAuthenticatedQuery,
  useAuthenticatedQuery
} from "@/features/dashboard/hooks/use-authenticated-query";
import { useDashboardPageSearch } from "@/features/dashboard/hooks/use-dashboard-page-search";
import { useDashboardAccess } from "@/features/dashboard/hooks/use-dashboard-permission";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import {
  StaffDialog,
  emptyForm,
  readMutationResponse,
  staffToForm,
  type StaffDialogMode,
  type StaffFormState,
  type StaffInvitation
} from "@/features/administration/components/staff-dialog";
import {
  LineIcon,
  SectionHeader,
  StatusBadge,
  secondaryButtonClass
} from "@/features/administration/components/staff-shared";
import { StaffProfileDialog } from "@/features/administration/components/staff-profile-dialog";
import { useStaffDirectory } from "@/features/administration/hooks/use-staff-directory";
import { AssignmentDialog } from "@/features/access/components/assignment-dialog";
import { RoleBadge } from "@/features/access/components/role-editor";
import type {
  RolesResponse,
  StaffResponse
} from "@/features/access/components/access-shared";
import { AccessRolesPanel } from "@/features/access/components/access-roles-panel";
import { AuditPanel } from "@/features/access/components/audit-panel";
import {
  resolveStaffTab,
  visibleStaffTabs,
  type StaffTab
} from "@/features/administration/components/staff-tabs";

/**
 * Staff management, in four tabs: WHO WORKS HERE, what they may do, who has not
 * arrived yet, and what was changed.
 *
 * ONE PAGE, STILL TWO PERMISSIONS. The permission matrix used to be its own
 * route and its own sidebar entry, and that separation existed because editing a
 * phone number and handing out privileges had been one screen behind one
 * permission - exactly the conflation this design undoes. Folding Access back in
 * as a tab keeps the separation where it actually lives: each tab carries the
 * key its old route was gated on, so Roles & Permissions is absent, not merely
 * inert, for anybody without `role.read`. See staff-tabs.ts.
 *
 * The bridge from a person to their privileges is the "Access" button on each
 * row, which opens the assignment dialog - and that dialog posts to
 * /api/access/assignments like everything else. One writer per privilege change.
 */

const STAFF_URL = "/api/staff";

export function StaffPage() {
  const access = useDashboardAccess();
  const canViewStaff = access.hasPermission("staff.read");
  const canInvite = access.hasPermission("staff.invite");
  const canEditProfiles = access.hasPermission("staff.update");
  const canDeactivate = access.hasPermission("staff.deactivate");
  const canAssign = access.hasPermission("role.assign");

  const staffQuery = useAuthenticatedQuery<StaffResponse>(
    STAFF_URL,
    canViewStaff
  );
  const rolesQuery = useAuthenticatedQuery<RolesResponse>(
    "/api/access/roles",
    canAssign
  );

  const [searchQuery] = useDashboardPageSearch("Staff");
  const [isTodayNotesOpen, setIsTodayNotesOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<StaffDialogMode>(null);
  const [form, setForm] = useState<StaffFormState>(emptyForm());
  const [editingPrincipalId, setEditingPrincipalId] = useState("");
  const [inviteInput, setInviteInput] = useState("");
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [mutationError, setMutationError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  // Kept out of `notice` because it must not auto-dismiss: an undelivered
  // invitation link is the only copy of that token the inviter will ever see.
  const [undeliveredInvites, setUndeliveredInvites] = useState<
    StaffInvitation[]
  >([]);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [assigningPrincipalId, setAssigningPrincipalId] = useState("");

  const {
    currentPage,
    departmentFilter,
    departments,
    filteredStaff,
    paginatedStaff,
    rowsPerPage,
    selectedStaff,
    setCurrentPage,
    setDepartmentFilter,
    setSelectedPrincipalId,
    setStatusFilter,
    staffMembers,
    statusFilter,
    totalPages
  } = useStaffDirectory(staffQuery.data, searchQuery);

  const assigningStaff = staffQuery.data?.staff.find(
    (entry) => entry.principalId === assigningPrincipalId
  );

  /*
   * The open tab lives in the URL, not in state.
   *
   * `/dashboard/access` is a redirect to `?tab=roles` now, and Settings links
   * straight at three of the four - so the tab has to survive being arrived at,
   * shared, and reloaded. `replace` rather than `push` when switching: a tab is
   * a view of one page, and making Back walk through four of them before
   * leaving Staff is the thing nobody wants.
   */
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabs = visibleStaffTabs(access);
  const tab = resolveStaffTab(searchParams.get("tab"), access);

  const openTab = (next: StaffTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    // `typedRoutes` cannot know a template literal is a real route, so the cast
    // is what every other runtime-built href in this app uses - see the password
    // setup redirect in app/dashboard/layout.tsx.
    router.replace(
      `${pathname}?${params.toString()}` as Parameters<typeof router.replace>[0],
      { scroll: false }
    );
  };

  /*
   * Invited, never arrived. `lastLoginAt` is the only signal the directory
   * carries for this: there is no invitations table, because an invitation IS a
   * staff row that has not been signed into yet. Sorted newest first, since the
   * one somebody is asking about is almost always the one just sent.
   */
  const pendingInvitations = (staffQuery.data?.staff ?? [])
    .filter((entry) => !entry.lastLoginAt && entry.status === "Active")
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  }

  function refresh() {
    invalidateAuthenticatedQuery(STAFF_URL);
    staffQuery.refetch();
  }

  async function copyInviteLink(link: string | null | undefined) {
    if (!link) return;

    try {
      await navigator.clipboard.writeText(link);
      showNotice("Invitation link copied.");
    } catch {
      showNotice("Copy failed - select the link and copy it by hand.");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setMutationError("");
    setUndeliveredInvites([]);

    try {
      if (dialogMode === "add") {
        const response = await authenticatedFetch(STAFF_URL, {
          method: "POST",
          body: JSON.stringify({
            emails: inviteEmails,
            department: form.department || undefined
          })
        });
        const payload = await readMutationResponse(response);

        setUndeliveredInvites(
          (payload?.invites ?? []).filter((invite) => !invite.emailSent)
        );

        if (payload?.assignmentErrors?.length) {
          setMutationError(payload.assignmentErrors.join(" "));
        } else {
          showNotice("Invitations sent.");
          setDialogMode(null);
        }
      } else if (dialogMode === "edit" && editingPrincipalId) {
        const response = await authenticatedFetch(
          `/api/staff/${editingPrincipalId}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              name: form.name,
              phone: form.phone,
              department: form.department,
              title: form.title
            })
          }
        );
        await readMutationResponse(response);
        showNotice("Profile saved.");
        setDialogMode(null);
      }

      refresh();
    } catch (caught) {
      setMutationError(
        caught instanceof Error ? caught.message : "The change failed."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function setActive(principalId: string, isActive: boolean) {
    setMutationError("");

    try {
      const response = await authenticatedFetch(
        `/api/staff/${principalId}/deactivate`,
        { method: "POST", body: JSON.stringify({ isActive }) }
      );
      await readMutationResponse(response);
      showNotice(isActive ? "Access restored." : "Access revoked.");
      refresh();
    } catch (caught) {
      setMutationError(
        caught instanceof Error ? caught.message : "The change failed."
      );
    }
  }

  /*
   * Refused only when there is no tab at all to offer.
   *
   * `staff.read` alone used to decide this, but Access folded in here and it was
   * gated on `role.read` - so somebody who may read roles and not the directory
   * would have been locked out of a screen they could reach yesterday. The page
   * now renders whatever subset of tabs the caller holds, and this is the case
   * where that subset is empty.
   */
  if (!tab) {
    return (
      <DashboardPageState
        emptyMessage="Staff management needs the staff.read permission for the directory, or role.read for roles and permissions."
        emptyTitle="Access restricted"
        isEmpty
        showNewBookingAction={false}
        subtitle=""
        title="Staff"
      />
    );
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#f5f6f8] text-[#17202a]">
      <DashboardTopbar
        compactMobileActions
        onTodayNotes={() => setIsTodayNotesOpen(true)}
        showNewBookingAction={false}
        subtitle={`${staffMembers.length} people`}
        title="Staff"
      />
      <TodayNotesDrawer
        onClose={() => setIsTodayNotesOpen(false)}
        open={isTodayNotesOpen}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
        <nav aria-label="Staff management" className="mb-3 flex flex-wrap gap-1.5">
          {tabs.map((entry) => (
            <button
              aria-current={tab === entry.value ? "page" : undefined}
              className={`h-9 rounded-lg border px-3 text-xs font-black ${
                tab === entry.value
                  ? "border-[#17202a] bg-[#17202a] text-white"
                  : "border-[#c7d0dc] bg-white text-[#233144]"
              }`}
              key={entry.value}
              onClick={() => openTab(entry.value)}
              type="button"
            >
              {entry.label}
            </button>
          ))}
        </nav>

        {notice ? (
          <p className="mb-3 rounded-lg border border-[#a9dfc9] bg-[#effaf5] px-3 py-2 text-[11px] font-semibold text-[#147653]">
            {notice}
          </p>
        ) : null}
        {mutationError ? (
          <p className="mb-3 rounded-lg border border-[#f2b7ba] bg-[#fff2f2] px-3 py-2 text-[11px] font-semibold text-[#a52a3d]">
            {mutationError}
          </p>
        ) : null}
        {undeliveredInvites.length > 0 ? (
          <div className="mb-3 rounded-lg border border-[#efd39d] bg-[#fff7e8] px-3 py-2">
            <p className="text-[11px] font-black text-[#a45f00]">
              Some invitations could not be emailed. Send these links yourself -
              this is the only time they are shown.
            </p>
            <ul className="mt-1.5 space-y-1">
              {undeliveredInvites.map((invite) => (
                <li
                  className="flex flex-wrap items-center gap-2 text-[10px]"
                  key={invite.email}
                >
                  <span className="font-black">{invite.email}</span>
                  {invite.inviteLink ? (
                    <button
                      className="rounded border border-[#c7d0dc] px-1.5 py-0.5 font-black"
                      onClick={() => copyInviteLink(invite.inviteLink)}
                      type="button"
                    >
                      Copy link
                    </button>
                  ) : (
                    <span className="text-[#a52a3d]">{invite.error}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {tab === "roles" ? <AccessRolesPanel /> : null}

        {tab === "audit" ? <AuditPanel canRead /> : null}

        {tab === "invitations" ? (
          <section className="rounded-xl border border-[#d8dde5] bg-white">
            <SectionHeader
              action={
                <button
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#17202a] px-3 text-xs font-black text-white disabled:opacity-50"
                  disabled={!canInvite}
                  onClick={() => {
                    setForm(emptyForm());
                    setInviteInput("");
                    setInviteEmails([]);
                    setMutationError("");
                    setDialogMode("add");
                  }}
                  type="button"
                >
                  <LineIcon name="plus" />
                  Invite
                </button>
              }
              subtitle="Sent, and not signed in yet. An invitation is a staff row nobody has arrived at."
              title="Invitations"
            />

            {pendingInvitations.length === 0 ? (
              <p className="px-4 py-6 text-[11px] text-[#6a7483]">
                Everybody invited has signed in at least once.
              </p>
            ) : (
              <ul className="divide-y divide-[#eef1f5]">
                {pendingInvitations.map((entry) => (
                  <li
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                    key={entry.principalId}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-black">{entry.name}</p>
                      <p className="mt-0.5 truncate text-[10px] text-[#6a7483]">
                        {entry.email} · invited{" "}
                        {new Intl.DateTimeFormat("en-US", {
                          dateStyle: "medium"
                        }).format(new Date(entry.createdAt))}
                      </p>
                    </div>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {entry.assignments.length === 0 ? (
                        <span className="rounded border border-[#efd39d] bg-[#fff7e8] px-1.5 py-0.5 text-[9px] font-black text-[#a45f00]">
                          No role yet
                        </span>
                      ) : (
                        entry.assignments.map((assignment) => (
                          <RoleBadge
                            key={assignment.id}
                            name={assignment.roleName}
                          />
                        ))
                      )}
                      <button
                        className="rounded-lg border border-[#c7d0dc] px-2 py-1 text-[10px] font-black disabled:border-[#e3e8ee] disabled:text-[#9aa5b4]"
                        disabled={!canAssign}
                        onClick={() =>
                          setAssigningPrincipalId(entry.principalId)
                        }
                        type="button"
                      >
                        Access
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <footer className="border-t border-[#eef1f5] px-4 py-3">
              <p className="text-[10px] text-[#6a7483]">
                An invitation that could not be emailed shows its link at the top
                of this page, once. It is the only copy.
              </p>
            </footer>
          </section>
        ) : null}

        {tab === "people" ? (
        <section className="rounded-xl border border-[#d8dde5] bg-white">
          <SectionHeader
            action={
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="h-9 rounded-lg border border-[#c7d0dc] px-2 text-xs font-semibold"
                  name="departmentFilter"
                  onChange={(event) => setDepartmentFilter(event.target.value)}
                  value={departmentFilter}
                >
                  {departments.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
                <select
                  className="h-9 rounded-lg border border-[#c7d0dc] px-2 text-xs font-semibold"
                  name="statusFilter"
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value as "All" | "Active" | "Inactive"
                    )
                  }
                  value={statusFilter}
                >
                  <option value="All">All statuses</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
                {/* A tab away, not a page away. Hidden entirely without
                    `role.read`, the same key the old Access route was gated on -
                    a button onto a tab the caller cannot open is worse than no
                    button. */}
                {tabs.some((entry) => entry.value === "roles") ? (
                  <button
                    className={secondaryButtonClass}
                    onClick={() => openTab("roles")}
                    type="button"
                  >
                    <LineIcon name="shield" />
                    Manage access
                  </button>
                ) : null}
                <button
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#17202a] px-3 text-xs font-black text-white disabled:opacity-50"
                  disabled={!canInvite}
                  onClick={() => {
                    setForm(emptyForm());
                    setInviteInput("");
                    setInviteEmails([]);
                    setMutationError("");
                    setDialogMode("add");
                  }}
                  type="button"
                >
                  <LineIcon name="plus" />
                  Invite
                </button>
              </div>
            }
            subtitle="Profiles here, privileges under Roles & Permissions."
            title="Directory"
          />

          <div className="overflow-x-auto">
            <table className="w-full min-w-180 text-left">
              <thead>
                <tr className="border-b border-[#eef1f5] text-[10px] uppercase tracking-wide text-[#6a7483]">
                  <th className="px-4 py-2 font-black">Person</th>
                  <th className="px-4 py-2 font-black">Holds</th>
                  <th className="px-4 py-2 font-black">Department</th>
                  <th className="px-4 py-2 font-black">Status</th>
                  <th className="px-4 py-2 font-black">Last sign-in</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {paginatedStaff.map((staff) => (
                  <tr
                    className="border-b border-[#f4f6f8] last:border-b-0"
                    key={staff.principalId}
                  >
                    <td className="px-4 py-2.5">
                      <button
                        className="flex items-center gap-2 text-left"
                        onClick={() => {
                          setSelectedPrincipalId(staff.principalId);
                          setIsProfileOpen(true);
                        }}
                        type="button"
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white ${staff.color}`}
                        >
                          {staff.initials}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs font-black">
                            {staff.name}
                          </span>
                          <span className="block truncate text-[10px] text-[#6a7483]">
                            {staff.email}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="flex flex-wrap gap-1">
                        {staff.assignments.length === 0 ? (
                          <span className="text-[10px] text-[#6a7483]">
                            No role
                          </span>
                        ) : (
                          staff.assignments.map((assignment) => (
                            <RoleBadge
                              key={assignment.id}
                              name={assignment.roleName}
                            />
                          ))
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[11px]">
                      {staff.department}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={staff.status} />
                    </td>
                    <td className="px-4 py-2.5 text-[10px] text-[#6a7483]">
                      {staff.lastLogin}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="flex justify-end gap-1.5">
                        <button
                          className="rounded-lg border border-[#c7d0dc] px-2 py-1 text-[10px] font-black disabled:border-[#e3e8ee] disabled:text-[#9aa5b4]"
                          disabled={!canEditProfiles}
                          onClick={() => {
                            setForm(staffToForm(staff));
                            setEditingPrincipalId(staff.principalId);
                            setMutationError("");
                            setDialogMode("edit");
                          }}
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          className="rounded-lg border border-[#c7d0dc] px-2 py-1 text-[10px] font-black disabled:border-[#e3e8ee] disabled:text-[#9aa5b4]"
                          disabled={!canAssign}
                          onClick={() =>
                            setAssigningPrincipalId(staff.principalId)
                          }
                          type="button"
                        >
                          Access
                        </button>
                        <button
                          className="rounded-lg border border-[#f2b7ba] px-2 py-1 text-[10px] font-black text-[#d63740] disabled:border-[#e3e8ee] disabled:text-[#9aa5b4]"
                          disabled={!canDeactivate}
                          onClick={() =>
                            setActive(
                              staff.principalId,
                              staff.status !== "Active"
                            )
                          }
                          type="button"
                        >
                          {staff.status === "Active" ? "Revoke" : "Restore"}
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[#eef1f5] px-4 py-2.5">
            <p className="text-[10px] text-[#6a7483]">
              {filteredStaff.length} of {staffMembers.length} shown
            </p>
            <div className="flex items-center gap-1.5">
              <button
                className="rounded-lg border border-[#c7d0dc] px-2 py-1 text-[10px] font-black disabled:text-[#9aa5b4]"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                type="button"
              >
                Previous
              </button>
              <span className="text-[10px] text-[#6a7483]">
                {currentPage} / {totalPages} ({rowsPerPage} per page)
              </span>
              <button
                className="rounded-lg border border-[#c7d0dc] px-2 py-1 text-[10px] font-black disabled:text-[#9aa5b4]"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                type="button"
              >
                Next
              </button>
            </div>
          </footer>
        </section>
        ) : null}
      </div>

      <StaffDialog
        canInvite={canInvite}
        error={mutationError}
        form={form}
        inviteEmails={inviteEmails}
        inviteInput={inviteInput}
        isSaving={isSaving}
        mode={dialogMode}
        onChangeForm={setForm}
        onChangeInviteEmails={setInviteEmails}
        onChangeInviteInput={setInviteInput}
        onClose={() => setDialogMode(null)}
        onSubmit={submit}
      />

      {isProfileOpen && selectedStaff ? (
        <StaffProfileDialog
          onClose={() => setIsProfileOpen(false)}
          staff={selectedStaff}
        />
      ) : null}

      {assigningStaff ? (
        <AssignmentDialog
          canAssign={canAssign}
          epoch={rolesQuery.data?.epoch ?? access.epoch}
          onClose={() => setAssigningPrincipalId("")}
          onSaved={() => {
            refresh();
            rolesQuery.refetch();
          }}
          roles={rolesQuery.data?.roles ?? []}
          staff={assigningStaff}
        />
      ) : null}
    </div>
  );
}
