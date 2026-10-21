"use client";

import { useState } from "react";
import { useAppLanguage } from "@/components/providers/app-language-provider";
import { MfaChallengeDialog } from "@/features/auth/components/mfa-challenge-dialog";
import { useTotpEnrollment } from "@/features/auth/hooks/use-totp-enrollment";

const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-[#cbd5e1] bg-white px-4 py-2 text-sm font-bold text-[#1e293b] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50";
// Its own string rather than colours appended to `buttonClass`. Tailwind does
// not let the later class win - both `bg-white` and `bg-[#1f557d]` end up on
// the element and the stylesheet decides, which drew this button as white text
// on a white background.
const primaryButtonClass =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-[#1f557d] bg-[#1f557d] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#174362] disabled:cursor-not-allowed disabled:opacity-50";

export function MfaSecurityPanel({
  requiredByOrganization = false,
  requiredNote
}: {
  /**
   * The organization mandates a factor. Turning it off would only land the
   * person on the enrolment screen at their next request, so the button is not
   * offered. A courtesy, not the control - the server enforces the policy.
   */
  requiredByOrganization?: boolean;
  requiredNote?: string;
} = {}) {
  const { t } = useAppLanguage();
  const [message, setMessage] = useState("");
  const {
    busy,
    cancel,
    code,
    confirmEmail,
    disable,
    dismissStepUp,
    stepUpRequired,
    begin,
    emailCode,
    emailStep,
    enrollment,
    error,
    isLoading,
    setCode,
    setEmailCode,
    verify,
    verifiedFactorId
  } = useTotpEnrollment({
    // `t` changes identity with the locale, so the messages this hook reaches
    // for follow the language rather than freezing at mount.
    messages: {
      loadFailed: t("settings.mfaLoadFailed"),
      setupFailed: t("settings.mfaSetupFailed"),
      codeRejected: t("settings.mfaCodeRejected"),
      enterSixDigits: t("settings.enterSixDigitCode"),
      emailCodeFailed: t("settings.mfaEmailFailed"),
      enterEmailCode: t("settings.mfaEnterEmailCode"),
      setupExpired: t("settings.mfaSetupExpired")
    }
  });

  return (
    <div className="divide-y divide-[#e6e9ed]">
      {stepUpRequired ? (
        // Signed in on a trusted device without the code; removing the
        // factor needs it now. Cancel only closes this - nothing is signed out.
        <MfaChallengeDialog
          onCancel={dismissStepUp}
          onVerified={async () => {
            dismissStepUp();
            if (await disable()) setMessage(t("settings.mfaDisabled"));
          }}
        />
      ) : null}
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-[#172033]">
                {t("settings.twoFactor")}
              </h3>
              {!isLoading ? (
                <span className={`rounded-full px-2 py-1 text-[10px] font-black ${verifiedFactorId ? "bg-[#edfbf4] text-[#147653]" : "bg-[#f1f5f9] text-[#64748b]"}`}>
                  {verifiedFactorId ? t("settings.enabled") : t("settings.notEnabled")}
                </span>
              ) : null}
            </div>
            <p className="mt-1 max-w-xl text-xs leading-5 text-[#64748b]">
              {t("settings.twoFactorHint")}
            </p>
            {requiredByOrganization && requiredNote ? (
              <p className="mt-1 max-w-xl text-xs font-bold leading-5 text-[#1f557d]">
                {requiredNote}
              </p>
            ) : null}
          </div>
          {!isLoading &&
          !enrollment &&
          !emailStep &&
          !(verifiedFactorId && requiredByOrganization) ? (
            <button
              className={buttonClass}
              disabled={busy}
              onClick={async () => {
                setMessage("");

                if (verifiedFactorId) {
                  if (await disable()) setMessage(t("settings.mfaDisabled"));
                  return;
                }

                await begin();
              }}
              type="button"
            >
              {verifiedFactorId
                ? t("settings.disableMfa")
                : t("settings.setUpMfa")}
            </button>
          ) : null}
        </div>

        {/* Email first. No QR exists until the server has accepted this code:
            a factor enrolled without it is removed (lib/auth/mfa-trust.ts). */}
        {emailStep && !enrollment ? (
          <div className="space-y-3 rounded-xl border border-[#d8e2ee] bg-[#f8fafc] p-4">
            <p className="text-xs leading-5 text-[#334155]" role="status">
              {t("settings.mfaEmailSent", { email: emailStep.sentTo })}
            </p>
            <input
              aria-label={t("settings.mfaEmailCode")}
              autoComplete="one-time-code"
              className="min-h-10 w-full max-w-xs rounded-lg border border-[#cbd5e1] bg-white px-3 text-sm tracking-[0.3em] outline-none focus:border-[#1f557d] focus:ring-2 focus:ring-[#1f557d]/15"
              inputMode="numeric"
              maxLength={6}
              name="emailVerificationCode"
              onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, ""))}
              placeholder={t("settings.mfaEmailCode")}
              value={emailCode}
            />
            <div className="flex flex-wrap gap-2">
              <button
                className={primaryButtonClass}
                disabled={busy}
                onClick={() => void confirmEmail()}
                type="button"
              >
                {t("settings.mfaEmailVerify")}
              </button>
              <button
                className={buttonClass}
                disabled={busy}
                onClick={() => void begin()}
                type="button"
              >
                {t("settings.mfaEmailResend")}
              </button>
              <button className={buttonClass} disabled={busy} onClick={cancel} type="button">
                {t("common.cancel")}
              </button>
            </div>
          </div>
        ) : null}

        {enrollment ? (
          <div className="grid gap-5 rounded-xl border border-[#d8e2ee] bg-[#f8fafc] p-4 sm:grid-cols-[180px_1fr]">
            {/* A plain <img>, not next/image, and deliberately so. Supabase
                returns the QR as a data URI holding raw unencoded SVG; the
                Image component parses `src` as a URL and throws on it, which
                `unoptimized` does not prevent because the failure is in
                parsing rather than in optimising. There is also nothing for an
                optimiser to do here - the bytes are already inline, already
                vector, and never leave the page. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={t("settings.authenticatorQr")}
              className="h-45 w-45 rounded-lg border bg-white p-2"
              height={180}
              src={enrollment.qrCode}
              width={180}
            />
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-black text-[#172033]">{t("settings.scanAndVerify")}</h4>
                <p className="mt-1 text-xs leading-5 text-[#64748b]">
                  {t("settings.scanQrHint")}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-[#64748b]">
                  {t("settings.manualSetupKey")}
                </p>
                <code className="mt-1 block break-all rounded-md bg-white p-2 text-xs text-[#172033]">
                  {enrollment.secret}
                </code>
              </div>
              <input
                aria-label={t("settings.authCode")}
                autoComplete="one-time-code"
                className="min-h-10 w-full rounded-lg border border-[#cbd5e1] bg-white px-3 text-sm outline-none focus:border-[#1f557d] focus:ring-2 focus:ring-[#1f557d]/15"
                inputMode="numeric"
                maxLength={6}
                name="authenticatorCode"
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                placeholder={t("settings.sixDigitCode")}
                value={code}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  className={primaryButtonClass}
                  disabled={busy}
                  onClick={async () => {
                    if (await verify()) setMessage(t("settings.mfaEnabled"));
                  }}
                  type="button"
                >
                  {t("settings.verifyAndEnable")}
                </button>
                <button className={buttonClass} disabled={busy} onClick={cancel} type="button">
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Signing out other sessions used to live here as well. It moved to
          `OtherSessionsPanel`, which sits directly below this on the Security
          screen and does the same job properly: server-side through
          `DELETE /api/me/sessions`, so the act is audited, behind a
          confirmation because it is felt on devices the person cannot see, and
          marking the session rows so the list beside it stops showing devices
          that can no longer renew. Two buttons doing the same thing on one
          screen is worse than either. */}
      {error || message ? (
        <p className={`px-4 py-3 text-xs font-bold sm:px-5 ${error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`} role="status">
          {error || message}
        </p>
      ) : null}
    </div>
  );
}
