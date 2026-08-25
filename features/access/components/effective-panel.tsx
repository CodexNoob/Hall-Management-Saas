"use client";

import { useMemo, useState } from "react";
import {
  describeApiError,
  epochHeaders,
  type ApiError,
  type EffectiveResponse,
  type StaffEntry
} from "@/features/access/components/access-shared";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";

/**
 * "Why can they do that?", on screen.
 *
 * Every key in the catalog, whether it is held, and WHAT PRODUCED IT - a role,
 * an individual grant, or an expired assignment that no longer counts. Without
 * this the only way to explain a permission is to read four tables by hand,
 * which is exactly when somebody decides it is easier to grant Owner and move on.
 *
 * The individual GRANT / DENY toggles live here too, next to the explanation
 * they change, rather than on a separate screen where the effect of ticking one
 * is invisible until you go and look.
 */

type EffectivePanelProps = {
  staff: StaffEntry;
  epoch: number;
  canOverride: boolean;
  onChanged: () => void;
};

export function EffectivePanel({
  staff,
  epoch,
  canOverride,
  onChanged
}: EffectivePanelProps) {
  const [showHeldOnly, setShowHeldOnly] = useState(true);
  const [error, setError] = useState("");
  const [pendingKey, setPendingKey] = useState("");

  const query = useAuthenticatedQuery<EffectiveResponse>(
    `/api/access/effective/${staff.principalId}`
  );

  const permissions = useMemo(() => {
    const all = query.data?.data.permissions ?? [];

    return showHeldOnly
      ? all.filter(
          (permission) =>
            permission.held ||
            permission.deniedByOverride ||
            permission.expiredOnly
        )
      : all;
  }, [query.data?.data.permissions, showHeldOnly]);

  /**
   * Overrides are written as a FULL REPLACEMENT of this principal's exceptions,
   * so the toggle sends the whole state it wants rather than a delta. That makes
   * "I unticked it and it came back" impossible.
   */
  const setOverride = async (
    key: string,
    effect: "GRANT" | "DENY" | "NONE"
  ) => {
    const current = query.data?.data.permissions ?? [];
    const grants = current
      .filter((permission) => permission.viaGrantOverride)
      .map((permission) => permission.key as string)
      .filter((existing) => existing !== key);
    const denies = current
      .filter((permission) => permission.deniedByOverride)
      .map((permission) => permission.key as string)
      .filter((existing) => existing !== key);

    if (effect === "GRANT") grants.push(key);
    if (effect === "DENY") denies.push(key);

    setPendingKey(key);
    setError("");

    try {
      const response = await authenticatedFetch(
        `/api/access/overrides/${staff.principalId}`,
        {
          method: "PUT",
          headers: epochHeaders(epoch),
          body: JSON.stringify({ grants, denies })
        }
      );

      if (!response.ok) {
        setError(
          describeApiError(
            (await response.json().catch(() => null)) as ApiError | null
          )
        );
        return;
      }

      query.refetch();
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Update failed.");
    } finally {
      setPendingKey("");
    }
  };

  return (
    <section className="rounded-xl border border-[#d8dde5] bg-white">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d8dde5] px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-black">
            Effective permissions - {staff.name}
          </h2>
          <p className="mt-0.5 text-[10px] text-[#6a7483]">
            {query.data?.data.heldCount ?? 0} held. This is the resolver&apos;s
            own answer, not a re-derivation.
          </p>
        </div>
        <label className="flex items-center gap-1.5 text-[10px] font-black text-[#39465a]">
          <input
            checked={showHeldOnly}
            onChange={(event) => setShowHeldOnly(event.target.checked)}
            type="checkbox"
          />
          Only what matters
        </label>
      </header>

      {error ? (
        <p className="m-3 rounded-lg border border-[#f2b7ba] bg-[#fff2f2] px-3 py-2 text-[11px] font-semibold text-[#a52a3d]">
          {error}
        </p>
      ) : null}

      <div className="max-h-[60dvh] overflow-y-auto px-3 py-2">
        {query.isLoading ? (
          <p className="px-1 py-3 text-[11px] text-[#6a7483]">Resolving...</p>
        ) : null}
        <ul className="space-y-1">
          {permissions.map((permission) => (
            <li
              className="rounded-lg border border-[#eef1f5] px-3 py-2"
              key={permission.key}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      permission.held
                        ? "bg-[#147653]"
                        : permission.deniedByOverride
                          ? "bg-[#d63740]"
                          : "bg-[#cdd5df]"
                    }`}
                  />
                  <span className="text-xs font-black text-[#17202a]">
                    {permission.label}
                  </span>
                  <code className="rounded bg-[#eef1f5] px-1 py-0.5 text-[9px] text-[#536172]">
                    {permission.key}
                  </code>
                </span>
                {canOverride ? (
                  <span className="flex items-center gap-1">
                    {(["GRANT", "DENY", "NONE"] as const).map((effect) => {
                      const active =
                        (effect === "GRANT" && permission.viaGrantOverride) ||
                        (effect === "DENY" && permission.deniedByOverride) ||
                        (effect === "NONE" &&
                          !permission.viaGrantOverride &&
                          !permission.deniedByOverride);

                      return (
                        <button
                          className={`rounded border px-1.5 py-0.5 text-[9px] font-black ${
                            active
                              ? "border-[#17202a] bg-[#17202a] text-white"
                              : "border-[#c7d0dc] text-[#536172]"
                          }`}
                          disabled={pendingKey === permission.key}
                          key={effect}
                          onClick={() => setOverride(permission.key, effect)}
                          type="button"
                        >
                          {effect === "NONE" ? "Role only" : effect}
                        </button>
                      );
                    })}
                  </span>
                ) : null}
              </div>

              <p className="mt-1 text-[10px] text-[#6a7483]">
                {permission.deniedByOverride
                  ? "Denied for this person. A DENY is final - nothing overrides it, including a role that grants it."
                  : permission.viaGrantOverride
                    ? "Granted directly to this person, organization-wide."
                    : permission.viaRoles.length > 0
                      ? `Via ${permission.viaRoles
                          .map(
                            (role) => `${role.roleName} (${role.scopeLabel})`
                          )
                          .join(", ")}`
                      : permission.expiredOnly
                        ? "The only assignment that carried this has expired."
                        : "Not held."}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
