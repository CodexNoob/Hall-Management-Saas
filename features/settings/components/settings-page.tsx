"use client";

import Image from "next/image";
import { useEffect, useState, type RefObject } from "react";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { AsyncState } from "@/components/ui/async-state";
import { useAuthenticatedMutation } from "@/features/dashboard/hooks/use-authenticated-mutation";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { useDashboardAccess } from "@/features/dashboard/hooks/use-dashboard-permission";
import { HallsSettingsPanel } from "@/features/settings/components/halls-settings-panel";
import { LogoField } from "@/features/settings/components/logo-field";
import { ResetSettingsPanel } from "@/features/settings/components/reset-settings-panel";
import {
  getOrganizationLogoUrl,
  uploadOrganizationLogo
} from "@/features/settings/lib/upload-organization-logo";
import {
  AccessSettingsPanel,
  BillingBasicsPanel,
  CalendarSettingsPanel,
  ComingSoonPanel,
  KitchenSettingsPanel
} from "@/features/settings/components/settings-control-center-panels";
import { centerMobileTab } from "@/lib/ui/center-mobile-tab";
import { showBillingReadouts } from "@/lib/ui/mvp-features";
import { UpgradePlanDialog } from "@/components/forms/upgrade-plan-dialog";

import {
  Icon,
  PanelHeader,
  Toggle,
  integrations,
  modalSettingsNavItems,
  secondaryButton,
  type ControlCenterSettings,
  type ModalSettingsSection,
  type SettingsResponse
} from "@/features/settings/components/settings-shared";
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
  const { canAccessRoute, hasPermission } = useDashboardAccess();
  const canViewSettings = canAccessRoute("/dashboard/settings");
  const canEditSettings = hasPermission("settings.update");
  const settingsQuery = useAuthenticatedQuery<SettingsResponse>(
    "/api/settings",
    canViewSettings
  );
  const canManagePayments = hasPermission("payment.record");
  const settingsMutation = useAuthenticatedMutation<
    Partial<
      SettingsResponse["notifications"] & {
        language: string;
        timezone: string;
        dailyEventLimit: number;
        organizationName: string;
        controlCenter: ControlCenterSettings;
        payments: { paymentLink: string };
      }
    >,
    SettingsResponse
  >("/api/settings", "PATCH");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [eventConfirmations, setEventConfirmations] = useState(true);
  const [billingAlerts, setBillingAlerts] = useState(true);
  const [systemAnnouncements, setSystemAnnouncements] = useState(false);
  const [timezone, setTimezone] = useState("America/New_York");
  const [language, setLanguage] = useState("en-US");
  const [dailyEventLimit, setDailyEventLimit] = useState(2);
  const [organizationName, setOrganizationName] = useState("");
  const [controlCenter, setControlCenter] = useState<ControlCenterSettings>({
    general: {
      logoPath: "",
      contactEmail: "",
      dateFormat: "MMM d, yyyy",
      timeFormat: "12-hour"
    },
    calendar: {
      defaultView: "month",
      weekStartsOn: "sunday",
      showHebrewDate: true,
      showAvailability: true,
      clickAnywhereToAdd: false,
      holdExpirationHours: 48,
      shortNoticeDays: 7
    },
    kitchen: {
      defaultView: "week",
      shortNoticeDays: 3,
      notificationsEnabled: true,
      requireMenuAcknowledgment: true
    }
  });
  const [settingsMessage, setSettingsMessage] = useState("");
  // The logo is picked here and uploaded on save, so an abandoned screen leaves
  // nothing in the bucket. `isLogoCleared` is the third state the path alone
  // cannot express: a stored logo the operator has asked to drop, which is not
  // the same as never having had one.
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isLogoCleared, setIsLogoCleared] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [storedLogoUrl, setStoredLogoUrl] = useState<string | null>(null);
  const [activeModalSection, setActiveModalSection] =
    useState<ModalSettingsSection>("General");
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [paymentLink, setPaymentLink] = useState("");
  const [paymentMessage, setPaymentMessage] = useState("");

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
    setDailyEventLimit(
      settingsQuery.data.settings.calendar?.dailyEventLimit ?? 2
    );
    setOrganizationName(settingsQuery.data.organization.name);
    setControlCenter(settingsQuery.data.settings.controlCenter);
    // What the server says is now what is stored, so a pending pick or a
    // pending removal has either been applied or was never saved.
    setLogoFile(null);
    setIsLogoCleared(false);
    setPaymentLink(settingsQuery.data.payments?.paymentLink ?? "");
  }, [settingsQuery.data]);

  const logoPath = controlCenter.general.logoPath;

  // The bucket is private, so the stored logo is only renderable through a
  // signed URL. Signed on the client the way hall floor plans are: the
  // tenant_storage_select policy already limits it to this organization's
  // folder, and routing it through the API would buy nothing.
  useEffect(() => {
    if (!logoPath) {
      setStoredLogoUrl(null);
      return;
    }

    let isCurrent = true;
    void getOrganizationLogoUrl(logoPath).then((url) => {
      if (isCurrent) setStoredLogoUrl(url);
    });

    return () => {
      isCurrent = false;
    };
  }, [logoPath]);

  const savePaymentLink = async () => {
    setPaymentMessage("");
    const trimmed = paymentLink.trim();

    try {
      await settingsMutation.mutate({ payments: { paymentLink: trimmed } });
      setPaymentMessage(
        trimmed
          ? "Payment link saved."
          : "Payment link cleared. Pay balance is hidden on the client portal."
      );
    } catch (error) {
      setPaymentMessage(
        error instanceof Error
          ? error.message
          : "Could not save the payment link."
      );
    }
  };

  const savePreference = async (
    field: keyof SettingsResponse["notifications"],
    value: boolean
  ) => {
    await settingsMutation.mutate({ [field]: value });
  };

  const saveControlCenter = async () => {
    setSettingsMessage("");
    try {
      // The picked file reaches the bucket here and not a moment earlier, so
      // closing the panel without saving uploads nothing.
      let nextLogoPath = controlCenter.general.logoPath;
      if (logoFile) {
        setIsUploadingLogo(true);
        try {
          nextLogoPath = await uploadOrganizationLogo(logoFile);
        } finally {
          setIsUploadingLogo(false);
        }
      } else if (isLogoCleared) {
        nextLogoPath = "";
      }

      const nextControlCenter: ControlCenterSettings = {
        ...controlCenter,
        general: { ...controlCenter.general, logoPath: nextLogoPath }
      };

      await settingsMutation.mutate({
        organizationName,
        controlCenter: nextControlCenter
      });
      setControlCenter(nextControlCenter);
      setLogoFile(null);
      setIsLogoCleared(false);
      setSettingsMessage("Settings saved.");
      await settingsQuery.refetch();
    } catch (error) {
      setSettingsMessage(
        error instanceof Error ? error.message : "Could not save settings."
      );
    }
  };

  // The Reset panel draws nothing for anyone without `organization.reset`, so
  // its tab goes with it. A tab that opens on an empty page reads as a broken
  // screen, and one labelled Reset invites a conversation about who has the
  // permission - which is not a conversation this screen should start.
  const visibleModalNavItems = modalSettingsNavItems.filter(
    (item) => item.label !== "Reset" || hasPermission("organization.reset")
  );
  const activeModalNavItem =
    visibleModalNavItems.find((item) => item.label === activeModalSection) ??
    visibleModalNavItems[0];
  const showAllSettingsContent = false;
  const visibleIntegrations = integrations;
  const shouldShowIntegrations = false;
  const modalGridClass =
    activeModalSection === "Access"
      ? "max-w-full lg:grid-cols-2"
      : activeModalSection === "Billing" ||
          activeModalSection === "Branding" ||
          activeModalSection === "Integrations"
        ? "max-w-3xl"
        : "max-w-3xl";

  if (
    !canViewSettings ||
    settingsQuery.isLoading ||
    settingsQuery.error ||
    !settingsQuery.data
  ) {
    return (
      <main
        className={`flex items-center justify-center bg-[#f5f6f8] p-4 ${
          isModal ? "h-full min-h-80" : "min-h-dvh"
        }`}
      >
        <AsyncState
          emptyMessage={
            canViewSettings
              ? undefined
              : "You do not have permission to view organization settings. Contact an administrator if you need access."
          }
          emptyTitle={canViewSettings ? undefined : "Access restricted"}
          error={canViewSettings ? settingsQuery.error : null}
          isEmpty={!canViewSettings}
          isLoading={canViewSettings && settingsQuery.isLoading}
          onRetry={canViewSettings ? settingsQuery.refetch : undefined}
        />
      </main>
    );
  }

  const settingsData = settingsQuery.data;

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
          showDefaultActions={false}
          showSearch={false}
        />
      ) : null}

      <main className="min-h-0 flex-1 overflow-hidden">
        <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f5f6f8]">
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

          <nav
            aria-label="Settings sections"
            className="scrollbar-none flex shrink-0 gap-1 overflow-x-auto border-b border-[#d8dde5] bg-white px-4 py-2"
          >
            {visibleModalNavItems.map((item) => (
              <button
                className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-bold transition ${
                  item.label === activeModalSection
                    ? "bg-[#e8f1f8] text-[#1f4d73]"
                    : "text-[#596779] hover:bg-[#f0f3f6] hover:text-[#233144]"
                }`}
                key={item.label}
                onClick={(event) => {
                  setActiveModalSection(item.label);
                  centerMobileTab(event.currentTarget);
                }}
                type="button"
              >
                <Icon className="h-4 w-4 shrink-0" name={item.icon} />
                {item.label}
              </button>
            ))}
          </nav>

          <div
            className={
              isModal
                ? "min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4"
                : "min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4"
            }
          >
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

            <div
              className={`mx-auto grid w-full items-start gap-4 ${
                isModal ? modalGridClass : "max-w-375"
              }`}
            >
              <aside className={isModal ? "contents" : "grid gap-4"}>
                {showAllSettingsContent || activeModalSection === "General" ? (
                  <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
                    <PanelHeader title="Organization profile" />

                    <div className="flex items-center gap-3 border-b border-[#d8dde5] p-4">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#25292e] text-base font-bold text-white">
                        {settingsData.organization.name
                          .slice(0, 1)
                          .toUpperCase()}
                      </span>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-sm font-black">
                            {settingsData.organization.name}
                          </h2>
                          <span className="rounded-full bg-[#edfbf4] px-2 py-1 text-[9px] font-black text-[#147653]">
                            Organization
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] text-[#6a7483]">
                          Event Core workspace
                        </p>
                        <p className="mt-1 truncate text-[10px] text-[#6a7483]">
                          Organization details and primary contact
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 p-4 sm:grid-cols-2">
                      <label className="text-[10px] font-bold sm:col-span-2">
                        Organization name
                        <input
                          className="mt-1 h-9 w-full rounded-lg border border-[#c7d0dc] bg-[#f5f6f8] px-3 text-xs"
                          disabled={!canEditSettings}
                          name="organizationName"
                          onChange={(event) =>
                            setOrganizationName(event.target.value)
                          }
                          value={organizationName}
                        />
                      </label>
                      <LogoField
                        currentLogoUrl={storedLogoUrl}
                        file={logoFile}
                        isCleared={isLogoCleared}
                        isDisabled={!canEditSettings || isUploadingLogo}
                        onClearStored={() => setIsLogoCleared(true)}
                        onRestoreStored={() => setIsLogoCleared(false)}
                        onSelect={(picked) => {
                          setLogoFile(picked);
                          // Picking replaces the stored logo outright, so a
                          // pending removal is no longer what the operator
                          // asked for.
                          if (picked) setIsLogoCleared(false);
                        }}
                      />
                      <label className="text-[10px] font-bold sm:col-span-2">
                        Contact email
                        <input
                          className="mt-1 h-9 w-full rounded-lg border border-[#c7d0dc] px-3 text-xs"
                          name="organizationContactEmail"
                          onChange={(event) =>
                            setControlCenter((current) => ({
                              ...current,
                              general: {
                                ...current.general,
                                contactEmail: event.target.value
                              }
                            }))
                          }
                          placeholder="office@example.com"
                          type="email"
                          value={controlCenter.general.contactEmail}
                        />
                      </label>
                    </div>
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
                          description:
                            "New bookings, updates, and cancellations.",
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
                          description:
                            "Product updates and maintenance alerts.",
                          icon: "activity" as const,
                          value: systemAnnouncements,
                          action: () => {
                            const value = !systemAnnouncements;
                            setSystemAnnouncements(value);
                            void savePreference("systemAnnouncements", value);
                          }
                        }
                      ]
                        // The invoice toggle governs mail about the hidden
                        // Billing module (lib/ui/mvp-features); the rest are
                        // account-wide and unaffected. Filtered rather than
                        // removed, so the saved preference is untouched and
                        // comes back with the module.
                        .filter(
                          (notification) =>
                            showBillingReadouts ||
                            notification.title !== "Invoice & billing alerts"
                        )
                        .map((notification) => (
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
                  <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
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
                          <option value="en-GB">
                            English (United Kingdom)
                          </option>
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
                            onChange={(event) =>
                              setControlCenter((current) => ({
                                ...current,
                                general: {
                                  ...current.general,
                                  dateFormat: event.target
                                    .value as ControlCenterSettings["general"]["dateFormat"]
                                }
                              }))
                            }
                            value={controlCenter.general.dateFormat}
                          >
                            <option value="MMM d, yyyy">Jul 8, 2026</option>
                            <option value="MM/dd/yyyy">07/08/2026</option>
                            <option value="dd/MM/yyyy">08/07/2026</option>
                          </select>
                        </label>

                        <label className="text-[10px] font-bold">
                          Time format
                          <select
                            className="mt-1 h-9 w-full rounded-lg border border-[#c7d0dc] bg-white px-2 text-[10px]"
                            name="settingsTimeFormat"
                            onChange={(event) =>
                              setControlCenter((current) => ({
                                ...current,
                                general: {
                                  ...current.general,
                                  timeFormat: event.target
                                    .value as ControlCenterSettings["general"]["timeFormat"]
                                }
                              }))
                            }
                            value={controlCenter.general.timeFormat}
                          >
                            <option value="12-hour">12 Hour (1:30 PM)</option>
                            <option value="24-hour">24 Hour (13:30)</option>
                          </select>
                        </label>
                      </div>
                    </div>
                  </section>
                ) : null}
              </aside>

              <div className={isModal ? "contents" : "grid min-w-0 gap-4"}>
                {activeModalSection === "Halls" ? (
                  <HallsSettingsPanel canEdit={canEditSettings} />
                ) : null}
                {activeModalSection === "Calendar" ? (
                  <CalendarSettingsPanel
                    canEdit={canEditSettings}
                    dailyEventLimit={dailyEventLimit}
                    onDailyEventLimitChange={(value) => {
                      if (!Number.isFinite(value) || value < 1 || value > 50)
                        return;
                      setDailyEventLimit(value);
                      void settingsMutation.mutate({ dailyEventLimit: value });
                    }}
                    onChange={(calendar) =>
                      setControlCenter((current) => ({ ...current, calendar }))
                    }
                    value={controlCenter.calendar}
                  />
                ) : null}
                {activeModalSection === "Kitchen" ? (
                  <KitchenSettingsPanel
                    onChange={(kitchen) =>
                      setControlCenter((current) => ({ ...current, kitchen }))
                    }
                    value={controlCenter.kitchen}
                  />
                ) : null}
                {activeModalSection === "Access" ? (
                  <AccessSettingsPanel />
                ) : null}
                {activeModalSection === "Reset" ? <ResetSettingsPanel /> : null}
                {activeModalSection === "Billing" ? (
                  <BillingBasicsPanel />
                ) : null}
                {activeModalSection === "Branding" ||
                activeModalSection === "Integrations" ? (
                  <ComingSoonPanel section={activeModalSection} />
                ) : null}
                <div
                  className={`grid gap-4 ${
                    isModal
                      ? activeModalSection === "Billing" ||
                        activeModalSection === "Branding" ||
                        activeModalSection === "Integrations"
                        ? "grid-cols-1"
                        : "sm:grid-cols-2"
                      : "sm:grid-cols-2 xl:grid-cols-4"
                  }`}
                >
                  {showAllSettingsContent ? (
                    <section className="flex min-h-52 flex-col overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
                      <PanelHeader title="Branding Preview" icon="eye" />

                      <div className="flex flex-1 flex-col justify-between p-4">
                        <Image
                          alt="Hall Management SaaS"
                          className="h-16 w-auto object-contain"
                          height={408}
                          src="/images/branding/hms-logo-header.png"
                          unoptimized
                          width={612}
                        />

                        <button
                          className={`${secondaryButton} mt-4 w-full`}
                          onClick={() => setActiveModalSection("Branding")}
                          type="button"
                        >
                          Customize Branding
                        </button>
                      </div>
                    </section>
                  ) : null}

                  {shouldShowIntegrations ? (
                    <section className="flex min-h-52 flex-col overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
                      <PanelHeader
                        title={
                          isModal && activeModalSection !== "Integrations"
                            ? `${activeModalSection} Status`
                            : "Integrations Status"
                        }
                        icon="link"
                      />

                      <div className="flex flex-1 flex-col justify-center space-y-4 p-4">
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

                  {(showAllSettingsContent ||
                    activeModalSection === "Billing") &&
                  canManagePayments ? (
                    <section className="flex min-h-52 flex-col overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
                      <PanelHeader title="Client Payment Link" icon="billing" />

                      <div className="flex flex-1 flex-col space-y-3 p-4">
                        <label
                          className="block text-[10px] font-black uppercase tracking-[0.08em] text-[#516174]"
                          htmlFor="organization-payment-link"
                        >
                          Payment link
                        </label>
                        <input
                          className="h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm"
                          id="organization-payment-link"
                          name="paymentLink"
                          onChange={(changeEvent) =>
                            setPaymentLink(changeEvent.target.value)
                          }
                          placeholder="https://secure.example.com/your-venue"
                          type="url"
                          value={paymentLink}
                        />
                        <p className="text-[10px] text-[#6a7483]">
                          Where the Pay balance button on your client portal
                          sends clients. Leave this empty to hide that button.
                        </p>
                        <button
                          className={`${secondaryButton} w-full`}
                          disabled={settingsMutation.isPending}
                          onClick={savePaymentLink}
                          type="button"
                        >
                          {settingsMutation.isPending
                            ? "Saving..."
                            : "Save Payment Link"}
                        </button>
                        {paymentMessage ? (
                          <p
                            className="text-[10px] font-bold text-[#516174]"
                            role="status"
                          >
                            {paymentMessage}
                          </p>
                        ) : null}
                      </div>
                    </section>
                  ) : null}

                  {showAllSettingsContent ? (
                    <section className="flex min-h-52 flex-col overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
                      <PanelHeader title="Billing Cycle" icon="billing" />

                      <dl className="flex-1 space-y-4 p-4 text-[10px]">
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
                          onClick={() => setIsUpgradeOpen(true)}
                          type="button"
                        >
                          Manage Subscription
                        </button>
                      </div>
                    </section>
                  ) : null}
                </div>
                {activeModalSection === "General" ||
                activeModalSection === "Calendar" ||
                activeModalSection === "Kitchen" ? (
                  <div className="flex items-center justify-end gap-3 rounded-xl border border-[#d8dde5] bg-white p-4 shadow-sm">
                    {settingsMessage ? (
                      <p
                        className="mr-auto text-xs font-bold text-[#315573]"
                        role="status"
                      >
                        {settingsMessage}
                      </p>
                    ) : null}
                    <button
                      className="h-9 rounded-lg bg-[#1f4d73] px-5 text-xs font-black text-white disabled:opacity-45"
                      disabled={
                        !canEditSettings ||
                        settingsMutation.isPending ||
                        isUploadingLogo ||
                        !organizationName.trim()
                      }
                      onClick={() => void saveControlCenter()}
                      type="button"
                    >
                      {isUploadingLogo
                        ? "Uploading logo..."
                        : settingsMutation.isPending
                          ? "Saving..."
                          : "Save changes"}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <UpgradePlanDialog
            onClose={() => setIsUpgradeOpen(false)}
            open={isUpgradeOpen}
          />
        </section>
      </main>
    </div>
  );
}
