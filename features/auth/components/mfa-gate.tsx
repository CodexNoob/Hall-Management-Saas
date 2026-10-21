"use client";

import { MfaChallengeDialog } from "@/features/auth/components/mfa-challenge-dialog";
import { useTotpEnrollment } from "@/features/auth/hooks/use-totp-enrollment";

/**
 * The screen somebody sees instead of the dashboard when they owe a second
 * factor.
 *
 * It exists because the server already refuses them. `resolveUserActor` turns
 * every API call from an `aal1` session on an enrolled account into a 403, so
 * without this the dashboard would render and then fail at every panel with no
 * explanation - the worst possible presentation of a control that is working
 * exactly as intended.
 *
 * TWO DIFFERENT PROBLEMS, which is why `obligation` is not a boolean:
 *
 *   challenge - they have a factor and this session did not use it. There is a
 *               code to enter. Sign-in usually catches this first; what
 *               reaches here is a social sign-in, or a session that was
 *               already open when the factor was added on another device.
 *
 *   enroll    - the organization mandates a factor and this account has none.
 *               There is no code to enter, and asking for one is a dead end.
 *
 * Signing out is offered on both. Somebody who has lost their authenticator
 * needs a way off this screen that is not the back button, and an
 * administrator resetting the factor is a conversation that happens elsewhere.
 */
export function MfaGate({
  obligation,
  onSatisfied,
  onSignOut
}: {
  obligation: "challenge" | "enroll";
  /** Re-reads the session, which is what actually lets the dashboard through. */
  onSatisfied: (accessToken?: string) => void | Promise<void>;
  onSignOut: () => void | Promise<void>;
}) {
  const {
    busy,
    cancel,
    code,
    begin,
    confirmEmail,
    emailCode,
    emailStep,
    enrollment,
    error,
    setCode,
    setEmailCode,
    verify
  } = useTotpEnrollment({
    messages: {
      loadFailed: "Your security settings could not be loaded.",
      setupFailed: "Two-factor authentication could not be set up. Try again.",
      codeRejected: "That code was not accepted. Enter the code your app shows right now.",
      enterSixDigits: "Enter the six-digit code from your authenticator app.",
      emailCodeFailed: "The verification email could not be sent or checked. Try again.",
      enterEmailCode: "Enter the six-digit code from the email.",
      setupExpired:
        "Setup took too long, so it was cancelled to keep your account safe. Start again."
    }
  });

  if (obligation === "challenge") {
    return (
      <main className="min-h-screen bg-[#f5f6f8]">
        <MfaChallengeDialog
          onCancel={onSignOut}
          onVerified={(accessToken) => onSatisfied(accessToken)}
        />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f6f8] p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h1 className="text-lg font-black text-[#172033]">
          Two-factor authentication required
        </h1>
        <p className="mt-1 text-xs leading-5 text-[#64748b]">
          Your organization requires every account to be protected by an
          authenticator app. Set one up to continue.
        </p>

        {!enrollment && !emailStep ? (
          <button
            className="mt-5 inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-[#1f557d] px-4 text-sm font-bold text-white transition hover:bg-[#174362] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy}
            onClick={begin}
            type="button"
          >
            Set up two-factor authentication
          </button>
        ) : !enrollment && emailStep ? (
          // Email first: whoever is on this screen knows the password, which
          // is exactly what a thief would know. Reading the account's inbox is
          // what they would not - and without it, the server removes any
          // authenticator they manage to attach.
          <div className="mt-5 space-y-3">
            <p className="text-xs leading-5 text-[#334155]" role="status">
              Your organization requires 2FA. We sent a verification code to{" "}
              <strong>{emailStep.sentTo}</strong> before showing the
              authenticator setup. It expires in 10 minutes.
            </p>
            <input
              aria-label="Code from the email"
              autoComplete="one-time-code"
              className="min-h-11 w-full rounded-lg border border-[#cbd5e1] px-3 text-center text-lg font-black tracking-[0.4em] outline-none focus:border-[#1f557d] focus:ring-2 focus:ring-[#1f557d]/15"
              inputMode="numeric"
              maxLength={6}
              name="emailVerificationCode"
              onChange={(event) =>
                setEmailCode(event.target.value.replace(/\D/g, ""))
              }
              placeholder="000000"
              value={emailCode}
            />
            <div className="flex gap-2">
              <button
                className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg bg-[#1f557d] px-4 text-sm font-bold text-white transition hover:bg-[#174362] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={busy}
                onClick={() => void confirmEmail()}
                type="button"
              >
                Verify email
              </button>
              <button
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#cbd5e1] px-4 text-sm font-bold text-[#1e293b] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={busy}
                onClick={() => void begin()}
                type="button"
              >
                Send a new code
              </button>
            </div>
          </div>
        ) : enrollment ? (
          <div className="mt-5 space-y-3">
            {/* See the note in mfa-security-panel.tsx: Supabase's QR is a data
                URI of raw SVG, which next/image cannot parse. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="Authenticator QR code"
              className="mx-auto h-45 w-45 rounded-lg border bg-white p-2"
              height={180}
              src={enrollment.qrCode}
              width={180}
            />
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-[#64748b]">
                Manual setup key
              </p>
              <code className="mt-1 block break-all rounded-md bg-[#f8fafc] p-2 text-xs text-[#172033]">
                {enrollment.secret}
              </code>
            </div>
            <input
              aria-label="Authentication code"
              autoComplete="one-time-code"
              className="min-h-11 w-full rounded-lg border border-[#cbd5e1] px-3 text-center text-lg font-black tracking-[0.4em] outline-none focus:border-[#1f557d] focus:ring-2 focus:ring-[#1f557d]/15"
              inputMode="numeric"
              maxLength={6}
              name="authenticatorCode"
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, ""))
              }
              placeholder="000000"
              value={code}
            />
            <div className="flex gap-2">
              <button
                className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg bg-[#1f557d] px-4 text-sm font-bold text-white transition hover:bg-[#174362] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={busy}
                onClick={async () => {
                  // Verifying a factor upgrades this very session to `aal2`, so
                  // there is no new token to hand over and nothing to sign in
                  // again for - the session just became sufficient.
                  if (await verify()) await onSatisfied();
                }}
                type="button"
              >
                Verify and continue
              </button>
              <button
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#cbd5e1] px-4 text-sm font-bold text-[#1e293b] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={busy}
                onClick={cancel}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 text-xs font-bold text-[#b42318]" role="alert">
            {error}
          </p>
        ) : null}

        <button
          className="mt-4 w-full text-center text-xs font-bold text-[#64748b] underline"
          onClick={onSignOut}
          type="button"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
