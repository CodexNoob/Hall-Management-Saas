"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Icon,
  PanelHeader,
  Toggle,
  secondaryButton,
  type ControlCenterSettings
} from "./settings-shared";
import { useAppLanguage } from "@/components/providers/app-language-provider";

const fieldClass =
  "mt-1 h-10 w-full rounded-lg border border-[#c7d0dc] bg-white px-3 text-xs text-[#233144] disabled:cursor-not-allowed disabled:bg-[#f5f6f8] disabled:text-[#7a8492]";

function SettingRow({
  title,
  description,
  checked,
  onChange
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-start gap-4 border-b border-[#e5e9ef] py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black text-[#233144]">{title}</p>
        <p className="mt-1 text-[10px] leading-4 text-[#6a7483]">
          {description}
        </p>
      </div>
      <Toggle checked={checked} label={`Toggle ${title}`} onChange={onChange} />
    </div>
  );
}

export function CalendarSettingsPanel({
  value,
  onChange
}: {
  value: ControlCenterSettings["calendar"];
  onChange: (value: ControlCenterSettings["calendar"]) => void;
}) {
  const { t } = useAppLanguage();

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
        <PanelHeader title={t("settings.calendarDefaults")} icon="calendar" />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <label className="text-[10px] font-black">
            {t("settings.defaultView")}
            <select
              className={fieldClass}
              name="calendarDefaultView"
              value={value.defaultView}
              onChange={(event) =>
                onChange({
                  ...value,
                  defaultView: event.target.value as typeof value.defaultView
                })
              }
            >
              <option value="month">{t("settings.viewMonth")}</option>
              <option value="week">{t("settings.viewWeek")}</option>
              <option value="agenda">{t("settings.viewAgenda")}</option>
            </select>
          </label>
          <label className="text-[10px] font-black">
            {t("settings.weekStartsOn")}
            <select
              className={fieldClass}
              name="calendarWeekStartsOn"
              value={value.weekStartsOn}
              onChange={(event) =>
                onChange({
                  ...value,
                  weekStartsOn: event.target.value as typeof value.weekStartsOn
                })
              }
            >
              <option value="sunday">{t("settings.sunday")}</option>
              <option value="monday">{t("settings.monday")}</option>
              <option value="saturday">{t("settings.saturday")}</option>
            </select>
          </label>
          <label className="text-[10px] font-black">
            {t("settings.holdExpiration")}
            <select
              className={fieldClass}
              name="calendarHoldExpirationHours"
              value={value.holdExpirationHours}
              onChange={(event) =>
                onChange({
                  ...value,
                  holdExpirationHours: Number(
                    event.target.value
                  ) as typeof value.holdExpirationHours
                })
              }
            >
              <option value="24">{t("settings.hold24h")}</option>
              <option value="48">{t("settings.hold48h")}</option>
              <option value="72">{t("settings.hold72h")}</option>
              <option value="168">{t("settings.days7")}</option>
            </select>
          </label>
          <label className="text-[10px] font-black">
            {t("settings.shortNoticeWarning")}
            <select
              className={fieldClass}
              name="calendarShortNoticeDays"
              value={value.shortNoticeDays}
              onChange={(event) =>
                onChange({
                  ...value,
                  shortNoticeDays: Number(
                    event.target.value
                  ) as typeof value.shortNoticeDays
                })
              }
            >
              <option value="3">{t("settings.days3")}</option>
              <option value="7">{t("settings.days7")}</option>
              <option value="14">{t("settings.days14")}</option>
              <option value="30">{t("settings.days30")}</option>
            </select>
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
        <PanelHeader title={t("settings.calendarDisplay")} icon="eye" />
        <div className="px-4">
          <SettingRow
            checked={value.showHebrewDate}
            description={t("settings.showHebrewDatesHint")}
            onChange={() =>
              onChange({ ...value, showHebrewDate: !value.showHebrewDate })
            }
            title={t("settings.showHebrewDates")}
          />
          <SettingRow
            checked={value.showAvailability}
            description={t("settings.showAvailableIndicatorHint")}
            onChange={() =>
              onChange({ ...value, showAvailability: !value.showAvailability })
            }
            title={t("settings.showAvailableIndicator")}
          />
          <SettingRow
            checked={value.clickAnywhereToAdd}
            description={t("settings.clickAnywhereHint")}
            onChange={() =>
              onChange({
                ...value,
                clickAnywhereToAdd: !value.clickAnywhereToAdd
              })
            }
            title={t("settings.clickAnywhereToAdd")}
          />
        </div>
      </section>
    </div>
  );
}

export function KitchenSettingsPanel({
  value,
  onChange
}: {
  value: ControlCenterSettings["kitchen"];
  onChange: (value: ControlCenterSettings["kitchen"]) => void;
}) {
  const { t } = useAppLanguage();

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
        <PanelHeader title={t("settings.kitchenDashboard")} icon="kitchen" />
        <div className="space-y-4 p-4">
          <label className="block text-[10px] font-black">
            {t("settings.defaultView")}
            <select
              className={fieldClass}
              name="eventsDefaultView"
              value={value.defaultView}
              onChange={(event) =>
                onChange({
                  ...value,
                  defaultView: event.target.value as typeof value.defaultView
                })
              }
            >
              <option value="today">{t("settings.kitchenToday")}</option>
              <option value="week">{t("settings.kitchenThisWeek")}</option>
              <option value="four-weeks">{t("settings.kitchenFourWeeks")}</option>
            </select>
          </label>
          <label className="block text-[10px] font-black">
            {t("settings.shortNoticeThreshold")}
            <select
              className={fieldClass}
              name="eventsShortNoticeDays"
              value={value.shortNoticeDays}
              onChange={(event) =>
                onChange({
                  ...value,
                  shortNoticeDays: Number(
                    event.target.value
                  ) as typeof value.shortNoticeDays
                })
              }
            >
              <option value="1">{t("settings.days1")}</option>
              <option value="3">{t("settings.days3")}</option>
              <option value="7">{t("settings.days7")}</option>
            </select>
          </label>
          <Link className={`${secondaryButton} w-full`} href="/dashboard/staff">
            {t("settings.manageKitchenWorkers")}
          </Link>
        </div>
      </section>
      <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
        <PanelHeader title={t("settings.kitchenAlerts")} icon="mail" />
        <div className="px-4">
          <SettingRow
            checked={value.notificationsEnabled}
            description={t("settings.kitchenNotificationsHint")}
            onChange={() =>
              onChange({
                ...value,
                notificationsEnabled: !value.notificationsEnabled
              })
            }
            title={t("settings.kitchenNotifications")}
          />
          <SettingRow
            checked={value.requireMenuAcknowledgment}
            description={t("settings.requireAckHint")}
            onChange={() =>
              onChange({
                ...value,
                requireMenuAcknowledgment: !value.requireMenuAcknowledgment
              })
            }
            title={t("settings.requireAck")}
          />
        </div>
      </section>
    </div>
  );
}

export function AccessSettingsPanel() {
  const { t } = useAppLanguage();
  /*
   * Four shortcuts onto one page, each opening the tab it names.
   *
   * Two of these pointed at `/dashboard/access`, which is now a redirect - so
   * they would still have arrived, one hop later and both on the same tab.
   * Naming the tab directly is what makes t("settings.permissionSummary") land on the
   * summary rather than on whichever tab the page happened to default to.
   */
  const actions: Array<{
    title: string;
    description: string;
    href: `/dashboard/staff?tab=${string}`;
    icon: "users" | "shield" | "access" | "mail";
  }> = [
    {
      title: t("settings.manageStaff"),
      description: t("settings.manageStaffHint"),
      href: "/dashboard/staff?tab=people",
      icon: "users" as const
    },
    {
      title: t("settings.manageRoles"),
      description: t("settings.manageRolesHint"),
      href: "/dashboard/staff?tab=roles",
      icon: "shield" as const
    },
    {
      title: t("settings.permissionSummary"),
      description: t("settings.permissionSummaryHint"),
      href: "/dashboard/staff?tab=roles",
      icon: "access" as const
    },
    {
      title: t("settings.inviteUser"),
      description: t("settings.inviteUserHint"),
      href: "/dashboard/staff?tab=invitations",
      icon: "mail" as const
    }
  ];
  return (
    <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
      <PanelHeader title={t("settings.accessRoles")} icon="access" />
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        {actions.map((action) => (
          <Link
            className="group flex min-h-24 items-start gap-3 rounded-xl border border-[#d8dde5] p-4 transition hover:border-[#8fb0ca] hover:bg-[#f7fbff]"
            href={action.href}
            key={action.title}
          >
            <Icon
              className="h-5 w-5 shrink-0 text-[#536b83]"
              name={action.icon}
            />
            <span className="min-w-0 flex-1">
              <strong className="block text-xs text-[#233144]">
                {action.title}
              </strong>
              <span className="mt-1 block text-[10px] leading-4 text-[#6a7483]">
                {action.description}
              </span>
            </span>
            <span
              aria-hidden="true"
              className="text-[#718096] transition group-hover:translate-x-0.5"
            >
              &rarr;
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function BillingBasicsPanel() {
  const { t } = useAppLanguage();
  const [showPayBalance, setShowPayBalance] = useState(true);
  return (
    <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
      <PanelHeader title={t("settings.billingBasics")} icon="billing" />
      <div className="grid gap-x-4 p-4 sm:grid-cols-2">
        <label className="text-[10px] font-black">
          {t("settings.currency")}
          <select className={fieldClass} defaultValue="USD" name="billingCurrency">
            <option value="USD">{t("settings.currencyUsd")}</option>
            <option value="CAD">{t("settings.currencyCad")}</option>
            <option value="ILS">{t("settings.currencyIls")}</option>
          </select>
        </label>
        <label className="text-[10px] font-black">
          {t("settings.defaultDepositLabel")}
          <input className={fieldClass} defaultValue="Deposit" name="defaultDepositLabel" />
        </label>
        <label className="mt-4 text-[10px] font-black sm:col-span-2">
          {t("settings.acceptedPaymentMethods")}
          <input className={fieldClass} defaultValue="Card, ACH, Check, Cash" name="acceptedPaymentMethods" />
        </label>
        <div className="mt-3 sm:col-span-2">
          <SettingRow
            checked={showPayBalance}
            description={t("settings.showPayBalanceHint")}
            onChange={() => setShowPayBalance((value) => !value)}
            title={t("settings.showPayBalance")}
          />
        </div>
      </div>
    </section>
  );
}

export function ComingSoonPanel({
  section
}: {
  section: "Branding" | "Integrations";
}) {
  const { t } = useAppLanguage();
  const isBranding = section === "Branding";
  // Brand colour and the portal header used to be listed here too. Both ship
  // today, under General - `LogoField` and `PortalHeaderPanel` on that section -
  // so listing them as unbuilt told an operator who had already set them that
  // the feature did not exist. What is left is what genuinely is not built.
  const items = isBranding
    ? [t("settings.emailFooter"), t("settings.pdfBranding")]
    : [
        "Google Calendar",
        "Gmail & Google Drive",
        t("settings.stripeLink"),
        t("settings.whatsappSms")
      ];
  return (
    <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
      {/* `section` is the identifier the page switches on, so the heading is
          built from the catalog rather than from it - this used to render
          "Branding · Coming soon" in English whatever the language was. */}
      <PanelHeader
        title={`${t(
          isBranding
            ? "settings.section.branding"
            : "settings.section.integrations"
        )} · ${t("shell.comingSoon")}`}
        icon={isBranding ? "file" : "link"}
      />
      {isBranding ? (
        <p className="border-b border-[#e0e5eb] bg-[#f5f8fb] px-4 py-3 text-[11px] font-semibold text-[#38485a]">
          {t("settings.brandingLivesInGeneral")}
        </p>
      ) : null}
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        {items.map((item) => (
          <div
            className="flex items-center justify-between gap-3 rounded-xl border border-[#e0e5eb] bg-[#fafbfc] p-4"
            key={item}
          >
            <span className="text-xs font-bold text-[#38485a]">{item}</span>
            <span className="rounded-full bg-[#edf1f5] px-2 py-1 text-[9px] font-black uppercase tracking-wide text-[#687586]">
              {t("settings.soon")}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
