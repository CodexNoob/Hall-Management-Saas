"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import {
  getAuthErrorMessage,
  getSignUpErrorMessage
} from "@/lib/auth/auth-error-messages";
import { signInWithOAuthProvider } from "@/lib/auth/client";
import {
  AuthDivider,
  AuthSocialButtons,
  type AuthProvider
} from "@/features/auth/components/auth-social-buttons";
import { OWNER_ACCOUNT_TYPE } from "@/lib/auth/owner-signup";
import { PASSWORD_RULES_HINT } from "@/lib/auth/password";
import { getSignUpValidationError } from "@/features/auth/validations/auth.schema";
import { useDesktopAppMode } from "@/lib/desktop-app/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ArrowLoginIcon, EmailIcon, EyeIcon, LockIcon, ShieldIcon } from "@/features/auth/components/auth-icons";

function SignUpIllustration() {
  return (
    <div className="relative mt-8 h-52 lg:mt-10 xl:h-56">
      <div className="absolute bottom-0 left-2 h-48 w-48 rounded-full bg-[#E7E3DA]/70 blur-3xl" />
      <div className="absolute right-2 top-4 h-44 w-44 rounded-full bg-[#1f4d73]/75 blur-3xl" />

      <div className="relative mx-auto w-full max-w-107.5 origin-top scale-[0.85]">
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

        <div className="absolute -left-6 bottom-2 w-34 rounded-3xl border border-white/80 bg-white/90 p-4 shadow-xl shadow-[#1f4d73]/15 backdrop-blur">
          <p className="text-xs font-black text-[#64748B]">Next Booking</p>
          <p className="mt-2 text-sm font-black text-[#0F172A]">Wedding Event</p>
          <p className="mt-1 text-xs font-bold text-[#64748B]">May 22, 2026</p>
        </div>

        <div className="absolute -right-2 top-32 w-36 rounded-3xl border border-white/80 bg-white/90 p-4 shadow-xl shadow-[#0F172A]/15 backdrop-blur">
          <p className="text-xs font-black text-[#64748B]">Revenue</p>
          <p className="mt-2 text-lg font-black text-[#0F172A]">$125,000</p>
          <p className="mt-1 text-xs font-black text-[#16a34a]">+16.5%</p>
        </div>

        <div className="absolute bottom-1 left-30 flex h-16 w-16 items-center justify-center rounded-3xl bg-linear-to-br from-[#1f4d73] to-[#0F172A] text-white shadow-2xl shadow-[#1f4d73]/30">
          <ShieldIcon />
        </div>
      </div>
    </div>
  );
}

/**
 * Tells the server somebody has registered, so the team is notified now rather
 * than whenever the applicant next opens a browser.
 *
 * NEVER THROWS. The server records the request again in `provisionOwner`, which
 * is also where the refusal lives, so this call is a promptness optimisation
 * and not a step anything depends on. Letting it fail the submit would report
 * "sign-up failed" over an account Supabase had already created.
 */
async function requestBetaAccess(email: string) {
  try {
    await fetch("/api/beta-access/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, signupMethod: "email_password" })
    });
  } catch {
    // Deliberately silent - see above.
  }
}

export function SignUpCard() {
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
  const [oauthProvider, setOauthProvider] = useState<AuthProvider | null>(null);

  // Coming back from Google with the Back button restores this page from the
  // bfcache with its React state intact, so the button would stay disabled
  // reading "Opening Google..." with no way to retry short of a reload.
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setOauthProvider(null);
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  const updateField = (name: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [name]: value }));
    setError("");
  };

  const failSignUp = (message: string) => {
    setError(message);
    toast.error(message, { title: "Sign-up failed" });
  };

  const signUpWithProvider = async (provider: AuthProvider) => {
    setOauthProvider(provider);
    setError("");

    try {
      // The same call the login page makes. One Google button both signs in and
      // signs up, because the provider draws no distinction between the two and
      // a first sign-in here gets what the form beside it gets: an organization
      // and a trial.
      await signInWithOAuthProvider(provider);
    } catch (providerError) {
      const message = getAuthErrorMessage(
        providerError,
        "Unable to start social sign-up."
      );
      setError(message);
      toast.error(message, { title: "Social sign-up failed" });
      setOauthProvider(null);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const email = form.email.trim();
    // Covers the address shape as well as the password rules, so a malformed
    // email no longer round-trips to Supabase for a generic rejection.
    const validationError = getSignUpValidationError({
      email,
      password: form.password
    });

    if (validationError) {
      failSignUp(validationError);
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      // POST /api/auth/free-trial-access used to be called here first. It read
      // as an eligibility gate but returned { allowed: true } for any
      // syntactically valid address, and the allowlist it was presumably meant
      // to consult had no importers. The free trial is open by design, so the
      // check is gone rather than left looking like it does something.
      const supabase = createSupabaseBrowserClient();
      // The session is no longer read: with or without one, registration ends
      // at the same page while Event Core is in beta.
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: {
          // No query string, deliberately. The email template composes the link
          // as `{{ .RedirectTo }}?token_hash=...&type=signup`, so anything with
          // a `?` of its own would produce a URL with two of them. /auth/confirm
          // sends a confirmed owner to /dashboard/new on `type=signup` alone.
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
          data: {
            // The only server-side signal that authorizes POST
            // /api/auth/session to provision an organization. Everyone else
            // joins by administrator invitation. The Google button below sets
            // the same flag the only way an OAuth round trip allows - see
            // lib/auth/owner-signup.ts.
            account_type: OWNER_ACCOUNT_TYPE
          }
        }
      });

      if (signUpError) {
        failSignUp(getSignUpErrorMessage(signUpError));
        return;
      }

      /*
       * Registering is a REQUEST now, so the team is told here.
       *
       * Deliberately after signUp rather than before: an address Supabase
       * refuses - malformed, rate-limited, already taken - is not a
       * registration, and queueing one would fill the list with people who
       * never signed up.
       */
      await requestBetaAccess(email);

      // Whether or not Supabase started a session, the destination is the same:
      // nothing is provisioned until the request is approved. This used to
      // branch - /verify-email with no session, /dashboard/new with one - and
      // that second branch is now a dead end that ends in a 403.
      router.push("/beta-pending");
    } catch (error) {
      failSignUp(getSignUpErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const card = (
    <section
      className={
        isDesktopApp
          ? "desktop-auth-soft-page desktop-auth-soft-back mx-auto grid w-full min-w-0 max-w-lg overflow-hidden rounded-2xl border border-white/80 bg-white/70 shadow-2xl shadow-[#1f4d73]/12 backdrop-blur-xl sm:rounded-4xl"
          : "grid min-h-dvh w-full min-w-0 lg:grid-cols-2"
      }
    >
<<<<<<< HEAD
      <div className={`relative overflow-hidden ${isDesktopApp ? "order-2 hidden" : "order-1 hidden bg-linear-to-br from-[#1f4d73] via-[#1a4066] to-[#0F172A] p-10 text-white lg:flex lg:flex-col lg:justify-center xl:p-16"}`}>
        <div className="pointer-events-none absolute -bottom-32 -left-28 h-80 w-md rounded-[50%] bg-[#3c86bd]/35 blur-3xl" />
=======
      <div className={`relative overflow-hidden ${isDesktopApp ? "order-2 hidden" : "order-1 hidden bg-linear-to-br from-[#1f4d73] via-[#1a4066] to-[#0F172A] p-8 text-white lg:flex lg:flex-col lg:justify-center xl:p-10 2xl:p-14"}`}>
        <div className="pointer-events-none absolute -bottom-32 -left-28 h-80 w-112 rounded-[50%] bg-[#3c86bd]/35 blur-3xl" />
>>>>>>> 4f5174064571d6be3fb7c0cab5d41a799059d122
        <div className="pointer-events-none absolute -right-28 top-1/4 h-72 w-72 rounded-full bg-[#0b5c8a]/35 blur-3xl" />
        <svg className="pointer-events-none absolute bottom-0 left-0 h-40 w-full text-white opacity-8" viewBox="0 0 640 180" fill="none" aria-hidden="true">
          <path d="M0 106C70 54 130 150 222 102C310 56 356 140 438 92C510 50 574 74 640 40V180H0Z" fill="currentColor" />
        </svg>
        <div className="pointer-events-none absolute right-10 top-36 hidden grid-cols-6 gap-3 opacity-35 sm:grid">
          {Array.from({ length: 36 }).map((_, index) => (
            <span key={index} className="h-1.5 w-1.5 rounded-full bg-white/70" />
          ))}
        </div>

        <div className="relative">
          <div>
            {/* The white wordmark straight on the navy, which is the pairing
                PORTAL_HEADER_FALLBACK_LOGO already makes for a dark ground. The
                navy artwork used to sit here on a white plate to stay legible,
                and that plate read as a card floating on the panel rather than
                as branding. */}
            <Link
              href="/"
              aria-label="Back to Event Core home"
              className="inline-flex transition hover:opacity-80"
            >
              <Image src="/images/branding/Footer-logo.png" alt="Hall Management SaaS" width={565} height={185} priority unoptimized className="h-auto w-40 max-w-full object-contain" />
            </Link>

            <p className="mt-8 text-sm font-black text-[#8fc0e8]">
              Welcome! <span aria-hidden="true">&#128075;</span>
            </p>
            <h1 className="mt-3 max-w-md text-3xl font-black leading-[1.12] tracking-tight text-white xl:text-4xl">
              Create your account
            </h1>
<<<<<<< HEAD
            <p className="mt-5 max-w-md text-base leading-8 text-white/75 sm:text-lg">
              Event Core is in private beta. Start with your email and a password, and we&apos;ll reach out as soon as your access is approved.
=======
            <p className="mt-4 max-w-md text-base leading-7 text-white/75">
              Start with your email and a password. You&apos;ll name your organization and choose a plan right after you confirm your inbox.
>>>>>>> 4f5174064571d6be3fb7c0cab5d41a799059d122
            </p>
          </div>

          <SignUpIllustration />

          <div className="mt-8 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/12 ring-1 ring-white/25">
              <ShieldIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-black text-white">Your data is secure with us.</p>
              <p className="mt-1 text-xs font-medium text-white/70">We use industry-standard encryption and best security practices.</p>
            </div>
          </div>
        </div>
      </div>

      <div className={`box-border w-full min-w-0 bg-white ${isDesktopApp ? "desktop-auth-form-panel order-1 p-4 sm:p-5" : "order-2 flex items-center justify-center px-5 py-8 sm:px-10 lg:px-14 2xl:px-16"}`}>
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
          ) : (
            // The brand panel is desktop-only, so small screens would otherwise
            // lose the logo and the way back to the marketing site.
            <Link
              href="/"
              aria-label="Back to Event Core home"
              className="mb-6 inline-flex w-fit lg:hidden"
            >
              <Image
                src="/images/branding/hms-logo-header.png"
                alt="Hall Management SaaS"
                width={612}
                height={408}
                priority
                unoptimized
                className="h-auto w-40 max-w-full object-contain"
              />
            </Link>
          )}
<<<<<<< HEAD
          <h2 className={`${isDesktopApp ? "text-xl" : "text-3xl sm:text-4xl"} font-black tracking-tight text-[#0F172A]`}>Request beta access</h2>
          {/* Was "Step 1 of 2 - organization details come next". They do not
              come next any more: nothing is provisioned until the request is
              approved, and promising the setup form strands somebody on a 403. */}
          <p className={`${isDesktopApp ? "mt-1 text-sm" : "mt-3 text-base sm:mt-4 sm:text-lg"} text-[#64748B]`}>Event Core is in private beta. Create your account and we&apos;ll be in touch once it is approved.</p>
=======
          <h2 className={`${isDesktopApp ? "text-xl" : "text-2xl sm:text-3xl"} font-black tracking-tight text-[#0F172A]`}>Get started free</h2>
          <p className={`${isDesktopApp ? "mt-1 text-sm" : "mt-2 text-sm sm:text-base"} text-[#64748B]`}>Step 1 of 2 &mdash; create the owner account. Organization details come next.</p>
>>>>>>> 4f5174064571d6be3fb7c0cab5d41a799059d122

          <form className={isDesktopApp ? "mt-3" : "mt-6"} onSubmit={submit}>
            <label className="block text-sm font-bold text-[#0F172A]" htmlFor="signupEmail">
              Email Address
            </label>
            <div className={`login-field mt-1.5 flex items-center gap-3 border border-[#E5E0D6] bg-white px-3 transition focus-within:border-[#1f4d73] focus-within:shadow-[0_0_0_4px_rgba(31,77,115,0.14)] ${isDesktopApp ? "h-9" : "h-11"}`}>
              <EmailIcon />
              <input
                id="signupEmail"
                name="email"
                autoComplete="email"
                className="min-w-0 flex-1 bg-transparent text-sm text-[#0F172A] outline-none placeholder:text-[#9aa5ba]"
                placeholder="Enter your email address"
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
              />
            </div>

            <label className={`${isDesktopApp ? "mt-2.5 text-sm" : "mt-5 text-sm"} block font-bold text-[#0F172A]`} htmlFor="signupPassword">
              Password
            </label>
            <div className={`login-field mt-1.5 flex items-center gap-3 border border-[#E5E0D6] bg-white px-3 transition focus-within:border-[#1f4d73] focus-within:shadow-[0_0_0_4px_rgba(31,77,115,0.14)] ${isDesktopApp ? "h-9" : "h-11"}`}>
              <LockIcon />
              <input
                id="signupPassword"
                name="newPassword"
                autoComplete="new-password"
                className="min-w-0 flex-1 bg-transparent text-sm text-[#0F172A] outline-none placeholder:text-[#9aa5ba]"
                placeholder="Create a password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(event) => updateField("password", event.target.value)}
              />
              <button className="login-icon-button text-[#64748B] transition hover:text-[#1f4d73]" type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>
                <EyeIcon isVisible={showPassword} />
              </button>
            </div>
            <p className={`${isDesktopApp ? "mt-1.5 text-xs" : "mt-2 text-xs"} font-medium text-[#64748B]`}>
              {PASSWORD_RULES_HINT}
            </p>

            {error ? (
              <p className={`${isDesktopApp ? "mt-3" : "mt-5"} text-sm font-bold text-[#c2410c]`} role="alert">
                {error}
              </p>
            ) : null}

            <button
              className={`login-button flex w-full items-center justify-center gap-3 bg-linear-to-r from-[#1f4d73] to-[#0F172A] font-black text-white shadow-xl shadow-[#0F172A]/25 transition hover:brightness-110 hover:shadow-2xl disabled:cursor-not-allowed disabled:opacity-70 ${isDesktopApp ? "mt-3 h-10 text-sm" : "mt-6 h-12 text-base"}`}
              type="submit"
              disabled={isSubmitting}
            >
              <ArrowLoginIcon />
              {isSubmitting ? "Creating account..." : "Create account"}
            </button>

            <AuthDivider className={isDesktopApp ? "my-4" : "my-6"} />

            <AuthSocialButtons
              size={isDesktopApp ? "sm" : "md"}
              oauthProvider={oauthProvider}
              onProviderClick={signUpWithProvider}
            />

            <p className={`${isDesktopApp ? "mt-3 text-xs leading-5" : "mt-4 text-xs leading-5"} text-center font-medium text-[#64748B]`}>
              By creating an account you agree to the{" "}
              <Link className="font-bold text-[#1f4d73] transition hover:text-[#15344f]" href="#terms">
                Terms &amp; Privacy Policy
              </Link>
              .
            </p>

            <p className={`${isDesktopApp ? "mt-3 text-xs" : "mt-4 text-sm"} text-center text-[#64748B]`}>
              Already have an account?{" "}
              <Link className="font-bold text-[#1f4d73] transition hover:text-[#1f4d73]" href={isDesktopApp ? "/login?desktop=1" : "/login"}>
                Login
              </Link>
            </p>
          </form>
        </div>
      </div>
    </section>
  );

  if (!isDesktopApp) {
    return card;
  }

  // The desktop shell keeps the old floating-panel presentation, so it has to
  // supply the page ground itself - the web layout is a full-bleed split now
  // and no longer centres anything for it.
  return (
    <div className="relative flex min-h-dvh w-full items-center justify-center overflow-x-hidden bg-linear-to-br from-white via-[#F7F4ED] to-[#F1F5F9] px-2 py-4 sm:px-6 sm:py-8">
      <div className="pointer-events-none absolute -left-24 top-16 h-80 w-80 rounded-full bg-[#F1F5F9] blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-14 h-96 w-96 rounded-full bg-[#E5E0D6] blur-3xl" />
      <div className="relative flex w-full max-w-7xl items-center justify-center">
        {card}
      </div>
    </div>
  );
}
