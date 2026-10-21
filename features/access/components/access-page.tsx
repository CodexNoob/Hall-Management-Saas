"use client";

import { useState } from "react";
import { DashboardPageState } from "@/components/layout/dashboard-page-state";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
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
import { AuditPanel } from "@/features/access/components/audit-panel";
import { useAppLanguage } from "@/components/providers/app-language-provider";

/**
 * Settings -> Access. The screen that makes roles data.
 *
 * Three tabs, and the split between them is the same one the API makes: ROLES
 * are the shapes, PEOPLE hold them, and the AUDIT is what happened. Nothing here
 * knows the name of any role - it renders whatever `/api/access/roles` returns,
 * which is why a tenant's own "Front Desk" looks and behaves exactly like the
 * starter five.
 */

type Tab = "roles" | "people" | "audit";

export function AccessPage() {
  const { t } = useAppLanguage();
  const access = useDashboardAccess();
  const [tab, setTab] = useState<Tab>("roles");
  const [editing, setEditing] = useState<RoleSummary | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedPrincipalId, setSelectedPrincipalId] = useState("");
  const [error, setError] = useState("");

  const canRead = access.hasPermission("role.read");
  const canManageRoles = access.hasPermission("role.manage");
  const canOverride = access.hasPermission("permission.override");
  const canReadAudit = access.hasPermission("audit.read");

  const catalogQuery = useAuthenticatedQuery<CatalogResponse>(
    "/api/access/catalog",
    canRead
  );
  const rolesQuery = useAuthenticatedQuery<RolesResponse>(
    "/api/access/roles",
    canRead
  );
  const staffQuery = useAuthenticatedQuery<StaffResponse>(
    "/api/staff",
    canRead && access.hasPermission("staff.read")
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
            (await response.json().catch(() => null)) as ApiError | null,
            t
          )
        );
        return;
      }

      refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Delete failed.");
    }
  };

  if (!canRead) {
    return (
      <DashboardPageState
        emptyMessage={t("access.restrictedBody")}
        emptyTitle={t("access.restricted")}
        isEmpty
        showNewBookingAction={false}
        showSearch={false}
        subtitle=""
        title={t("access.title")}
      />
    );
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#f5f6f8] text-[#17202a]">
      <DashboardTopbar
        compactMobileActions
        showNewBookingAction={false}
        showSearch={false}
        subtitle={t("access.blurb")}
        title={t("access.title")}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
        <nav className="mb-3 flex gap-1.5">
          {(
            [
              ["roles", "Roles"],
              ["people", "People"],
              ["audit", "Audit"]
            ] as Array<[Tab, string]>
          ).map(([value, label]) => (
            <button
              className={`h-9 rounded-lg border px-3 text-xs font-black ${
                tab === value
                  ? "border-[#17202a] bg-[#17202a] text-white"
                  : "border-[#c7d0dc] bg-white text-[#233144]"
              }`}
              key={value}
              onClick={() => setTab(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>

        {error ? (
          <p className="mb-3 rounded-lg border border-[#f2b7ba] bg-[#fff2f2] px-3 py-2 text-[11px] font-semibold text-[#a52a3d]">
            {error}
          </p>
        ) : null}

        {tab === "roles" ? (
          <section className="rounded-xl border border-[#d8dde5] bg-white">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d8dde5] px-4 py-3">
              <div className="min-w-0">
                <h2 className="text-sm font-black">{t("access.roles")}</h2>
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
                {t("access.newRole")}
              </button>
            </header>

            <ul className="divide-y divide-[#eef1f5]">
              {roles.map((role) => (
                <li
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                  key={role.id}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <RoleBadge name={role.name} />
                      <span className="text-[10px] text-[#6a7483]">
                        rank {role.rank} · {role.permissions.length} permissions
                        · {role.holderCount}{" "}
                        {role.holderCount === 1 ? "holder" : "holders"}
                      </span>
                      {role.isSystem ? (
                        <span className="rounded border border-[#cdd5df] bg-[#f4f6f8] px-1.5 py-0.5 text-[9px] font-black text-[#536172]">
                          {t("access.starter")}
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
                        !canManageRoles ||
                        role.isSystem ||
                        role.holderCount > 0
                      }
                      onClick={() => removeRole(role)}
                      title={
                        role.isSystem
                          ? t("access.starterCannotDelete")
                          : role.holderCount > 0
                            ? t("access.reassignFirst")
                            : undefined
                      }
                      type="button"
                    >
                      {t("common.delete")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <footer className="border-t border-[#eef1f5] px-4 py-3">
              <p className="text-[10px] text-[#6a7483]">
                {t("access.ceilingNote")}
              </p>
            </footer>
          </section>
        ) : null}

        {tab === "people" ? (
          <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
            <section className="rounded-xl border border-[#d8dde5] bg-white">
              <header className="border-b border-[#d8dde5] px-4 py-3">
                <h2 className="text-sm font-black">{t("access.people")}</h2>
                <p className="mt-0.5 text-[10px] text-[#6a7483]">
                  {t("access.pickSomebody")}
                </p>
              </header>
              <ul className="max-h-[60dvh] divide-y divide-[#eef1f5] overflow-y-auto">
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
                      <span className="block text-xs font-black">
                        {entry.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-[#6a7483]">
                        {entry.assignments.length > 0
                          ? entry.assignments
                              .map((assignment) => assignment.roleName)
                              .join(", ")
                          : t("staff.noRoleYet")}
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
                  {t("access.nobodyYet")}
                </p>
              </section>
            )}
          </div>
        ) : null}

        {tab === "audit" ? <AuditPanel canRead={canReadAudit} /> : null}
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
