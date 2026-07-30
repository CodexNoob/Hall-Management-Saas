"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithOAuthProvider, syncSignedInUser } from "@/lib/auth/client";
import { useDesktopAppMode } from "@/lib/desktop-app/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function EmailIcon() {
  return (
    <svg className="h-5 w-5 text-[#64748B]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h16v12H4zM4 6l8 7 8-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="h-5 w-5 text-[#64748B]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 10V8a5 5 0 0 1 10 0v2M6 10h12v10H6zM12 14v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeIcon({ isVisible }: { isVisible: boolean }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {isVisible ? (
        <>
          <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="2" />
        </>
      ) : (
        <>
          <path d="M3 12s3.5-6 9-6c2 0 3.8.8 5.2 1.8M21 12s-3.5 6-9 6c-2 0-3.8-.8-5.2-1.8M4 4l16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

function ArrowLoginIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10 7 15 12l-5 5M15 12H3M14 4h5v16h-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
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

function GoogleIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.3h6a5.1 5.1 0 0 1-2.2 3.3v2.8h3.6c2.1-1.9 3.2-4.8 3.2-8.2Z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.4-2.6l-3.6-2.8c-1 .7-2.3 1-3.8 1-2.9 0-5.3-1.9-6.1-4.5H2.2V17A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.9 14.1a6.6 6.6 0 0 1 0-4.2V7H2.2a11 11 0 0 0 0 10l3.7-2.9Z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A10.8 10.8 0 0 0 12 1 11 11 0 0 0 2.2 7l3.7 2.9c.8-2.6 3.2-4.5 6.1-4.5Z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#F35325" d="M3 3h8.5v8.5H3z" />
      <path fill="#81BC06" d="M12.5 3H21v8.5h-8.5z" />
      <path fill="#05A6F0" d="M3 12.5h8.5V21H3z" />
      <path fill="#FFBA08" d="M12.5 12.5H21V21h-8.5z" />
    </svg>
  );
}

function DashboardIllustration() {
  return (
    <div className="relative mt-10 min-h-75 overflow-hidden lg:mt-12">
      <div className="absolute bottom-0 left-2 h-44 w-44 rounded-full bg-[#E7E3DA]/65 blur-3xl" />
      <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[#1f4d73]/70 blur-3xl" />

      <div className="relative mx-auto w-full max-w-107.5">
        <div className="relative mx-auto h-56 w-[88%] rotate-[-4deg] overflow-hidden rounded-3xl border border-white/80 bg-white shadow-2xl shadow-[#1f4d73]/20">
          <div className="flex h-10 items-center gap-2 border-b border-[#E5E0D6] bg-[#FFFFFF] px-4">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff6b6b]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#ffbf4d]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#32d583]" />
          </div>
          <div className="grid h-[calc(100%-40px)] grid-cols-[95px_1fr]">
            <div className="bg-linear-to-b from-[#1f4d73] to-[#0F172A] p-4">
              <div className="h-3 w-14 rounded-full bg-white/80" />
              <div className="mt-6 space-y-3">
                <div className="h-3 w-16 rounded-full bg-white/50" />
                <div className="h-3 w-12 rounded-full bg-white/30" />
                <div className="h-3 w-14 rounded-full bg-white/30" />
                <div className="h-3 w-10 rounded-full bg-white/30" />
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="h-14 rounded-2xl bg-[#F7F4ED]" />
                <div className="h-14 rounded-2xl bg-[#F7F4ED]" />
                <div className="h-14 rounded-2xl bg-[#F7F4ED]" />
              </div>
              <div className="mt-5 grid grid-cols-[1fr_72px] gap-4">
                <div className="h-24 rounded-2xl bg-white shadow-inner shadow-[#1f4d73]/10">
                  <svg className="h-full w-full p-4 text-[#1f4d73]" viewBox="0 0 160 80" fill="none" aria-hidden="true">
                    <path d="M8 64c22-42 42-10 62-38 16-22 39 18 82-12" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="h-24 rounded-2xl bg-[#F7F4ED] p-3">
                  <div className="h-full rounded-full border-10 border-[#0F172A] border-l-[#E5E0D6]" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute -right-2 top-24 w-36 rounded-3xl border border-white/80 bg-white/90 p-4 shadow-xl shadow-[#0F172A]/15 backdrop-blur">
          <div className="mb-3 h-3 w-20 rounded-full bg-[#1f4d73]/30" />
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 9 }).map((_, index) => (
              <span key={index} className="h-5 rounded-md bg-[#F7F4ED]" />
            ))}
          </div>
        </div>

        <div className="absolute bottom-5 right-16 flex h-20 w-20 items-center justify-center rounded-3xl bg-linear-to-br from-[#1f4d73] to-[#0F172A] text-white shadow-2xl shadow-[#1f4d73]/30">
          <LockIcon />
        </div>
      </div>
    </div>
  );
}

type LoginCardProps = {
  compact?: boolean;
  onStartTrialClick?: () => void;
  onForgotPasswordClick?: () => void;
};

export function LoginCard({ compact = false, onStartTrialClick, onForgotPasswordClick }: LoginCardProps) {
  const router = useRouter();
  const isDesktopApp = useDesktopAppMode();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<"google" | "azure" | null>(null);

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

    if (!email.trim() || !password.trim()) {
      setError("Please enter your email address and password.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      if (data.session?.access_token) {
        await syncSignedInUser(data.session.access_token, { force: true });
      }

      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to sign in. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const signInWithProvider = async (provider: "google" | "azure") => {
    setOauthProvider(provider);
    setError("");

    try {
      await signInWithOAuthProvider(provider);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to start social login.");
      setOauthProvider(null);
    }
  };

  return (
    <section className={`mx-auto grid w-full min-w-0 overflow-hidden rounded-2xl border border-white/80 bg-white/70 shadow-2xl shadow-[#1f4d73]/12 backdrop-blur-xl sm:rounded-4xl ${isDesktopApp ? "desktop-auth-soft-page desktop-auth-soft-back max-h-[760px] max-w-6xl grid-cols-[0.92fr_1fr]" : "lg:grid-cols-2"}`}>
          <div className={`order-2 relative overflow-hidden p-5 sm:p-10 lg:order-1 ${isDesktopApp ? "desktop-auth-info-panel block bg-linear-to-br from-white via-[#F7F4ED] to-[#F1F5F9] p-8" : compact ? "hidden bg-linear-to-br from-white via-[#F7F4ED] to-[#F1F5F9] lg:block lg:p-10" : "bg-linear-to-br from-white via-[#F7F4ED] to-[#F1F5F9] lg:p-14"}`}>
            <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-96 rounded-[50%] bg-[#E7E3DA]/80 blur-2xl" />
            <div className="pointer-events-none absolute -right-24 top-1/3 h-64 w-64 rounded-full bg-[#1f4d73]/80 blur-2xl" />
            <div className="pointer-events-none absolute right-10 top-36 hidden grid-cols-6 gap-3 opacity-35 sm:grid">
              {Array.from({ length: 36 }).map((_, index) => (
                <span key={index} className="h-1.5 w-1.5 rounded-full bg-[#1f4d73]" />
              ))}
            </div>

            <div className="relative">
              {isDesktopApp ? (
                <Image src="/images/branding/hms-logo-header.png" alt="Hall Management SaaS" width={612} height={408} priority unoptimized className="h-auto w-64 max-w-full object-contain" />
              ) : (
                <Link href="/" aria-label="Back to Hall Management SaaS home">
                  <Image src="/images/branding/hms-logo-header.png" alt="Hall Management SaaS" width={612} height={408} priority unoptimized className="h-auto w-64 max-w-full object-contain" />
                </Link>
              )}

              <p className={`${isDesktopApp ? "mt-8" : compact ? "mt-8" : "mt-10"} text-base font-black text-[#1f4d73]`}>Welcome Back!</p>
              <h1 className={`${isDesktopApp ? "mt-4 text-4xl" : "mt-5 text-3xl sm:mt-6 sm:text-5xl"} max-w-md font-black leading-[1.12] tracking-tight text-[#0F172A]`}>
                Login to your account
              </h1>
              <p className={`${isDesktopApp ? "mt-4 text-base leading-7" : "mt-4 text-base leading-7 sm:mt-5 sm:text-lg sm:leading-8"} max-w-md text-[#64748B]`}>
                Access your dashboard to manage bookings, events, payments, and hall operations all in one place.
              </p>

              {isDesktopApp ? null : !compact ? <DashboardIllustration /> : <div className="hidden lg:block"><DashboardIllustration /></div>}

              <div className={`${isDesktopApp ? "mt-8" : compact ? "mt-8" : "mt-10"} flex items-center gap-4`}>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/80 shadow-lg shadow-[#1f4d73]/10">
                  <ShieldIcon />
                </div>
                <div>
                  <p className="font-black text-[#0F172A]">Your data is secure with us.</p>
                  <p className="mt-1 text-sm font-medium text-[#64748B]">We use industry-standard encryption.</p>
                </div>
              </div>
            </div>
          </div>

          <div className={`order-1 box-border w-full min-w-0 lg:order-2 ${isDesktopApp ? "desktop-auth-form-panel bg-white p-8" : compact ? "bg-white p-5 pt-16 sm:p-10 lg:p-10" : "bg-white p-5 sm:p-10 lg:p-16"}`}>
            <div className={`mx-auto flex h-full w-full min-w-0 flex-col justify-center ${isDesktopApp ? "max-w-md" : "max-w-xl"}`}>
              <h2 id="login-modal-title" className={`${isDesktopApp ? "text-xl" : "text-3xl sm:text-4xl"} font-black tracking-tight text-[#0F172A]`}>Employee Login</h2>
              <p className={`${isDesktopApp ? "mt-2 text-sm" : "mt-3 text-base sm:mt-4 sm:text-lg"} text-[#64748B]`}>Use your organization account to continue.</p>

              <form className={isDesktopApp ? "mt-4" : compact ? "mt-8" : "mt-10"} onSubmit={submit}>
                <label className={`${isDesktopApp ? "text-sm" : "text-base"} font-bold text-[#0F172A]`} htmlFor="email">
                  Email Address
                </label>
                <div className={`login-field mt-2 flex items-center gap-3 border border-[#E5E0D6] bg-white px-3 transition focus-within:border-[#1f4d73] focus-within:shadow-[0_0_0_4px_rgba(31,77,115,0.14)] ${isDesktopApp ? "h-10" : "h-14"}`}>
                  <EmailIcon />
                  <input
                    id="email"
                    name="email"
                    autoComplete="email"
                    className="min-w-0 flex-1 bg-transparent text-base text-[#0F172A] outline-none placeholder:text-[#9aa5ba]"
                    placeholder="Enter your email address"
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setError("");
                    }}
                  />
                </div>

                <label className={`${isDesktopApp ? "mt-4 text-sm" : compact ? "mt-5 text-base" : "mt-7 text-base"} block font-bold text-[#0F172A]`} htmlFor="password">
                  Password
                </label>
                <div className={`login-field mt-2 flex items-center gap-3 border border-[#E5E0D6] bg-white px-3 transition focus-within:border-[#1f4d73] focus-within:shadow-[0_0_0_4px_rgba(31,77,115,0.14)] ${isDesktopApp ? "h-10" : "h-14"}`}>
                  <LockIcon />
                  <input
                    id="password"
                    name="password"
                    autoComplete="current-password"
                    className="min-w-0 flex-1 bg-transparent text-base text-[#0F172A] outline-none placeholder:text-[#9aa5ba]"
                    placeholder="Enter your password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError("");
                    }}
                  />
                  <button
                    className="login-icon-button text-[#64748B] transition hover:text-[#1f4d73]"
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <EyeIcon isVisible={showPassword} />
                  </button>
                </div>

                <div className={`${isDesktopApp ? "mt-3 text-sm" : "mt-6 text-base"} flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4`}>
                  <label className="flex cursor-pointer items-center gap-3 font-medium text-[#64748B]" htmlFor="remember">
                    <input
                      id="remember"
                      className="login-checkbox h-5 w-5 border border-[#E5E0D6] accent-[#1f4d73]"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(event) => setRememberMe(event.target.checked)}
                    />
                    Remember me
                  </label>
                  {onForgotPasswordClick ? (
                    <button className="font-bold text-[#1f4d73] transition hover:text-[#1f4d73]" type="button" onClick={onForgotPasswordClick}>
                      Forgot password?
                    </button>
                  ) : (
                    <Link className="font-bold text-[#1f4d73] transition hover:text-[#1f4d73]" href={isDesktopApp ? "/forgot-password?desktop=1" : "/forgot-password"}>
                      Forgot password?
                    </Link>
                  )}
                </div>

                {error ? <p className="mt-5 text-sm font-bold text-[#c2410c]">{error}</p> : null}

                <button
                  className={`${isDesktopApp || compact ? "mt-5" : "mt-8"} login-button flex w-full items-center justify-center gap-3 bg-linear-to-r from-[#1f4d73] to-[#0F172A] font-black text-white shadow-xl shadow-[#0F172A]/25 transition hover:brightness-110 hover:shadow-2xl disabled:cursor-not-allowed disabled:opacity-70 ${isDesktopApp ? "h-11 text-sm" : "h-16 text-lg"}`}
                  type="submit"
                  disabled={isSubmitting}
                >
                  <ArrowLoginIcon />
                  {isSubmitting ? "Logging in..." : "Login"}
                </button>

                <div className={`${isDesktopApp ? "my-5" : compact ? "my-7" : "my-10"} flex items-center gap-5 text-sm font-medium text-[#64748B]`}>
                  <span className="h-px flex-1 bg-[#E5E0D6]" />
                  or continue with
                  <span className="h-px flex-1 bg-[#E5E0D6]" />
                </div>

                <div className={isDesktopApp ? "space-y-3" : "space-y-4"}>
                  <button
                    className={`login-social flex w-full items-center justify-center gap-4 border border-[#E5E0D6] bg-white font-bold text-[#0F172A] transition hover:border-[#1f4d73] hover:bg-[#F7F4ED] disabled:cursor-not-allowed disabled:opacity-70 ${isDesktopApp ? "h-10 text-sm" : "h-14 text-base"}`}
                    type="button"
                    disabled={oauthProvider !== null}
                    onClick={() => signInWithProvider("google")}
                  >
                    <GoogleIcon />
                    {oauthProvider === "google" ? "Opening Google..." : "Continue with Google"}
                  </button>
                  <button
                    className={`login-social flex w-full items-center justify-center gap-4 border border-[#E5E0D6] bg-white font-bold text-[#0F172A] transition hover:border-[#1f4d73] hover:bg-[#F7F4ED] disabled:cursor-not-allowed disabled:opacity-70 ${isDesktopApp ? "h-10 text-sm" : "h-14 text-base"}`}
                    type="button"
                    disabled={oauthProvider !== null}
                    onClick={() => signInWithProvider("azure")}
                  >
                    <MicrosoftIcon />
                    {oauthProvider === "azure" ? "Opening Microsoft..." : "Continue with Microsoft"}
                  </button>
                </div>

                {!isDesktopApp ? (
                  <div className="mt-9 rounded-2xl border border-[#E5E0D6] bg-[#F7F4ED] p-4 text-center">
                    <p className="font-bold text-[#0F172A]">Joining an existing organization?</p>
                    <p className="mt-1 text-sm leading-6 text-[#64748B]">
                      Ask your administrator for an invitation, then open the secure link sent to your email.
                    </p>
                  </div>
                ) : null}

                {!isDesktopApp ? (
                <p className="mt-5 text-center text-base text-[#64748B]">
                  Opening a new hall organization?{" "}
                  {onStartTrialClick ? (
                    <button className="font-bold text-[#1f4d73] transition hover:text-[#15344f]" type="button" onClick={onStartTrialClick}>
                      Start free trial
                    </button>
                  ) : (
                    <Link className="font-bold text-[#1f4d73] transition hover:text-[#15344f]" href="/start-trial">
                      Start free trial
                    </Link>
                  )}
                </p>
                ) : null}
              </form>
            </div>
          </div>
        </section>
  );
}
