"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, MailCheck, ShieldCheck } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { getSignUpErrorMessage } from "@/lib/auth/auth-error-messages";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

// Supabase throttles confirmation sends per address, so the button stays disabled
// long enough that a second press cannot trip that cooldown. It does nothing for
// the project-wide hourly quota, which a resend can still exhaust - that failure
// gets its own copy in auth-error-messages.ts rather than a "wait a minute" the
// button has already waited out.
const RESEND_COOLDOWN_SECONDS = 60;

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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F3F6FA] px-5 py-10 text-[#0F172A]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(31,77,115,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(185,151,77,0.16),transparent_34%)]" />
      <section className="relative w-full max-w-[520px] rounded-[32px] border border-white/80 bg-white p-8 text-center shadow-[0_28px_80px_rgba(15,23,42,0.16)] sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#0B1930] shadow-xl shadow-[#0B1930]/20">
          <MailCheck className="h-8 w-8 text-[#D9B45F]" />
        </div>

        <p className="mt-6 text-xs font-black uppercase tracking-[0.28em] text-[#1F4D73]">
          Event Core
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
          Confirm your email
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-base font-semibold leading-7 text-[#64748B]">
          Your account has been created. We sent a confirmation link
          {email ? " to " : " to your email address"}
          {email ? (
            <span className="font-black text-[#0F172A]">{email}</span>
          ) : null}
          . Open it to activate your account and finish setting up your
          organization.
        </p>

        <div className="mt-7 rounded-2xl border border-[#D8DEE8] bg-[#F8FBFF] p-4 text-left">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#1F4D73] shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black text-[#0F172A]">
                What happens next
              </p>
              <p className="mt-1 text-sm leading-6 text-[#64748B]">
                Confirming the link signs you in and takes you straight to a
                short form where you name your organization and choose a plan.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {email ? (
            <button
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#1F4D73] px-6 py-3 text-sm font-black text-white shadow-lg shadow-[#1F4D73]/20 transition hover:bg-[#163B59] disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isResending || isCoolingDown}
              onClick={resendConfirmation}
              type="button"
            >
              {isResending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isResending
                ? "Sending..."
                : isCoolingDown
                  ? `Resend in ${cooldownSeconds}s`
                  : "Resend confirmation email"}
            </button>
          ) : null}
          <Link
            className="inline-flex items-center justify-center rounded-2xl border border-[#B8C4D4] bg-white px-6 py-3 text-sm font-black text-[#0F172A] transition hover:bg-[#F8FAFC]"
            href="/login"
          >
            Go to sign in
          </Link>
        </div>

        <p className="mt-7 text-sm font-semibold text-[#64748B]">
          Can&apos;t find it? Check your spam folder before resending.
        </p>
      </section>
    </main>
  );
}
