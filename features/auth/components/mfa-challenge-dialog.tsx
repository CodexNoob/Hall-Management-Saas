"use client";

import { FormEvent, useId, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * The second step of signing in, for an account that has a factor.
 *
 * WHAT THIS IS AND IS NOT. It is the convenience: it puts the challenge in
 * front of somebody at the moment they expect it, and it keeps the session
 * they already have rather than making them start again. It is NOT the
 * control. `signInWithPassword` has already minted a valid session by the time
 * this renders - at `aal1` - and a dialog is not something an API client has
 * to agree to. The control is `resolveUserActor` in lib/authz/authorize.ts,
 * which refuses an `aal1` request from an enrolled account no matter what the
 * browser did or did not show.
 *
 * Closing it signs the half-session out. Leaving an `aal1` session alive in
 * the browser is the state that reads as "signed in and everything is broken":
 * proxy.ts sends anyone holding a session away from /login, so the next reload
 * would land on a dashboard that refuses every request with no way back.
 */
export function MfaChallengeDialog({
  onCancel,
  onVerified
}: {
  onCancel: () => void;
  /** Handed the upgraded access token, so the caller need not re-read it. */
  onVerified: (accessToken: string) => void | Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  // The dialog's accessible name. Without it a screen reader announces an
  // unnamed dialog, and nothing - assistive tech or a test - can find it by
  // its title.
  const titleId = useId();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = code.trim();

    if (!/^\d{6}$/.test(trimmed)) {
      setError("Enter the six-digit code from your authenticator app.");
      return;
    }

    setIsVerifying(true);
    setError("");
    let signInCompleted = false;

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: factors, error: factorsError } =
        await supabase.auth.mfa.listFactors();

      if (factorsError) {
        throw new Error("Your sign-in could not be checked. Try again.");
      }

      const factor = factors.totp.find((item) => item.status === "verified");

      if (!factor) {
        // Nothing to challenge against. The account had a factor a moment ago
        // or this dialog would not be open, so it was removed mid-sign-in -
        // rare, but the alternative is a spinner that never resolves.
        throw new Error(
          "No authenticator app is set up on this account any more. Sign in again."
        );
      }

      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify(
        { factorId: factor.id, code: trimmed }
      );

      // Supabase's own wording ("Invalid TOTP code entered") is not shown.
      if (verifyError) {
        throw new Error(
          "That code didn't match. Enter the code your authenticator app shows right now."
        );
      }

      // Re-read rather than reusing the token from sign-in: the whole point of
      // the step just completed is that the session now carries `aal2`, and
      // that is a different token.
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (!accessToken) {
        throw new Error("Your session could not be read. Sign in again.");
      }

      await onVerified(accessToken);
      signInCompleted = true;
    } catch (challengeError) {
      setError(
        challengeError instanceof Error
          ? challengeError.message
          : "That code was not accepted. Try the next one your app shows."
      );
      setCode("");
    } finally {
      // Keep the loading state in place while the parent syncs the upgraded
      // session and navigates away. Re-enabling this dialog would let another
      // sign-in replace the just-verified session with an aal1 session.
      if (!signInCompleted) setIsVerifying(false);
    }
  };

  return (
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/45 p-4"
      role="dialog"
    >
      <form
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
        onSubmit={submit}
      >
        <h2 className="text-base font-black text-[#172033]" id={titleId}>
          Two-factor authentication
        </h2>
        <p className="mt-1 text-xs leading-5 text-[#64748b]">
          Enter the six-digit code from your authenticator app to finish
          signing in.
        </p>

        <input
          aria-label="Authentication code"
          autoComplete="one-time-code"
          autoFocus
          className="mt-4 min-h-11 w-full rounded-lg border border-[#cbd5e1] px-3 text-center text-lg font-black tracking-[0.4em] outline-none focus:border-[#1f557d] focus:ring-2 focus:ring-[#1f557d]/15"
          inputMode="numeric"
          maxLength={6}
          name="authenticatorCode"
          onChange={(event) => {
            setCode(event.target.value.replace(/\D/g, ""));
            setError("");
          }}
          placeholder="000000"
          value={code}
        />

        {error ? (
          <p className="mt-2 text-xs font-bold text-[#b42318]" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex gap-2">
          <button
            className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg bg-[#1f557d] px-4 text-sm font-bold text-white transition hover:bg-[#174362] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isVerifying}
            type="submit"
          >
            {isVerifying ? "Verifying..." : "Verify"}
          </button>
          <button
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#cbd5e1] px-4 text-sm font-bold text-[#1e293b] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isVerifying}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
