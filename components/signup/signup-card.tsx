"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithOAuthProvider, syncSignedInUser } from "@/lib/auth/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function UserIcon() {
  return (
    <svg className="h-5 w-5 text-[#64748B]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg className="h-5 w-5 text-[#64748B]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h16v12H4zM4 6l8 7 8-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className="h-5 w-5 text-[#64748B]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 4 4.5 6.5c-.6.6-.7 1.5-.3 2.3 2.3 4.8 6.2 8.7 11 11 .8.4 1.7.3 2.3-.3L20 17l-4-3-2 2c-2.5-1.1-4.5-3.1-5.6-5.6l2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg className="h-5 w-5 text-[#64748B]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 21h16M6 21V7l6-3 6 3v14M9 10h2M13 10h2M9 14h2M13 14h2M9 18h2M13 18h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
        <path d="M3 12s3.5-6 9-6c2 0 3.8.8 5.2 1.8M21 12s-3.5 6-9 6c-2 0-3.8-.8-5.2-1.8M4 4l16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
    <svg className="h-7 w-7 text-[#B9974D]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

function SignupIllustration() {
  return (
    <div className="relative mt-10 min-h-75 lg:mt-12">
      <div className="absolute bottom-0 left-2 h-48 w-48 rounded-full bg-[#E7E3DA]/70 blur-3xl" />
      <div className="absolute right-2 top-4 h-44 w-44 rounded-full bg-[#B9974D]/75 blur-3xl" />

      <div className="relative mx-auto w-full max-w-107.5">
        <div className="relative mx-auto h-60 w-[88%] rotate-[-4deg] overflow-hidden rounded-4xl border border-white/80 bg-white shadow-2xl shadow-[#B9974D]/20">
          <div className="flex h-11 items-center justify-between border-b border-[#E5E0D6] bg-[#FFFFFF] px-5">
            <div className="flex gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff6b6b]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#ffbf4d]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#32d583]" />
            </div>
            <span className="h-3 w-20 rounded-full bg-[#E5E0D6]" />
          </div>
          <div className="grid h-[calc(100%-44px)] grid-cols-[98px_1fr]">
            <div className="bg-linear-to-b from-[#B9974D] to-[#0F172A] p-4">
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
                  <p className="h-2 w-12 rounded-full bg-[#B9974D]/25" />
                  <p className="mt-3 text-lg font-black text-[#0F172A]">128</p>
                </div>
                <div className="rounded-2xl bg-[#F7F4ED] p-3">
                  <p className="h-2 w-14 rounded-full bg-[#0F172A]/25" />
                  <p className="mt-3 text-lg font-black text-[#0F172A]">$24k</p>
                </div>
                <div className="rounded-2xl bg-[#F7F4ED] p-3">
                  <p className="h-2 w-12 rounded-full bg-[#B9974D]/25" />
                  <p className="mt-3 text-lg font-black text-[#0F172A]">92%</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-[1fr_78px] gap-4">
                <div className="h-24 rounded-2xl bg-white shadow-inner shadow-[#B9974D]/10">
                  <svg className="h-full w-full p-4 text-[#B9974D]" viewBox="0 0 160 80" fill="none" aria-hidden="true">
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

        <div className="absolute -left-3 bottom-16 w-34 rounded-3xl border border-white/80 bg-white/90 p-4 shadow-xl shadow-[#B9974D]/15 backdrop-blur">
          <p className="text-xs font-black text-[#64748B]">Next Booking</p>
          <p className="mt-2 text-sm font-black text-[#0F172A]">Wedding Event</p>
          <p className="mt-1 text-xs font-bold text-[#64748B]">May 22, 2026</p>
        </div>

        <div className="absolute -right-2 top-24 w-36 rounded-3xl border border-white/80 bg-white/90 p-4 shadow-xl shadow-[#0F172A]/15 backdrop-blur">
          <p className="text-xs font-black text-[#64748B]">Revenue</p>
          <p className="mt-2 text-lg font-black text-[#0F172A]">$125,000</p>
          <p className="mt-1 text-xs font-black text-[#16a34a]">+16.5%</p>
        </div>

        <div className="absolute bottom-0 right-16 flex h-20 w-20 items-center justify-center rounded-3xl bg-linear-to-br from-[#B9974D] to-[#0F172A] text-white shadow-2xl shadow-[#B9974D]/30">
          <ShieldIcon />
        </div>
      </div>
    </div>
  );
}

type SignupCardProps = {
  compact?: boolean;
  onLoginClick?: () => void;
};

export function SignupCard({ compact = false, onLoginClick }: SignupCardProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    countryCode: "+1",
    phone: "",
    venue: "",
    password: "",
    confirmPassword: "",
    acceptedTerms: false
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<"google" | "azure" | null>(null);

  const updateField = (name: keyof typeof form, value: string | boolean) => {
    setForm((current) => ({ ...current, [name]: value }));
    setError("");
    setSuccess("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.fullName.trim() || !form.email.trim() || !form.phone.trim() || !form.venue.trim() || !form.password.trim() || !form.confirmPassword.trim()) {
      setError("Please complete all required fields.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!form.acceptedTerms) {
      setError("Please agree to the Terms & Privacy Policy.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: form.fullName.trim(),
            phone: `${form.countryCode} ${form.phone.trim()}`,
            venue_name: form.venue.trim()
          }
        }
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.session?.access_token) {
        await syncSignedInUser(data.session.access_token);
        router.push("/dashboard");
        router.refresh();
        return;
      }

      setSuccess("Account created. Please check your email to confirm your account.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to create your account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const signInWithProvider = async (provider: "google" | "azure") => {
    setOauthProvider(provider);
    setError("");
    setSuccess("");

    try {
      await signInWithOAuthProvider(provider);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to start social login.");
      setOauthProvider(null);
    }
  };

  return (
    <section className="grid w-full overflow-hidden rounded-4xl border border-white/80 bg-white/70 shadow-2xl shadow-[#B9974D]/12 backdrop-blur-xl lg:grid-cols-2">
      <div className={`order-2 relative overflow-hidden bg-linear-to-br from-white via-[#F7F4ED] to-[#F1F5F9] p-8 sm:p-10 ${compact ? "lg:p-10" : "lg:p-14"}`}>
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-96 rounded-[50%] bg-[#E7E3DA]/80 blur-2xl" />
        <div className="pointer-events-none absolute -right-24 top-1/3 h-64 w-64 rounded-full bg-[#B9974D]/80 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 right-0 h-56 w-80 rounded-[48%] bg-[#E7E3DA]/75 blur-2xl" />
        <div className="pointer-events-none absolute bottom-16 left-10 hidden grid-cols-8 gap-3 opacity-25 sm:grid">
          {Array.from({ length: 48 }).map((_, index) => (
            <span key={index} className="h-1.5 w-1.5 rounded-full bg-[#0F172A]" />
          ))}
        </div>
        <svg className="pointer-events-none absolute bottom-0 left-0 h-40 w-full text-[#B9974D] opacity-25" viewBox="0 0 640 180" fill="none" aria-hidden="true">
          <path d="M0 106C70 54 130 150 222 102C310 56 356 140 438 92C510 50 574 74 640 40V180H0Z" fill="currentColor" />
        </svg>
        <div className="pointer-events-none absolute right-10 top-36 hidden grid-cols-6 gap-3 opacity-35 sm:grid">
          {Array.from({ length: 36 }).map((_, index) => (
            <span key={index} className="h-1.5 w-1.5 rounded-full bg-[#B9974D]" />
          ))}
        </div>

        <div className={`relative ${compact ? "lg:sticky lg:top-0 lg:flex lg:min-h-[calc(90vh-80px)] lg:flex-col lg:justify-between lg:gap-6" : ""}`}>
          <div>
            <Link href="/" aria-label="Back to Hall Management SaaS home">
              <Image src="/hms-logo-header.png" alt="Hall Management SaaS" width={1160} height={300} priority unoptimized className="h-auto w-64 max-w-full object-contain" />
            </Link>

            <p className="mt-10 text-base font-black text-[#B9974D]">
              Welcome! <span aria-hidden="true">&#128075;</span>
            </p>
            <h1 className="mt-6 max-w-md text-4xl font-black leading-[1.12] tracking-tight text-[#0F172A] sm:text-5xl">
              Create your account
            </h1>
            <p className="mt-5 max-w-md text-lg leading-8 text-[#64748B]">
              Get started with powerful tools to manage hall bookings, events, payments, and operations&mdash;all in one place.
            </p>
          </div>

          <div className={compact ? "lg:-my-3" : ""}>
            <SignupIllustration />
          </div>

          <div className={`${compact ? "mt-8" : "mt-10"} flex items-center gap-4`}>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/80 shadow-lg shadow-[#B9974D]/10">
              <ShieldIcon />
            </div>
            <div>
              <p className="font-black text-[#0F172A]">Your data is secure with us.</p>
              <p className="mt-1 text-sm font-medium text-[#64748B]">We use industry-standard encryption and best security practices.</p>
            </div>
          </div>
        </div>
      </div>

      <div className={`order-1 bg-white p-8 sm:p-10 ${compact ? "lg:p-10" : "lg:p-14"}`}>
        <div className="mx-auto flex h-full max-w-xl flex-col justify-center">
          <h2 id="signup-modal-title" className="text-4xl font-black tracking-tight text-[#0F172A]">Sign Up</h2>
          <p className="mt-4 text-lg text-[#64748B]">Set up your account to get started</p>

          <form className="mt-8" onSubmit={submit}>
            <label className="text-base font-bold text-[#0F172A]" htmlFor="fullName">
              Full Name
            </label>
            <div className="login-field mt-3 flex h-14 items-center gap-4 border border-[#E5E0D6] bg-white px-4 transition focus-within:border-[#B9974D] focus-within:shadow-[0_0_0_4px_rgba(185,151,77,0.14)]">
              <UserIcon />
              <input
                id="fullName"
                name="fullName"
                autoComplete="name"
                className="min-w-0 flex-1 bg-transparent text-base text-[#0F172A] outline-none placeholder:text-[#9aa5ba]"
                placeholder="Enter your full name"
                value={form.fullName}
                onChange={(event) => updateField("fullName", event.target.value)}
              />
            </div>

            <label className="mt-5 block text-base font-bold text-[#0F172A]" htmlFor="signupEmail">
              Email Address
            </label>
            <div className="login-field mt-3 flex h-14 items-center gap-4 border border-[#E5E0D6] bg-white px-4 transition focus-within:border-[#B9974D] focus-within:shadow-[0_0_0_4px_rgba(185,151,77,0.14)]">
              <EmailIcon />
              <input
                id="signupEmail"
                name="email"
                autoComplete="email"
                className="min-w-0 flex-1 bg-transparent text-base text-[#0F172A] outline-none placeholder:text-[#9aa5ba]"
                placeholder="Enter your email address"
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
              />
            </div>

            <label className="mt-5 block text-base font-bold text-[#0F172A]" htmlFor="phone">
              Phone Number
            </label>
            <div className="login-field mt-3 flex h-14 overflow-hidden border border-[#E5E0D6] bg-white transition focus-within:border-[#B9974D] focus-within:shadow-[0_0_0_4px_rgba(185,151,77,0.14)]">
              <div className="flex items-center px-4">
                <PhoneIcon />
              </div>
              <select
                id="countryCode"
                name="countryCode"
                autoComplete="tel-country-code"
                aria-label="Country code"
                className="h-full border-x border-[#E5E0D6] bg-white px-3 text-base font-bold text-[#0F172A] outline-none"
                value={form.countryCode}
                onChange={(event) => updateField("countryCode", event.target.value)}
              >
                <option value="+1">+1</option>
                <option value="+44">+44</option>
                <option value="+63">+63</option>
                <option value="+91">+91</option>
              </select>
              <input
                id="phone"
                name="phone"
                autoComplete="tel-national"
                className="min-w-0 flex-1 bg-transparent px-4 text-base text-[#0F172A] outline-none placeholder:text-[#9aa5ba]"
                placeholder="Enter your phone number"
                type="tel"
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
              />
            </div>

            <label className="mt-5 block text-base font-bold text-[#0F172A]" htmlFor="venue">
              Company or Venue Name
            </label>
            <div className="login-field mt-3 flex h-14 items-center gap-4 border border-[#E5E0D6] bg-white px-4 transition focus-within:border-[#B9974D] focus-within:shadow-[0_0_0_4px_rgba(185,151,77,0.14)]">
              <BuildingIcon />
              <input
                id="venue"
                name="organization"
                autoComplete="organization"
                className="min-w-0 flex-1 bg-transparent text-base text-[#0F172A] outline-none placeholder:text-[#9aa5ba]"
                placeholder="Enter your company or venue name"
                value={form.venue}
                onChange={(event) => updateField("venue", event.target.value)}
              />
            </div>

            <label className="mt-5 block text-base font-bold text-[#0F172A]" htmlFor="signupPassword">
              Password
            </label>
            <div className="login-field mt-3 flex h-14 items-center gap-4 border border-[#E5E0D6] bg-white px-4 transition focus-within:border-[#B9974D] focus-within:shadow-[0_0_0_4px_rgba(185,151,77,0.14)]">
              <LockIcon />
              <input
                id="signupPassword"
                name="newPassword"
                autoComplete="new-password"
                className="min-w-0 flex-1 bg-transparent text-base text-[#0F172A] outline-none placeholder:text-[#9aa5ba]"
                placeholder="Create a password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(event) => updateField("password", event.target.value)}
              />
              <button className="login-icon-button text-[#64748B] transition hover:text-[#B9974D]" type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>
                <EyeIcon isVisible={showPassword} />
              </button>
            </div>

            <label className="mt-5 block text-base font-bold text-[#0F172A]" htmlFor="confirmPassword">
              Confirm Password
            </label>
            <div className="login-field mt-3 flex h-14 items-center gap-4 border border-[#E5E0D6] bg-white px-4 transition focus-within:border-[#B9974D] focus-within:shadow-[0_0_0_4px_rgba(185,151,77,0.14)]">
              <LockIcon />
              <input
                id="confirmPassword"
                name="confirmPassword"
                autoComplete="new-password"
                className="min-w-0 flex-1 bg-transparent text-base text-[#0F172A] outline-none placeholder:text-[#9aa5ba]"
                placeholder="Confirm your password"
                type={showConfirmPassword ? "text" : "password"}
                value={form.confirmPassword}
                onChange={(event) => updateField("confirmPassword", event.target.value)}
              />
              <button className="login-icon-button text-[#64748B] transition hover:text-[#B9974D]" type="button" onClick={() => setShowConfirmPassword((current) => !current)} aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}>
                <EyeIcon isVisible={showConfirmPassword} />
              </button>
            </div>

            <label className="mt-6 flex cursor-pointer items-center gap-3 text-base font-medium text-[#64748B]" htmlFor="terms">
              <input
                id="terms"
                className="login-checkbox h-5 w-5 border border-[#E5E0D6] accent-[#B9974D]"
                type="checkbox"
                checked={form.acceptedTerms}
                onChange={(event) => updateField("acceptedTerms", event.target.checked)}
              />
              <span>
                I agree to the{" "}
                <Link className="font-bold text-[#B9974D] transition hover:text-[#B9974D]" href="#terms">
                  Terms & Privacy Policy
                </Link>
              </span>
            </label>

            {error ? <p className="mt-5 text-sm font-bold text-[#c2410c]">{error}</p> : null}
            {success ? <p className="mt-5 text-sm font-bold text-[#138a4f]">{success}</p> : null}

            <button
              className="login-button mt-7 flex h-16 w-full items-center justify-center gap-3 bg-linear-to-r from-[#B9974D] to-[#0F172A] text-lg font-black text-white shadow-xl shadow-[#0F172A]/25 transition hover:brightness-110 hover:shadow-2xl disabled:cursor-not-allowed disabled:opacity-70"
              type="submit"
              disabled={isSubmitting}
            >
              <ArrowLoginIcon />
              {isSubmitting ? "Creating account..." : "Sign Up"}
            </button>

            <div className="my-8 flex items-center gap-5 text-sm font-medium text-[#64748B]">
              <span className="h-px flex-1 bg-[#E5E0D6]" />
              or continue with
              <span className="h-px flex-1 bg-[#E5E0D6]" />
            </div>

            <div className="space-y-4">
              <button
                className="login-social flex h-14 w-full items-center justify-center gap-4 border border-[#E5E0D6] bg-white text-base font-bold text-[#0F172A] transition hover:border-[#B9974D] hover:bg-[#F7F4ED] disabled:cursor-not-allowed disabled:opacity-70"
                type="button"
                disabled={oauthProvider !== null}
                onClick={() => signInWithProvider("google")}
              >
                <GoogleIcon />
                {oauthProvider === "google" ? "Opening Google..." : "Continue with Google"}
              </button>
              <button
                className="login-social flex h-14 w-full items-center justify-center gap-4 border border-[#E5E0D6] bg-white text-base font-bold text-[#0F172A] transition hover:border-[#B9974D] hover:bg-[#F7F4ED] disabled:cursor-not-allowed disabled:opacity-70"
                type="button"
                disabled={oauthProvider !== null}
                onClick={() => signInWithProvider("azure")}
              >
                <MicrosoftIcon />
                {oauthProvider === "azure" ? "Opening Microsoft..." : "Continue with Microsoft"}
              </button>
            </div>

            <p className="mt-9 text-center text-base text-[#64748B]">
              Already have an account?{" "}
              {onLoginClick ? (
                <button className="font-bold text-[#B9974D] transition hover:text-[#B9974D]" type="button" onClick={onLoginClick}>
                  Login
                </button>
              ) : (
                <Link className="font-bold text-[#B9974D] transition hover:text-[#B9974D]" href="/dashboard">
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
