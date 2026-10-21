"use client";

import { useState } from "react";

import { useAppLanguage } from "@/components/providers/app-language-provider";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { useDateFormatters } from "@/features/dashboard/hooks/use-regional-settings";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";

type StaffSession = {
  id: string;
  device: string | null;
  ipAddress: string | null;
  city: string | null;
  /** State or province. Null where the edge resolved none, which is common. */
  region: string | null;
  /** ISO 3166-1 alpha-2, named at render so it reads in the viewer's language. */
  country: string | null;
  createdAt: string;
  lastSeenAt: string;
};

/**
 * WHERE THIS PERSON IS SIGNED IN, AND THE BUTTON TO END ONE.
 *
 * The answer to "they left their phone in a taxi but they still work here".
 * Deactivating the account locks them out of everything at once and stops them
 * working; this ends one device and leaves the rest alone.
 *
 * A COURTESY, NOT THE CONTROL. `staff.deactivate` gates both the list and the
 * revoke server-side, and the rank ceiling that stops an administrator
 * switching the owner off stops them signing the owner out too. Hiding this
 * panel is only so somebody who cannot act on it is not shown a button that
 * will refuse them.
 *
 * Rendered only when the caller holds the key - the parent decides that, so
 * this component has one job.
 */
export function StaffSessionsPanel({
  principalId,
  staffName
}: {
  principalId: string;
  staffName: string;
}) {
  const { t } = useAppLanguage();
  const dates = useDateFormatters();
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const query = useAuthenticatedQuery<{ sessions: StaffSession[] }>(
    `/api/staff/${principalId}/sessions`
  );
  const sessions = query.data?.sessions ?? [];

  /**
   * "Manila, Philippines", or as much of it as the edge resolved.
   *
   * The country is stored as a code and named here, so the same row reads in
   * the viewer's own language. A code `Intl` cannot name falls back to itself.
   */
  const place = (session: StaffSession) => {
    let country: string | null = null;

    if (session.country) {
      try {
        country =
          new Intl.DisplayNames([dates.settings.locale], { type: "region" }).of(
            session.country
          ) ?? session.country;
      } catch {
        country = session.country;
      }
    }

    // City, region, country - narrowest first, the way a postal address reads.
    // Any of the three may be null; `filter` means a missing middle closes up
    // rather than leaving "Manila, , Philippines".
    return (
      [session.city, session.region, country].filter(Boolean).join(", ") || null
    );
  };

  const revoke = async (query_: string, id: string | null) => {
    setRevokingId(id ?? "all");
    setMessage("");

    try {
      const response = await authenticatedFetch(
        `/api/staff/${principalId}/sessions${query_}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        throw new Error(payload?.error ?? t("staff.sessionRevokeFailed"));
      }

      setMessage(t("staff.sessionRevoked"));
      await query.refetch();
    } catch (revokeError) {
      setMessage(
        revokeError instanceof Error
          ? revokeError.message
          : t("staff.sessionRevokeFailed")
      );
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <section className="rounded-lg border border-[#d8dde5] p-3">
      <h3 className="text-xs font-black uppercase tracking-[0.08em] text-[#6a7483]">
        {t("staff.activeSessions")}
      </h3>
      <p className="mt-1 text-[10px] leading-4 text-[#6a7483]">
        {t("staff.activeSessionsHint", { name: staffName })}
      </p>

      {query.error ? (
        <p className="mt-2 text-[11px] font-bold text-[#b42318]" role="alert">
          {t("staff.sessionsLoadFailed")}
        </p>
      ) : null}

      <ul className="mt-2 divide-y divide-[#eef1f5]">
        {sessions.map((session) => (
          <li
            className="flex flex-wrap items-baseline justify-between gap-2 py-2"
            key={session.id}
          >
            <span className="min-w-0">
              <span className="text-xs font-black text-[#17202a]">
                {session.device ?? t("settings.unknownDevice")}
              </span>
              <span className="mt-0.5 block text-[10px] text-[#6a7483]">
                {[
                  place(session) ?? t("settings.locationUnknown"),
                  t("settings.signedInOn", {
                    when: dates.dateTime(session.createdAt)
                  }),
                  session.ipAddress
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            <span className="flex items-center gap-3">
              <span className="text-[10px] text-[#6a7483]">
                {t("settings.lastSeen", {
                  when: dates.dateTime(session.lastSeenAt)
                })}
              </span>
              <button
                className="rounded-lg border border-[#e3c4c4] px-2.5 py-1 text-[10px] font-black text-[#b42318] transition hover:bg-[#fef3f2] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={revokingId !== null}
                onClick={() =>
                  revoke(`?sessionId=${encodeURIComponent(session.id)}`, session.id)
                }
                type="button"
              >
                {t("settings.signOutDevice")}
              </button>
            </span>
          </li>
        ))}
      </ul>

      {/* Not while the list failed to load: "no active sessions" is a claim,
          and making it directly under "could not be loaded" asserts something
          we have just admitted we do not know. */}
      {!query.isLoading && !query.error && sessions.length === 0 ? (
        <p className="mt-2 text-[10px] leading-4 text-[#6a7483]">
          {t("staff.noActiveSessions")}
        </p>
      ) : null}

      {sessions.length > 1 ? (
        <button
          className="mt-3 inline-flex min-h-8 items-center rounded-lg border border-[#c7d0dc] px-3 text-[11px] font-black text-[#233144] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={revokingId !== null}
          onClick={() => revoke("?scope=all", null)}
          type="button"
        >
          {t("staff.signOutAllDevices")}
        </button>
      ) : null}

      {message ? (
        <p className="mt-2 text-[11px] font-bold text-[#147653]" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
