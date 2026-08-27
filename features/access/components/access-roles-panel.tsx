"use client";

import { useState } from "react";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { useDashboardAccess } from "@/features/dashboard/hooks/use-dashboard-permission";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import {
  describeApiError,
  epochHeaders,
  type ApiError,
  type CatalogResponse,
  type RoleSummary,
  type RolesResponse,
  type StaffResponse
} from "@/features/access/components/access-shared";
import { RoleBadge, RoleEditor } from "@/features/access/components/role-editor";
import { EffectivePanel } from "@/features/access/components/effective-panel";

/**
 * Roles, and what they add up to for one person. The screen that makes roles
 * data.
 *
 * WITHOUT PAGE CHROME, ON PURPOSE. This used to be `/dashboard/access` with its
 * own topbar and its own sidebar entry; it is now a tab inside Staff, so the
 * chrome belongs to the host and this renders only the body. Everything else is
 * unchanged - it still knows the name of no role, rendering whatever
 * `/api/access/roles` returns, which is why a tenant's own "Front Desk" looks
 * and behaves exactly like the starter six.
 *
 * The two halves are the split the API makes: ROLES are the shapes, and the
 * summary below is what one person's shapes come to once scope and overrides
 * have been applied. They sit together because "what may this role do" and "why
 * can this person do that" are the same question asked from two ends, and the
 * answer to the second is unreadable without the first.
 *
 * Gated by the caller on `role.read`. That gate is what keeps the old separation
 * intact now that the sidebar no longer provides it: somebody who may edit a
 * phone number but not read a role never sees this tab, so "edit a profile" and
 * "hand out privileges" are still two different permissions.
 */
export function AccessRolesPanel() {
  const access = useDashboardAccess();
  const [editing, setEditing] = useState<RoleSummary | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedPrincipalId, setSelectedPrincipalId] = useState("");
  const [error, setError] = useState("");

  const canManageRoles = access.hasPermission("role.manage");
  const canOverride = access.hasPermission("permission.override");

  const catalogQuery = useAuthenticatedQuery<CatalogResponse>(
    "/api/access/catalog"
  );
  const rolesQuery = useAuthenticatedQuery<RolesResponse>("/api/access/roles");
  const staffQuery = useAuthenticatedQuery<StaffResponse>(
    "/api/staff",
    access.hasPermission("staff.read")
  );

  // The epoch every mutation is composed against. Taken from the freshest read
  // rather than from the cached session, because the session only refreshes when
  // a response tells it to and the grid may have been open for a while.
  const epoch =
    rolesQuery.data?.epoch ?? catalogQuery.data?.epoch ?? access.epoch;

  const roles = rolesQuery.data?.roles ?? [];
  const staff = staffQuery.data?.staff ?? [];
  const selectedStaff =
    staff.find((entry) => entry.principalId === selectedPrincipalId) ??
    staff[0] ??
    null;

  const refresh = () => {
    rolesQuery.refetch();
    staffQuery.refetch();
  };

  const removeRole = async (role: RoleSummary) => {
    setError("");

    try {
      const response = await authenticatedFetch(
        `/api/access/roles/${role.id}`,
        { method: "DELETE", headers: epochHeaders(epoch) }
      );

      if (!response.ok) {
        setError(
          describeApiError(
            (await response.json().catch(() => null)) as ApiError | null
          )
        );
        return;
      }

      refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Delete failed.");
    }
  };

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-lg border border-[#f2b7ba] bg-[#fff2f2] px-3 py-2 text-[11px] font-semibold text-[#a52a3d]">
          {error}
        </p>
      ) : null}

      {/*
        Both sections below are named, because they stack on one tab and each
        renders the other's vocabulary: a role's name appears in this list and
        again under whoever holds it in the summary. Without a name a <section>
        is not a landmark at all, so "the Roles list" was not addressable.
      */}
      <section
        aria-label="Roles"
        className="rounded-xl border border-[#d8dde5] bg-white"
      >
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d8dde5] px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-black">Roles</h2>
            <p className="mt-0.5 text-[10px] text-[#6a7483]">
              {roles.length} roles. Adding one is a row, not a release.
            </p>
          </div>
          <button
            className="h-9 rounded-lg bg-[#17202a] px-3 text-xs font-black text-white disabled:opacity-50"
            disabled={!canManageRoles}
            onClick={() => setIsCreating(true)}
            type="button"
          >
            New role
          </button>
        </header>

        {/* Named, because this tab renders two lists that both spell out role
            names - these rows, and the people below them whose subtitle is the
            roles they hold. Unlabelled, "the row for Owner" is ambiguous to a
            screen reader walking the lists and to anything else looking one up. */}
        <ul aria-label="Roles" className="divide-y divide-[#eef1f5]">
          {roles.map((role) => (
            <li
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              key={role.id}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <RoleBadge name={role.name} />
                  <span className="text-[10px] text-[#6a7483]">
                    rank {role.rank} · {role.permissions.length} permissions ·{" "}
                    {role.holderCount}{" "}
                    {role.holderCount === 1 ? "holder" : "holders"}
                  </span>
                  {role.isSystem ? (
                    <span className="rounded border border-[#cdd5df] bg-[#f4f6f8] px-1.5 py-0.5 text-[9px] font-black text-[#536172]">
                      Starter
                    </span>
                  ) : null}
                </div>
                {role.description ? (
                  <p className="mt-0.5 text-[10px] text-[#6a7483]">
                    {role.description}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="h-8 rounded-lg border border-[#c7d0dc] px-3 text-[11px] font-black"
                  onClick={() => setEditing(role)}
                  type="button"
                >
                  {canManageRoles ? "Edit" : "View"}
                </button>
                <button
                  className="h-8 rounded-lg border border-[#f2b7ba] px-3 text-[11px] font-black text-[#d63740] disabled:border-[#e3e8ee] disabled:text-[#9aa5b4]"
                  disabled={
                    !canManageRoles || role.isSystem || role.holderCount > 0
                  }
                  onClick={() => removeRole(role)}
                  title={
                    role.isSystem
                      ? "Starter roles cannot be deleted. Edit what this one grants instead."
                      : role.holderCount > 0
                        ? "Reassign the people holding this role first."
                        : undefined
                  }
                  type="button"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>

        <footer className="border-t border-[#eef1f5] px-4 py-3">
          <p className="text-[10px] text-[#6a7483]">
            A role can never hand out more than you hold yourself, and never at
            or above your own rank. Both refusals name what stopped them.
          </p>
        </footer>
      </section>

      <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
        <section
          aria-label="Permission summary"
          className="rounded-xl border border-[#d8dde5] bg-white"
        >
          <header className="border-b border-[#d8dde5] px-4 py-3">
            <h2 className="text-sm font-black">Permission summary</h2>
            <p className="mt-0.5 text-[10px] text-[#6a7483]">
              Pick somebody to see exactly what they can do, and why.
            </p>
          </header>
          <ul
            aria-label="People"
            className="max-h-[60dvh] divide-y divide-[#eef1f5] overflow-y-auto"
          >
            {staff.map((entry) => (
              <li key={entry.principalId}>
                <button
                  className={`w-full px-4 py-2.5 text-left ${
                    selectedStaff?.principalId === entry.principalId
                      ? "bg-[#eef4fa]"
                      : ""
                  }`}
                  onClick={() => setSelectedPrincipalId(entry.principalId)}
                  type="button"
                >
                  <span className="block text-xs font-black">{entry.name}</span>
                  <span className="mt-0.5 block truncate text-[10px] text-[#6a7483]">
                    {entry.assignments.length > 0
                      ? entry.assignments
                          .map((assignment) => assignment.roleName)
                          .join(", ")
                      : "No role yet"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {selectedStaff ? (
          <EffectivePanel
            canOverride={canOverride}
            epoch={epoch}
            onChanged={refresh}
            staff={selectedStaff}
          />
        ) : (
          <section className="rounded-xl border border-[#d8dde5] bg-white px-4 py-6">
            <p className="text-[11px] text-[#6a7483]">
              {access.hasPermission("staff.read")
                ? "Nobody to show yet."
                : "Seeing who holds what needs the staff.read permission as well."}
            </p>
          </section>
        )}
      </div>

      {editing || isCreating ? (
        <RoleEditor
          canManage={canManageRoles}
          catalog={catalogQuery.data ?? null}
          epoch={epoch}
          onClose={() => {
            setEditing(null);
            setIsCreating(false);
          }}
          onSaved={refresh}
          role={editing}
        />
      ) : null}
    </div>
  );
}
