"use client";

import {
  PanelHeader,
  Toggle
} from "@/features/settings/components/settings-shared";
import { useAppLanguage } from "@/components/providers/app-language-provider";
import { INACTIVITY_TIMEOUT_DISABLED } from "@/lib/auth/inactivity";

/**
 * The organization's sign-in policy.
 *
 * Both values have been stored, validated and audited since the settings table
 * was written - `POST /api/settings` accepts them and records the before/after
 * like every other field. Neither had a control, so an organization could not
 * turn on the requirement it was already able to store.
 *
 * It sits above `MfaSecurityPanel` rather than replacing it: this is what the
 * venue requires of everybody, that is how one person satisfies it, and an
 * administrator who has just switched the requirement on is the most likely
 * person to need the enrolment panel immediately afterwards.
 */

/**
 * Minutes, chosen rather than typed.
 *
 * A SHIFT, NOT A BANKING SESSION. The list used to start at fifteen minutes and
 * that was a number borrowed from software with a different job: in a venue,
 * fifteen minutes means signing in again after every walk-through of the hall.
 * The unit that means something here is a shift, so it starts at an hour.
 *
 * `0` is "Never", and it is an option on purpose. A venue that does not want
 * this should be able to SAY so - "Never" in a dropdown is a decision somebody
 * made, while twelve hours is a number somebody typed hoping it was enough.
 *
 * Widening rather than narrowing, so nobody's stored value becomes
 * unselectable: a venue that set fifteen minutes through the API still sees it
 * offered back below.
 */
const TIMEOUT_CHOICES = [
  INACTIVITY_TIMEOUT_DISABLED,
  60,
  120,
  240,
  480,
  720
] as const;

export function SecuritySettingsPanel({
  canEdit,
  twoFactorRequired,
  sessionTimeoutMinutes,
  onChange
}: {
  canEdit: boolean;
  twoFactorRequired: boolean;
  sessionTimeoutMinutes: number;
  onChange: (next: {
    twoFactorRequired?: boolean;
    sessionTimeoutMinutes?: number;
  }) => void;
}) {
  const { t } = useAppLanguage();

  const describe = (minutes: number) => {
    // "Never" reads as a decision. "0 minutes" reads as a mistake.
    if (minutes === INACTIVITY_TIMEOUT_DISABLED) {
      return t("settings.neverTimeout");
    }
    if (minutes >= 1440) return t("settings.oneDay");
    if (minutes >= 60 && minutes % 60 === 0) {
      return t("settings.hoursValue", { count: minutes / 60 });
    }

    return t("settings.minutesValue", { count: minutes });
  };

  // A value stored before these choices existed, or set through the API, is
  // offered back rather than silently rounded to the nearest option - the
  // select would otherwise show blank and the next save would change it.
  const choices = TIMEOUT_CHOICES.includes(
    sessionTimeoutMinutes as (typeof TIMEOUT_CHOICES)[number]
  )
    ? [...TIMEOUT_CHOICES]
    : [sessionTimeoutMinutes, ...TIMEOUT_CHOICES].sort((a, b) => a - b);

  return (
    <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
      <PanelHeader title={t("settings.organizationPolicy")} icon="shield" />

      <div className="space-y-4 p-4">
        {!canEdit ? (
          <p className="rounded-lg border border-[#e0e5eb] bg-[#f5f8fb] px-3 py-2 text-[11px] font-semibold text-[#38485a]">
            {t("settings.securityPolicyReadOnly")}
          </p>
        ) : null}

        <div className="flex items-start gap-4 border-b border-[#e5e9ef] py-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-[#233144]">
              {t("settings.requireTwoFactor")}
            </p>
            <p className="mt-1 text-[10px] leading-4 text-[#6a7483]">
              {t("settings.requireTwoFactorHint")}
            </p>
          </div>
          <Toggle
            checked={twoFactorRequired}
            disabled={!canEdit}
            label={t("settings.requireTwoFactor")}
            onChange={() => onChange({ twoFactorRequired: !twoFactorRequired })}
          />
        </div>

        <label className="block text-[10px] font-black">
          {t("settings.sessionTimeout")}
          <select
            className="mt-1 h-9 w-full rounded-lg border border-[#c7d0dc] bg-white px-3 text-[10px] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canEdit}
            name="sessionTimeoutMinutes"
            onChange={(event) =>
              onChange({ sessionTimeoutMinutes: Number(event.target.value) })
            }
            value={sessionTimeoutMinutes}
          >
            {choices.map((minutes) => (
              <option key={minutes} value={minutes}>
                {describe(minutes)}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[10px] font-medium text-[#6a7483]">
            {t("settings.sessionTimeoutHint")}
          </span>
        </label>
      </div>
    </section>
  );
}
