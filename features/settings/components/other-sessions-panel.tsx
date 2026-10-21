"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { signOutCurrentSession } from "@/lib/auth/client";
import { getDashboardLoginPath } from "@/lib/auth/redirect";
import {
  PanelHeader,
  secondaryButton
} from "@/features/settings/components/settings-shared";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { useAppLanguage } from "@/components/providers/app-language-provider";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import type { MessageKey } from "@/lib/i18n/messages";

type SessionRow = {
  id: string;
  device: string | null;
  ipAddress: string | null;
  city: string | null;
  /** State or province. Null where the edge resolved none, which is common. */
  region: string | null;
  /** ISO 3166-1 alpha-2, named at render rather than stored as a name. */
  country: string | null;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
  /** Confirmed, not removed, inside its trust period - primary or not. */
  trustedDevice: boolean;
  /** The first device; only "sign out untrusted devices" treats it apart. */
  primaryDevice?: boolean;
};

/**
 * The bulk sign-out that ends every session and revokes every device's trust.
 */
type BulkAction = "all-devices";

const BULK: Record<
  BulkAction,
  {
    query: string;
    label: MessageKey;
    hint: MessageKey;
    confirm: MessageKey;
  }
> = {
  "all-devices": {
    query: "?scope=all-devices",
    label: "settings.signOutAllDevices",
    hint: "settings.signOutAllDevicesHint",
    confirm: "settings.signOutAllDevicesConfirm"
  }
};

const BULK_ORDER: BulkAction[] = ["all-devices"];

/**
 * Sessions on trusted and untrusted devices.
 *
 * The session sync records the device association used by bulk sign-out.
 * That association lets the server revoke secondary sessions without ending
 * the confirmed primary device - for "untrusted devices" only. "All devices"
 * ends the primary too, and the Devices list can remove any device.
 */
export function OtherSessionsPanel() {
  const { t, locale } = useAppLanguage();
  const router = useRouter();
  const [confirming, setConfirming] = useState<BulkAction | null>(null);
  const [message, setMessage] = useState("");
  /** The row whose own button is mid-flight, so only that one shows it. */
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const sessionsQuery = useAuthenticatedQuery<{ sessions: SessionRow[] }>(
    "/api/me/sessions"
  );
  const sessions = sessionsQuery.data?.sessions ?? [];
  const others = sessions.filter((session) => !session.current);
  const refetchSessions = sessionsQuery.refetch;

  /**
   * The list reads itself back while somebody is looking at it.
   *
   * Realtime already covers the push: a new sign-in writes `auth.login.success`
   * to `activity_logs`, which is published and mapped to this endpoint, so an
   * open panel refreshes the moment another device appears. This is the other
   * half, and it is here for two reasons rather than as a duplicate.
   *
   * `NEXT_PUBLIC_ENABLE_REALTIME_SYNC` defaults OFF in development, so without
   * this the feature would appear not to work on the machine it is built on.
   * And `lastSeenAt` moves on a heartbeat that writes no activity row at all,
   * so nothing would ever announce it.
   *
   * Thirty seconds, and only while the tab is in front - the same shape the
   * kitchen board uses, for the same reason: a screen nobody is reading should
   * not poll, and should be current the moment it is looked at again.
   */
  useEffect(() => {
    const poll = () => {
      if (document.visibilityState !== "visible") return;

      void refetchSessions();
    };

    const timer = setInterval(poll, 30_000);
    document.addEventListener("visibilitychange", poll);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [refetchSessions]);

  // The venue's own locale and zone, so "last seen" reads the way every other
  // date on this screen does rather than in the browser's default.
  const when = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value));

  /**
   * "Manila, Philippines", or as much of it as the edge resolved.
   *
   * The country is stored as an ISO code and named here, so the same row reads
   * in the reader's own language. A code `Intl` does not recognise falls back
   * to itself rather than disappearing.
   */
  const place = (session: SessionRow) => {
    let country: string | null = null;

    if (session.country) {
      try {
        country =
          new Intl.DisplayNames([locale], { type: "region" }).of(
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

  /**
   * End one session, or one of the three bulk scopes.
   *
   * Shared by every control because the failure handling is identical and the
   * difference is one query string. The SERVER says whether this browser's
   * own session ended (`endedCurrentSession`) - always for "all devices",
   * and for "untrusted devices" when this is not the trusted primary.
   */
  const revoke = async (query: string) => {
    setMessage("");

    const response = await authenticatedFetch(`/api/me/sessions${query}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      // Thrown rather than returned: `ConfirmDialog` keeps itself open and
      // shows the reason, which is what should happen when the thing being
      // confirmed did not occur.
      throw new Error(payload?.error ?? t("settings.otherSessionsFailed"));
    }

    const payload = (await response.json().catch(() => null)) as {
      endedCurrentSession?: boolean;
    } | null;

    if (payload?.endedCurrentSession) {
      // This browser's session just ended. Clear the local Supabase
      // session and leave rather than staying on a dashboard that will refuse
      // every request from here on.
      await signOutCurrentSession().catch(() => undefined);
      router.replace(getDashboardLoginPath("/dashboard/settings"));

      return;
    }

    setMessage(t("settings.otherSessionsSignedOut"));
    setConfirming(null);
    // The rows the server just marked revoked, so the list stops showing
    // devices that can no longer renew.
    await sessionsQuery.refetch();
  };

  const confirmingAction = confirming ? BULK[confirming] : null;

  /**
   * One device, from its own row.
   *
   * Not behind a confirmation, unlike the bulk control. Signing out one named
   * device is a small, understood act aimed at something the person can see on
   * the list - and they can sign that device back in. "Everything, including
   * this one" is the irreversible-feeling one, and that is the one that asks.
   */
  const revokeOne = async (id: string) => {
    setRevokingId(id);

    try {
      await revoke(`?sessionId=${encodeURIComponent(id)}`);
    } catch (revokeError) {
      setMessage(
        revokeError instanceof Error
          ? revokeError.message
          : t("settings.otherSessionsFailed")
      );
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
      <PanelHeader title={t("settings.otherSessions")} icon="lock" />

      <div className="space-y-3 p-4">
        {sessionsQuery.error ? (
          <p className="text-[11px] font-bold text-[#b42318]" role="alert">
            {t("settings.sessionsLoadFailed")}
          </p>
        ) : null}

        <ul className="divide-y divide-[#eef1f5]">
          {sessions.map((session) => (
            <li
              className="flex flex-wrap items-baseline justify-between gap-2 py-2.5"
              key={session.id}
            >
              <span className="min-w-0">
                <span className="text-xs font-black text-[#17202a]">
                  {session.device ?? t("settings.unknownDevice")}
                </span>
                {session.current ? (
                  <span className="ml-2 rounded-full bg-[#e8f3ec] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#1c6b3f]">
                    {t("settings.thisDevice")}
                  </span>
                ) : null}
                {/* Every trusted device says so. Labelling only the primary
                    made a trusted secondary look untrusted beside it. No
                    "not trusted" badge: a session recorded before sessions
                    were linked to devices has no device to judge, and saying
                    "not trusted" about it would be a guess. */}
                {session.trustedDevice ? (
                  <span className="ml-2 rounded-full bg-[#edfbf4] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#147653]">
                    {t("settings.trustedDeviceBadge")}
                  </span>
                ) : null}
                {session.trustedDevice && session.primaryDevice ? (
                  <span className="ml-2 rounded-full bg-[#e8f1f8] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#1f4d73]">
                    {t("settings.primaryDeviceBadge")}
                  </span>
                ) : null}
                <span className="mt-0.5 block text-[10px] text-[#6a7483]">
                  {[
                    // Place first: it is the field somebody scans for when the
                    // question is "was that me?", and an address means nothing
                    // to most people.
                    //
                    // Named even when it is missing. Leaving the segment out
                    // entirely made an unresolved location indistinguishable
                    // from a broken one - the row simply had no place on it,
                    // and the only reading available was that the feature had
                    // not worked.
                    place(session) ?? t("settings.locationUnknown"),
                    t("settings.signedInOn", { when: when(session.createdAt) }),
                    session.ipAddress
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <span className="flex items-center gap-3">
                <span className="text-[10px] text-[#6a7483]">
                  {t("settings.lastSeen", { when: when(session.lastSeenAt) })}
                </span>
                {/* No button on this device. Its row already says "This
                    device", and the control for leaving the browser you are
                    sitting at is Logout in the sidebar - offering a second one
                    here, beside a list of other people's phones, invites
                    exactly the mis-click it looks like. "Sign out all devices"
                    below covers it deliberately. */}
                {!session.current ? (
                  <button
                    className="rounded-lg border border-[#e3c4c4] px-2.5 py-1 text-[10px] font-black text-[#b42318] transition hover:bg-[#fef3f2] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={revokingId !== null}
                    onClick={() => revokeOne(session.id)}
                    type="button"
                  >
                    {revokingId === session.id
                      ? t("settings.signingOutOthers")
                      : t("settings.signOutDevice")}
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>

        {/* Not while the list failed to load. "You are only signed in on this
            device" is a statement of fact, and saying it directly under "your
            sessions could not be loaded" asserts something we just admitted we
            do not know. */}
        {!sessionsQuery.isLoading &&
        !sessionsQuery.error &&
        others.length === 0 ? (
          <p className="text-[10px] leading-4 text-[#6a7483]">
            {t("settings.noOtherSessions")}
          </p>
        ) : null}

        {BULK_ORDER.map((action) => (
          <div className="space-y-1.5" key={action}>
            <p className="text-[10px] leading-4 text-[#6a7483]">
              {t(BULK[action].hint)}
            </p>
            <button
              className={secondaryButton}
              onClick={() => {
                setMessage("");
                setConfirming(action);
              }}
              type="button"
            >
              {t(BULK[action].label)}
            </button>
          </div>
        ))}

        {message ? (
          <p className="text-[11px] font-bold text-[#147653]" role="status">
            {message}
          </p>
        ) : null}
      </div>

      <ConfirmDialog
        confirmLabel={confirmingAction ? t(confirmingAction.label) : ""}
        description={confirmingAction ? t(confirmingAction.confirm) : ""}
        fallbackErrorMessage={t("settings.otherSessionsFailed")}
        onClose={() => setConfirming(null)}
        onConfirm={() => revoke(confirmingAction?.query ?? "")}
        open={confirmingAction !== null}
        pendingLabel={t("settings.signingOutOthers")}
        title={confirmingAction ? t(confirmingAction.label) : ""}
      />
    </section>
  );
}
