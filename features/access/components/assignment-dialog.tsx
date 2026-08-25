"use client";

import { useEffect, useState } from "react";
import {
  describeApiError,
  describeScope,
  epochHeaders,
  type ApiError,
  type RoleSummary,
  type StaffEntry
} from "@/features/access/components/access-shared";
import { RoleBadge } from "@/features/access/components/role-editor";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";

/**
 * Assigning a role to one person, with scope and an optional expiry.
 *
 * The three fields here are the three things an assignment is: WHICH role, over
 * WHAT, and until WHEN. Scope and expiry are ordinary inputs rather than
 * advanced options, because a time-boxed hall-scoped elevation is the normal
 * case for covering a shift - and making it normal is what stops people reaching
 * for a permanent org-wide role instead.
 */

type ScopeOption = { id: string; name: string };

type HallsResponse = { halls?: ScopeOption[] };
type EventTypesResponse = { eventTypes?: ScopeOption[] };

type AssignmentDialogProps = {
  staff: StaffEntry;
  roles: RoleSummary[];
  epoch: number;
  canAssign: boolean;
  onSaved: () => void;
  onClose: () => void;
};

export function AssignmentDialog({
  staff,
  roles,
  epoch,
  canAssign,
  onSaved,
  onClose
}: AssignmentDialogProps) {
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [scopeType, setScopeType] = useState<"org" | "hall" | "event_type">(
    "org"
  );
  const [scopeId, setScopeId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const hallsQuery = useAuthenticatedQuery<HallsResponse>(
    "/api/halls",
    scopeType === "hall"
  );
  const eventTypesQuery = useAuthenticatedQuery<EventTypesResponse>(
    "/api/event-types",
    scopeType === "event_type"
  );

  const scopeOptions =
    scopeType === "hall"
      ? (hallsQuery.data?.halls ?? [])
      : scopeType === "event_type"
        ? (eventTypesQuery.data?.eventTypes ?? [])
        : [];

  useEffect(() => {
    setScopeId("");
  }, [scopeType]);

  const submit = async () => {
    setIsSaving(true);
    setError("");

    try {
      const response = await authenticatedFetch("/api/access/assignments", {
        method: "POST",
        headers: epochHeaders(epoch),
        body: JSON.stringify({
          principalId: staff.principalId,
          roleId,
          scope: {
            type: scopeType,
            ...(scopeType === "org" ? {} : { id: scopeId })
          },
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
        })
      });

      if (!response.ok) {
        setError(
          describeApiError(
            (await response.json().catch(() => null)) as ApiError | null
          )
        );
        return;
      }

      onSaved();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Assignment failed.");
    } finally {
      setIsSaving(false);
    }
  };

  const revoke = async (assignmentId: string) => {
    setError("");

    try {
      const response = await authenticatedFetch(
        `/api/access/assignments/${assignmentId}`,
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

      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Revoke failed.");
    }
  };

  const needsScopeTarget = scopeType !== "org" && !scopeId;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
      <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-[#d8dde5] px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-black">Access for {staff.name}</h2>
            <p className="mt-0.5 truncate text-[10px] text-[#6a7483]">
              {staff.email}
            </p>
          </div>
          <button
            className="rounded-lg border border-[#c7d0dc] px-3 py-1.5 text-xs font-black"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <h3 className="mb-2 text-[11px] font-black uppercase tracking-wide text-[#39465a]">
            Holds now
          </h3>
          {staff.assignments.length === 0 ? (
            <p className="rounded-lg border border-[#eef1f5] px-3 py-3 text-[11px] text-[#6a7483]">
              Nothing yet. This person can sign in and see nothing until they are
              given a role - which is the correct default, not a bug.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {staff.assignments.map((assignment) => (
                <li
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#eef1f5] px-3 py-2"
                  key={assignment.id}
                >
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <RoleBadge name={assignment.roleName} />
                    <span className="text-[10px] text-[#536172]">
                      {describeScope(assignment)}
                    </span>
                    {assignment.expiresAt ? (
                      <span className="rounded border border-[#efd39d] bg-[#fff7e8] px-1.5 py-0.5 text-[9px] font-black text-[#a45f00]">
                        Until{" "}
                        {new Intl.DateTimeFormat("en-US", {
                          dateStyle: "medium"
                        }).format(new Date(assignment.expiresAt))}
                      </span>
                    ) : null}
                    {assignment.source !== "manual" ? (
                      // Group-sourced assignments are read-only by design: the
                      // identity provider owns them, and editing one here would
                      // be silently undone at the next sync.
                      <span className="rounded border border-[#cdd5df] bg-[#f4f6f8] px-1.5 py-0.5 text-[9px] font-black text-[#536172]">
                        From {assignment.source}
                      </span>
                    ) : null}
                  </span>
                  <button
                    className="text-[10px] font-black text-[#d63740] disabled:text-[#9aa5b4]"
                    disabled={!canAssign || assignment.source !== "manual"}
                    onClick={() => revoke(assignment.id)}
                    type="button"
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}

          <h3 className="mb-2 mt-5 text-[11px] font-black uppercase tracking-wide text-[#39465a]">
            Add a role
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-[10px] font-black uppercase tracking-wide text-[#6a7483]">
              Role
              <select
                className="mt-1 h-9 w-full rounded-lg border border-[#c7d0dc] px-2 text-xs font-semibold"
                disabled={!canAssign}
                onChange={(event) => setRoleId(event.target.value)}
                value={roleId}
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name} (rank {role.rank})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[10px] font-black uppercase tracking-wide text-[#6a7483]">
              Scope
              <select
                className="mt-1 h-9 w-full rounded-lg border border-[#c7d0dc] px-2 text-xs font-semibold"
                disabled={!canAssign}
                onChange={(event) =>
                  setScopeType(
                    event.target.value as "org" | "hall" | "event_type"
                  )
                }
                value={scopeType}
              >
                <option value="org">Whole organization</option>
                <option value="hall">One hall</option>
                <option value="event_type">One event type</option>
              </select>
            </label>
            {scopeType !== "org" ? (
              <label className="block text-[10px] font-black uppercase tracking-wide text-[#6a7483]">
                {scopeType === "hall" ? "Hall" : "Event type"}
                <select
                  className="mt-1 h-9 w-full rounded-lg border border-[#c7d0dc] px-2 text-xs font-semibold"
                  disabled={!canAssign}
                  onChange={(event) => setScopeId(event.target.value)}
                  value={scopeId}
                >
                  <option value="">Choose one</option>
                  {scopeOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="block text-[10px] font-black uppercase tracking-wide text-[#6a7483]">
              Expires (optional)
              <input
                className="mt-1 h-9 w-full rounded-lg border border-[#c7d0dc] px-2 text-xs font-semibold"
                disabled={!canAssign}
                onChange={(event) => setExpiresAt(event.target.value)}
                type="datetime-local"
                value={expiresAt}
              />
            </label>
          </div>
          <p className="mt-2 text-[10px] text-[#6a7483]">
            Assignments add up. Two hall-scoped rows mean both halls; one
            organization-wide row means everywhere. They never narrow each other.
          </p>
        </div>

        <footer className="flex flex-col gap-2 border-t border-[#d8dde5] px-4 py-3">
          {error ? (
            <p className="rounded-lg border border-[#f2b7ba] bg-[#fff2f2] px-3 py-2 text-[11px] font-semibold text-[#a52a3d]">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              className="h-9 rounded-lg border border-[#c7d0dc] px-4 text-xs font-black"
              onClick={onClose}
              type="button"
            >
              Done
            </button>
            <button
              className="h-9 rounded-lg bg-[#17202a] px-4 text-xs font-black text-white disabled:opacity-50"
              disabled={!canAssign || isSaving || !roleId || needsScopeTarget}
              onClick={submit}
              type="button"
            >
              {isSaving ? "Assigning..." : "Assign"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
