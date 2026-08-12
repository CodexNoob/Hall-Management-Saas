"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Enrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-[#cbd5e1] bg-white px-4 py-2 text-sm font-bold text-[#1e293b] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50";

export function MfaSecurityPanel() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      const verified = data.totp.find((factor) => factor.status === "verified");
      setVerifiedFactorId(verified?.id ?? null);
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "Unable to load security settings."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const beginEnrollment = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Event Core Authenticator"
      });
      if (enrollError) throw enrollError;
      setEnrollment({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret
      });
    } catch (enrollError) {
      setError(
        enrollError instanceof Error
          ? enrollError.message
          : "Unable to start two-factor authentication setup."
      );
    } finally {
      setBusy(false);
    }
  };

  const verifyEnrollment = async () => {
    if (!enrollment || !/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrollment.factorId,
        code: code.trim()
      });
      if (verifyError) throw verifyError;
      setEnrollment(null);
      setCode("");
      setMessage("Two-factor authentication is now enabled.");
      await loadStatus();
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : "The verification code could not be accepted."
      );
    } finally {
      setBusy(false);
    }
  };

  const cancelEnrollment = async () => {
    if (!enrollment) return;
    setBusy(true);
    setError("");
    const supabase = createSupabaseBrowserClient();
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({
      factorId: enrollment.factorId
    });
    if (unenrollError) setError(unenrollError.message);
    else {
      setEnrollment(null);
      setCode("");
    }
    setBusy(false);
  };

  const disableMfa = async () => {
    if (!verifiedFactorId) return;
    setBusy(true);
    setError("");
    setMessage("");
    const supabase = createSupabaseBrowserClient();
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({
      factorId: verifiedFactorId
    });
    if (unenrollError) setError(unenrollError.message);
    else {
      setMessage("Two-factor authentication has been disabled.");
      await loadStatus();
    }
    setBusy(false);
  };

  const signOutOtherSessions = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    const supabase = createSupabaseBrowserClient();
    const { error: signOutError } = await supabase.auth.signOut({ scope: "others" });
    if (signOutError) setError(signOutError.message);
    else setMessage("All other sessions have been signed out.");
    setBusy(false);
  };

  return (
    <div className="divide-y divide-[#e6e9ed]">
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-[#172033]">
                Two-factor authentication
              </h3>
              {!loading ? (
                <span className={`rounded-full px-2 py-1 text-[10px] font-black ${verifiedFactorId ? "bg-[#edfbf4] text-[#147653]" : "bg-[#f1f5f9] text-[#64748b]"}`}>
                  {verifiedFactorId ? "Enabled" : "Not enabled"}
                </span>
              ) : null}
            </div>
            <p className="mt-1 max-w-xl text-xs leading-5 text-[#64748b]">
              Require a rotating code from an authenticator app when signing in.
            </p>
          </div>
          {!loading && !enrollment ? (
            <button
              className={buttonClass}
              disabled={busy}
              onClick={verifiedFactorId ? disableMfa : beginEnrollment}
              type="button"
            >
              {verifiedFactorId ? "Disable MFA" : "Set up MFA"}
            </button>
          ) : null}
        </div>

        {enrollment ? (
          <div className="grid gap-5 rounded-xl border border-[#d8e2ee] bg-[#f8fafc] p-4 sm:grid-cols-[180px_1fr]">
            <Image
              alt="Authenticator QR code"
              className="h-45 w-45 rounded-lg border bg-white p-2"
              height={180}
              src={enrollment.qrCode}
              unoptimized
              width={180}
            />
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-black text-[#172033]">Scan and verify</h4>
                <p className="mt-1 text-xs leading-5 text-[#64748b]">
                  Scan this QR code with your authenticator app, then enter its 6-digit code.
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-[#64748b]">
                  Manual setup key
                </p>
                <code className="mt-1 block break-all rounded-md bg-white p-2 text-xs text-[#172033]">
                  {enrollment.secret}
                </code>
              </div>
              <input
                aria-label="Authenticator verification code"
                autoComplete="one-time-code"
                className="min-h-10 w-full rounded-lg border border-[#cbd5e1] bg-white px-3 text-sm outline-none focus:border-[#1f557d] focus:ring-2 focus:ring-[#1f557d]/15"
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                placeholder="6-digit code"
                value={code}
              />
              <div className="flex flex-wrap gap-2">
                <button className={`${buttonClass} border-[#1f557d] bg-[#1f557d] text-white hover:bg-[#174362]`} disabled={busy} onClick={verifyEnrollment} type="button">
                  Verify and enable
                </button>
                <button className={buttonClass} disabled={busy} onClick={cancelEnrollment} type="button">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h3 className="text-sm font-black text-[#172033]">Other active sessions</h3>
          <p className="mt-1 text-xs leading-5 text-[#64748b]">
            Revoke every login except the session on this device.
          </p>
        </div>
        <button className={buttonClass} disabled={busy} onClick={signOutOtherSessions} type="button">
          Sign out other sessions
        </button>
      </div>

      {error || message ? (
        <p className={`px-4 py-3 text-xs font-bold sm:px-5 ${error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`} role="status">
          {error || message}
        </p>
      ) : null}
    </div>
  );
}
