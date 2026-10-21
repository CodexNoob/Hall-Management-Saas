"use client";

import { useId, useState } from "react";

import { useAppLanguage } from "@/components/providers/app-language-provider";
import { useAuthSession } from "@/features/dashboard/hooks/use-dashboard-permission";
import { refreshAuthorization } from "@/lib/auth/authorization-refresh";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";

/**
 * "This is a shared display."
 *
 * The exemption from the inactivity timeout, for a screen that is unattended by
 * design - the kitchen board mounted on a wall, which nobody touches for three
 * hours at a stretch because that is it working.
 *
 * IN THE PROFILE DIALOG, NOT IN SETTINGS, and for the same reason the language
 * picker is: Settings is gated on `settings.read`, and the person setting up a
 * kitchen board is a kitchen manager who does not hold it. Putting the one
 * control that stops a board signing itself out mid-service behind an
 * administrator's permission would have made it unreachable by everybody who
 * needs it.
 *
 * PER DEVICE, SET FROM THAT DEVICE. It marks the session this browser is using,
 * which is the only way somebody can actually see which screen they are
 * describing. There is no id here that could name another person's device.
 *
 * Applies on change rather than on the dialog's Save, and says so - the rest of
 * that dialog does not persist anything yet, so hanging this off its button
 * would promise something the button does not do.
 */
export function ProfileSharedDeviceField({
  className = "block rounded-md border border-white/30 px-3 py-2 focus-within:border-white/70",
  labelClassName = "block text-xs text-white"
}: {
  className?: string;
  labelClassName?: string;
}) {
  const { t } = useAppLanguage();
  const fieldId = useId();
  const session = useAuthSession();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  /**
   * Nothing to exempt from. A venue with the timeout turned off would otherwise
   * be offered a switch that changes nothing it can observe.
   */
  if (!session?.inactivity || session.inactivity.timeoutMinutes <= 0) {
    return null;
  }

  const sharedDevice = session.inactivity.sharedDevice;

  const toggle = async (next: boolean) => {
    setIsSaving(true);
    setError("");

    try {
      const response = await authenticatedFetch("/api/me/activity", {
        method: "PATCH",
        body: JSON.stringify({ sharedDevice: next })
      });

      if (!response.ok) throw new Error(t("settings.sharedDeviceFailed"));

      // The flag rides the session, so re-reading it is what makes the
      // inactivity hook stop counting down on this device.
      await refreshAuthorization({ force: true });
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : t("settings.sharedDeviceFailed")
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={className}>
      <label className={labelClassName} htmlFor={fieldId}>
        {t("settings.sharedDevice")}
      </label>
      <div className="mt-1 flex items-start gap-2">
        <input
          checked={sharedDevice}
          className="mt-0.5 h-4 w-4 shrink-0"
          disabled={isSaving}
          id={fieldId}
          name="sharedDevice"
          onChange={(event) => void toggle(event.target.checked)}
          type="checkbox"
        />
        <span className="text-[11px] leading-4 opacity-80">
          {t("settings.sharedDeviceHint")}
        </span>
      </div>
      {error ? (
        <p className="mt-1 text-[11px] font-bold text-[#ffd7d7]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
