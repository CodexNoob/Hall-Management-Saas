"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type RefObject } from "react";
import { getCachedAuthSession } from "@/lib/auth/client";
import { DEFAULT_TIME_ZONE } from "@/lib/dates/calendar-date";
import { groupedTimeZoneOptions } from "@/lib/dates/time-zones";
import { resolvePortalHeaderColor } from "@/lib/ui/portal-header-theme";
import { MfaSecurityPanel } from "@/features/settings/components/mfa-security-panel";
import { SecuritySettingsPanel } from "@/features/settings/components/security-settings-panel";
import { OtherSessionsPanel } from "@/features/settings/components/other-sessions-panel";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { AsyncState } from "@/components/ui/async-state";
import { useAuthenticatedMutation } from "@/features/dashboard/hooks/use-authenticated-mutation";
import {
  invalidateAuthenticatedQueryPrefix,
  useAuthenticatedQuery
} from "@/features/dashboard/hooks/use-authenticated-query";
import { useDashboardAccess } from "@/features/dashboard/hooks/use-dashboard-permission";
import { EventTypesSettingsPanel } from "@/features/settings/components/event-types-settings-panel";
import { HallsSettingsPanel } from "@/features/settings/components/halls-settings-panel";
import { LogoField } from "@/features/settings/components/branding-image-field";
import { PortalHeaderPanel } from "@/features/settings/components/portal-header-panel";
import { ActivitySettingsPanel } from "@/features/settings/components/activity-settings-panel";
import { ResetSettingsPanel } from "@/features/settings/components/reset-settings-panel";
import {
  getOrganizationBrandingUrl,
  uploadOrganizationLogo,
  uploadPortalHeaderImage
} from "@/features/settings/lib/upload-organization-branding";
import {
  AccessSettingsPanel,
  BillingBasicsPanel,
  CalendarSettingsPanel,
  ComingSoonPanel,
  KitchenSettingsPanel
} from "@/features/settings/components/settings-control-center-panels";
import { centerMobileTab } from "@/lib/ui/center-mobile-tab";
import { DEFAULT_PORTAL_HEADER_COLOR } from "@/lib/ui/portal-header-theme";
import { showBillingReadouts } from "@/lib/ui/mvp-features";
import { UpgradePlanDialog } from "@/components/forms/upgrade-plan-dialog";
import { APP_LANGUAGE_CHANGE_EVENT } from "@/components/providers/app-language-provider";
import { refreshAuthorization } from "@/lib/auth/authorization-refresh";

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
import { useAppLanguage } from "@/components/providers/app-language-provider";
type SettingsPageProps = {
  closeButtonRef?: RefObject<HTMLButtonElement | null>;
  displayMode?: "page" | "modal";
  onClose?: () => void;
};

/**
 * The screens that answer with a copy of a setting saved here.
 *
 * Saving writes `integrations.controlCenter`, but neither the calendar nor the
 * kitchen board reads it from /api/settings: each carries its own copy in its
 * own response, so that a visit does not paint one view for a moment before a
 * second request tells it about another. The cost of that is here - the
 * mutation ages /api/settings and nothing else, so those responses stayed
 * cached for their two-minute stale window and the saved setting looked like it
 * had not taken until the page was reloaded.
 *
 * Prefixes rather than urls, because both carry the range on screen in their
 * query string. Aging is all this does: a response nobody is reading is
 * refetched when something next asks for it.
 */
const CONTROL_CENTER_QUERY_PREFIXES = ["/api/calendar", "/api/kitchen"];

function refreshQueriesCarrying(prefixes: string[]) {
  for (const prefix of prefixes) {
    invalidateAuthenticatedQueryPrefix(prefix);
  }
}

/**
 * A signed URL for a stored branding image, or null while there is none to
 * sign.
 *
 * The bucket is private, so a stored image is only renderable through one.
 * Signed on the client the way hall floor plans are: the tenant_storage_select
 * policy already limits it to this organization's folder, and routing it
 * through the API would buy nothing.
 */
function useSignedBrandingUrl(path: string) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setSignedUrl(null);
      return;
    }

    let isCurrent = true;
    void getOrganizationBrandingUrl(path).then((url) => {
      if (isCurrent) setSignedUrl(url);
    });

    return () => {
      isCurrent = false;
    };
  }, [path]);

  return signedUrl;
}

export function SettingsPage({
  closeButtonRef,
  displayMode = "page",
  onClose
}: SettingsPageProps) {
  const { t } = useAppLanguage();
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
        twoFactorRequired: boolean;
        sessionTimeoutMinutes: number;
        organizationName: string;
        controlCenter: ControlCenterSettings;
        payments: { paymentLink: string };
      }
    >,
    SettingsResponse
  >("/api/settings", "PATCH", { cacheResponse: true });
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [eventConfirmations, setEventConfirmations] = useState(true);
  const [billingAlerts, setBillingAlerts] = useState(true);
  const [systemAnnouncements, setSystemAnnouncements] = useState(false);
  const [timezone, setTimezone] = useState(DEFAULT_TIME_ZONE);
  // Rebuilt only when the stored zone changes, because the list is four hundred
  // entries and it is otherwise identical on every render.
  const timeZoneGroups = useMemo(
    () => groupedTimeZoneOptions(timezone),
    [timezone]
  );
  const [language, setLanguage] = useState("en-US");
  const [organizationName, setOrganizationName] = useState("");
  const [controlCenter, setControlCenter] = useState<ControlCenterSettings>({
    general: {
      logoPath: "",
      portalHeader: {
        style: "color",
        color: DEFAULT_PORTAL_HEADER_COLOR,
        imagePath: ""
      },
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
  const [notificationMessage, setNotificationMessage] = useState("");
  // The logo is picked here and uploaded on save, so an abandoned screen leaves
  // nothing in the bucket. `isLogoCleared` is the third state the path alone
  // cannot express: a stored logo the operator has asked to drop, which is not
  // the same as never having had one.
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isLogoCleared, setIsLogoCleared] = useState(false);
  // The portal header background is picked on the same terms, and both upload
  // in the same save.
  const [headerImageFile, setHeaderImageFile] = useState<File | null>(null);
  const [isHeaderImageCleared, setIsHeaderImageCleared] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [activeModalSection, setActiveModalSection] =
    useState<ModalSettingsSection>("General");
  // The organization's sign-in policy. Both have been stored and audited since
  // the settings table was written; neither had a control until the Security
  // section existed.
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(30);
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
    setTwoFactorRequired(settingsQuery.data.settings.twoFactorRequired);
    setSessionTimeoutMinutes(
      settingsQuery.data.settings.sessionTimeoutMinutes
    );
    setOrganizationName(settingsQuery.data.organization.name);
    setControlCenter(settingsQuery.data.settings.controlCenter);
    // What the server says is now what is stored, so a pending pick or a
    // pending removal has either been applied or was never saved.
    setLogoFile(null);
    setIsLogoCleared(false);
    setHeaderImageFile(null);
    setIsHeaderImageCleared(false);
    setPaymentLink(settingsQuery.data.payments?.paymentLink ?? "");
  }, [settingsQuery.data]);

  const storedLogoUrl = useSignedBrandingUrl(controlCenter.general.logoPath);
  const storedHeaderImageUrl = useSignedBrandingUrl(
    controlCenter.general.portalHeader.imagePath
  );

  const savePaymentLink = async () => {
    setPaymentMessage("");
    const trimmed = paymentLink.trim();

    try {
      await settingsMutation.mutate({ payments: { paymentLink: trimmed } });
      setPaymentMessage(
        trimmed
          ? t("settings.paymentLinkSaved")
          : t("settings.paymentLinkCleared")
      );
    } catch (error) {
      setPaymentMessage(
        error instanceof Error
          ? error.message
          : t("settings.paymentLinkSaveFailed")
      );
    }
  };

  const savePreference = async (
    field: keyof SettingsResponse["notifications"],
    value: boolean,
    rollback: () => void
  ) => {
    setNotificationMessage("");
    try {
      await settingsMutation.mutate({ [field]: value });
    } catch (error) {
      rollback();
      setNotificationMessage(
        error instanceof Error
          ? error.message
          : t("settings.notificationSaveFailed")
      );
    }
  };

  const saveImmediateSetting = async (
    input: Partial<{
      language: string;
      timezone: string;
      twoFactorRequired: boolean;
      sessionTimeoutMinutes: number;
    }>,
    rollback: () => void
  ) => {
    setSettingsMessage("");
    try {
      await settingsMutation.mutate(input);
      // Only for the people who follow the organization. Somebody who has
      // chosen their own language has not stopped choosing it because an
      // administrator changed the hall's - applying it here would switch the
      // screen out from under whoever happened to be on this page.
      if (input.language && !getCachedAuthSession()?.user.language) {
        window.dispatchEvent(
          new CustomEvent(APP_LANGUAGE_CHANGE_EVENT, {
            detail: { language: input.language }
          })
        );
      }

      // Language and timezone are part of how this organization writes a date,
      // and the session is where that lives. Refetched forced, so every mounted
      // screen re-renders against the new settings rather than waiting for the
      // realtime event to come back round to the browser that made the change.
      await refreshAuthorization({ force: true });
    } catch (error) {
      rollback();
      setSettingsMessage(
        error instanceof Error ? error.message : t("settings.saveFailed")
      );
    }
  };

  const saveControlCenter = async () => {
    setSettingsMessage("");
    try {
      // The picked files reach the bucket here and not a moment earlier, so
      // closing the panel without saving uploads nothing.
      let nextLogoPath = controlCenter.general.logoPath;
      let nextHeaderImagePath = controlCenter.general.portalHeader.imagePath;
      if (logoFile || headerImageFile) {
        setIsUploadingImage(true);
        try {
          // Together, so a save that changes both is one wait rather than two.
          const [uploadedLogoPath, uploadedHeaderImagePath] = await Promise.all(
            [
              logoFile ? uploadOrganizationLogo(logoFile) : null,
              headerImageFile ? uploadPortalHeaderImage(headerImageFile) : null
            ]
          );
          nextLogoPath = uploadedLogoPath ?? nextLogoPath;
          nextHeaderImagePath = uploadedHeaderImagePath ?? nextHeaderImagePath;
        } finally {
          setIsUploadingImage(false);
        }
      }

      if (!logoFile && isLogoCleared) nextLogoPath = "";
      if (!headerImageFile && isHeaderImageCleared) nextHeaderImagePath = "";

      const nextControlCenter: ControlCenterSettings = {
        ...controlCenter,
        general: {
          ...controlCenter.general,
          logoPath: nextLogoPath,
          portalHeader: {
            ...controlCenter.general.portalHeader,
            imagePath: nextHeaderImagePath
          }
        }
      };

      await settingsMutation.mutate({
        organizationName,
        controlCenter: nextControlCenter
      });
      setControlCenter(nextControlCenter);
      setLogoFile(null);
      setIsLogoCleared(false);
      setHeaderImageFile(null);
      setIsHeaderImageCleared(false);
      setSettingsMessage(t("settings.saved"));
      refreshQueriesCarrying(CONTROL_CENTER_QUERY_PREFIXES);
      // Date Format and Time Format are saved in this block, and they live on
      // the session rather than in a query - so the query invalidation above
      // reaches the panels and this reaches every date on every mounted screen.
      await refreshAuthorization({ force: true });
    } catch (error) {
      setSettingsMessage(
        error instanceof Error ? error.message : t("settings.saveFailed")
      );
    }
  };

  // The Reset panel draws nothing for anyone without `organization.reset`, so
  // its tab goes with it. A tab that opens on an empty page reads as a broken
  // screen, and one labelled Reset invites a conversation about who has the
  // permission - which is not a conversation this screen should start.
  //
  // Activity goes the same way and for the same reason: without `activity.read`
  // the panel draws only an explanation of the permission it needs, which is a
  // worse answer than not offering the tab.
  const canReadActivity = hasPermission("activity.read");
  const visibleModalNavItems = modalSettingsNavItems.filter(
    (item) =>
      (item.label !== "Reset" || hasPermission("organization.reset")) &&
      (item.label !== "Activity" || canReadActivity)
  );
  const activeModalNavItem =
    visibleModalNavItems.find((item) => item.label === activeModalSection) ??
    visibleModalNavItems[0];
  const showAllSettingsContent = false;
  const visibleIntegrations = integrations;
  const shouldShowIntegrations = false;
  /**
   * Whether the secondary card grid below the section panels holds anything.
   *
   * It is gated as a whole because a grid with no children is not free: it still
   * takes a row in the `grid gap-4` around it, so an empty one added 16px of
   * blank page under every section that does not fill it - which, with
   * `showAllSettingsContent` and `shouldShowIntegrations` both pinned false, is
   * every section except Billing. That doubled the gap above the Save changes
   * bar and read as a stray empty container at the foot of General.
   *
   * Spelled out as the same disjunction the cards themselves use rather than
   * `activeModalSection === "Billing"`, so a card that comes back when one of
   * those flags is flipped brings its container back with it.
   */
  const hasSecondaryCards =
    showAllSettingsContent ||
    shouldShowIntegrations ||
    ((showAllSettingsContent || activeModalSection === "Billing") &&
      canManagePayments);
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
              : t("settings.noViewPermission")
          }
          emptyTitle={canViewSettings ? undefined : t("common.accessRestricted")}
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
          title={t("settings.title")}
          subtitle={t("settings.blurb")}
          showDefaultActions={false}
          showSearch={false}
        />
      ) : null}

      <main className="min-h-0 flex-1 overflow-hidden">
        <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f5f6f8]">
          {isModal ? (
            <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#d8dde5] bg-[#f5f6f8] px-4 sm:px-5">
              <h3 className="text-sm font-black text-[#17202a] lg:sr-only">
                {t("settings.title")}
              </h3>
              <button
                aria-label={t("settings.close")}
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
            aria-label={t("settings.sections")}
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
                {t(item.labelKey)}
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
                  {t(activeModalNavItem.labelKey)}
                </h2>
              </div>
              <p className="mt-1 text-xs leading-5 text-[#6a7483]">
                {t(activeModalNavItem.descriptionKey)}
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
                    <PanelHeader title={t("settings.organizationProfile")} />

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
                            {t("settings.organization")}
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] text-[#6a7483]">
                          {t("settings.workspace")}
                        </p>
                        <p className="mt-1 truncate text-[10px] text-[#6a7483]">
                          {t("settings.organizationDetails")}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 p-4 sm:grid-cols-2">
                      <label className="text-[10px] font-bold sm:col-span-2">
                        {t("settings.organizationName")}
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
                        currentUrl={storedLogoUrl}
                        file={logoFile}
                        isCleared={isLogoCleared}
                        isDisabled={!canEditSettings || isUploadingImage}
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
                        {t("settings.contactEmail")}
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

                {showAllSettingsContent || activeModalSection === "General" ? (
                  <PortalHeaderPanel
                    canEdit={canEditSettings}
                    imageFile={headerImageFile}
                    imageUrl={storedHeaderImageUrl}
                    isImageCleared={isHeaderImageCleared}
                    isUploading={isUploadingImage}
                    logoUrl={storedLogoUrl}
                    onChange={(portalHeader) =>
                      setControlCenter((current) => ({
                        ...current,
                        general: { ...current.general, portalHeader }
                      }))
                    }
                    onImageClearStored={() => setIsHeaderImageCleared(true)}
                    onImageRestoreStored={() => setIsHeaderImageCleared(false)}
                    onImageSelect={(picked) => {
                      setHeaderImageFile(picked);
                      // Picking replaces the stored image outright, so a
                      // pending removal is no longer what the operator asked
                      // for.
                      if (picked) setIsHeaderImageCleared(false);
                    }}
                    value={controlCenter.general.portalHeader}
                  />
                ) : null}

                {showAllSettingsContent ||
                activeModalSection === "Notifications" ? (
                  <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
                    <PanelHeader title={t("settings.notificationPreferences")} />

                    <div className="space-y-4 p-4">
                      {[
                        {
                          title: t("settings.emailNotifications"),
                          description: t("settings.emailNotificationsHint"),
                          icon: "mail" as const,
                          value: emailNotifications,
                          action: () => {
                            const value = !emailNotifications;
                            setEmailNotifications(value);
                            void savePreference("emailNotifications", value, () =>
                              setEmailNotifications(!value)
                            );
                          }
                        },
                        {
                          title: t("settings.eventConfirmations"),
                          description:
                            t("settings.eventConfirmationsHint"),
                          icon: "calendar" as const,
                          value: eventConfirmations,
                          action: () => {
                            const value = !eventConfirmations;
                            setEventConfirmations(value);
                            void savePreference("eventConfirmations", value, () =>
                              setEventConfirmations(!value)
                            );
                          }
                        },
                        {
                          title: t("settings.invoiceAlerts"),
                          description: t("settings.invoiceAlertsHint"),
                          icon: "billing" as const,
                          value: billingAlerts,
                          action: () => {
                            const value = !billingAlerts;
                            setBillingAlerts(value);
                            void savePreference("billingAlerts", value, () =>
                              setBillingAlerts(!value)
                            );
                          }
                        },
                        {
                          title: t("settings.systemAnnouncements"),
                          description:
                            t("settings.systemAnnouncementsHint"),
                          icon: "activity" as const,
                          value: systemAnnouncements,
                          action: () => {
                            const value = !systemAnnouncements;
                            setSystemAnnouncements(value);
                            void savePreference("systemAnnouncements", value, () =>
                              setSystemAnnouncements(!value)
                            );
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
                            notification.title !== t("settings.invoiceAlerts")
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
                      {notificationMessage ? (
                        <p
                          className="rounded-lg bg-red-50 p-3 text-xs font-bold text-red-700"
                          role="status"
                        >
                          {notificationMessage}
                        </p>
                      ) : null}
                    </div>
                  </section>
                ) : null}

                {showAllSettingsContent || activeModalSection === "General" ? (
                  <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
                    <PanelHeader title={t("settings.languageRegion")} icon="globe" />

                    <div className="space-y-3 p-4">
                      <label className="block text-[10px] font-bold">
                        {t("settings.language")}
                        <select
                          className="mt-1 h-9 w-full rounded-lg border border-[#c7d0dc] bg-white px-3 text-[10px]"
                          name="settingsLanguage"
                          disabled={!canEditSettings}
                          onChange={(event) => {
                            const value = event.target.value;
                            const previous = language;
                            setLanguage(value);
                            void saveImmediateSetting({ language: value }, () =>
                              setLanguage(previous)
                            );
                          }}
                          value={language}
                        >
                          <option value="en-US">{t("settings.langEnUs")}</option>
                          <option value="en-GB">
                            {t("settings.langEnGb")}
                          </option>
                          <option value="he-IL">{t("settings.langHe")}</option>
                          <option value="es-US">{t("settings.langEs")}</option>
                        </select>
                      </label>

                      <label className="block text-[10px] font-bold">
                        {t("settings.currentTimezone")}
                        <select
                          className="mt-1 h-9 w-full rounded-lg border border-[#c7d0dc] bg-white px-3 text-[10px]"
                          name="settingsTimezone"
                          disabled={!canEditSettings}
                          onChange={(event) => {
                            const value = event.target.value;
                            const previous = timezone;
                            setTimezone(value);
                            void saveImmediateSetting({ timezone: value }, () =>
                              setTimezone(previous)
                            );
                          }}
                          value={timezone}
                        >
                          {timeZoneGroups.map((group) => (
                            <optgroup key={group.region} label={group.region}>
                              {group.zones.map((zone) => (
                                <option key={zone.id} value={zone.id}>
                                  {zone.label}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </label>

                      <div className="grid grid-cols-2 gap-3">
                        <label className="text-[10px] font-bold">
                          {t("settings.dateFormat")}
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
                          {t("settings.timeFormat")}
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
                            <option value="12-hour">{t("settings.time12")}</option>
                            <option value="24-hour">{t("settings.time24")}</option>
                          </select>
                        </label>
                      </div>
                    </div>
                  </section>
                ) : null}
              </aside>

              <div className={isModal ? "contents" : "grid min-w-0 gap-4"}>
                {/*
                  No `canEdit` prop: these two panels read their own keys.
                  `settings.update` is the wrong question for them - a hall is
                  not a preference, and the split lifecycle means each control
                  has a different answer. See `useHallPermissions`.
                */}
                {activeModalSection === "Halls" ? <HallsSettingsPanel /> : null}
                {activeModalSection === "Event Types" ? (
                  <EventTypesSettingsPanel />
                ) : null}
                {activeModalSection === "Calendar" ? (
                  <CalendarSettingsPanel
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
                {activeModalSection === "Activity" ? (
                  <ActivitySettingsPanel canRead={canReadActivity} />
                ) : null}
                {activeModalSection === "Reset" ? <ResetSettingsPanel /> : null}
                {activeModalSection === "Billing" ? (
                  <BillingBasicsPanel />
                ) : null}
                {activeModalSection === "Security" ? (
                  <div className="grid gap-4">
                    <SecuritySettingsPanel
                      canEdit={canEditSettings}
                      onChange={(next) => {
                        const previous = {
                          twoFactorRequired,
                          sessionTimeoutMinutes
                        };

                        if (next.twoFactorRequired !== undefined) {
                          setTwoFactorRequired(next.twoFactorRequired);
                        }
                        if (next.sessionTimeoutMinutes !== undefined) {
                          setSessionTimeoutMinutes(next.sessionTimeoutMinutes);
                        }

                        void saveImmediateSetting(next, () => {
                          setTwoFactorRequired(previous.twoFactorRequired);
                          setSessionTimeoutMinutes(
                            previous.sessionTimeoutMinutes
                          );
                        });
                      }}
                      sessionTimeoutMinutes={sessionTimeoutMinutes}
                      twoFactorRequired={twoFactorRequired}
                    />
                    {/* Enrolling is the individual's, not the
                        administrator's, so it is not gated on
                        `settings.update` the way the policy above is. */}
                    <MfaSecurityPanel />
                    <OtherSessionsPanel />
                  </div>
                ) : null}
                {activeModalSection === "Branding" ||
                activeModalSection === "Integrations" ? (
                  <ComingSoonPanel section={activeModalSection} />
                ) : null}
                {hasSecondaryCards ? (
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
                        <PanelHeader title={t("settings.brandingPreview")} icon="eye" />

                        {/* The organization's own logo over its own header
                            colour - a miniature of what a client sees at the
                            top of the portal. It drew the Event Core product
                            logo before, which is not a preview of anything the
                            operator set and read as an upload that had failed.
                            `storedLogoUrl` is resolved above for the same
                            reason the portal signs it: the file is private. */}
                        <div className="flex flex-1 flex-col justify-between p-4">
                          <div
                            className="flex h-20 items-center justify-center rounded-lg px-4"
                            style={{
                              backgroundColor: resolvePortalHeaderColor(
                                controlCenter.general.portalHeader.color
                              )
                            }}
                          >
                            {storedLogoUrl ? (
                              // Plain <img>: the URL is signed and rotates, so
                              // the optimizer would cache a link that expires.
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                alt={t("settings.brandingPreview")}
                                className="max-h-12 w-auto object-contain"
                                src={storedLogoUrl}
                              />
                            ) : (
                              <span className="text-xs font-black text-white/80">
                                {organizationName || t("settings.yourVenue")}
                              </span>
                            )}
                          </div>

                          <button
                            className={`${secondaryButton} mt-4 w-full`}
                            // General, not Branding: that is where `LogoField`
                            // and `PortalHeaderPanel` actually are. Sending
                            // people to Branding took them to a "coming soon"
                            // panel for something they had already set.
                            onClick={() => setActiveModalSection("General")}
                            type="button"
                          >
                            {t("settings.customizeBranding")}
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
                              : t("settings.integrationsStatus")
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
                                {t("settings.connected")}
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
                        <PanelHeader
                          title={t("settings.clientPaymentLink")}
                          icon="billing"
                        />

                        <div className="flex flex-1 flex-col space-y-3 p-4">
                          <label
                            className="block text-[10px] font-black uppercase tracking-[0.08em] text-[#516174]"
                            htmlFor="organization-payment-link"
                          >
                            {t("settings.paymentLink")}
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
                            {t("settings.paymentLinkHint")}
                          </p>
                          <button
                            className={`${secondaryButton} w-full`}
                            disabled={settingsMutation.isPending}
                            onClick={savePaymentLink}
                            type="button"
                          >
                            {settingsMutation.isPending
                              ? t("common.savingEllipsis")
                              : t("settings.savePaymentLink")}
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
                        <PanelHeader title={t("settings.billingCycle")} icon="billing" />

                        <dl className="flex-1 space-y-4 p-4 text-[10px]">
                          <div className="flex justify-between gap-3">
                            <dt>{t("settings.currentPlan")}</dt>
                            <dd className="rounded-full bg-[#eef6fd] px-2 py-1 font-black text-[#246b9f]">
                              {t("settings.planProfessional")}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt>{t("settings.billingCycle")}</dt>
                            <dd className="font-bold">{t("settings.cycleMonthly")}</dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt>{t("settings.nextBillingDate")}</dt>
                            <dd className="font-bold">Aug 8, 2026</dd>
                          </div>
                        </dl>

                        <div className="px-4 pb-4">
                          <button
                            className={`${secondaryButton} w-full`}
                            onClick={() => setIsUpgradeOpen(true)}
                            type="button"
                          >
                            {t("settings.manageSubscription")}
                          </button>
                        </div>
                      </section>
                    ) : null}
                  </div>
                ) : null}
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
                        isUploadingImage ||
                        !organizationName.trim()
                      }
                      onClick={() => void saveControlCenter()}
                      type="button"
                    >
                      {isUploadingImage
                        ? t("settings.uploadingImages")
                        : settingsMutation.isPending
                          ? t("common.savingEllipsis")
                          : t("common.saveChanges")}
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
