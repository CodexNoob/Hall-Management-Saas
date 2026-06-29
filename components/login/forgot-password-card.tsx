"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function EmailIcon() {
  return (
    <svg className="h-5 w-5 text-[#8290ad]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h16v12H4zM4 6l8 7 8-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="h-7 w-7 text-[#3155ff]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
      <div className="absolute bottom-0 left-4 h-44 w-44 rounded-full bg-[#c7d8ff]/65 blur-3xl" />
      <div className="absolute right-0 top-6 h-44 w-44 rounded-full bg-[#d9c7ff]/70 blur-3xl" />

      <div className="relative mx-auto w-full max-w-107.5">
        <div className="relative mx-auto h-56 w-[88%] rotate-[-4deg] overflow-hidden rounded-3xl border border-white/80 bg-white shadow-2xl shadow-[#3155ff]/20">
          <div className="grid h-full grid-cols-[92px_1fr]">
            <div className="bg-linear-to-b from-[#3155ff] to-[#7138f5] p-4">
              <div className="h-3 w-14 rounded-full bg-white/80" />
              <div className="mt-7 space-y-3">
                <span className="block h-3 w-14 rounded-full bg-white/50" />
                <span className="block h-3 w-11 rounded-full bg-white/30" />
                <span className="block h-3 w-16 rounded-full bg-white/30" />
              </div>
            </div>
            <div className="p-5">
              <div className="h-12 rounded-2xl bg-[#eef3ff]" />
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="h-20 rounded-2xl bg-[#f4f0ff]" />
                <div className="h-20 rounded-2xl bg-[#eef3ff]" />
              </div>
              <div className="mt-4 h-14 rounded-2xl bg-white shadow-inner shadow-[#3155ff]/10" />
            </div>
          </div>
        </div>

        <div className="absolute left-1/2 top-24 flex h-28 w-28 -translate-x-1/2 items-center justify-center rounded-full bg-linear-to-br from-[#3155ff] to-[#8b37f6] text-white shadow-2xl shadow-[#3155ff]/30">
          <LockIcon />
        </div>

        <div className="absolute -right-2 top-28 w-32 rounded-3xl border border-white/80 bg-white/90 p-4 shadow-xl shadow-[#7138f5]/15 backdrop-blur">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f4f0ff] text-[#4f46ff]">
            <EmailIcon />
          </div>
          <p className="text-xs font-black text-[#52607d]">Reset Link</p>
          <p className="mt-2 h-2 w-20 rounded-full bg-[#dce5ff]" />
        </div>

        <div className="absolute bottom-8 right-20 flex h-16 w-16 items-center justify-center rounded-full border border-white/80 bg-white text-[#4f46ff] shadow-xl shadow-[#3155ff]/15">
          <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m6 12 4 4 8-8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <svg className="absolute right-8 top-14 h-24 w-24 text-[#7138f5]" viewBox="0 0 120 120" fill="none" aria-hidden="true">
          <path d="M16 96c35-10 8-46 48-54" stroke="currentColor" strokeWidth="2" strokeDasharray="6 6" strokeLinecap="round" opacity="0.45" />
          <path d="m70 35 28-13-12 29-5-13z" fill="currentColor" opacity="0.75" />
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
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    <section className="grid w-full overflow-hidden rounded-4xl border border-white/80 bg-white/70 shadow-2xl shadow-[#3155ff]/12 backdrop-blur-xl lg:grid-cols-2">
      <div className={`relative overflow-hidden bg-linear-to-br from-white via-[#f7f6ff] to-[#e7f0ff] p-8 sm:p-10 ${compact ? "lg:p-10" : "lg:p-14"}`}>
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-96 rounded-[50%] bg-[#c9d7ff]/80 blur-2xl" />
        <div className="pointer-events-none absolute -right-24 top-1/3 h-64 w-64 rounded-full bg-[#d4c2ff]/80 blur-2xl" />
        <div className="pointer-events-none absolute right-10 top-36 hidden grid-cols-6 gap-3 opacity-35 sm:grid">
          {Array.from({ length: 36 }).map((_, index) => (
            <span key={index} className="h-1.5 w-1.5 rounded-full bg-[#3155ff]" />
          ))}
        </div>
        <svg className="pointer-events-none absolute bottom-0 left-0 h-40 w-full text-[#9fb8ff] opacity-25" viewBox="0 0 640 180" fill="none" aria-hidden="true">
          <path d="M0 106C70 54 130 150 222 102C310 56 356 140 438 92C510 50 574 74 640 40V180H0Z" fill="currentColor" />
        </svg>

        <div className="relative">
          <Link href="/" aria-label="Back to Hall Management SaaS home">
            <Image src="/hms-logo-header.png" alt="Hall Management SaaS" width={1160} height={300} priority className="h-auto w-64 max-w-full object-contain" />
          </Link>

          <p className={`${compact ? "mt-8" : "mt-10"} text-base font-black text-[#3155ff]`}>
            No worries! <span aria-hidden="true">&#128075;</span>
          </p>
          <h1 className="mt-6 max-w-md text-4xl font-black leading-[1.12] tracking-tight text-[#09122f] sm:text-5xl">
            Recover your account
          </h1>
          <p className="mt-5 max-w-md text-lg leading-8 text-[#52607d]">
            Enter your email address and we&apos;ll send you a secure link to reset your password.
          </p>

          <ResetIllustration />

          <div className={`${compact ? "mt-8" : "mt-10"} flex items-center gap-4`}>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/80 shadow-lg shadow-[#3155ff]/10">
              <ShieldIcon />
            </div>
            <div>
              <p className="font-black text-[#09122f]">Your security is our priority.</p>
              <p className="mt-1 text-sm font-medium text-[#52607d]">We use industry-standard encryption to keep your data safe.</p>
            </div>
          </div>
        </div>
      </div>

      <div className={`bg-white p-8 sm:p-10 ${compact ? "lg:p-10" : "lg:p-16"}`}>
        <div className="mx-auto flex h-full max-w-xl flex-col justify-center">
          <h2 id="forgot-password-modal-title" className="text-4xl font-black tracking-tight text-[#09122f]">Forgot Password</h2>
          <p className="mt-4 max-w-md text-lg leading-8 text-[#52607d]">Enter your email address and we will send you a reset link.</p>

          <form className={compact ? "mt-10" : "mt-12"} onSubmit={submit}>
            <label className="text-base font-bold text-[#09122f]" htmlFor="forgotEmail">
              Email Address
            </label>
            <div className="login-field mt-3 flex h-14 items-center gap-4 border border-[#cfd7e8] bg-white px-4 transition focus-within:border-[#3155ff] focus-within:shadow-[0_0_0_4px_rgba(49,85,255,0.12)]">
              <EmailIcon />
              <input
                id="forgotEmail"
                className="min-w-0 flex-1 bg-transparent text-base text-[#09122f] outline-none placeholder:text-[#9aa5ba]"
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

            <div className="mt-7 flex gap-4 text-base font-bold leading-7 text-[#65718d]">
              <ShieldIcon />
              <p>We&apos;ll send a secure password reset link to this email address.</p>
            </div>

            {error ? <p className="mt-5 text-sm font-bold text-[#c2410c]">{error}</p> : null}
            {success ? <p className="mt-5 text-sm font-bold text-[#138a4f]">{success}</p> : null}

            <button
              className="login-button mt-9 flex h-16 w-full items-center justify-center gap-3 bg-linear-to-r from-[#0e4cff] to-[#8b37f6] text-lg font-black text-white shadow-xl shadow-[#5436ff]/25 transition hover:brightness-110 hover:shadow-2xl disabled:cursor-not-allowed disabled:opacity-70"
              type="submit"
              disabled={isSubmitting}
            >
              <SendIcon />
              {isSubmitting ? "Sending..." : "Send Reset Link"}
            </button>

            <div className="my-10 flex items-center gap-5 text-sm font-medium text-[#8290ad]">
              <span className="h-px flex-1 bg-[#dbe2ef]" />
              or
              <span className="h-px flex-1 bg-[#dbe2ef]" />
            </div>

            {onBackToLogin ? (
              <button className="mx-auto flex items-center justify-center gap-3 text-lg font-black text-[#4f2cff] transition hover:text-[#3155ff]" type="button" onClick={onBackToLogin}>
                <span aria-hidden="true">&larr;</span>
                Back to Login
              </button>
            ) : (
              <Link className="mx-auto flex items-center justify-center gap-3 text-lg font-black text-[#4f2cff] transition hover:text-[#3155ff]" href="/">
                <span aria-hidden="true">&larr;</span>
                Back to Login
              </Link>
            )}

            <p className="mt-14 flex items-center justify-center gap-2 text-base text-[#52607d]">
              Need help?{" "}
              <Link className="inline-flex items-center gap-2 font-bold text-[#4f2cff] transition hover:text-[#3155ff]" href="#support">
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
