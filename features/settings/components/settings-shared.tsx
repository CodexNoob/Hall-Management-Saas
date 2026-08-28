"use client";

import { type ReactNode } from "react";

export type SettingsResponse = {
  organization: { id: string; name: string };
  settings: {
    language: string;
    timezone: string;
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
    logoUrl: string;
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
  | "billing";

export type SettingsHubItem = {
  title: string;
  description: string;
  icon: IconName;
};

export type ModalSettingsSection =
  | "General"
  | "Halls"
  | "Calendar"
  | "Kitchen"
  | "Notifications"
  | "Billing"
  | "Access"
  | "Branding"
  | "Integrations";

export type ModalSettingsNavItem = {
  label: ModalSettingsSection;
  description: string;
  icon: IconName;
};

export const modalSettingsNavItems: ModalSettingsNavItem[] = [
  {
    label: "General",
    description: "Organization profile and account basics.",
    icon: "gear"
  },
  {
    label: "Halls",
    description: "Rooms, halls, capacity, and setup.",
    icon: "hall"
  },
  {
    label: "Calendar",
    description: "Booking calendar behavior and date defaults.",
    icon: "calendar"
  },
  {
    label: "Kitchen",
    description: "Kitchen dashboard defaults and alerts.",
    icon: "kitchen"
  },
  {
    label: "Notifications",
    description: "Email, kitchen, booking, and system alerts.",
    icon: "mail"
  },
  {
    label: "Billing",
    description: "Simple payment settings and client payment link.",
    icon: "billing"
  },
  {
    label: "Access",
    description: "Staff, roles, permissions, and invites.",
    icon: "access"
  },
  {
    label: "Branding",
    description: "Logo, client portal copy, and PDF identity.",
    icon: "file"
  },
  {
    label: "Integrations",
    description: "Connected services and coming-soon channels.",
    icon: "link"
  }
];

export const modalHubTitlesBySection: Partial<
  Record<ModalSettingsSection, string[]>
> = {
  General: ["Platform Settings"],
  Halls: ["Halls"],
  Calendar: ["Calendar Defaults"],
  Kitchen: ["Kitchen Defaults", "Kitchen Workers", "Kitchen Alerts"],
  Access: ["User Types", "User Access", "Feature Access"],
  Billing: ["Billing Basics"],
  Branding: ["PDF & Branding"]
};

export const settingsHubItems: SettingsHubItem[] = [
  {
    title: "Platform Settings",
    description: "General settings, preferences, and system configuration.",
    icon: "gear"
  },
  {
    title: "Halls",
    description: "Manage halls, rooms, capacity, and setup.",
    icon: "hall"
  },
  {
    title: "Calendar Defaults",
    description: "Default view, Hebrew dates, availability markers, and holds.",
    icon: "calendar"
  },
  {
    title: "Event Types",
    description: "Create booking categories such as weddings and conferences.",
    icon: "calendar"
  },
  {
    title: "Kitchen Defaults",
    description: "Default kitchen view, assigned-only mode, and prep display.",
    icon: "kitchen"
  },
  {
    title: "Kitchen Workers",
    description: "Manage who can be assigned to kitchen dishes.",
    icon: "users"
  },
  {
    title: "Kitchen Alerts",
    description: "Short-notice alerts and required acknowledgments.",
    icon: "mail"
  },
  {
    title: "User Types",
    description: "Create and manage user roles and types.",
    icon: "users"
  },
  {
    title: "User Access",
    description: "Manage users and their access to the platform.",
    icon: "access"
  },
  {
    title: "Feature Access",
    description: "Control access to platform features and modules.",
    icon: "feature"
  },
  {
    title: "Billing Basics",
    description: "Currency, payment methods, and simple ledger defaults.",
    icon: "billing"
  },
  {
    title: "Payments & Gmail",
    description: "Payment methods and Gmail integration settings.",
    icon: "mail"
  },
  {
    title: "Google Calendar",
    description: "Sync events and availability with Google Calendar.",
    icon: "calendar"
  },
  {
    title: "PDF & Branding",
    description: "Customize PDFs, invoices, and brand identity.",
    icon: "file"
  },
  {
    title: "Activity Logs",
    description: "View system activity and audit logs.",
    icon: "activity"
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
  label
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={checked}
      className={`relative h-5 w-9 rounded-full transition ${
        checked ? "bg-[#347db4]" : "bg-[#cbd3dc]"
      }`}
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
