"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { getSignUpErrorMessage } from "@/lib/auth/auth-error-messages";
import { syncSignedInUser } from "@/lib/auth/client";
import {
  PASSWORD_RULES_HINT,
  getPasswordValidationError
} from "@/lib/auth/password";
import { useDesktopAppMode } from "@/lib/desktop-app/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ArrowLoginIcon, EmailIcon, EyeIcon, LockIcon, ShieldIcon } from "@/features/auth/components/auth-icons";

function FreeTrialIllustration() {
  return (
    <div className="relative mt-10 min-h-75 lg:mt-12">
      <div className="absolute bottom-0 left-2 h-48 w-48 rounded-full bg-[#E7E3DA]/70 blur-3xl" />
      <div className="absolute right-2 top-4 h-44 w-44 rounded-full bg-[#1f4d73]/75 blur-3xl" />

      <div className="relative mx-auto w-full max-w-107.5">
        <div className="relative mx-auto h-60 w-[88%] rotate-[-4deg] overflow-hidden rounded-4xl border border-white/80 bg-white shadow-2xl shadow-[#1f4d73]/20">
          <div className="flex h-11 items-center justify-between border-b border-[#E5E0D6] bg-[#FFFFFF] px-5">
            <div className="flex gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff6b6b]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#ffbf4d]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#32d583]" />
            </div>
            <span className="h-3 w-20 rounded-full bg-[#E5E0D6]" />
          </div>
          <div className="grid h-[calc(100%-44px)] grid-cols-[98px_1fr]">
            <div className="bg-linear-to-b from-[#1f4d73] to-[#0F172A] p-4">
              <div className="h-4 w-16 rounded-full bg-white/80" />
              <div className="mt-6 space-y-3.5">
                <div className="h-3 w-16 rounded-full bg-white/55" />
                <div className="h-3 w-12 rounded-full bg-white/35" />
                <div className="h-3 w-14 rounded-full bg-white/35" />
                <div className="h-3 w-10 rounded-full bg-white/35" />
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-[#F7F4ED] p-3">
                  <p className="h-2 w-12 rounded-full bg-[#1f4d73]/25" />
                  <p className="mt-3 text-lg font-black text-[#0F172A]">128</p>
                </div>
                <div className="rounded-2xl bg-[#F7F4ED] p-3">
                  <p className="h-2 w-14 rounded-full bg-[#0F172A]/25" />
                  <p className="mt-3 text-lg font-black text-[#0F172A]">$24k</p>
                </div>
                <div className="rounded-2xl bg-[#F7F4ED] p-3">
                  <p className="h-2 w-12 rounded-full bg-[#1f4d73]/25" />
                  <p className="mt-3 text-lg font-black text-[#0F172A]">92%</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-[1fr_78px] gap-4">
                <div className="h-24 rounded-2xl bg-white shadow-inner shadow-[#1f4d73]/10">
                  <svg className="h-full w-full p-4 text-[#1f4d73]" viewBox="0 0 160 80" fill="none" aria-hidden="true">
                    <path d="M8 64c18-34 34-12 52-34 18-22 35 17 52-2 12-13 24-18 40-14" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="h-24 rounded-2xl bg-[#F7F4ED] p-3">
                  <div className="h-full rounded-full border-10 border-[#0F172A] border-l-[#E5E0D6]" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute -left-3 bottom-16 w-34 rounded-3xl border border-white/80 bg-white/90 p-4 shadow-xl shadow-[#1f4d73]/15 backdrop-blur">
          <p className="text-xs font-black text-[#64748B]">Next Booking</p>
          <p className="mt-2 text-sm font-black text-[#0F172A]">Wedding Event</p>
          <p className="mt-1 text-xs font-bold text-[#64748B]">May 22, 2026</p>
        </div>

        <div className="absolute -right-2 top-24 w-36 rounded-3xl border border-white/80 bg-white/90 p-4 shadow-xl shadow-[#0F172A]/15 backdrop-blur">
          <p className="text-xs font-black text-[#64748B]">Revenue</p>
          <p className="mt-2 text-lg font-black text-[#0F172A]">$125,000</p>
          <p className="mt-1 text-xs font-black text-[#16a34a]">+16.5%</p>
        </div>

        <div className="absolute bottom-0 right-16 flex h-20 w-20 items-center justify-center rounded-3xl bg-linear-to-br from-[#1f4d73] to-[#0F172A] text-white shadow-2xl shadow-[#1f4d73]/30">
          <ShieldIcon />
        </div>
      </div>
    </div>
  );
}

type FreeTrialCardProps = {
  compact?: boolean;
  onLoginClick?: () => void;
};

export function FreeTrialCard({ compact = false, onLoginClick }: FreeTrialCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const isDesktopApp = useDesktopAppMode();
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: ""
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (name: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [name]: value }));
    setError("");
  };

  const failSignUp = (message: string) => {
    setError(message);
    toast.error(message, { title: "Sign-up failed" });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const email = form.email.trim();

    if (!email) {
      failSignUp("Please enter your email address.");
      return;
    }

    const passwordError = getPasswordValidationError(form.password);

    if (passwordError) {
      failSignUp(passwordError);
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const accessResponse = await fetch("/api/auth/free-trial-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email })
      });

      if (!accessResponse.ok) {
        const payload = (await accessResponse.json().catch(() => null)) as {
          error?: string;
        } | null;
        failSignUp(
          payload?.error ??
            "Unable to create your account right now. Please try again."
        );
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: {
          // The organization is named on /dashboard/new, so send the confirmed
          // owner straight there instead of the dashboard.
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/dashboard/new")}`,
          data: {
            // The only server-side signal that authorizes POST
            // /api/auth/sync-user to provision an organization. Everyone else
            // joins by administrator invitation.
            account_type: "organization_owner"
          }
        }
      });

      if (signUpError) {
        failSignUp(getSignUpErrorMessage(signUpError));
        return;
      }

      // With email confirmation enabled Supabase returns no session, so the
      // account is real but unusable until the inbox is confirmed.
      if (!data.session?.access_token) {
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }

      // Confirmation disabled (local development): the owner is already signed
      // in, so go collect the organization details now.
      await syncSignedInUser(data.session.access_token, { force: true });
      router.push("/dashboard/new");
      router.refresh();
    } catch (error) {
      failSignUp(getSignUpErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className={`mx-auto grid w-full min-w-0 overflow-hidden rounded-2xl border border-white/80 bg-white/70 shadow-2xl shadow-[#1f4d73]/12 backdrop-blur-xl sm:rounded-4xl ${isDesktopApp ? "desktop-auth-soft-page desktop-auth-soft-back max-w-lg" : "lg:grid-cols-2"}`}>
      <div className={`order-2 relative overflow-hidden bg-linear-to-br from-white via-[#F7F4ED] to-[#F1F5F9] p-5 sm:p-10 ${isDesktopApp ? "hidden" : compact ? "hidden lg:block lg:p-10" : "lg:p-14"}`}>
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-96 rounded-[50%] bg-[#E7E3DA]/80 blur-2xl" />
        <div className="pointer-events-none absolute -right-24 top-1/3 h-64 w-64 rounded-full bg-[#1f4d73]/80 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 right-0 h-56 w-80 rounded-[48%] bg-[#E7E3DA]/75 blur-2xl" />
        <div className="pointer-events-none absolute bottom-16 left-10 hidden grid-cols-8 gap-3 opacity-25 sm:grid">
          {Array.from({ length: 48 }).map((_, index) => (
            <span key={index} className="h-1.5 w-1.5 rounded-full bg-[#0F172A]" />
          ))}
        </div>
        <svg className="pointer-events-none absolute bottom-0 left-0 h-40 w-full text-[#1f4d73] opacity-25" viewBox="0 0 640 180" fill="none" aria-hidden="true">
          <path d="M0 106C70 54 130 150 222 102C310 56 356 140 438 92C510 50 574 74 640 40V180H0Z" fill="currentColor" />
        </svg>
        <div className="pointer-events-none absolute right-10 top-36 hidden grid-cols-6 gap-3 opacity-35 sm:grid">
          {Array.from({ length: 36 }).map((_, index) => (
            <span key={index} className="h-1.5 w-1.5 rounded-full bg-[#1f4d73]" />
          ))}
        </div>

        <div className={`relative ${compact ? "lg:sticky lg:top-0 lg:flex lg:min-h-[calc(90vh-80px)] lg:flex-col lg:justify-between lg:gap-6" : ""}`}>
          <div>
            {isDesktopApp ? (
              <Image src="/images/branding/hms-logo-header.png" alt="Event Core" width={612} height={408} priority unoptimized className="h-auto w-64 max-w-full object-contain" />
            ) : (
              <Link href="/" aria-label="Back to Hall Management SaaS home">
                <Image src="/images/branding/hms-logo-header.png" alt="Hall Management SaaS" width={612} height={408} priority unoptimized className="h-auto w-64 max-w-full object-contain" />
              </Link>
            )}

            <p className="mt-10 text-base font-black text-[#1f4d73]">
              Welcome! <span aria-hidden="true">&#128075;</span>
            </p>
            <h1 className="mt-5 max-w-md text-3xl font-black leading-[1.12] tracking-tight text-[#0F172A] sm:mt-6 sm:text-5xl">
              Create your account
            </h1>
            <p className="mt-4 max-w-md text-base leading-7 text-[#64748B] sm:mt-5 sm:text-lg sm:leading-8">
              Start with your email and a password. You&apos;ll name your organization and choose a plan right after you confirm your inbox.
            </p>
          </div>

          <div className={compact ? "lg:-my-3" : ""}>
            <FreeTrialIllustration />
          </div>

          <div className={`${compact ? "mt-8" : "mt-10"} flex items-center gap-4`}>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/80 shadow-lg shadow-[#1f4d73]/10">
              <ShieldIcon />
            </div>
            <div>
              <p className="font-black text-[#0F172A]">Your data is secure with us.</p>
              <p className="mt-1 text-sm font-medium text-[#64748B]">We use industry-standard encryption and best security practices.</p>
            </div>
          </div>
        </div>
      </div>

      <div className={`order-1 box-border w-full min-w-0 bg-white ${isDesktopApp ? "desktop-auth-form-panel p-4 sm:p-5" : compact ? "p-5 pt-16 sm:p-10 lg:p-10" : "p-5 sm:p-10 lg:p-14"}`}>
        <div className={`mx-auto flex h-full w-full min-w-0 flex-col justify-center ${isDesktopApp ? "max-w-md" : "max-w-xl"}`}>
          {isDesktopApp ? (
            <Image
              src="/images/branding/hms-logo-header.png"
              alt="Event Core"
              width={612}
              height={408}
              priority
              unoptimized
              className="mb-2 h-auto w-40 max-w-full object-contain"
            />
          ) : null}
          <h2 id="free-trial-modal-title" className={`${isDesktopApp ? "text-xl" : "text-3xl sm:text-4xl"} font-black tracking-tight text-[#0F172A]`}>Start Your Free Trial</h2>
          <p className={`${isDesktopApp ? "mt-1 text-sm" : "mt-3 text-base sm:mt-4 sm:text-lg"} text-[#64748B]`}>Step 1 of 2 &mdash; create the owner account. Organization details come next.</p>

          <form className={isDesktopApp ? "mt-3" : "mt-8"} onSubmit={submit}>
            <label className={`${isDesktopApp ? "text-sm" : "text-base"} block font-bold text-[#0F172A]`} htmlFor="freeTrialEmail">
              Email Address
            </label>
            <div className={`login-field mt-1.5 flex items-center gap-3 border border-[#E5E0D6] bg-white px-3 transition focus-within:border-[#1f4d73] focus-within:shadow-[0_0_0_4px_rgba(31,77,115,0.14)] ${isDesktopApp ? "h-9" : "h-14"}`}>
              <EmailIcon />
              <input
                id="freeTrialEmail"
                name="email"
                autoComplete="email"
                className="min-w-0 flex-1 bg-transparent text-base text-[#0F172A] outline-none placeholder:text-[#9aa5ba]"
                placeholder="Enter your email address"
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
              />
            </div>

            <label className={`${isDesktopApp ? "mt-2.5 text-sm" : "mt-5 text-base"} block font-bold text-[#0F172A]`} htmlFor="freeTrialPassword">
              Password
            </label>
            <div className={`login-field mt-1.5 flex items-center gap-3 border border-[#E5E0D6] bg-white px-3 transition focus-within:border-[#1f4d73] focus-within:shadow-[0_0_0_4px_rgba(31,77,115,0.14)] ${isDesktopApp ? "h-9" : "h-14"}`}>
              <LockIcon />
              <input
                id="freeTrialPassword"
                name="newPassword"
                autoComplete="new-password"
                className="min-w-0 flex-1 bg-transparent text-base text-[#0F172A] outline-none placeholder:text-[#9aa5ba]"
                placeholder="Create a password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(event) => updateField("password", event.target.value)}
              />
              <button className="login-icon-button text-[#64748B] transition hover:text-[#1f4d73]" type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>
                <EyeIcon isVisible={showPassword} />
              </button>
            </div>
            <p className={`${isDesktopApp ? "mt-1.5 text-xs" : "mt-2 text-sm"} font-medium text-[#64748B]`}>
              {PASSWORD_RULES_HINT}
            </p>

            {error ? (
              <p className={`${isDesktopApp ? "mt-3" : "mt-5"} text-sm font-bold text-[#c2410c]`} role="alert">
                {error}
              </p>
            ) : null}

            <button
              className={`login-button flex w-full items-center justify-center gap-3 bg-linear-to-r from-[#1f4d73] to-[#0F172A] font-black text-white shadow-xl shadow-[#0F172A]/25 transition hover:brightness-110 hover:shadow-2xl disabled:cursor-not-allowed disabled:opacity-70 ${isDesktopApp ? "mt-3 h-10 text-sm" : "mt-7 h-16 text-lg"}`}
              type="submit"
              disabled={isSubmitting}
            >
              <ArrowLoginIcon />
              {isSubmitting ? "Creating account..." : "Create account"}
            </button>

            <p className={`${isDesktopApp ? "mt-3 text-xs leading-5" : "mt-5 text-sm leading-6"} text-center font-medium text-[#64748B]`}>
              By creating an account you agree to the{" "}
              <Link className="font-bold text-[#1f4d73] transition hover:text-[#15344f]" href="#terms">
                Terms &amp; Privacy Policy
              </Link>
              .
            </p>

            <p className={`${isDesktopApp ? "mt-3 text-xs" : "mt-7 text-base"} text-center text-[#64748B]`}>
              Already have an account?{" "}
              {onLoginClick ? (
                <button className="font-bold text-[#1f4d73] transition hover:text-[#1f4d73]" type="button" onClick={onLoginClick}>
                  Login
                </button>
              ) : (
                <Link className="font-bold text-[#1f4d73] transition hover:text-[#1f4d73]" href={isDesktopApp ? "/login?desktop=1" : "/login"}>
                  Login
                </Link>
              )}
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
