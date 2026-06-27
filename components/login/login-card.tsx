"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";

function EmailIcon() {
  return (
    <svg className="h-5 w-5 text-[#8290ad]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h16v12H4zM4 6l8 7 8-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="h-5 w-5 text-[#8290ad]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
    <svg className="h-7 w-7 text-[#3155ff]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
      <div className="absolute bottom-0 left-2 h-44 w-44 rounded-full bg-[#c7d8ff]/65 blur-3xl" />
      <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[#d9c7ff]/70 blur-3xl" />

      <div className="relative mx-auto w-full max-w-107.5">
        <div className="relative mx-auto h-56 w-[88%] rotate-[-4deg] overflow-hidden rounded-3xl border border-white/80 bg-white shadow-2xl shadow-[#3155ff]/20">
          <div className="flex h-10 items-center gap-2 border-b border-[#eef2ff] bg-[#fbfcff] px-4">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff6b6b]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#ffbf4d]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#32d583]" />
          </div>
          <div className="grid h-[calc(100%-40px)] grid-cols-[95px_1fr]">
            <div className="bg-linear-to-b from-[#3155ff] to-[#7138f5] p-4">
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
                <div className="h-14 rounded-2xl bg-[#eef3ff]" />
                <div className="h-14 rounded-2xl bg-[#f4f0ff]" />
                <div className="h-14 rounded-2xl bg-[#eef3ff]" />
              </div>
              <div className="mt-5 grid grid-cols-[1fr_72px] gap-4">
                <div className="h-24 rounded-2xl bg-white shadow-inner shadow-[#3155ff]/10">
                  <svg className="h-full w-full p-4 text-[#3155ff]" viewBox="0 0 160 80" fill="none" aria-hidden="true">
                    <path d="M8 64c22-42 42-10 62-38 16-22 39 18 82-12" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="h-24 rounded-2xl bg-[#f5f3ff] p-3">
                  <div className="h-full rounded-full border-10 border-[#7138f5] border-l-[#d9d0ff]" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute -right-2 top-24 w-36 rounded-3xl border border-white/80 bg-white/90 p-4 shadow-xl shadow-[#7138f5]/15 backdrop-blur">
          <div className="mb-3 h-3 w-20 rounded-full bg-[#3155ff]/30" />
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 9 }).map((_, index) => (
              <span key={index} className="h-5 rounded-md bg-[#eef3ff]" />
            ))}
          </div>
        </div>

        <div className="absolute bottom-5 right-16 flex h-20 w-20 items-center justify-center rounded-3xl bg-linear-to-br from-[#3155ff] to-[#8b37f6] text-white shadow-2xl shadow-[#3155ff]/30">
          <LockIcon />
        </div>
      </div>
    </div>
  );
}

type LoginCardProps = {
  compact?: boolean;
  onSignupClick?: () => void;
  onForgotPasswordClick?: () => void;
};

export function LoginCard({ compact = false, onSignupClick, onForgotPasswordClick }: LoginCardProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setError("Please enter your email address and password.");
      return;
    }

    setError("");
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

            <div className="relative">
              <Link href="/" aria-label="Back to Hall Management SaaS home">
                <Image src="/hms-logo-header.png" alt="Hall Management SaaS" width={1160} height={300} priority className="h-auto w-64 max-w-full object-contain" />
              </Link>

              <p className={`${compact ? "mt-8" : "mt-10"} text-base font-black text-[#3155ff]`}>Welcome Back!</p>
              <h1 className="mt-6 max-w-md text-4xl font-black leading-[1.12] tracking-tight text-[#09122f] sm:text-5xl">
                Login to your account
              </h1>
              <p className="mt-5 max-w-md text-lg leading-8 text-[#52607d]">
                Access your dashboard to manage bookings, events, payments, and hall operations all in one place.
              </p>

              {!compact ? <DashboardIllustration /> : <div className="hidden lg:block"><DashboardIllustration /></div>}

              <div className={`${compact ? "mt-8" : "mt-10"} flex items-center gap-4`}>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/80 shadow-lg shadow-[#3155ff]/10">
                  <ShieldIcon />
                </div>
                <div>
                  <p className="font-black text-[#09122f]">Your data is secure with us.</p>
                  <p className="mt-1 text-sm font-medium text-[#52607d]">We use industry-standard encryption.</p>
                </div>
              </div>
            </div>
          </div>

          <div className={`bg-white p-8 sm:p-10 ${compact ? "lg:p-10" : "lg:p-16"}`}>
            <div className="mx-auto flex h-full max-w-xl flex-col justify-center">
              <h2 id="login-modal-title" className="text-4xl font-black tracking-tight text-[#09122f]">Login</h2>
              <p className="mt-4 text-lg text-[#52607d]">Enter your credentials to continue</p>

              <form className={compact ? "mt-8" : "mt-10"} onSubmit={submit}>
                <label className="text-base font-bold text-[#09122f]" htmlFor="email">
                  Email Address
                </label>
                <div className="login-field mt-3 flex h-14 items-center gap-4 border border-[#cfd7e8] bg-white px-4 transition focus-within:border-[#3155ff] focus-within:shadow-[0_0_0_4px_rgba(49,85,255,0.12)]">
                  <EmailIcon />
                  <input
                    id="email"
                    className="min-w-0 flex-1 bg-transparent text-base text-[#09122f] outline-none placeholder:text-[#9aa5ba]"
                    placeholder="Enter your email address"
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setError("");
                    }}
                  />
                </div>

                <label className={`${compact ? "mt-5" : "mt-7"} block text-base font-bold text-[#09122f]`} htmlFor="password">
                  Password
                </label>
                <div className="login-field mt-3 flex h-14 items-center gap-4 border border-[#cfd7e8] bg-white px-4 transition focus-within:border-[#3155ff] focus-within:shadow-[0_0_0_4px_rgba(49,85,255,0.12)]">
                  <LockIcon />
                  <input
                    id="password"
                    className="min-w-0 flex-1 bg-transparent text-base text-[#09122f] outline-none placeholder:text-[#9aa5ba]"
                    placeholder="Enter your password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError("");
                    }}
                  />
                  <button
                    className="login-icon-button text-[#8290ad] transition hover:text-[#3155ff]"
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <EyeIcon isVisible={showPassword} />
                  </button>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                  <label className="flex cursor-pointer items-center gap-3 text-base font-medium text-[#52607d]" htmlFor="remember">
                    <input
                      id="remember"
                      className="login-checkbox h-5 w-5 border border-[#cfd7e8] accent-[#3155ff]"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(event) => setRememberMe(event.target.checked)}
                    />
                    Remember me
                  </label>
                  {onForgotPasswordClick ? (
                    <button className="font-bold text-[#4f2cff] transition hover:text-[#3155ff]" type="button" onClick={onForgotPasswordClick}>
                      Forgot password?
                    </button>
                  ) : (
                    <Link className="font-bold text-[#4f2cff] transition hover:text-[#3155ff]" href="/forgot-password">
                      Forgot password?
                    </Link>
                  )}
                </div>

                {error ? <p className="mt-5 text-sm font-bold text-[#c2410c]">{error}</p> : null}

                <button className={`${compact ? "mt-6" : "mt-8"} login-button flex h-16 w-full items-center justify-center gap-3 bg-linear-to-r from-[#0e4cff] to-[#8b37f6] text-lg font-black text-white shadow-xl shadow-[#5436ff]/25 transition hover:brightness-110 hover:shadow-2xl`} type="submit">
                  <ArrowLoginIcon />
                  Login
                </button>

                <div className={`${compact ? "my-8" : "my-10"} flex items-center gap-5 text-sm font-medium text-[#8290ad]`}>
                  <span className="h-px flex-1 bg-[#dbe2ef]" />
                  or continue with
                  <span className="h-px flex-1 bg-[#dbe2ef]" />
                </div>

                <div className="space-y-4">
                  <button className="login-social flex h-14 w-full items-center justify-center gap-4 border border-[#d2d9e8] bg-white text-base font-bold text-[#09122f] transition hover:border-[#3155ff] hover:bg-[#f8faff]" type="button">
                    <GoogleIcon />
                    Continue with Google
                  </button>
                  <button className="login-social flex h-14 w-full items-center justify-center gap-4 border border-[#d2d9e8] bg-white text-base font-bold text-[#09122f] transition hover:border-[#3155ff] hover:bg-[#f8faff]" type="button">
                    <MicrosoftIcon />
                    Continue with Microsoft
                  </button>
                </div>

                <p className="mt-10 text-center text-base text-[#52607d]">
                  Don&apos;t have an account?{" "}
                  {onSignupClick ? (
                    <button className="font-bold text-[#4f2cff] transition hover:text-[#3155ff]" type="button" onClick={onSignupClick}>
                      Sign Up Now
                    </button>
                  ) : (
                    <Link className="font-bold text-[#4f2cff] transition hover:text-[#3155ff]" href="/signup">
                      Sign Up Now
                    </Link>
                  )}
                </p>
              </form>
            </div>
          </div>
        </section>
  );
}
