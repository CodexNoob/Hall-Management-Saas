"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useDesktopAppMode } from "@/lib/desktop-app/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function EmailIcon() {
  return (
    <svg className="h-5 w-5 text-[#64748B]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h16v12H4zM4 6l8 7 8-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="h-7 w-7 text-[#1f4d73]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="m8.5 12 2.2 2.2 4.8-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 10V8a5 5 0 0 1 10 0v2M6 10h12v10H6zM12 14v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m21 3-8.5 18-3-7-6.5-3zM21 3 9.5 14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14 4h6v6M20 4l-9 9M10 5H5v14h14v-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ResetIllustration() {
  return (
    <div className="relative mt-10 min-h-75 lg:mt-12">
      <div className="absolute bottom-0 left-4 h-44 w-44 rounded-full bg-[#E7E3DA]/65 blur-3xl" />
      <div className="absolute right-0 top-6 h-44 w-44 rounded-full bg-[#1f4d73]/70 blur-3xl" />

      <div className="relative mx-auto w-full max-w-107.5">
        <div className="relative mx-auto h-56 w-[88%] rotate-[-4deg] overflow-hidden rounded-3xl border border-white/80 bg-white shadow-2xl shadow-[#1f4d73]/20">
          <div className="grid h-full grid-cols-[92px_1fr]">
            <div className="bg-linear-to-b from-[#1f4d73] to-[#0F172A] p-4">
              <div className="h-3 w-14 rounded-full bg-white/80" />
              <div className="mt-7 space-y-3">
                <span className="block h-3 w-14 rounded-full bg-white/50" />
                <span className="block h-3 w-11 rounded-full bg-white/30" />
                <span className="block h-3 w-16 rounded-full bg-white/30" />
              </div>
            </div>
            <div className="p-5">
              <div className="h-12 rounded-2xl bg-[#F7F4ED]" />
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="h-20 rounded-2xl bg-[#F7F4ED]" />
                <div className="h-20 rounded-2xl bg-[#F7F4ED]" />
              </div>
              <div className="mt-4 h-14 rounded-2xl bg-white shadow-inner shadow-[#1f4d73]/10" />
            </div>
          </div>
        </div>

        <div className="absolute left-1/2 top-24 flex h-28 w-28 -translate-x-1/2 items-center justify-center rounded-full bg-linear-to-br from-[#1f4d73] to-[#0F172A] text-white shadow-2xl shadow-[#1f4d73]/30">
          <LockIcon />
        </div>

        <div className="absolute -right-2 top-28 w-32 rounded-3xl border border-white/80 bg-white/90 p-4 shadow-xl shadow-[#0F172A]/15 backdrop-blur">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F7F4ED] text-[#1f4d73]">
            <EmailIcon />
          </div>
          <p className="text-xs font-black text-[#64748B]">Reset Link</p>
          <p className="mt-2 h-2 w-20 rounded-full bg-[#E5E0D6]" />
        </div>

        <div className="absolute bottom-8 right-20 flex h-16 w-16 items-center justify-center rounded-full border border-white/80 bg-white text-[#1f4d73] shadow-xl shadow-[#1f4d73]/15">
          <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m6 12 4 4 8-8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <svg className="absolute right-8 top-14 h-24 w-24 text-[#0F172A]" viewBox="0 0 120 120" fill="none" aria-hidden="true">
          <path d="M16 96c35-10 8-46 48-54" stroke="currentColor" strokeWidth="2" strokeDasharray="6 6" strokeLinecap="round" opacity="0.45" />
          <path d="m70 35 28-13-12 29-5-13z" fill="currentColor" opacity="0.75" />
        </svg>
      </div>
    </div>
  );
}

function DesktopResetIllustration() {
  return (
    <div className="relative mt-5 h-31 overflow-hidden">
      <div className="absolute bottom-0 left-6 h-20 w-32 rounded-full bg-[#E7E3DA]/70 blur-3xl" />
      <div className="absolute right-8 top-0 h-20 w-24 rounded-full bg-[#1f4d73]/60 blur-3xl" />

      <div className="relative mx-auto h-25 w-[82%] rotate-[-3deg] overflow-hidden rounded-2xl border border-white/80 bg-white shadow-2xl shadow-[#1f4d73]/18">
        <div className="grid h-full grid-cols-[58px_1fr]">
          <div className="bg-linear-to-b from-[#1f4d73] to-[#0F172A] p-3">
            <div className="h-2 w-9 rounded-full bg-white/80" />
            <div className="mt-4 space-y-2">
              <span className="block h-2 w-9 rounded-full bg-white/50" />
              <span className="block h-2 w-7 rounded-full bg-white/30" />
              <span className="block h-2 w-10 rounded-full bg-white/30" />
            </div>
          </div>
          <div className="p-3">
            <div className="h-7 rounded-xl bg-[#F7F4ED]" />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="h-9 rounded-xl bg-[#F7F4ED]" />
              <div className="h-9 rounded-xl bg-[#F7F4ED]" />
            </div>
          </div>
        </div>
      </div>

      <div className="absolute left-1/2 top-8 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-linear-to-br from-[#1f4d73] to-[#0F172A] text-white shadow-2xl shadow-[#1f4d73]/30">
        <LockIcon />
      </div>

      <div className="absolute bottom-2 right-12 flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-white text-[#1f4d73] shadow-xl shadow-[#1f4d73]/15">
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m6 12 4 4 8-8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

type ForgotPasswordCardProps = {
  compact?: boolean;
  onBackToLogin?: () => void;
};

export function ForgotPasswordCard({ compact = false, onBackToLogin }: ForgotPasswordCardProps) {
  const isDesktopApp = useDesktopAppMode();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isDesktopApp) {
      return;
    }

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [isDesktopApp]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim()) {
      setError("Please enter your email address.");
      setSuccess("");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo
      });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSuccess("Reset link sent. Please check your email.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to send reset link.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className={`mx-auto grid w-full min-w-0 overflow-hidden rounded-2xl border border-white/80 bg-white/70 shadow-2xl shadow-[#1f4d73]/12 backdrop-blur-xl sm:rounded-4xl ${isDesktopApp ? "desktop-auth-soft-page desktop-auth-soft-forward max-h-[760px] max-w-6xl grid-cols-[1fr_0.92fr]" : "lg:grid-cols-2"}`}>
      <div className={`relative overflow-hidden bg-linear-to-br from-white via-[#F7F4ED] to-[#F1F5F9] p-5 sm:p-10 ${isDesktopApp ? "order-2 block p-8" : "order-2 lg:order-1"} ${!isDesktopApp && compact ? "hidden lg:block lg:p-10" : !isDesktopApp ? "lg:p-14" : ""}`}>
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-96 rounded-[50%] bg-[#E7E3DA]/80 blur-2xl" />
        <div className="pointer-events-none absolute -right-24 top-1/3 h-64 w-64 rounded-full bg-[#1f4d73]/80 blur-2xl" />
        <div className="pointer-events-none absolute right-10 top-36 hidden grid-cols-6 gap-3 opacity-35 sm:grid">
          {Array.from({ length: 36 }).map((_, index) => (
            <span key={index} className="h-1.5 w-1.5 rounded-full bg-[#1f4d73]" />
          ))}
        </div>
        <svg className="pointer-events-none absolute bottom-0 left-0 h-40 w-full text-[#1f4d73] opacity-25" viewBox="0 0 640 180" fill="none" aria-hidden="true">
          <path d="M0 106C70 54 130 150 222 102C310 56 356 140 438 92C510 50 574 74 640 40V180H0Z" fill="currentColor" />
        </svg>

        <div className="relative">
          {isDesktopApp ? (
            <Image src="/images/branding/hms-logo-header.png" alt="Hall Management SaaS" width={612} height={408} priority unoptimized className="h-auto w-64 max-w-full object-contain" />
          ) : (
            <Link href="/" aria-label="Back to Hall Management SaaS home">
              <Image src="/images/branding/hms-logo-header.png" alt="Hall Management SaaS" width={612} height={408} priority unoptimized className="h-auto w-64 max-w-full object-contain" />
            </Link>
          )}

          <p className={`${isDesktopApp ? "mt-7" : compact ? "mt-8" : "mt-10"} text-base font-black text-[#1f4d73]`}>
            No worries! <span aria-hidden="true">&#128075;</span>
          </p>
          <h1 className={`${isDesktopApp ? "mt-4 text-4xl" : "mt-5 text-3xl sm:mt-6 sm:text-5xl"} max-w-md font-black leading-[1.08] tracking-tight text-[#0F172A]`}>
            Recover your account
          </h1>
          <p className={`${isDesktopApp ? "mt-3 text-base leading-7" : "mt-4 text-base leading-7 sm:mt-5 sm:text-lg sm:leading-8"} max-w-md text-[#64748B]`}>
            Enter your email address and we&apos;ll send you a secure link to reset your password.
          </p>

          {isDesktopApp ? <DesktopResetIllustration /> : <ResetIllustration />}

          <div className={`${isDesktopApp ? "mt-5" : compact ? "mt-8" : "mt-10"} flex items-center gap-4`}>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/80 shadow-lg shadow-[#1f4d73]/10">
              <ShieldIcon />
            </div>
            <div>
              <p className="font-black text-[#0F172A]">Your security is our priority.</p>
              <p className="mt-1 text-sm font-medium text-[#64748B]">We use industry-standard encryption to keep your data safe.</p>
            </div>
          </div>
        </div>
      </div>

      <div className={`box-border w-full min-w-0 bg-white ${isDesktopApp ? "order-1 p-8" : compact ? "order-1 p-5 pt-16 sm:p-10 lg:order-2 lg:p-10" : "order-1 p-5 sm:p-10 lg:order-2 lg:p-16"}`}>
        <div className={`mx-auto flex h-full w-full min-w-0 flex-col justify-center ${isDesktopApp ? "max-w-md" : "max-w-xl"}`}>
          <h2 id="forgot-password-modal-title" className={`${isDesktopApp ? "text-xl" : "text-3xl sm:text-4xl"} font-black tracking-tight text-[#0F172A]`}>Forgot Password</h2>
          <p className={`${isDesktopApp ? "mt-2 text-sm leading-6" : "mt-3 text-base leading-7 sm:mt-4 sm:text-lg sm:leading-8"} max-w-md text-[#64748B]`}>Enter your email address and we will send you a reset link.</p>

          <form className={isDesktopApp ? "mt-4" : compact ? "mt-10" : "mt-12"} onSubmit={submit}>
            <label className={`${isDesktopApp ? "text-sm" : "text-base"} font-bold text-[#0F172A]`} htmlFor="forgotEmail">
              Email Address
            </label>
            <div className={`login-field mt-2 flex items-center gap-3 border border-[#E5E0D6] bg-white px-3 transition focus-within:border-[#1f4d73] focus-within:shadow-[0_0_0_4px_rgba(31,77,115,0.14)] ${isDesktopApp ? "h-10" : "h-14"}`}>
              <EmailIcon />
              <input
                id="forgotEmail"
                name="email"
                autoComplete="email"
                className="min-w-0 flex-1 bg-transparent text-base text-[#0F172A] outline-none placeholder:text-[#9aa5ba]"
                placeholder="Enter your email address"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError("");
                  setSuccess("");
                }}
              />
            </div>

            <div className={`${isDesktopApp ? "mt-5 text-sm leading-6" : "mt-7 text-base leading-7"} flex gap-4 font-bold text-[#65718d]`}>
              <p>We&apos;ll send a secure password reset link to this email address.</p>
            </div>

            {error ? <p className="mt-5 text-sm font-bold text-[#c2410c]">{error}</p> : null}
            {success ? <p className="mt-5 text-sm font-bold text-[#138a4f]">{success}</p> : null}

            <button
              className={`login-button flex w-full items-center justify-center gap-3 bg-linear-to-r from-[#1f4d73] to-[#0F172A] font-black text-white shadow-xl shadow-[#0F172A]/25 transition hover:brightness-110 hover:shadow-2xl disabled:cursor-not-allowed disabled:opacity-70 ${isDesktopApp ? "mt-5 h-11 text-sm" : "mt-9 h-16 text-lg"}`}
              type="submit"
              disabled={isSubmitting}
            >
              <SendIcon />
              {isSubmitting ? "Sending..." : "Send Reset Link"}
            </button>

            <div className={`${isDesktopApp ? "my-5" : "my-10"} flex items-center gap-5 text-sm font-medium text-[#64748B]`}>
              <span className="h-px flex-1 bg-[#E5E0D6]" />
              or
              <span className="h-px flex-1 bg-[#E5E0D6]" />
            </div>

            {onBackToLogin ? (
              <button className={`mx-auto flex items-center justify-center gap-3 font-black text-[#1f4d73] transition hover:text-[#1f4d73] ${isDesktopApp ? "text-base" : "text-lg"}`} type="button" onClick={onBackToLogin}>
                <span aria-hidden="true"></span>
                Back to Login
              </button>
            ) : (
              <Link className={`mx-auto flex items-center justify-center gap-3 font-black text-[#1f4d73] transition hover:text-[#1f4d73] ${isDesktopApp ? "text-base" : "text-lg"}`} href={isDesktopApp ? "/login?desktop=1" : "/login"}>
                <span aria-hidden="true"></span>
                Back to Login
              </Link>
            )}

            <p className={`${isDesktopApp ? "mt-5 text-sm" : "mt-10 text-sm sm:mt-14 sm:text-base"} flex flex-wrap items-center justify-center gap-2 text-center text-[#64748B]`}>
              Need help?{" "}
              <Link className="inline-flex items-center gap-2 font-bold text-[#1f4d73] transition hover:text-[#1f4d73]" href="#support">
                Contact support
                <ExternalLinkIcon />
              </Link>
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
