"use client";

import { type ReactNode } from "react";

import type { MessageKey } from "@/lib/i18n/messages";

export type SettingsResponse = {
  organization: { id: string; name: string };
  settings: {
    language: string;
    timezone: string;
    /**
     * Whether everyone in this organization has to hold a second factor.
     *
     * Stored and audited since the settings table was written, and returned by
     * the route all along through the `...settings` spread - it simply had no
     * control and no entry here, so nothing could read it.
     */
    twoFactorRequired: boolean;
    /** How long an idle session lasts, in minutes. */
    sessionTimeoutMinutes: number;
    calendar?: { dailyEventLimit: number };
    controlCenter: ControlCenterSettings;
  };
  notifications: {
    emailNotifications: boolean;
    eventConfirmations: boolean;
    billingAlerts: boolean;
    systemAnnouncements: boolean;
  };
  // Where this organization's client portal sends Pay balance. Empty means
  // unconfigured, and the portal hides the action rather than falling back.
  payments: { paymentLink: string };
};

export type ControlCenterSettings = {
  general: {
    /**
     * Where the logo lives in the private organization-logos bucket, not a URL:
     * it is rendered through a signed URL that rotates, so the path is the only
     * part worth storing.
     */
    logoPath: string;
    /**
     * What the client portal paints behind its header - the one part of Event
     * Core a venue's own clients look at.
     *
     * `style` decides which of the two below is drawn, so switching back to a
     * colour keeps the uploaded image rather than making the operator upload it
     * again. `imagePath` is a storage path in the same private bucket as the
     * logo, for the same reason.
     */
    portalHeader: {
      style: "color" | "image";
      color: string;
      imagePath: string;
    };
    contactEmail: string;
    dateFormat: "MMM d, yyyy" | "MM/dd/yyyy" | "dd/MM/yyyy";
    timeFormat: "12-hour" | "24-hour";
  };
  calendar: {
    defaultView: "month" | "week" | "agenda";
    weekStartsOn: "sunday" | "monday" | "saturday";
    showHebrewDate: boolean;
    showAvailability: boolean;
    clickAnywhereToAdd: boolean;
    holdExpirationHours: 24 | 48 | 72 | 168;
    shortNoticeDays: 3 | 7 | 14 | 30;
  };
  kitchen: {
    defaultView: "today" | "week" | "four-weeks";
    shortNoticeDays: 1 | 3 | 7;
    notificationsEnabled: boolean;
    requireMenuAcknowledgment: boolean;
  };
};

export type IconName =
  | "gear"
  | "hall"
  | "kitchen"
  | "users"
  | "access"
  | "feature"
  | "mail"
  | "calendar"
  | "file"
  | "activity"
  | "lock"
  | "shield"
  | "globe"
  | "eye"
  | "link"
  | "upload"
  | "billing";

export type ModalSettingsSection =
  | "General"
  | "Halls"
  | "Event Types"
  | "Calendar"
  | "Kitchen"
  | "Notifications"
  | "Billing"
  | "Access"
  | "Activity"
  | "Security"
  | "Branding"
  | "Integrations"
  | "Reset";

export type ModalSettingsNavItem = {
  /**
   * The section identifier. Stays English on purpose - the page and the
   * sidebar switch on it, so it is a key, not copy. `labelKey` is what gets
   * drawn.
   */
  label: ModalSettingsSection;
  labelKey: MessageKey;
  descriptionKey: MessageKey;
  icon: IconName;
};

export const modalSettingsNavItems: ModalSettingsNavItem[] = [
  {
    label: "General",
    labelKey: "settings.section.general",
    descriptionKey: "settings.sectionDesc.general",
    icon: "gear"
  },
  {
    label: "Halls",
    labelKey: "settings.section.halls",
    descriptionKey: "settings.sectionDesc.halls",
    icon: "hall"
  },
  {
    label: "Event Types",
    labelKey: "settings.section.eventTypes",
    descriptionKey: "settings.sectionDesc.eventTypes",
    icon: "calendar"
  },
  {
    label: "Calendar",
    labelKey: "settings.section.calendar",
    descriptionKey: "settings.sectionDesc.calendar",
    icon: "calendar"
  },
  {
    label: "Kitchen",
    labelKey: "settings.section.kitchen",
    descriptionKey: "settings.sectionDesc.kitchen",
    icon: "kitchen"
  },
  {
    label: "Notifications",
    labelKey: "settings.section.notifications",
    descriptionKey: "settings.sectionDesc.notifications",
    icon: "mail"
  },
  {
    label: "Billing",
    labelKey: "settings.section.billing",
    descriptionKey: "settings.sectionDesc.billing",
    icon: "billing"
  },
  {
    label: "Access",
    labelKey: "settings.section.access",
    descriptionKey: "settings.sectionDesc.access",
    icon: "access"
  },
  {
    // Next to Access rather than at the top, because the two answer adjacent
    // questions: who may do things, and what was done. Gated on `activity.read`
    // in settings-page.tsx, the same way Reset is gated on `organization.reset`.
    label: "Activity",
    labelKey: "settings.section.activity",
    descriptionKey: "settings.sectionDesc.activity",
    icon: "activity"
  },
  {
    // After Access and Activity, which is the order the three questions are
    // usually asked in: who may do things, what was done, and how hard it is
    // to become one of those people in the first place.
    label: "Security",
    labelKey: "settings.section.security",
    descriptionKey: "settings.sectionDesc.security",
    icon: "shield"
  },
  {
    label: "Branding",
    labelKey: "settings.section.branding",
    descriptionKey: "settings.sectionDesc.branding",
    icon: "file"
  },
  {
    label: "Integrations",
    labelKey: "settings.section.integrations",
    descriptionKey: "settings.sectionDesc.integrations",
    icon: "link"
  },
  // Last, and it stays last. Everything above it is a preference somebody can
  // change back; this one empties the account.
  {
    label: "Reset",
    labelKey: "settings.section.reset",
    descriptionKey: "settings.sectionDesc.reset",
    icon: "gear"
  }
];

export const integrations = [
  {
    name: "Google Calendar",
    image: "/images/icons/integrations/google-calendar.png"
  },
  {
    name: "Gmail",
    image: "/images/icons/integrations/gmail.png"
  },
  {
    name: "Google Drive",
    image: "/images/icons/integrations/google-drive.png"
  }
];

export function Icon({
  name,
  className = "h-4 w-4"
}: {
  name: IconName;
  className?: string;
}) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  };

  const icons: Record<IconName, ReactNode> = {
    gear: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.4 3a7 7 0 0 0-1.7 1L5 6.1 3 9.5 5 11a7 7 0 0 0 0 2l-2 1.5L5 18l2.4-1a7 7 0 0 0 1.7 1l.4 3h5l.4-3a7 7 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5a7 7 0 0 0 0-2Z" />
      </>
    ),
    hall: (
      <>
        <path d="M3 21h18M5 21V9l7-5 7 5v12" />
        <path d="M8 11h8M9 21v-6h6v6" />
      </>
    ),
    kitchen: (
      <>
        <path d="M4 3v8M8 3v8M4 7h4M6 11v10" />
        <path d="M14 3v18M14 3c3 1 5 4 5 8 0 3-2 5-5 6" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-2a5 5 0 0 1 10 0v2M16 6a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1" />
      </>
    ),
    access: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-2a6 6 0 0 1 12 0v2M17 9h4M19 7v4" />
      </>
    ),
    feature: (
      <>
        <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
        <circle cx="16" cy="7" r="2" />
        <circle cx="8" cy="17" r="2" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18" />
      </>
    ),
    file: (
      <>
        <path d="M6 3h9l3 3v15H6Z" />
        <path d="M15 3v4h4M9 12h6M9 16h6" />
      </>
    ),
    activity: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6Z" />
        <path d="m9 12 2 2 4-5" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    link: (
      <>
        <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
        <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4M8 8l4-4 4 4" />
        <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
      </>
    ),
    billing: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 9h18M7 15h4" />
      </>
    )
  };

  return <svg {...common}>{icons[name]}</svg>;
}

export function PanelHeader({
  title,
  icon
}: {
  title: string;
  icon?: IconName;
}) {
  return (
    <header className="flex min-h-12 items-center gap-2 border-b border-[#d8dde5] px-4 py-3">
      {icon ? <Icon name={icon} /> : null}
      <h2 className="text-sm font-black text-[#17202a]">{title}</h2>
    </header>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  /** For a policy somebody may read but not change - see the Security section. */
  disabled = false
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={checked}
      className={`relative h-5 w-9 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-[#347db4]" : "bg-[#cbd3dc]"
      }`}
      disabled={disabled}
      onClick={onChange}
      type="button"
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${
          checked ? "left-4.5" : "left-0.5"
        }`}
      />
    </button>
  );
}

export const secondaryButton =
  "inline-flex h-9 items-center justify-center rounded-lg border border-[#c7d0dc] bg-white px-4 text-xs font-black text-[#233144] transition hover:bg-[#eef4fa]";
