"use client";

import { useState } from "react";

import { useAppLanguage } from "@/components/providers/app-language-provider";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";

type ResetResult = {
  emailSent: boolean;
  link: string | null;
  emailError: string | null;
};

/**
 * "Send password reset" for somebody who cannot help themselves - they forgot
 * their password and cannot reach the email the self-service link goes to.
 *
 * Two ways to deliver it: email, or a link the administrator passes on by hand.
 * Either way the person picks their own password; the administrator never sees
 * or sets one.
 *
 * A COURTESY, NOT THE CONTROL. `staff.update` and the rank ceiling are decided
 * server-side; the parent only renders this for somebody who holds the key.
 */
export function StaffPasswordResetPanel({
  principalId,
  staffName,
  staffEmail
}: {
  principalId: string;
  staffName: string;
  staffEmail: string;
}) {
  const { t } = useAppLanguage();
  const [pending, setPending] = useState<"email" | "link" | null>(null);
  const [result, setResult] = useState<ResetResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const issue = async (delivery: "email" | "link") => {
    setPending(delivery);
    setResult(null);
    setError("");
    setCopied(false);

    try {
      const response = await authenticatedFetch(
        `/api/staff/${principalId}/password-reset`,
        { method: "POST", body: JSON.stringify({ delivery }) }
      );
      const payload = (await response.json().catch(() => null)) as
        | (ResetResult & { error?: string })
        | null;

      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? t("staff.resetFailed"));
      }

      setResult(payload);
    } catch (issueError) {
      setError(issueError instanceof Error ? issueError.message : t("staff.resetFailed"));
    } finally {
      setPending(null);
    }
  };

  const copy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // The field below is selectable, so a blocked clipboard still leaves a
      // way to copy it by hand.
    }
  };

  const buttonClass =
    "inline-flex h-8 items-center rounded-lg border border-[#c7d0dc] px-3 text-[11px] font-black text-[#233144] transition hover:bg-[#eef4fa] disabled:opacity-50";

  return (
    <section className="rounded-lg border border-[#d8dde5] p-3">
      <h3 className="text-xs font-black uppercase tracking-[0.08em] text-[#6a7483]">
        {t("staff.passwordReset")}
      </h3>
      <p className="mt-1 text-[10px] leading-4 text-[#6a7483]">
        {t("staff.passwordResetHint", { name: staffName })}
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          className={buttonClass}
          disabled={pending !== null}
          onClick={() => void issue("email")}
          type="button"
        >
          {t("staff.emailResetLink")}
        </button>
        <button
          className={buttonClass}
          disabled={pending !== null}
          onClick={() => void issue("link")}
          type="button"
        >
          {t("staff.getResetLink")}
        </button>
      </div>

      {error ? (
        <p className="mt-2 text-[11px] font-bold text-[#b42318]" role="alert">
          {error}
        </p>
      ) : null}

      {result?.emailSent ? (
        <p className="mt-2 text-[11px] font-bold text-[#147653]" role="status">
          {t("staff.resetEmailed", { email: staffEmail })}
        </p>
      ) : null}

      {result?.link ? (
        <div className="mt-2 space-y-1.5">
          <p className="text-[11px] font-bold text-[#233144]" role="status">
            {result.emailError
              ? t("staff.resetEmailFailedLink")
              : t("staff.resetLinkReady", { name: staffName })}
          </p>
          <div className="flex gap-2">
            <input
              aria-label={t("common.copyLink")}
              className="h-8 min-w-0 flex-1 rounded-lg border border-[#c7d0dc] bg-[#f5f6f8] px-2 text-[11px]"
              onFocus={(event) => event.currentTarget.select()}
              readOnly
              value={result.link}
            />
            <button
              className={buttonClass}
              onClick={() => void copy(result.link as string)}
              type="button"
            >
              {copied ? t("staff.linkCopied") : t("common.copyLink")}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
