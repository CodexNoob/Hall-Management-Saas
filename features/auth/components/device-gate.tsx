"use client";

import { useEffect, useState } from "react";

import { useAppLanguage } from "@/components/providers/app-language-provider";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";

/**
 * The screen somebody sees INSTEAD of the dashboard while this browser is not
 * a confirmed device of theirs.
 *
 * The third gate, after the password and the second factor. Nothing of the
 * dashboard is rendered behind it - no sidebar, no page, no data requests -
 * and the server refuses dashboard data from this browser on its own authority
 * (`device_confirmation_required`), so this screen is the explanation, not the
 * lock.
 *
 * The code was emailed when the second factor was cleared (once per sign-in).
 * "Resend" asks for another, with the server's cooldown shown as a countdown.
 */
export function DeviceGate({
  pendingConfirmation,
  onConfirmed,
  onSignOut
}: {
  /** A code has already been emailed for this sign-in. */
  pendingConfirmation: boolean;
  /** Re-reads the session - which is what actually lets the dashboard through. */
  onConfirmed: () => void | Promise<void>;
  onSignOut: () => void | Promise<void>;
}) {
  const { t } = useAppLanguage();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(pendingConfirmation);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Ticks only while a cooldown is running.
  useEffect(() => {
    if (!resendAt) return;

    const timer = window.setInterval(() => setNow(Date.now()), 1_000);

    return () => window.clearInterval(timer);
  }, [resendAt]);

  const secondsLeft = resendAt ? Math.max(0, Math.ceil((resendAt - now) / 1_000)) : 0;

  const readError = async (response: Response) => {
    const payload = (await response.json().catch(() => null)) as {
      error?: unknown;
      resendAvailableAt?: unknown;
    } | null;

    if (typeof payload?.resendAvailableAt === "string") {
      setResendAt(new Date(payload.resendAvailableAt).getTime());
    }

    return typeof payload?.error === "string" ? payload.error : t("account.deviceFailed");
  };

  const resend = async () => {
    setBusy(true);
    setError("");

    try {
      const response = await authenticatedFetch("/api/me/devices/resend", { method: "POST" });

      if (!response.ok) throw new Error(await readError(response));

      const payload = (await response.json()) as { resendAvailableAt?: string };

      setSent(true);
      if (payload.resendAvailableAt) {
        setResendAt(new Date(payload.resendAvailableAt).getTime());
      }
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : t("account.deviceFailed"));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError(t("settings.mfaEnterEmailCode"));
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response = await authenticatedFetch("/api/me/devices/confirm", {
        method: "POST",
        body: JSON.stringify({ code })
      });

      if (!response.ok) throw new Error(await readError(response));

      setConfirmed(true);
      await onConfirmed();
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : t("account.deviceFailed"));
      setBusy(false);
    }
  };

  const primary =
    "inline-flex min-h-10 flex-1 items-center justify-center rounded-lg bg-[#1f557d] px-4 text-sm font-bold text-white transition hover:bg-[#174362] disabled:cursor-not-allowed disabled:opacity-50";
  const secondary =
    "inline-flex min-h-10 items-center justify-center rounded-lg border border-[#cbd5e1] px-4 text-sm font-bold text-[#1e293b] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f6f8] p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h1 className="text-lg font-black text-[#172033]">
          {t("account.deviceBannerTitle")}
        </h1>
        <p className="mt-1 text-sm leading-6 text-[#475467]">{t("account.deviceGateIntro")}</p>

        {confirmed ? (
          <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-700" role="status">
            {t("account.deviceConfirmed")}
          </p>
        ) : sent ? (
          <div className="mt-4 space-y-3">
            <p className="text-xs leading-5 text-[#334155]" role="status">
              {t("account.deviceBannerSent")}
            </p>
            <input
              aria-label={t("account.deviceCodeLabel")}
              autoComplete="one-time-code"
              className="min-h-11 w-full rounded-lg border border-[#cbd5e1] px-3 text-center text-lg font-black tracking-[0.4em] outline-none focus:border-[#1f557d] focus:ring-2 focus:ring-[#1f557d]/15"
              inputMode="numeric"
              maxLength={6}
              name="deviceConfirmationCode"
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              value={code}
            />
            <div className="flex gap-2">
              <button className={primary} disabled={busy} onClick={() => void confirm()} type="button">
                {t("account.deviceConfirm")}
              </button>
              <button
                className={secondary}
                disabled={busy || secondsLeft > 0}
                onClick={() => void resend()}
                type="button"
              >
                {secondsLeft > 0
                  ? t("account.deviceResendIn", { seconds: secondsLeft })
                  : t("account.deviceResend")}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-xs leading-5 text-[#334155]">{t("account.deviceBannerUnconfirmed")}</p>
            <button
              className={`${primary} w-full`}
              disabled={busy || secondsLeft > 0}
              onClick={() => void resend()}
              type="button"
            >
              {secondsLeft > 0
                ? t("account.deviceResendIn", { seconds: secondsLeft })
                : t("account.deviceSendCode")}
            </button>
          </div>
        )}

        {error ? (
          <p className="mt-3 text-xs font-bold text-[#b42318]" role="alert">
            {error}
          </p>
        ) : null}

        <p className="mt-4 rounded-lg bg-[#fff8eb] p-3 text-xs font-bold leading-5 text-[#8a5a00]">
          {t("account.deviceGateNotYou")}
        </p>

        <button
          className="mt-4 w-full text-center text-xs font-bold text-[#64748b] underline"
          onClick={() => void onSignOut()}
          type="button"
        >
          {t("account.deviceSignOut")}
        </button>
      </div>
    </main>
  );
}
