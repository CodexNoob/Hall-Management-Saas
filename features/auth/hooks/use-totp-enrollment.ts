"use client";

import { useCallback, useEffect, useState } from "react";

import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type TotpEnrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

type TotpFactor = {
  id: string;
  status: string;
  factor_type?: string;
};

const TOTP_FRIENDLY_NAME = "Event Core Authenticator";

function isFactor(factor: unknown): factor is TotpFactor {
  return (
    factor !== null &&
    typeof factor === "object" &&
    typeof (factor as { id?: unknown }).id === "string" &&
    typeof (factor as { status?: unknown }).status === "string"
  );
}

/**
 * Every TOTP factor on the account, VERIFIED OR NOT.
 *
 * `all` first, and that order is the fix for a lock-out. Supabase's
 * `listFactors()` fills `totp` with VERIFIED factors only - an abandoned,
 * unverified attempt appears in `all` and nowhere else. Reading `totp` meant
 * the clean-up in `begin` never saw the leftover factor, so it was never
 * removed, and every later attempt was refused with "a factor with the
 * friendly name ... already exists".
 *
 * `totp` stays as the fallback for a payload that carries no `all`.
 */
function totpFactors(data: unknown): TotpFactor[] {
  if (!data || typeof data !== "object") return [];

  const payload = data as { totp?: unknown; all?: unknown };

  if (Array.isArray(payload.all)) {
    return payload.all.filter(
      (factor): factor is TotpFactor =>
        isFactor(factor) &&
        ((factor as { factor_type?: unknown }).factor_type === "totp" ||
          (factor as { factor_type?: unknown }).factor_type === undefined)
    );
  }

  return Array.isArray(payload.totp) ? payload.totp.filter(isFactor) : [];
}

function isDuplicateFriendlyNameError(error: unknown) {
  return (
    error instanceof Error &&
    error.message
      .toLowerCase()
      .includes("factor with the friendly name")
  );
}

/** The first, email half of setting up: where the code went, and when another may be sent. */
export type EmailStep = {
  sentTo: string;
  resendAvailableAt: string;
};

type MfaSyncResponse = { trusted?: boolean; removedUntrusted?: number };

async function readApiError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as {
    error?: unknown;
  } | null;

  // Our own routes' copy is written for people; anything else is not shown.
  return typeof payload?.error === "string" ? payload.error : fallback;
}

/**
 * Setting up an authenticator app, in the two places that do it.
 *
 * The Security panel and the gate that holds somebody out of the dashboard run
 * the identical three Supabase calls - `enroll`, `challengeAndVerify`,
 * `unenroll` - and differ only in their framing and in what they do once it is
 * done. Two copies of that would be two things to keep in step, and one of
 * them would eventually miss the call that tells the server (see
 * `reportChange` below), which is the copy that silently stops enforcing.
 *
 * THE SECRET NEVER LEAVES THE BROWSER. `enroll` returns a TOTP secret and a QR
 * code; both go straight to the screen and neither is ever posted anywhere.
 * Only Supabase can verify a code, and only Supabase stores the secret.
 *
 * EMAIL FIRST. `begin` no longer enrolls: it asks the server to email a code
 * to the account, and `confirmEmail` - once the server accepts that code -
 * enrolls and shows the QR. The server only TRUSTS a factor enrolled while the
 * resulting grant is live (lib/auth/mfa-trust.ts), so this order is not
 * decoration: a factor enrolled any other way is removed. The UI simply
 * follows the path the server will accept.
 *
 * NO RAW PROVIDER ERRORS. Supabase's wording ("Invalid TOTP code entered")
 * is replaced with the screen's own messages.
 */
export function useTotpEnrollment(options: {
  /** Ran after a factor is verified or removed, once the server has been told. */
  onChanged?: () => void | Promise<void>;
  /** Copy differs per screen, so the messages are passed in. */
  messages: {
    loadFailed: string;
    setupFailed: string;
    codeRejected: string;
    enterSixDigits: string;
    /** Sending or checking the email code failed for a reason the server did not explain. */
    emailCodeFailed?: string;
    /** "Enter the 6-digit code from the email" - distinct from the app's code. */
    enterEmailCode?: string;
    /** The factor was not trusted - the grant had expired. */
    setupExpired?: string;
  };
}) {
  const { onChanged, messages } = options;
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [emailStep, setEmailStep] = useState<EmailStep | null>(null);
  const [emailCode, setEmailCode] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  /**
   * Removing the factor needs this session to have entered it first. A sign-in
   * on a trusted device can skip the code (lib/auth/device-trust-policy.ts),
   * which leaves the session at `aal1` - and Supabase refuses to unenroll a
   * verified factor from `aal1`. The screen asks for the code, then retries.
   */
  const [stepUpRequired, setStepUpRequired] = useState(false);

  /**
   * Tell the server to go and re-read the factor list.
   *
   * Enrolment happens entirely between this browser and Supabase, so nothing
   * on our side knows it occurred. `users.mfa_enrolled_at` is what every
   * request consults to decide whether this person owes a second factor, and
   * the session sync only refreshes it on a cold load - so without this,
   * turning 2FA on would do nothing until the client cache lapsed.
   *
   * The request carries no claim about what changed. The route asks Supabase
   * with the caller's own token; a browser is not evidence about its own
   * privileges.
   *
   * Failure is swallowed. The factor is already enrolled or already gone at
   * this point, and the sync will catch up - reporting "that did not work"
   * over a change that did is the wrong answer.
   */
  const reportChange = useCallback(async (): Promise<MfaSyncResponse | null> => {
    try {
      const response = await authenticatedFetch("/api/me/mfa", { method: "POST" });

      return response.ok ? ((await response.json()) as MfaSyncResponse) : null;
    } catch {
      return null;
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      // The server first: it removes any factor it does not trust, so the
      // list read next never shows somebody else's authenticator as theirs.
      const sync = await reportChange();
      const supabase = createSupabaseBrowserClient();
      const { data, error: factorsError } = await supabase.auth.mfa.listFactors();

      if (factorsError) throw factorsError;

      const verified =
        totpFactors(data).find((factor) => factor.status === "verified")?.id ??
        null;

      // Supabase says verified; only call it "enabled" if the server agrees
      // it is trusted. A null sync (offline) falls back to Supabase's word.
      setVerifiedFactorId(sync && sync.trusted === false ? null : verified);
    } catch {
      setError(messages.loadFailed);
    } finally {
      setIsLoading(false);
    }
  }, [messages.loadFailed, reportChange]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * Step one of setting up: email a code to the account. Also "resend".
   *
   * Nothing is enrolled here and no QR exists yet - that waits for
   * `confirmEmail`.
   */
  const begin = async () => {
    setBusy(true);
    setError("");

    try {
      const response = await authenticatedFetch("/api/me/security-code/send", {
        method: "POST",
        body: JSON.stringify({ purpose: "MFA_ENROLLMENT" })
      });

      if (!response.ok) {
        throw new Error(
          await readApiError(response, messages.emailCodeFailed ?? messages.setupFailed)
        );
      }

      setEmailStep((await response.json()) as EmailStep);
      setEmailCode("");
    } catch (sendError) {
      setError(
        sendError instanceof Error ? sendError.message : messages.setupFailed
      );
    } finally {
      setBusy(false);
    }
  };

  /**
   * Step two: the code from the email. Accepted, it becomes this session's
   * enrollment grant on the server - and only then is the authenticator
   * enrolled and its QR shown.
   */
  const confirmEmail = async () => {
    if (!/^\d{6}$/.test(emailCode.trim())) {
      setError(messages.enterEmailCode ?? messages.enterSixDigits);
      return false;
    }

    setBusy(true);
    setError("");

    try {
      const response = await authenticatedFetch("/api/me/security-code/verify", {
        method: "POST",
        body: JSON.stringify({ purpose: "MFA_ENROLLMENT", code: emailCode.trim() })
      });

      if (!response.ok) {
        throw new Error(
          await readApiError(response, messages.emailCodeFailed ?? messages.setupFailed)
        );
      }
    } catch (verifyError) {
      setError(
        verifyError instanceof Error ? verifyError.message : messages.setupFailed
      );
      setBusy(false);

      return false;
    }

    setEmailStep(null);
    setEmailCode("");
    // `enrollFactor` manages `busy` from here.
    return enrollFactor();
  };

  /** Step three, internal: create the factor and show its QR. */
  const enrollFactor = async () => {
    setBusy(true);
    setError("");

    try {
      const supabase = createSupabaseBrowserClient();

      /**
       * Clear out any half-finished attempt before starting a new one.
       *
       * `enroll` creates the factor row immediately and leaves it unverified
       * until the first code is accepted - so closing the tab, reloading, or
       * simply walking away leaves one behind. Supabase then refuses the next
       * attempt with "a factor with the friendly name ... already exists", and
       * the only way out was deleting the row in the Supabase dashboard. The
       * person is locked out of setting up 2FA by their own abandoned attempt.
       *
       * Only UNVERIFIED factors are removed, and that distinction is the whole
       * safety of this: a verified factor is the one protecting the account,
       * and deleting it here - silently, as a side effect of pressing "Set
       * up" - would turn a mis-click into a downgrade.
       */
      const { data: existing, error: existingError } =
        await supabase.auth.mfa.listFactors();

      if (existingError) throw existingError;

      const existingFactors = totpFactors(existing);
      const verified = existingFactors.find(
        (factor) => factor.status === "verified"
      );

      if (verified) {
        setVerifiedFactorId(verified.id);
        setEnrollment(null);
        setError("");
        return false;
      }

      for (const stale of existingFactors) {
        if (stale.status !== "verified") {
          await supabase.auth.mfa.unenroll({ factorId: stale.id });
        }
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: TOTP_FRIENDLY_NAME
      });

      if (enrollError) {
        if (isDuplicateFriendlyNameError(enrollError)) {
          await refresh();
        }

        throw enrollError;
      }

      setEnrollment({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret
      });

      return true;
    } catch {
      setError(messages.setupFailed);

      return false;
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!enrollment || !/^\d{6}$/.test(code.trim())) {
      setError(messages.enterSixDigits);
      return false;
    }

    setBusy(true);
    setError("");

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrollment.factorId,
        code: code.trim()
      });

      if (verifyError) {
        // Supabase's "Invalid TOTP code entered" means exactly this.
        setError(messages.codeRejected);
        return false;
      }

      setEnrollment(null);
      setCode("");
      const sync = await reportChange();

      // Verified at Supabase but NOT trusted by the server: the grant ran out
      // while the QR was on screen, so the server removed the factor. Say so
      // plainly rather than claiming 2FA is on.
      if (sync && sync.trusted === false) {
        // Refresh FIRST: it clears `error` as it starts, and the point here
        // is the message.
        await refresh();
        setError(messages.setupExpired ?? messages.setupFailed);

        return false;
      }

      await refresh();
      await onChanged?.();

      return true;
    } catch {
      setError(messages.codeRejected);

      return false;
    } finally {
      setBusy(false);
    }
  };

  /**
   * Abandons a half-finished setup - at the email step, or with a QR on
   * screen whose factor exists but was never verified.
   */
  const cancel = async () => {
    setEmailStep(null);
    setEmailCode("");

    if (!enrollment) return;

    setBusy(true);
    setError("");

    const supabase = createSupabaseBrowserClient();
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({
      factorId: enrollment.factorId
    });

    if (unenrollError) setError(messages.setupFailed);
    else {
      setEnrollment(null);
      setCode("");
    }

    setBusy(false);
  };

  /** Removes a factor that was fully set up. */
  const disable = async () => {
    if (!verifiedFactorId) return false;

    setBusy(true);
    setError("");

    const supabase = createSupabaseBrowserClient();
    const currentLevel = await supabase.auth.mfa
      .getAuthenticatorAssuranceLevel()
      .then(({ data }) => data?.currentLevel ?? null)
      .catch(() => null);

    if (currentLevel !== "aal2") {
      setStepUpRequired(true);
      setBusy(false);

      return false;
    }

    const { error: unenrollError } = await supabase.auth.mfa.unenroll({
      factorId: verifiedFactorId
    });

    if (unenrollError) {
      setError(messages.setupFailed);
      setBusy(false);

      return false;
    }

    // `refresh` reports to the server BEFORE reading the list, and that is
    // the direction that matters: a mirror still reading "enrolled" would keep
    // demanding a code this account can no longer produce.
    await refresh();
    await onChanged?.();
    setBusy(false);

    return true;
  };

  return {
    busy,
    cancel,
    code,
    confirmEmail,
    disable,
    dismissStepUp: () => setStepUpRequired(false),
    stepUpRequired,
    begin,
    emailCode,
    emailStep,
    enrollment,
    error,
    isLoading,
    setCode,
    setEmailCode,
    setError,
    verify,
    verifiedFactorId
  };
}
