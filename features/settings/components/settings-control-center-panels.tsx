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
  canEdit,
  dailyEventLimit,
  onDailyEventLimitChange,
  value,
  onChange
}: {
  canEdit: boolean;
  dailyEventLimit: number;
  onDailyEventLimitChange: (value: number) => void;
  value: ControlCenterSettings["calendar"];
  onChange: (value: ControlCenterSettings["calendar"]) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
        <PanelHeader title="Calendar defaults" icon="calendar" />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <label className="text-[10px] font-black">
            Default view
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
              <option value="month">Month</option>
              <option value="week">Week</option>
              <option value="agenda">Agenda</option>
            </select>
          </label>
          <label className="text-[10px] font-black">
            Week starts on
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
              <option value="sunday">Sunday</option>
              <option value="monday">Monday</option>
              <option value="saturday">Saturday</option>
            </select>
          </label>
          <label className="text-[10px] font-black">
            Hold expiration
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
              <option value="24">24 hours</option>
              <option value="48">48 hours</option>
              <option value="72">72 hours</option>
              <option value="168">7 days</option>
            </select>
          </label>
          <label className="text-[10px] font-black">
            Short-notice warning
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
              <option value="3">3 days</option>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
            </select>
          </label>
          <label className="text-[10px] font-black sm:col-span-2">
            Events allowed per hall, per day
            <input
              className={fieldClass}
              disabled={!canEdit}
              name="calendarEventsPerHallPerDay"
              max={50}
              min={1}
              onChange={(event) =>
                onDailyEventLimitChange(Number(event.target.value))
              }
              type="number"
              value={dailyEventLimit}
            />
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
        <PanelHeader title="Calendar display" icon="eye" />
        <div className="px-4">
          <SettingRow
            checked={value.showHebrewDate}
            description="Display the Hebrew date beside the standard date."
            onChange={() =>
              onChange({ ...value, showHebrewDate: !value.showHebrewDate })
            }
            title="Show Hebrew dates"
          />
          <SettingRow
            checked={value.showAvailability}
            description="Mark dates that still have a bookable hall available."
            onChange={() =>
              onChange({ ...value, showAvailability: !value.showAvailability })
            }
            title="Show available-date indicator"
          />
          <SettingRow
            checked={value.clickAnywhereToAdd}
            description="On: clicking anywhere on a day opens the booking form, and the + button is dropped. Off: only the + button books, and clicking the day just selects it."
            onChange={() =>
              onChange({
                ...value,
                clickAnywhereToAdd: !value.clickAnywhereToAdd
              })
            }
            title="Click anywhere to add"
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
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
        <PanelHeader title="Kitchen dashboard" icon="kitchen" />
        <div className="space-y-4 p-4">
          <label className="block text-[10px] font-black">
            Default view
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
              <option value="today">Today</option>
              <option value="week">This week</option>
              <option value="four-weeks">4 weeks</option>
            </select>
          </label>
          <label className="block text-[10px] font-black">
            Short-notice alert threshold
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
              <option value="1">1 day</option>
              <option value="3">3 days</option>
              <option value="7">7 days</option>
            </select>
          </label>
          <Link className={`${secondaryButton} w-full`} href="/dashboard/staff">
            Manage kitchen workers
          </Link>
        </div>
      </section>
      <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
        <PanelHeader title="Kitchen alerts" icon="mail" />
        <div className="px-4">
          <SettingRow
            checked={value.notificationsEnabled}
            description="Notify kitchen staff about relevant event and menu changes."
            onChange={() =>
              onChange({
                ...value,
                notificationsEnabled: !value.notificationsEnabled
              })
            }
            title="Kitchen notifications"
          />
          <SettingRow
            checked={value.requireMenuAcknowledgment}
            description="Menu changes remain open until a kitchen worker confirms them."
            onChange={() =>
              onChange({
                ...value,
                requireMenuAcknowledgment: !value.requireMenuAcknowledgment
              })
            }
            title="Require menu-change acknowledgment"
          />
        </div>
      </section>
    </div>
  );
}

export function AccessSettingsPanel() {
  /*
   * Four shortcuts onto one page, each opening the tab it names.
   *
   * Two of these pointed at `/dashboard/access`, which is now a redirect - so
   * they would still have arrived, one hop later and both on the same tab.
   * Naming the tab directly is what makes "Permission summary" land on the
   * summary rather than on whichever tab the page happened to default to.
   */
  const actions: Array<{
    title: string;
    description: string;
    href: `/dashboard/staff?tab=${string}`;
    icon: "users" | "shield" | "access" | "mail";
  }> = [
    {
      title: "Manage staff",
      description: "Add, deactivate, and update team members.",
      href: "/dashboard/staff?tab=people",
      icon: "users" as const
    },
    {
      title: "Manage roles",
      description: "Create roles and assign permission sets.",
      href: "/dashboard/staff?tab=roles",
      icon: "shield" as const
    },
    {
      title: "Permission summary",
      description: "Review access across the organization.",
      href: "/dashboard/staff?tab=roles",
      icon: "access" as const
    },
    {
      title: "Invite user",
      description: "Send a new staff member an invitation.",
      href: "/dashboard/staff?tab=invitations",
      icon: "mail" as const
    }
  ];
  return (
    <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
      <PanelHeader title="Access & roles" icon="access" />
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
              aria-hidden
              className="text-[#718096] transition group-hover:translate-x-0.5"
            >
              →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function BillingBasicsPanel() {
  const [showPayBalance, setShowPayBalance] = useState(true);
  return (
    <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
      <PanelHeader title="Billing basics" icon="billing" />
      <div className="grid gap-x-4 p-4 sm:grid-cols-2">
        <label className="text-[10px] font-black">
          Currency
          <select className={fieldClass} defaultValue="USD" name="billingCurrency">
            <option value="USD">USD — US Dollar</option>
            <option value="CAD">CAD — Canadian Dollar</option>
            <option value="ILS">ILS — Israeli New Shekel</option>
          </select>
        </label>
        <label className="text-[10px] font-black">
          Default deposit label
          <input className={fieldClass} defaultValue="Deposit" name="defaultDepositLabel" />
        </label>
        <label className="mt-4 text-[10px] font-black sm:col-span-2">
          Accepted payment methods
          <input className={fieldClass} defaultValue="Card, ACH, Check, Cash" name="acceptedPaymentMethods" />
        </label>
        <div className="mt-3 sm:col-span-2">
          <SettingRow
            checked={showPayBalance}
            description="Display the configured client payment link in the client portal."
            onChange={() => setShowPayBalance((value) => !value)}
            title="Show Pay Balance button"
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
  const isBranding = section === "Branding";
  const items = isBranding
    ? [
        "Brand color",
        "Client portal header",
        "Email footer",
        "PDF & print branding"
      ]
    : [
        "Google Calendar",
        "Gmail & Google Drive",
        "Stripe / payment link",
        "WhatsApp & SMS"
      ];
  return (
    <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
      <PanelHeader
        title={`${section} · Coming soon`}
        icon={isBranding ? "file" : "link"}
      />
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        {items.map((item) => (
          <div
            className="flex items-center justify-between gap-3 rounded-xl border border-[#e0e5eb] bg-[#fafbfc] p-4"
            key={item}
          >
            <span className="text-xs font-bold text-[#38485a]">{item}</span>
            <span className="rounded-full bg-[#edf1f5] px-2 py-1 text-[9px] font-black uppercase tracking-wide text-[#687586]">
              Soon
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
