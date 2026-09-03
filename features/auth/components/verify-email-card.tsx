"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { getSignUpErrorMessage } from "@/lib/auth/auth-error-messages";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  AuthBrandPanel,
  AuthMobileLogo,
  AuthShell
} from "@/features/auth/components/auth-shell";
import {
  EmailIcon,
  SendIcon,
  ShieldIcon
} from "@/features/auth/components/auth-icons";

// Supabase throttles confirmation sends per address, so the button stays disabled
// long enough that a second press cannot trip that cooldown. It does nothing for
// the project-wide hourly quota, which a resend can still exhaust - that failure
// gets its own copy in auth-error-messages.ts rather than a "wait a minute" the
// button has already waited out.
const RESEND_COOLDOWN_SECONDS = 60;

/** Sits on the navy brand panel, so its plate is white and its accents light. */
function InboxIllustration() {
  return (
    <div className="relative mt-10 min-h-75 lg:mt-12">
      <div className="absolute bottom-0 left-4 h-44 w-44 rounded-full bg-[#E7E3DA]/65 blur-3xl" />
      <div className="absolute right-0 top-6 h-44 w-44 rounded-full bg-[#1f4d73]/70 blur-3xl" />

      <div className="relative mx-auto w-full max-w-107.5">
        <div className="relative mx-auto h-56 w-[88%] rotate-[-4deg] overflow-hidden rounded-3xl border border-white/80 bg-white shadow-2xl shadow-[#1f4d73]/20">
          <div className="flex h-10 items-center gap-2 border-b border-[#E5E0D6] px-4">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff6b6b]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#ffbf4d]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#32d583]" />
          </div>
          <div className="space-y-3 p-5">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center gap-3 rounded-2xl bg-[#F7F4ED] p-3"
              >
                <span className="h-8 w-8 shrink-0 rounded-xl bg-[#1f4d73]/15" />
                <span className="h-2.5 flex-1 rounded-full bg-[#E5E0D6]" />
              </div>
            ))}
          </div>
        </div>

        <div className="absolute left-1/2 top-24 flex h-28 w-28 -translate-x-1/2 items-center justify-center rounded-full bg-linear-to-br from-[#1f4d73] to-[#0F172A] text-white shadow-2xl shadow-[#1f4d73]/30">
          <EmailIcon className="h-11 w-11 text-white" />
        </div>

        <div className="absolute bottom-6 right-16 flex h-16 w-16 items-center justify-center rounded-full border border-white/80 bg-white text-[#1f4d73] shadow-xl shadow-[#1f4d73]/15">
          <svg
            className="h-8 w-8"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="m6 12 4 4 8-8"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

export function VerifyEmailCard() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const email = searchParams.get("email")?.trim() ?? "";
  const [isResending, setIsResending] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (cooldownSeconds <= 0) {
      return;
    }

    const timeoutId = window.setTimeout(
      () => setCooldownSeconds((current) => current - 1),
      1000
    );

    return () => window.clearTimeout(timeoutId);
  }, [cooldownSeconds]);

  const resendConfirmation = async () => {
    setIsResending(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          // Must match the sign-up call in signup-card.tsx, query string
          // included (there is none - see the comment there).
          emailRedirectTo: `${window.location.origin}/auth/confirm`
        }
      });

      if (error) {
        throw error;
      }

      setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
      toast.success(`We sent another confirmation link to ${email}.`, {
        title: "Confirmation email sent"
      });
    } catch (error) {
      toast.error(getSignUpErrorMessage(error), {
        title: "Could not resend the email"
      });
    } finally {
      setIsResending(false);
    }
  };

  const isCoolingDown = cooldownSeconds > 0;

  return (
    <AuthShell
      brand={
        <AuthBrandPanel
          eyebrow={
            <>
              Almost there! <span aria-hidden="true">&#128075;</span>
            </>
          }
          heading="Check your inbox"
          blurb="Opening the link we just sent activates your account and takes you straight to naming your organization."
          illustration={<InboxIllustration />}
          assuranceBlurb="Confirmation links are single-use and expire on their own."
        />
      }
    >
      <AuthMobileLogo />

      <h2 className="text-3xl font-black tracking-tight text-[#0F172A] sm:text-4xl">
        Confirm your email
      </h2>
      <p className="mt-3 max-w-md text-base leading-7 text-[#64748B] sm:mt-4 sm:text-lg sm:leading-8">
        Your account has been created. We sent a confirmation link
        {email ? " to " : " to your email address"}
        {email ? (
          <span className="font-black text-[#0F172A]">{email}</span>
        ) : null}
        . Open it to activate your account and finish setting up your
        organization.
      </p>

      <div className="mt-8 rounded-2xl border border-[#E5E0D6] bg-[#F7F4ED] p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#1f4d73] shadow-sm">
            <ShieldIcon className="h-5 w-5 text-[#1f4d73]" />
          </div>
          <div>
            <p className="font-bold text-[#0F172A]">What happens next</p>
            <p className="mt-1 text-sm leading-6 text-[#64748B]">
              Confirming the link signs you in and takes you straight to a short
              form where you name your organization and choose a plan.
            </p>
          </div>
        </div>
      </div>

      {email ? (
        <button
          className="login-button mt-8 flex h-16 w-full items-center justify-center gap-3 bg-linear-to-r from-[#1f4d73] to-[#0F172A] text-lg font-black text-white shadow-xl shadow-[#0F172A]/25 transition hover:brightness-110 hover:shadow-2xl disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isResending || isCoolingDown}
          onClick={resendConfirmation}
          type="button"
        >
          {isResending ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <SendIcon />
          )}
          {isResending
            ? "Sending..."
            : isCoolingDown
              ? `Resend in ${cooldownSeconds}s`
              : "Resend confirmation email"}
        </button>
      ) : null}

      <Link
        className={`login-social flex h-14 w-full items-center justify-center gap-4 border border-[#E5E0D6] bg-white text-base font-bold text-[#0F172A] transition hover:border-[#1f4d73] hover:bg-[#F7F4ED] ${email ? "mt-4" : "mt-8"}`}
        href="/login"
      >
        Go to sign in
      </Link>

      <p className="mt-7 text-center text-sm font-medium text-[#64748B]">
        Can&apos;t find it? Check your spam folder before resending.
      </p>
    </AuthShell>
  );
}
