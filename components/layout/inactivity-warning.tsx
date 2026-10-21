"use client";

import { useAppLanguage } from "@/components/providers/app-language-provider";
import { useInactivityTimeout } from "@/features/dashboard/hooks/use-inactivity-timeout";

/**
 * "You will be signed out in 40 seconds."
 *
 * THE MOST IMPORTANT PART OF THE WHOLE FEATURE, and the reason it will survive
 * contact with staff. A timeout that signs somebody out with no notice is one
 * they experience as the application breaking; a timeout that says so and
 * offers a button is one they dismiss in a second and forget about.
 *
 * Rendered by the dashboard layout, so it is above every screen and cannot be
 * missed behind a drawer. It draws nothing at all until the warning window, so
 * the ordinary case costs one interval tick a second and no markup.
 *
 * Not a `ConfirmDialog`: that one closes on Escape and on a backdrop click,
 * both of which would look like "stay signed in" and do the opposite.
 */
export function InactivityWarning({ onExpired }: { onExpired: () => void }) {
  const { t } = useAppLanguage();
  const { isWarning, secondsRemaining, staySignedIn } = useInactivityTimeout({
    onExpired
  });

  if (!isWarning || secondsRemaining === null) return null;

  return (
    <div
      aria-live="assertive"
      aria-modal="true"
      className="fixed inset-0 z-200 flex items-center justify-center bg-[#0f172a]/50 p-4"
      role="alertdialog"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
        <h2 className="text-base font-black text-[#172033]">
          {t("settings.inactivityWarningTitle")}
        </h2>
        <p className="mt-2 text-xs leading-5 text-[#64748b]">
          {t("settings.inactivityWarningBody", {
            seconds: String(secondsRemaining)
          })}
        </p>

        <button
          autoFocus
          className="mt-5 inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-[#1f557d] px-4 text-sm font-bold text-white transition hover:bg-[#174362]"
          onClick={staySignedIn}
          type="button"
        >
          {t("settings.inactivityStaySignedIn")}
        </button>
      </div>
    </div>
  );
}
