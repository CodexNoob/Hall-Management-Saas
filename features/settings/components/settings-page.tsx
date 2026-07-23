"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { TodayNotesDrawer } from "@/components/shared/today-notes-drawer";
import { NewBookingDialog } from "@/features/bookings/forms/new-booking-dialog";
import { AsyncState } from "@/components/ui/async-state";
import { useAuthenticatedMutation } from "@/features/dashboard/hooks/use-authenticated-mutation";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { useDashboardPermission } from "@/features/dashboard/hooks/use-dashboard-permission";

type SettingsResponse = {
  organization: { id: string; name: string };
  settings: { language: string; timezone: string };
  notifications: {
    emailNotifications: boolean;
    eventConfirmations: boolean;
    billingAlerts: boolean;
    systemAnnouncements: boolean;
  };
};

type IconName =
  | "gear"
  | "hall"
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

type SettingsHubItem = {
  title: string;
  description: string;
  icon: IconName;
};

type ModalSettingsSection =
  | "General"
  | "Notifications"
  | "Security"
  | "Halls"
  | "User Access"
  | "Payments & Gmail"
  | "Google Calendar"
  | "PDF & Branding"
  | "Activity Logs"
  | "Integrations"
  | "Billing Cycle";

type ModalSettingsNavItem = {
  label: ModalSettingsSection;
  description: string;
  icon: IconName;
};

const modalSettingsNavItems: ModalSettingsNavItem[] = [
  {
    label: "General",
    description: "Organization profile and account basics.",
    icon: "gear"
  },
  {
    label: "Notifications",
    description: "Email, billing, and system alerts.",
    icon: "mail"
  },
  {
    label: "Security",
    description: "Password, sessions, and two-factor access.",
    icon: "shield"
  },
  {
    label: "Halls",
    description: "Rooms, halls, capacity, and setup.",
    icon: "hall"
  },
  {
    label: "User Access",
    description: "Staff permissions and feature visibility.",
    icon: "access"
  },
  {
    label: "Payments & Gmail",
    description: "Payment processing and email integrations.",
    icon: "billing"
  },
  {
    label: "Google Calendar",
    description: "Event sync and calendar availability.",
    icon: "calendar"
  },
  {
    label: "PDF & Branding",
    description: "Logos, invoices, packets, and exports.",
    icon: "file"
  },
  {
    label: "Activity Logs",
    description: "Audit history and system activity.",
    icon: "activity"
  },
  {
    label: "Integrations",
    description: "Connected services and account links.",
    icon: "link"
  },
  {
    label: "Billing Cycle",
    description: "Plan, renewal, and subscription settings.",
    icon: "billing"
  }
];

const modalHubTitlesBySection: Partial<Record<ModalSettingsSection, string[]>> =
  {
    Halls: ["Halls"],
    "User Access": ["User Types", "User Access", "Feature Access"],
    "Payments & Gmail": ["Payments & Gmail"],
    "Google Calendar": ["Google Calendar"],
    "PDF & Branding": ["PDF & Branding"],
    "Activity Logs": ["Activity Logs"]
  };

const settingsHubItems: SettingsHubItem[] = [
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

const integrations = [
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

function Icon({
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

function PanelHeader({ title, icon }: { title: string; icon?: IconName }) {
  return (
    <header className="flex min-h-12 items-center gap-2 border-b border-[#d8dde5] px-4 py-3">
      {icon ? <Icon name={icon} /> : null}
      <h2 className="text-sm font-black text-[#17202a]">{title}</h2>
    </header>
  );
}

function Toggle({
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

const secondaryButton =
  "inline-flex h-9 items-center justify-center rounded-lg border border-[#c7d0dc] bg-white px-4 text-xs font-black text-[#233144] transition hover:bg-[#eef4fa]";

type SettingsPageProps = {
  closeButtonRef?: RefObject<HTMLButtonElement | null>;
  displayMode?: "page" | "modal";
  onClose?: () => void;
};

export function SettingsPage({
  closeButtonRef,
  displayMode = "page",
  onClose
}: SettingsPageProps) {
  const isModal = displayMode === "modal";
  const canEditSettings = useDashboardPermission("canEditSettings");
  const settingsQuery =
    useAuthenticatedQuery<SettingsResponse>("/api/settings");
  const settingsMutation = useAuthenticatedMutation<
    Partial<
      SettingsResponse["notifications"] & {
        language: string;
        timezone: string;
      }
    >,
    SettingsResponse
  >("/api/settings", "PATCH");
  const [isTodayNotesOpen, setIsTodayNotesOpen] = useState(false);
  const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [eventConfirmations, setEventConfirmations] = useState(true);
  const [billingAlerts, setBillingAlerts] = useState(true);
  const [systemAnnouncements, setSystemAnnouncements] = useState(false);
  const [timezone, setTimezone] = useState("America/New_York");
  const [language, setLanguage] = useState("en-US");
  const [activeModalSection, setActiveModalSection] =
    useState<ModalSettingsSection>("General");

  useEffect(() => {
    if (!settingsQuery.data) return;
    setEmailNotifications(settingsQuery.data.notifications.emailNotifications);
    setEventConfirmations(settingsQuery.data.notifications.eventConfirmations);
    setBillingAlerts(settingsQuery.data.notifications.billingAlerts);
    setSystemAnnouncements(
      settingsQuery.data.notifications.systemAnnouncements
    );
    setLanguage(settingsQuery.data.settings.language);
    setTimezone(settingsQuery.data.settings.timezone);
  }, [settingsQuery.data]);

  const savePreference = async (
    field: keyof SettingsResponse["notifications"],
    value: boolean
  ) => {
    await settingsMutation.mutate({ [field]: value });
  };

  const closeNewBooking = () => setIsNewBookingOpen(false);

  const submitNewBooking = () => {
    closeNewBooking();
  };

  const activeModalNavItem =
    modalSettingsNavItems.find((item) => item.label === activeModalSection) ??
    modalSettingsNavItems[0];
  const showAllSettingsContent = !isModal;
  const visibleSettingsHubItems = showAllSettingsContent
    ? settingsHubItems
    : settingsHubItems.filter((item) =>
        (modalHubTitlesBySection[activeModalSection] ?? []).includes(
          item.title
        )
      );
  const visibleIntegrations =
    activeModalSection === "Google Calendar"
      ? integrations.filter((integration) => integration.name === "Google Calendar")
      : activeModalSection === "Payments & Gmail"
        ? integrations.filter((integration) => integration.name === "Gmail")
        : integrations;
  const shouldShowIntegrations =
    showAllSettingsContent ||
    activeModalSection === "Integrations" ||
    activeModalSection === "Google Calendar" ||
    activeModalSection === "Payments & Gmail";
  const modalGridClass =
    activeModalSection === "User Access" ||
    activeModalSection === "PDF & Branding" ||
    activeModalSection === "Payments & Gmail" ||
    activeModalSection === "Google Calendar"
      ? "max-w-full lg:grid-cols-2"
      : "max-w-3xl";

  if (settingsQuery.isLoading || settingsQuery.error) {
    return (
      <main
        className={`flex items-center justify-center bg-[#f5f6f8] p-4 ${
          isModal ? "h-full min-h-80" : "min-h-dvh"
        }`}
      >
        <AsyncState
          error={settingsQuery.error}
          isLoading={settingsQuery.isLoading}
          onRetry={settingsQuery.refetch}
        />
      </main>
    );
  }

  return (
    <div
      className={`dashboard-readable-page flex min-h-0 flex-col overflow-hidden bg-[#f5f6f8] text-[#17202a] ${
        isModal ? "h-full" : "h-dvh"
      }`}
    >
      {!isModal ? (
        <DashboardTopbar
          title="Settings"
          subtitle="Manage organization, system, access, integrations, branding, and account plan."
          onNewBooking={() => setIsNewBookingOpen(true)}
          onTodayNotes={() => setIsTodayNotesOpen(true)}
        />
      ) : null}

      <main
        className={`min-h-0 flex-1 ${
          isModal
            ? "grid overflow-hidden lg:grid-cols-[14rem_minmax(0,1fr)]"
            : "overflow-x-hidden overflow-y-auto p-3 sm:p-4"
        }`}
      >
        {isModal ? (
          <aside className="hidden min-h-0 flex-col border-r border-white/10 bg-[#061126] text-white lg:flex">
            <div className="shrink-0 border-b border-white/10 px-5 py-4">
              <h3 className="text-sm font-black">Settings</h3>
            </div>

            <nav
              aria-label="Settings sections"
              className="min-h-0 flex-1 space-y-1 overflow-hidden px-3 py-3"
            >
              {modalSettingsNavItems.map((item) => (
                <button
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-bold transition ${
                    item.label === activeModalSection
                      ? "bg-white/10 text-white"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                  key={item.label}
                  onClick={() => setActiveModalSection(item.label)}
                  title={item.description}
                  type="button"
                >
                  <Icon className="h-4 w-4 shrink-0" name={item.icon} />
                  <span className="min-w-0 truncate">{item.label}</span>
                </button>
              ))}
            </nav>
          </aside>
        ) : null}

        <section
          className={
            isModal
              ? "flex min-h-0 flex-col overflow-hidden bg-[#f5f6f8]"
              : ""
          }
        >
          {isModal ? (
            <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#d8dde5] bg-[#f5f6f8] px-4 sm:px-5">
              <h3 className="text-sm font-black text-[#17202a] lg:sr-only">
                Settings
              </h3>
              <button
                aria-label="Close settings"
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
          ) : null}

          {isModal ? (
            <nav
              aria-label="Settings sections"
              className="flex shrink-0 gap-2 overflow-x-auto border-b border-[#d8dde5] bg-[#061126] px-3 py-2 lg:hidden"
            >
              {modalSettingsNavItems.map((item) => (
                <button
                  className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-bold transition ${
                    item.label === activeModalSection
                      ? "bg-white/15 text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                  key={item.label}
                  onClick={() => setActiveModalSection(item.label)}
                  type="button"
                >
                  <Icon className="h-4 w-4 shrink-0" name={item.icon} />
                  {item.label}
                </button>
              ))}
            </nav>
          ) : null}

          <div
            className={
              isModal
                ? "min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4"
                : ""
            }
          >
            {isModal ? (
              <div className="mb-4 rounded-xl border border-[#d8dde5] bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <Icon
                    className="h-4 w-4 shrink-0 text-[#536b83]"
                    name={activeModalNavItem.icon}
                  />
                  <h2 className="text-sm font-black text-[#17202a]">
                    {activeModalNavItem.label}
                  </h2>
                </div>
                <p className="mt-1 text-xs leading-5 text-[#6a7483]">
                  {activeModalNavItem.description}
                </p>
              </div>
            ) : null}

            <div
              className={`mx-auto grid w-full gap-4 ${
                isModal
                  ? modalGridClass
                  : "max-w-[1800px] xl:grid-cols-[300px_minmax(0,1fr)]"
              }`}
            >
              <aside className={isModal ? "contents" : "space-y-4"}>
                {showAllSettingsContent || activeModalSection === "General" ? (
                  <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
                <PanelHeader title="My Account" />

                <div className="flex items-center gap-3 border-b border-[#d8dde5] p-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#25292e] text-base font-bold text-white">
                    N
                  </span>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-black">
                        Charles John Duot
                      </h2>
                      <span className="rounded-full bg-[#edfbf4] px-2 py-1 text-[9px] font-black text-[#147653]">
                        Super Admin
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-[#6a7483]">
                      Administrator
                    </p>
                    <p className="mt-1 truncate text-[10px] text-[#6a7483]">
                      charles.duot@example.com
                    </p>
                  </div>
                </div>

                <dl className="space-y-3 p-4 text-[10px]">
                  <div className="flex justify-between gap-4">
                    <dt>Last login</dt>
                    <dd className="font-bold">Jul 8, 2026 8:42 AM</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Account created</dt>
                    <dd className="font-bold">May 12, 2026</dd>
                  </div>
                </dl>
              </section>
                ) : null}

                {showAllSettingsContent || activeModalSection === "Security" ? (
              <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
                <PanelHeader title="Security" />

                {[
                  ["Change password", "lock", ""],
                  ["Two-factor authentication", "shield", "Enabled"],
                  ["Active sessions", "users", "3 sessions"]
                ].map(([label, icon, value]) => (
                  <button
                    className="flex w-full items-center gap-3 border-b border-[#e6e9ed] px-4 py-3 text-left text-[11px] last:border-0 hover:bg-[#f7fafc]"
                    key={label}
                    type="button"
                  >
                    <Icon name={icon as IconName} />
                    <span className="flex-1">{label}</span>
                    {value ? (
                      <span
                        className={
                          value === "Enabled"
                            ? "rounded-full bg-[#edfbf4] px-2 py-1 text-[9px] font-black text-[#147653]"
                            : "text-[9px] text-[#6a7483]"
                        }
                      >
                        {value}
                      </span>
                    ) : null}
                    <span>›</span>
                  </button>
                ))}
              </section>
                ) : null}

                {showAllSettingsContent ||
                activeModalSection === "Notifications" ? (
              <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
                <PanelHeader title="Notification preferences" />

                <div className="space-y-4 p-4">
                  {[
                    {
                      title: "Email notifications",
                      description: "Receive important updates via email.",
                      icon: "mail" as const,
                      value: emailNotifications,
                      action: () => {
                        const value = !emailNotifications;
                        setEmailNotifications(value);
                        void savePreference("emailNotifications", value);
                      }
                    },
                    {
                      title: "Event confirmations",
                      description: "New bookings, updates, and cancellations.",
                      icon: "calendar" as const,
                      value: eventConfirmations,
                      action: () => {
                        const value = !eventConfirmations;
                        setEventConfirmations(value);
                        void savePreference("eventConfirmations", value);
                      }
                    },
                    {
                      title: "Invoice & billing alerts",
                      description: "Payment reminders and invoice updates.",
                      icon: "billing" as const,
                      value: billingAlerts,
                      action: () => {
                        const value = !billingAlerts;
                        setBillingAlerts(value);
                        void savePreference("billingAlerts", value);
                      }
                    },
                    {
                      title: "System announcements",
                      description: "Product updates and maintenance alerts.",
                      icon: "activity" as const,
                      value: systemAnnouncements,
                      action: () => {
                        const value = !systemAnnouncements;
                        setSystemAnnouncements(value);
                        void savePreference("systemAnnouncements", value);
                      }
                    }
                  ].map((notification) => (
                    <div
                      className="flex items-start gap-3"
                      key={notification.title}
                    >
                      <Icon
                        name={notification.icon}
                        className="mt-0.5 h-4 w-4 shrink-0"
                      />

                      <div className="min-w-0 flex-1">
                        <h3 className="text-[11px] font-black">
                          {notification.title}
                        </h3>
                        <p className="mt-1 text-[9px] leading-4 text-[#6a7483]">
                          {notification.description}
                        </p>
                      </div>

                      <Toggle
                        checked={notification.value}
                        label={`Toggle ${notification.title}`}
                        onChange={notification.action}
                      />
                    </div>
                  ))}
                </div>
              </section>
                ) : null}

                {showAllSettingsContent || activeModalSection === "General" ? (
              <section
                className={`overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm ${
                  isModal ? "" : "xl:min-h-55.5"
                }`}
              >
                <PanelHeader title="Language & Region" icon="globe" />

                <div className="space-y-3 p-4">
                  <label className="block text-[10px] font-bold">
                    Language
                    <select
                      className="mt-1 h-9 w-full rounded-lg border border-[#c7d0dc] bg-white px-3 text-[10px]"
                      name="settingsLanguage"
                      disabled={!canEditSettings}
                      onChange={(event) => {
                        const value = event.target.value;
                        setLanguage(value);
                        void settingsMutation.mutate({ language: value });
                      }}
                      value={language}
                    >
                      <option value="en-US">English (United States)</option>
                      <option value="en-GB">English (United Kingdom)</option>
                      <option value="he-IL">Hebrew</option>
                      <option value="es-US">Spanish</option>
                    </select>
                  </label>

                  <label className="block text-[10px] font-bold">
                    Current timezone
                    <select
                      className="mt-1 h-9 w-full rounded-lg border border-[#c7d0dc] bg-white px-3 text-[10px]"
                      name="settingsTimezone"
                      disabled={!canEditSettings}
                      onChange={(event) => {
                        const value = event.target.value;
                        setTimezone(value);
                        void settingsMutation.mutate({ timezone: value });
                      }}
                      value={timezone}
                    >
                      <option value="America/New_York">
                        (UTC-05:00) Eastern Time (US & Canada)
                      </option>
                      <option value="America/Chicago">
                        (UTC-06:00) Central Time (US & Canada)
                      </option>
                      <option value="Asia/Manila">
                        (UTC+08:00) Asia/Manila
                      </option>
                    </select>
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-[10px] font-bold">
                      Date format
                      <select
                        className="mt-1 h-9 w-full rounded-lg border border-[#c7d0dc] bg-white px-2 text-[10px]"
                        name="settingsDateFormat"
                      >
                        <option>Jul 8, 2026</option>
                        <option>07/08/2026</option>
                      </select>
                    </label>

                    <label className="text-[10px] font-bold">
                      Time format
                      <select
                        className="mt-1 h-9 w-full rounded-lg border border-[#c7d0dc] bg-white px-2 text-[10px]"
                        name="settingsTimeFormat"
                      >
                        <option>12 Hour (1:30 PM)</option>
                        <option>24 Hour (13:30)</option>
                      </select>
                    </label>
                  </div>
                </div>
              </section>
                ) : null}
            </aside>

              <div className={isModal ? "contents" : "min-w-0 space-y-4"}>
                {showAllSettingsContent || visibleSettingsHubItems.length > 0 ? (
              <section
                className={`overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm ${
                  isModal
                    ? activeModalSection === "User Access"
                      ? "sm:col-span-2"
                      : ""
                    : "xl:min-h-88.25"
                }`}
              >
                <PanelHeader
                  title={isModal ? activeModalSection : "Settings Hub"}
                />

                <div
                  className={`grid gap-3 p-4 ${
                    isModal ? "lg:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-5"
                  }`}
                >
                  {visibleSettingsHubItems.map((item) => (
                    <article
                      className="flex min-h-24 items-start gap-3 rounded-xl border border-[#d8dde5] bg-white p-3 text-left"
                      key={item.title}
                    >
                      <Icon
                        className="mt-0.5 h-5 w-5 shrink-0 text-[#536b83]"
                        name={item.icon}
                      />

                      <span className="min-w-0 flex-1">
                        <strong className="block text-[11px]">
                          {item.title}
                        </strong>
                        <span className="mt-2 block text-[9px] leading-4 text-[#6a7483]">
                          {item.description}
                        </span>
                      </span>
                    </article>
                  ))}
                </div>
              </section>
                ) : null}

                <div
                className={`grid gap-4 ${
                  isModal ? "sm:grid-cols-2" : "lg:grid-cols-3 xl:pt-px"
                }`}
              >
                {showAllSettingsContent ||
                activeModalSection === "PDF & Branding" ? (
                  <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
                  <PanelHeader title="Branding Preview" icon="eye" />

                  <div className="p-4">
                    <Image
                      alt="Hall Management SaaS"
                      className="h-16 w-auto object-contain"
                      height={408}
                      src="/images/branding/hms-logo-header.png?v=20260722"
                      unoptimized
                      width={612}
                    />

                    <button
                      className={`${secondaryButton} mt-4 w-full`}
                      type="button"
                    >
                      Customize Branding
                    </button>
                  </div>
                </section>
                ) : null}

                {shouldShowIntegrations ? (
                  <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
                  <PanelHeader
                    title={
                      isModal && activeModalSection !== "Integrations"
                        ? `${activeModalSection} Status`
                        : "Integrations Status"
                    }
                    icon="link"
                  />

                  <div className="space-y-4 p-4">
                    {visibleIntegrations.map((integration) => (
                      <div
                        className="flex items-center gap-3"
                        key={integration.name}
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#eef4fa] p-1">
                          <Image
                            alt=""
                            className="h-5 w-5 object-contain"
                            height={20}
                            src={integration.image}
                            width={20}
                          />
                        </span>

                        <span className="min-w-0 flex-1 wrap-break-word text-[11px] font-bold">
                          {integration.name}
                        </span>

                        <span className="shrink-0 rounded-full border border-[#a9dfc9] bg-[#effaf5] px-2 py-1 text-[9px] font-black text-[#147653]">
                          Connected
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
                ) : null}

                {showAllSettingsContent ||
                activeModalSection === "Billing Cycle" ? (
                  <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
                  <PanelHeader title="Billing Cycle" icon="billing" />

                  <dl className="space-y-4 p-4 text-[10px]">
                    <div className="flex justify-between gap-3">
                      <dt>Current plan</dt>
                      <dd className="rounded-full bg-[#eef6fd] px-2 py-1 font-black text-[#246b9f]">
                        Professional
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Billing cycle</dt>
                      <dd className="font-bold">Monthly</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Next billing date</dt>
                      <dd className="font-bold">Aug 8, 2026</dd>
                    </div>
                  </dl>

                  <div className="px-4 pb-4">
                    <button
                      className={`${secondaryButton} w-full`}
                      type="button"
                    >
                      Manage Subscription
                    </button>
                  </div>
                </section>
                ) : null}
              </div>
            </div>
          </div>
          </div>
        </section>
      </main>

      {!isModal ? (
        <>
          <TodayNotesDrawer
            onClose={() => setIsTodayNotesOpen(false)}
            open={isTodayNotesOpen}
          />

          <NewBookingDialog
            onClose={closeNewBooking}
            onSubmit={submitNewBooking}
            open={isNewBookingOpen}
          />
        </>
      ) : null}
    </div>
  );
}
