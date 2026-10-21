"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { getInitials } from "@/components/layout/dashboard-sidebar-shared";
import { ProfileSharedDeviceField } from "@/components/forms/profile-shared-device-field";
import { useAppLanguage } from "@/components/providers/app-language-provider";
import { AsyncState } from "@/components/ui/async-state";
import {
  invalidateAuthenticatedQuery,
  useAuthenticatedQuery
} from "@/features/dashboard/hooks/use-authenticated-query";
import { useAuthSession } from "@/features/dashboard/hooks/use-dashboard-permission";
import { useDateFormatters } from "@/features/dashboard/hooks/use-regional-settings";
import { MfaSecurityPanel } from "@/features/settings/components/mfa-security-panel";
import { OtherSessionsPanel } from "@/features/settings/components/other-sessions-panel";
import {
  Icon,
  PanelHeader,
  Toggle,
  type IconName
} from "@/features/settings/components/settings-shared";
import { refreshAuthorization } from "@/lib/auth/authorization-refresh";
import { signOutCurrentSession } from "@/lib/auth/client";
import { getPasswordValidationError } from "@/lib/auth/password";
import { getDashboardLoginPath } from "@/lib/auth/redirect";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import type { MessageKey } from "@/lib/i18n/messages";
import { centerMobileTab } from "@/lib/ui/center-mobile-tab";
import { showBillingReadouts } from "@/lib/ui/mvp-features";
import { useScrollLock } from "@/lib/ui/use-scroll-lock";

/**
 * My Account - what every signed-in person may change about THEMSELVES.
 *
 * The other half of the Settings split. Settings is the organization's and is
 * gated on `settings.read`; this is gated on nothing but being signed in,
 * because everything in it reaches only the caller's own rows through the
 * `/api/me/*` routes. What the organization decides about somebody - their
 * email, department, title, roles - is shown READ-ONLY and labelled as managed
 * by the organization, which is how the person learns where to ask.
 *
 * A DIALOG, NOT A PAGE, opened from the menu under the person's name, so
 * looking at your own details never takes you away from what you were doing.
 *
 * DRAWN WITH SETTINGS' OWN PARTS - the tab strip, the section intro card,
 * `PanelHeader` cards, the same field and button styles - so an administrator
 * moving between the two sees one product, not two.
 */

type Profile = {
  name: string;
  email: string;
  phone: string | null;
  department: string | null;
  title: string | null;
  organizationName: string;
};

type Preferences = {
  emailNotifications: boolean;
  eventConfirmations: boolean;
  billingAlerts: boolean;
  systemAnnouncements: boolean;
};

type AccessResponse = {
  roles: Array<{
    id: string;
    roleName: string;
    scopeType: string;
    scopeLabel: string | null;
    expiresAt: string | null;
  }>;
  permissionGroups: Array<{
    group: string;
    permissions: Array<{ key: string; label: string }>;
  }>;
};

type SectionId =
  | "profile"
  | "password"
  | "security"
  | "devices"
  | "notifications"
  | "region"
  | "access";

const SECTIONS: Array<{
  id: SectionId;
  labelKey: MessageKey;
  hintKey: MessageKey;
  icon: IconName;
}> = [
  {
    id: "profile",
    labelKey: "account.profile",
    hintKey: "account.profileHint",
    icon: "users"
  },
  {
    id: "password",
    labelKey: "account.password",
    hintKey: "account.passwordSectionHint",
    icon: "lock"
  },
  {
    id: "security",
    labelKey: "account.security",
    hintKey: "account.securityHint",
    icon: "shield"
  },
  {
    id: "devices",
    labelKey: "account.devices",
    hintKey: "account.devicesHint",
    icon: "eye"
  },
  {
    id: "notifications",
    labelKey: "account.notifications",
    hintKey: "account.notificationsHint",
    icon: "mail"
  },
  {
    id: "region",
    labelKey: "account.region",
    hintKey: "account.regionHint",
    icon: "globe"
  },
  {
    id: "access",
    labelKey: "account.access",
    hintKey: "account.accessHint",
    icon: "access"
  }
];

// Settings' own field and button styles, so the two read as one product.
const labelClass = "block text-[10px] font-bold text-[#17202a]";
const hintClass = "text-[10px] leading-4 text-[#6a7483]";
const inputClass =
  "mt-1 h-9 w-full rounded-lg border border-[#c7d0dc] bg-white px-3 text-xs outline-none focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15";
const primaryButton =
  "h-9 rounded-lg bg-[#1f4d73] px-5 text-xs font-black text-white disabled:opacity-45";

async function readError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  return payload?.error ?? fallback;
}

/** A Settings card: white, bordered, with the same header strip. */
function Panel({
  title,
  icon,
  children
}: {
  title?: string;
  icon?: IconName;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
      {title ? <PanelHeader icon={icon} title={title} /> : null}
      {children}
    </section>
  );
}

function PanelFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t border-[#d8dde5] px-4 py-3 sm:flex-row sm:items-center sm:justify-end">
      {children}
    </div>
  );
}

function Notice({
  tone,
  children
}: {
  tone: "ok" | "error";
  children: ReactNode;
}) {
  return (
    <p
      className={`rounded-lg p-3 text-xs font-bold sm:mr-auto ${tone === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </p>
  );
}

/** A value the organization owns: drawn as Settings draws a locked field. */
function ManagedField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className={labelClass}>{label}</p>
      <p className="mt-1 flex h-9 items-center truncate rounded-lg border border-[#c7d0dc] bg-[#f5f6f8] px-3 text-xs text-[#536b83]">
        {value}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- Profile

function ProfileSection({
  profile,
  roleNames
}: {
  profile: Profile;
  roleNames: string[];
}) {
  const { t } = useAppLanguage();
  const nameId = useId();
  const phoneId = useId();
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    setName(profile.name);
    setPhone(profile.phone ?? "");
  }, [profile.name, profile.phone]);

  const isDirty =
    name.trim() !== profile.name || phone.trim() !== (profile.phone ?? "");

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setNotice(null);

    try {
      const response = await authenticatedFetch("/api/me/profile", {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || null })
      });

      if (!response.ok) {
        throw new Error(await readError(response, t("account.saveFailed")));
      }

      invalidateAuthenticatedQuery("/api/me/profile");
      // The sidebar draws the name from the session, so re-reading it is what
      // makes the new name appear everywhere at once.
      await refreshAuthorization({ force: true });
      setNotice({ tone: "ok", text: t("account.saved") });
    } catch (saveError) {
      setNotice({
        tone: "error",
        text:
          saveError instanceof Error
            ? saveError.message
            : t("account.saveFailed")
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Panel title={t("account.profile")}>
        {/* The same identity row Settings opens its organization card with. */}
        <div className="flex items-center gap-3 border-b border-[#d8dde5] p-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#25292e] text-base font-bold text-white">
            {getInitials(profile.name)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-sm font-black">{profile.name}</h2>
              {roleNames.map((roleName) => (
                <span
                  className="rounded-full bg-[#edfbf4] px-2 py-1 text-[9px] font-black text-[#147653]"
                  key={roleName}
                >
                  {roleName}
                </span>
              ))}
            </div>
            <p className="mt-1 truncate text-[10px] text-[#6a7483]">
              {profile.email}
            </p>
            <p className="mt-1 truncate text-[10px] text-[#6a7483]">
              {profile.organizationName}
            </p>
          </div>
        </div>

        <form onSubmit={save}>
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <label className={labelClass} htmlFor={nameId}>
              {t("account.name")}
              <input
                autoComplete="name"
                className={inputClass}
                id={nameId}
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </label>
            <label className={labelClass} htmlFor={phoneId}>
              {t("account.phone")}
              <input
                autoComplete="tel"
                className={inputClass}
                id={phoneId}
                inputMode="tel"
                onChange={(event) => setPhone(event.target.value)}
                value={phone}
              />
            </label>
          </div>
          <PanelFooter>
            {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
            <button
              className={primaryButton}
              disabled={!isDirty || !name.trim() || isSaving}
              type="submit"
            >
              {isSaving ? t("account.saving") : t("account.save")}
            </button>
          </PanelFooter>
        </form>
      </Panel>

      <Panel icon="lock" title={t("account.managedByOrganization")}>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <ManagedField label={t("account.email")} value={profile.email} />
          <ManagedField
            label={t("account.organization")}
            value={profile.organizationName || t("account.notSet")}
          />
          <ManagedField
            label={t("account.department")}
            value={profile.department || t("account.notSet")}
          />
          <ManagedField
            label={t("account.jobTitle")}
            value={profile.title || t("account.notSet")}
          />
        </div>
      </Panel>
    </>
  );
}

// ---------------------------------------------------------------- Password

/** "a•••@example.com" - enough to recognise your own address on a shared screen. */
function maskEmail(email: string) {
  const [local, domain] = email.split("@");

  if (!local || !domain) return email;

  return `${local.slice(0, 1)}•••@${domain}`;
}

function PasswordSection({ email }: { email: string }) {
  const { t } = useAppLanguage();
  const currentId = useId();
  const nextId = useId();
  const confirmId = useId();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [notice, setNotice] = useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);

  // Forgot the current password: email the same reset link the logged-out
  // Forgot Password page sends, to the address on the account.
  const sendReset = async () => {
    setIsSendingReset(true);
    setNotice(null);

    try {
      const response = await authenticatedFetch("/api/me/password-reset", {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error(await readError(response, t("account.resetFailed")));
      }

      setNotice({
        tone: "ok",
        text: t("account.resetSent", { email: maskEmail(email) })
      });
    } catch (resetError) {
      setNotice({
        tone: "error",
        text:
          resetError instanceof Error
            ? resetError.message
            : t("account.resetFailed")
      });
    } finally {
      setIsSendingReset(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);

    if (next !== confirm) {
      setNotice({ tone: "error", text: t("account.passwordMismatch") });
      return;
    }

    // The server applies the same rule; checking here saves a round trip for
    // the common mistake.
    const rule = getPasswordValidationError(next);
    if (rule) {
      setNotice({ tone: "error", text: rule });
      return;
    }

    setIsSaving(true);

    try {
      const response = await authenticatedFetch("/api/me/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: current, newPassword: next })
      });

      if (!response.ok) {
        throw new Error(await readError(response, t("account.passwordFailed")));
      }

      setCurrent("");
      setNext("");
      setConfirm("");
      setNotice({ tone: "ok", text: t("account.passwordChanged") });
    } catch (changeError) {
      setNotice({
        tone: "error",
        text:
          changeError instanceof Error
            ? changeError.message
            : t("account.passwordFailed")
      });
    } finally {
      setIsSaving(false);
    }
  };

  const field = (
    id: string,
    labelKey: MessageKey,
    value: string,
    onChange: (value: string) => void,
    autoComplete: string
  ) => (
    <label className={labelClass} htmlFor={id}>
      {t(labelKey)}
      <input
        autoComplete={autoComplete}
        className={inputClass}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        required
        type="password"
        value={value}
      />
    </label>
  );

  return (
    <Panel title={t("account.changePassword")}>
      <form onSubmit={submit}>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <div className="sm:col-span-2 sm:max-w-[calc(50%-0.375rem)]">
            {field(
              currentId,
              "account.currentPassword",
              current,
              setCurrent,
              "current-password"
            )}
            {/* type="button" so it never submits the change form above it. */}
            <button
              className="mt-1.5 text-[11px] font-bold text-[#1769aa] hover:underline disabled:opacity-50"
              disabled={isSendingReset}
              onClick={() => void sendReset()}
              type="button"
            >
              {isSendingReset
                ? t("account.resetSending")
                : t("account.forgotCurrent")}
            </button>
          </div>
          {field(nextId, "account.newPassword", next, setNext, "new-password")}
          {field(
            confirmId,
            "account.confirmPassword",
            confirm,
            setConfirm,
            "new-password"
          )}
          <p className={`${hintClass} sm:col-span-2`}>
            {t("account.passwordHint")}
          </p>
        </div>
        <PanelFooter>
          {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
          <button
            className={primaryButton}
            disabled={!current || !next || !confirm || isSaving}
            type="submit"
          >
            {isSaving ? t("account.saving") : t("account.changePassword")}
          </button>
        </PanelFooter>
      </form>
    </Panel>
  );
}

// ---------------------------------------------------------------- Notifications

function NotificationsSection() {
  const { t } = useAppLanguage();
  const query = useAuthenticatedQuery<{ preferences: Preferences }>(
    "/api/me/notifications"
  );
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (query.data) setPreferences(query.data.preferences);
  }, [query.data]);

  const flip = async (field: keyof Preferences) => {
    if (!preferences) return;

    const previous = preferences;
    const value = !preferences[field];

    setPreferences({ ...preferences, [field]: value });
    setError("");

    try {
      const response = await authenticatedFetch("/api/me/notifications", {
        method: "PATCH",
        body: JSON.stringify({ [field]: value })
      });

      if (!response.ok) {
        throw new Error(
          await readError(response, t("account.notificationsFailed"))
        );
      }

      invalidateAuthenticatedQuery("/api/me/notifications");
    } catch (flipError) {
      setPreferences(previous);
      setError(
        flipError instanceof Error
          ? flipError.message
          : t("account.notificationsFailed")
      );
    }
  };

  const rows: Array<{
    field: keyof Preferences;
    title: MessageKey;
    hint: MessageKey;
    icon: IconName;
  }> = [
    {
      field: "emailNotifications",
      title: "settings.emailNotifications",
      hint: "settings.emailNotificationsHint",
      icon: "mail"
    },
    {
      field: "eventConfirmations",
      title: "settings.eventConfirmations",
      hint: "settings.eventConfirmationsHint",
      icon: "calendar"
    },
    // Governs mail about the hidden Billing module, exactly as on Settings.
    // Filtered rather than dropped, so the saved preference survives.
    ...(showBillingReadouts
      ? [
          {
            field: "billingAlerts" as const,
            title: "settings.invoiceAlerts" as const,
            hint: "settings.invoiceAlertsHint" as const,
            icon: "billing" as const
          }
        ]
      : []),
    {
      field: "systemAnnouncements",
      title: "settings.systemAnnouncements",
      hint: "settings.systemAnnouncementsHint",
      icon: "activity"
    }
  ];

  return (
    <Panel title={t("settings.notificationPreferences")}>
      {!preferences ? (
        <div className="p-4">
          <AsyncState
            error={query.error}
            isLoading={query.isLoading}
            onRetry={query.refetch}
          />
        </div>
      ) : (
        // The same rows as Settings' Notifications section.
        <div className="space-y-4 p-4">
          {rows.map((row) => (
            <div className="flex items-start gap-3" key={row.field}>
              <Icon className="mt-0.5 h-4 w-4 shrink-0" name={row.icon} />
              <div className="min-w-0 flex-1">
                <h3 className="text-[11px] font-black">{t(row.title)}</h3>
                <p className="mt-1 text-[9px] leading-4 text-[#6a7483]">
                  {t(row.hint)}
                </p>
              </div>
              <Toggle
                checked={preferences[row.field]}
                label={t(row.title)}
                onChange={() => void flip(row.field)}
              />
            </div>
          ))}
          {error ? <Notice tone="error">{error}</Notice> : null}
        </div>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------- Region

const LANGUAGE_NAME_KEYS: Record<string, MessageKey> = {
  "en-US": "settings.langEnUs",
  "en-GB": "settings.langEnGb",
  "es-US": "settings.langEs",
  "he-IL": "settings.langHe"
};

function RegionSection() {
  const { t } = useAppLanguage();
  const session = useAuthSession();
  const language = session?.language ?? "en-US";
  const languageKey = LANGUAGE_NAME_KEYS[language];

  return (
    <Panel title={t("account.region")}>
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <ManagedField
          label={t("account.language")}
          value={languageKey ? t(languageKey) : language}
        />
        <ManagedField
          label={t("account.timezone")}
          value={session?.regional?.timeZone ?? "—"}
        />
        <p className={`${hintClass} sm:col-span-2`}>
          {t("account.setByOrganization")}
        </p>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------- Access

function AccessSection({
  organizationName,
  query
}: {
  organizationName: string;
  query: ReturnType<typeof useAuthenticatedQuery<AccessResponse>>;
}) {
  const { t } = useAppLanguage();
  const dates = useDateFormatters();

  if (!query.data) {
    return (
      <Panel>
        <div className="p-4">
          <AsyncState
            error={query.error}
            isLoading={query.isLoading}
            onRetry={query.refetch}
          />
        </div>
      </Panel>
    );
  }

  return (
    <>
      <Panel title={t("account.roles")}>
        <div className="space-y-3 p-4">
          <p className={hintClass}>
            {t("account.accessBlurb", { organization: organizationName })}
          </p>
          {query.data.roles.length === 0 ? (
            <p className="text-xs text-[#6a7483]">{t("account.noRoles")}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {query.data.roles.map((role) => (
                <li
                  className="rounded-lg border border-[#d8dde5] bg-[#f5f6f8] px-3 py-2"
                  key={role.id}
                >
                  <span className="block text-xs font-black text-[#17202a]">
                    {role.roleName}
                  </span>
                  <span className="block text-[10px] text-[#6a7483]">
                    {role.scopeLabel ?? t("account.scopeOrganization")}
                    {role.expiresAt
                      ? ` · ${t("account.until", { when: dates.date(role.expiresAt) })}`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>

      <Panel title={t("account.permissions")}>
        <div className="space-y-4 p-4">
          {query.data.permissionGroups.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {query.data.permissionGroups.map((group) => (
                <div key={group.group}>
                  <p className="text-[10px] font-black uppercase tracking-wide text-[#6a7483]">
                    {group.group}
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {group.permissions.map((permission) => (
                      <li
                        className="flex items-start gap-2 text-xs text-[#233144]"
                        key={permission.key}
                      >
                        <span className="mt-0.5 text-[#147653]">
                          <Icon className="h-3.5 w-3.5" name="shield" />
                        </span>
                        {permission.label}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
          <p className="text-[11px] font-bold text-[#1f4d73]">
            {t("account.askAdmin")}
          </p>
        </div>
      </Panel>
    </>
  );
}

// ---------------------------------------------------------------- Devices

type DeviceRow = {
  id: string;
  device: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  lastSeenAt: string;
  primary: boolean;
  confirmed: boolean;
  trusted: boolean;
  /** When this device must be verified again. Null when never confirmed. */
  trustExpiresAt: string | null;
  current: boolean;
};

/** A removal waiting for its emailed code. */
type PendingRemoval = {
  deviceId: string;
  sentTo: string | null;
  code: string;
  /** Epoch ms when "send a new code" opens again. */
  resendAt: number | null;
};

/**
 * The browsers this person has signed in from, trusted or not. Removing one -
 * ANY one, the primary included - takes two steps, like a wallet app: a code is
 * emailed to the account, and entering it removes the device, takes its trust
 * away and signs it out. Removing THIS browser signs it out here too and
 * returns to sign-in. The server enforces every part of this; the screen only
 * follows what it reports. The list never carries a device hash.
 */
function TrustedDevicesPanel() {
  const { t } = useAppLanguage();
  const router = useRouter();
  const dates = useDateFormatters();
  const query = useAuthenticatedQuery<{ devices: DeviceRow[] }>(
    "/api/me/devices"
  );
  const [pending, setPending] = useState<PendingRemoval | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  // Ticks only while a resend cooldown is running.
  useEffect(() => {
    if (!pending?.resendAt) return;

    const timer = window.setInterval(() => setNow(Date.now()), 1_000);

    return () => window.clearInterval(timer);
  }, [pending?.resendAt]);

  const secondsLeft = pending?.resendAt
    ? Math.max(0, Math.ceil((pending.resendAt - now) / 1_000))
    : 0;

  /** Step one: email a code bound to this device. Nothing is removed yet. */
  const requestCode = async (deviceId: string) => {
    setBusy(true);
    setError("");

    try {
      const response = await authenticatedFetch("/api/me/devices/removal-code", {
        method: "POST",
        body: JSON.stringify({ deviceId })
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        sentTo?: string;
        resendAvailableAt?: string;
      } | null;
      const resendAt = payload?.resendAvailableAt
        ? new Date(payload.resendAvailableAt).getTime()
        : null;

      if (!response.ok) {
        // A cooldown still leaves an earlier code usable, so keep the form.
        if (response.status === 429 && pending?.deviceId === deviceId) {
          setPending({ ...pending, resendAt });
        }
        throw new Error(payload?.error ?? t("account.deviceRemoveFailed"));
      }

      setPending({
        deviceId,
        sentTo: payload?.sentTo ?? null,
        code: "",
        resendAt
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t("account.deviceRemoveFailed")
      );
    } finally {
      setBusy(false);
    }
  };

  /** Step two: the server checks the code, and only then removes. */
  const remove = async () => {
    if (!pending) return;

    if (!/^\d{6}$/.test(pending.code)) {
      setError(t("settings.mfaEnterEmailCode"));
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response = await authenticatedFetch("/api/me/devices", {
        method: "DELETE",
        body: JSON.stringify({ deviceId: pending.deviceId, code: pending.code })
      });

      if (!response.ok) {
        throw new Error(
          await readError(response, t("account.deviceRemoveFailed"))
        );
      }

      const payload = (await response.json().catch(() => null)) as {
        endedCurrentSession?: boolean;
      } | null;

      if (payload?.endedCurrentSession) {
        // THIS browser was removed: the server already ended its session and
        // refuses it. Clear it locally and go to sign-in, where it will be
        // verified again like a new device.
        await signOutCurrentSession().catch(() => undefined);
        router.replace(getDashboardLoginPath("/dashboard"));
        return;
      }

      setPending(null);
      invalidateAuthenticatedQuery("/api/me/devices");
      await query.refetch();
      // Re-read the session so the sessions list and gates stay current.
      await refreshAuthorization({ force: true });
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : t("account.deviceRemoveFailed")
      );
    } finally {
      setBusy(false);
    }
  };

  const devices = query.data?.devices ?? [];

  return (
    <Panel icon="eye" title={t("account.trustedDevices")}>
      <div className="space-y-3 p-4">
        <p className={hintClass}>{t("account.trustedDevicesHint")}</p>

        {!query.data ? (
          <AsyncState
            error={query.error}
            isLoading={query.isLoading}
            onRetry={query.refetch}
          />
        ) : devices.length === 0 ? (
          <p className="text-xs text-[#6a7483]">{t("account.noDevices")}</p>
        ) : (
          <ul className="divide-y divide-[#eef1f5] rounded-lg border border-[#d8dde5]">
            {devices.map((row) => (
              <li className="px-3 py-2.5" key={row.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-xs font-black text-[#17202a]">
                      {row.device ?? "—"}
                    </span>
                    {row.primary ? (
                      <span className="rounded-full bg-[#e8f1f8] px-2 py-0.5 text-[9px] font-black text-[#1f4d73]">
                        {t("account.devicePrimary")}
                      </span>
                    ) : null}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-black ${
                        row.trusted
                          ? "bg-[#edfbf4] text-[#147653]"
                          : row.confirmed
                            ? "bg-[#edf2ff] text-[#334a9a]"
                            : "bg-[#fff4e5] text-[#9a5b00]"
                      }`}
                    >
                      {row.trusted
                        ? row.trustExpiresAt
                          ? t("account.deviceTrustedUntil", {
                              when: dates.date(row.trustExpiresAt)
                            })
                          : t("account.deviceTrusted")
                        : row.confirmed
                          ? t("account.deviceTrustExpired")
                          : t("account.deviceUnconfirmed")}
                    </span>
                    {row.current ? (
                      <span className="rounded-full bg-[#e8f1f8] px-2 py-0.5 text-[9px] font-black text-[#1f4d73]">
                        {t("account.thisDevice")}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[10px] text-[#6a7483]">
                    {[row.city, row.region, row.country]
                      .filter(Boolean)
                      .join(", ")}
                    {[row.city, row.region, row.country].some(Boolean)
                      ? " · "
                      : ""}
                    {t("account.deviceLastSeen", {
                      when: dates.dateTime(row.lastSeenAt)
                    })}
                  </p>
                </div>
                {pending?.deviceId !== row.id ? (
                  <button
                    className="h-7 shrink-0 rounded-lg border border-[#c7d0dc] px-2.5 text-[10px] font-black text-[#233144] transition hover:bg-[#fff2f2] hover:text-[#b42318] disabled:opacity-50"
                    disabled={busy}
                    onClick={() => void requestCode(row.id)}
                    type="button"
                  >
                    {row.current
                      ? t("account.deviceRemoveAndSignOut")
                      : t("account.deviceRemove")}
                  </button>
                ) : null}
              </div>

              {pending?.deviceId === row.id ? (
                <div className="mt-2 space-y-2 rounded-lg border border-[#f1d4d4] bg-[#fffafa] p-3">
                  <p className="text-[10px] leading-4 text-[#334155]" role="status">
                    {t("account.deviceRemoveCodeSent", {
                      email: pending.sentTo ?? t("account.yourEmail")
                    })}
                    {row.current ? ` ${t("account.deviceRemoveSignsOutHere")}` : ""}
                  </p>
                  <input
                    aria-label={t("account.deviceCodeLabel")}
                    autoComplete="one-time-code"
                    className={`${inputClass} text-center font-black tracking-[0.4em]`}
                    inputMode="numeric"
                    maxLength={6}
                    name="deviceRemovalCode"
                    onChange={(event) =>
                      setPending({
                        ...pending,
                        code: event.target.value.replace(/\D/g, "")
                      })
                    }
                    placeholder="000000"
                    value={pending.code}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="h-8 rounded-lg bg-[#b42318] px-3 text-[10px] font-black text-white disabled:opacity-45"
                      disabled={busy}
                      onClick={() => void remove()}
                      type="button"
                    >
                      {row.current
                        ? t("account.deviceRemoveAndSignOut")
                        : t("account.deviceRemoveConfirm")}
                    </button>
                    <button
                      className="h-8 rounded-lg border border-[#c7d0dc] px-3 text-[10px] font-black text-[#233144] disabled:opacity-45"
                      disabled={busy || secondsLeft > 0}
                      onClick={() => void requestCode(row.id)}
                      type="button"
                    >
                      {secondsLeft > 0
                        ? t("account.deviceResendIn", { seconds: secondsLeft })
                        : t("account.deviceRemoveResend")}
                    </button>
                    <button
                      className="h-8 rounded-lg px-3 text-[10px] font-black text-[#6a7483] underline disabled:opacity-45"
                      disabled={busy}
                      onClick={() => {
                        setPending(null);
                        setError("");
                      }}
                      type="button"
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                </div>
              ) : null}
              </li>
            ))}
          </ul>
        )}

        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------- Dialog

export function AccountDialog({ onClose }: { onClose: () => void }) {
  const { t } = useAppLanguage();
  const session = useAuthSession();
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [section, setSection] = useState<SectionId>("profile");
  const profileQuery = useAuthenticatedQuery<{ profile: Profile }>(
    "/api/me/profile"
  );
  // Fetched here rather than in the Access section: the Profile card shows the
  // role badges too, and both read the same answer.
  const accessQuery = useAuthenticatedQuery<AccessResponse>("/api/me/access");
  const profile = profileQuery.data?.profile;
  const active = SECTIONS.find((entry) => entry.id === section) ?? SECTIONS[0];
  const roleNames = (accessQuery.data?.roles ?? []).map(
    (role) => role.roleName
  );

  useScrollLock(true);

  useEffect(() => {
    closeButtonRef.current?.focus();

    // Escape closes the TOP dialog only. "Sign out everywhere" opens a
    // confirmation over this one, and both listen on the window - without the
    // check, one keypress would dismiss the confirmation and My Account with it.
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (document.querySelectorAll('[aria-modal="true"]').length > 1) return;

      onClose();
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const renderSection = (current: Profile) => {
    switch (section) {
      case "profile":
        return <ProfileSection profile={current} roleNames={roleNames} />;
      case "password":
        return <PasswordSection email={current.email} />;
      case "security":
        return (
          <Panel>
            <MfaSecurityPanel
              requiredByOrganization={Boolean(
                session?.mfa?.requiredByOrganization
              )}
              requiredNote={t("account.twoFactorRequired")}
            />
          </Panel>
        );
      case "devices":
        return (
          <>
            {/* Browsers - trusted or not - and the sign-in sessions on them. */}
            <TrustedDevicesPanel />
            {/* Draws its own card - it is the same panel Settings shows. */}
            <OtherSessionsPanel />
            {/* The kitchen-board exemption. Only where the venue has a timeout
                to be exempt from; the field renders nothing otherwise. */}
            {session?.inactivity && session.inactivity.timeoutMinutes > 0 ? (
              <Panel title={t("settings.sharedDevice")}>
                <div className="p-4">
                  <ProfileSharedDeviceField
                    className="block text-xs text-[#17202a]"
                    labelClassName="sr-only"
                  />
                </div>
              </Panel>
            ) : null}
          </>
        );
      case "notifications":
        return <NotificationsSection />;
      case "region":
        return <RegionSection />;
      case "access":
        return (
          <AccessSection
            organizationName={current.organizationName}
            query={accessQuery}
          />
        );
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-[#17202a]/45 p-3 backdrop-blur-[1px] sm:p-5"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="dashboard-readable-page flex h-[min(780px,calc(100dvh-1.5rem))] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#d8dde5] bg-[#f5f6f8] text-[#17202a] shadow-2xl"
        role="dialog"
      >
        {/* Settings' modal header, button for button. */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#d8dde5] bg-[#f5f6f8] px-4 sm:px-5">
          <h2 className="text-sm font-black text-[#17202a]" id={titleId}>
            {t("account.title")}
          </h2>
          <button
            aria-label={t("account.close")}
            className="group ml-auto flex h-8 w-8 items-center justify-center rounded-full border-0 bg-transparent text-[#233144] shadow-none transition hover:bg-[#e4edf5] hover:text-[#1f4d73] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f4d73]/25"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            <span className="relative h-4 w-4" aria-hidden="true">
              <span className="absolute left-1/2 top-1/2 h-0.5 w-4 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-current transition-transform group-hover:scale-110" />
              <span className="absolute left-1/2 top-1/2 h-0.5 w-4 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-current transition-transform group-hover:scale-110" />
            </span>
          </button>
        </header>

        {/* Settings' tab strip. */}
        <nav
          aria-label={t("account.sections")}
          className="scrollbar-none flex shrink-0 gap-1 overflow-x-auto border-b border-[#d8dde5] bg-white px-4 py-2"
        >
          {SECTIONS.map((entry) => (
            <button
              aria-current={entry.id === section ? "page" : undefined}
              className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-bold transition ${
                entry.id === section
                  ? "bg-[#e8f1f8] text-[#1f4d73]"
                  : "text-[#596779] hover:bg-[#f0f3f6] hover:text-[#233144]"
              }`}
              key={entry.id}
              onClick={(event) => {
                setSection(entry.id);
                centerMobileTab(event.currentTarget);
              }}
              type="button"
            >
              <Icon className="h-4 w-4 shrink-0" name={entry.icon} />
              {t(entry.labelKey)}
            </button>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4">
          {!profile ? (
            <div className="flex h-full items-center justify-center">
              <AsyncState
                error={profileQuery.error}
                isLoading={profileQuery.isLoading}
                onRetry={profileQuery.refetch}
              />
            </div>
          ) : (
            <>
              {/* Settings' section intro card. */}
              <div className="mb-4 rounded-xl border border-[#d8dde5] bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <Icon
                    className="h-4 w-4 shrink-0 text-[#536b83]"
                    name={active.icon}
                  />
                  <h3 className="text-sm font-black text-[#17202a]">
                    {t(active.labelKey)}
                  </h3>
                </div>
                <p className="mt-1 text-xs leading-5 text-[#6a7483]">
                  {t(active.hintKey)}
                </p>
              </div>

              <div className="mx-auto grid w-full max-w-3xl items-start gap-4">
                {renderSection(profile)}
              </div>
            </>
          )}
        </div>
      </section>
    </div>,
    document.body
  );
}
