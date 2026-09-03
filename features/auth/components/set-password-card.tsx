"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { readAuthCallbackParams } from "@/lib/auth/auth-callback-params";
import {
  clearCachedAuthSession,
  markPasswordSet,
  fetchAuthSession
} from "@/lib/auth/client";
import {
  PASSWORD_RULES_HINT,
  getPasswordValidationError
} from "@/lib/auth/password";
import { getSafeDashboardReturnPath } from "@/lib/auth/redirect";
import { useDesktopAppMode } from "@/lib/desktop-app/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useDesktopAuthScrollLock } from "@/features/auth/components/use-desktop-auth-scroll-lock";
import {
  AuthBrandPanel,
  AuthMobileLogo,
  AuthShell
} from "@/features/auth/components/auth-shell";
import {
  ExternalLinkIcon,
  EyeIcon,
  LockIcon,
  SendIcon,
  ShieldIcon
} from "@/features/auth/components/auth-icons";

type SetPasswordFlow = "invite" | "recovery" | "required";

const copyByFlow: Record<
  SetPasswordFlow,
  { eyebrow: string; heading: string; blurb: string; action: string }
> = {
  invite: {
    eyebrow: "Welcome aboard!",
    heading: "Set your password",
    blurb:
      "Your email is confirmed. Choose a password now so you can sign in on your own from any device.",
    action: "Save password and continue"
  },
  recovery: {
    eyebrow: "Almost done!",
    heading: "Choose a new password",
    blurb:
      "Pick a new password for your account. You will use it the next time you sign in.",
    action: "Update password"
  },
  required: {
    eyebrow: "One more step",
    heading: "Set your password",
    blurb:
      "Your account does not have a password yet. Create one to finish setting up your access.",
    action: "Save password and continue"
  }
};

/** Sits on the navy brand panel, so its plate is white and its accents light. */
function LockMedallion() {
  // Laid out horizontally: the card only has two fields, so a tall stacked
  // illustration would drive the whole panel past the viewport.
  return (
    <div className="relative mt-8 flex items-center gap-5 lg:mt-10">
      <div className="pointer-events-none absolute -left-6 bottom-0 h-28 w-28 rounded-full bg-[#E7E3DA]/65 blur-3xl" />

      <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#1f4d73] to-[#0F172A] text-white shadow-xl shadow-[#1f4d73]/30">
        <LockIcon className="h-9 w-9" />
      </div>

      <div className="relative min-w-0 flex-1 rounded-2xl border border-white/80 bg-white/90 p-3 shadow-lg shadow-[#0F172A]/10 backdrop-blur">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#64748B]">
          Your new password
        </p>
        <div className="mt-2 flex items-center gap-1.5">
          {Array.from({ length: 10 }).map((_, index) => (
            <span
              key={index}
              className="h-2 w-2 rounded-full bg-[#1f4d73]/70"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SetPasswordCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDesktopApp = useDesktopAppMode();

  // Read during render. The Supabase client is created in the effect below, and
  // its constructor asynchronously consumes and strips the
  // `#access_token=...&type=` fragment that tells us which link brought the user
  // here. Render always runs first, so this snapshot is safe.
  const callbackParams = readAuthCallbackParams();

  const [isMounted, setIsMounted] = useState(false);
  const [sessionState, setSessionState] = useState<
    "checking" | "ready" | "missing"
  >("checking");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useDesktopAuthScrollLock(isDesktopApp);

  useEffect(() => setIsMounted(true), []);

  useEffect(() => {
    let isActive = true;

    async function loadSession() {
      try {
        const supabase = createSupabaseBrowserClient();
        // getSession() awaits the client's own initialization, so by the time it
        // resolves any link fragment has been consumed and the session stored.
        const { data, error: sessionError } = await supabase.auth.getSession();

        if (!isActive) return;

        if (sessionError || !data.session?.access_token) {
          setSessionState("missing");
          return;
        }

        setAccessToken(data.session.access_token);
        setSessionState("ready");
      } catch {
        if (isActive) {
          setSessionState("missing");
        }
      }
    }

    loadSession();

    return () => {
      isActive = false;
    };
  }, []);

  const flowParam = searchParams.get("flow");
  const flow: SetPasswordFlow =
    flowParam === "invite" ||
    flowParam === "recovery" ||
    flowParam === "required"
      ? flowParam
      : callbackParams.type === "invite" || callbackParams.type === "recovery"
        ? callbackParams.type
        : "required";
  // Gate flow-specific copy on mount so the hydration render matches the server
  // render, which has no access to the URL fragment.
  const copy = copyByFlow[isMounted ? flow : "required"];

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationError = getPasswordValidationError(
      password,
      confirmPassword
    );

    if (validationError) {
      setError(validationError);
      setSuccess("");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: { password_set_at: new Date().toISOString() }
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      const { data: refreshed } = await supabase.auth.getSession();
      const token = refreshed.session?.access_token ?? accessToken;

      if (!token) {
        throw new Error(
          "Your password was saved. Please sign in with your new password."
        );
      }

      // THE CLAIM, BEFORE THE CALL THAT DEPENDS ON IT.
      //
      // An invited account's user row is written by the invitation with no
      // `supabase_auth_id` - the Supabase auth user is created separately, and
      // nothing links the two at that point. POST /api/auth/session is the only
      // thing that ever does, matching on email. Every other endpoint,
      // /api/auth/password-set included, resolves its caller by
      // `supabase_auth_id` alone, so an invitee whose first authenticated call
      // is the one below is told "User account is not provisioned."
      //
      // Deliberately not forced: a fresh cached session for this same subject is
      // itself proof the row is claimed, since that response could only have
      // come from the endpoint that claims it. So this costs one round trip on
      // the invite flow and nothing on the others.
      await fetchAuthSession(token);

      await markPasswordSet(token);
      // Forced this time, because the point is the write that just happened -
      // `mustSetPassword` is derived from `passwordSetAt`, and a stale cache
      // sends the user straight back here from the dashboard gate.
      clearCachedAuthSession();
      await fetchAuthSession(token, { force: true });

      setSuccess("Password saved. Taking you to your dashboard...");
      router.replace(
        getSafeDashboardReturnPath(searchParams.get("next")) as Parameters<
          typeof router.replace
        >[0]
      );
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to save your password. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const forgotPasswordHref = isDesktopApp
    ? "/forgot-password?desktop=1"
    : "/forgot-password";

  const supportLine = (
    <p
      className={`${isDesktopApp ? "mt-5 text-sm" : "mt-6 text-sm"} flex flex-wrap items-center justify-center gap-2 text-center text-[#64748B]`}
    >
      Need help?{" "}
      <button
        className="inline-flex items-center gap-2 font-bold text-[#1f4d73] transition hover:text-[#15344f]"
        data-contact-modal
        type="button"
      >
        Contact support
        <ExternalLinkIcon />
      </button>
    </p>
  );

  const formPanel = (
    <>
      <h2
        id="set-password-modal-title"
        className={`${isDesktopApp ? "text-xl" : "text-2xl sm:text-3xl"} font-black tracking-tight text-[#0F172A]`}
      >
        {copy.heading}
      </h2>
      <p
        className={`${isDesktopApp ? "mt-2 text-sm leading-6" : "mt-2 text-sm leading-6 sm:text-base sm:leading-7"} max-w-md text-[#64748B]`}
      >
        {PASSWORD_RULES_HINT}
      </p>

      {sessionState === "missing" ? (
        <div className={isDesktopApp ? "mt-5" : "mt-6"}>
          <div className="rounded-2xl border border-[#E5E0D6] bg-[#F7F4ED] p-4">
            <p className="font-bold text-[#0F172A]">
              This link has expired or has already been used.
            </p>
            <p className="mt-1 text-sm leading-6 text-[#64748B]">
              {callbackParams.errorDescription ??
                "Password links can only be opened once, and they stop working after a while. Request a fresh one and we will email it right over."}
            </p>
          </div>

          <Link
            className={`login-button mt-6 flex w-full items-center justify-center gap-3 bg-linear-to-r from-[#1f4d73] to-[#0F172A] font-black text-white shadow-xl shadow-[#0F172A]/25 transition hover:brightness-110 hover:shadow-2xl ${isDesktopApp ? "h-11 text-sm" : "h-12 text-base"}`}
            href={forgotPasswordHref}
          >
            <SendIcon />
            Email me a new link
          </Link>

          {supportLine}
        </div>
      ) : (
        <form className={isDesktopApp ? "mt-4" : "mt-6"} onSubmit={submit}>
          <label
            className="text-sm font-bold text-[#0F172A]"
            htmlFor="newPassword"
          >
            New Password
          </label>
          <div
            className={`login-field mt-2 flex items-center gap-3 border border-[#E5E0D6] bg-white px-3 transition focus-within:border-[#1f4d73] focus-within:shadow-[0_0_0_4px_rgba(31,77,115,0.14)] ${isDesktopApp ? "h-10" : "h-11"}`}
          >
            <LockIcon />
            <input
              id="newPassword"
              name="newPassword"
              autoComplete="new-password"
              className="min-w-0 flex-1 bg-transparent text-sm text-[#0F172A] outline-none placeholder:text-[#9aa5ba]"
              placeholder="Create a password"
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

          <label
            className={`${isDesktopApp ? "mt-4 text-sm" : "mt-5 text-sm"} block font-bold text-[#0F172A]`}
            htmlFor="confirmPassword"
          >
            Confirm Password
          </label>
          <div
            className={`login-field mt-2 flex items-center gap-3 border border-[#E5E0D6] bg-white px-3 transition focus-within:border-[#1f4d73] focus-within:shadow-[0_0_0_4px_rgba(31,77,115,0.14)] ${isDesktopApp ? "h-10" : "h-11"}`}
          >
            <LockIcon />
            <input
              id="confirmPassword"
              name="confirmPassword"
              autoComplete="new-password"
              className="min-w-0 flex-1 bg-transparent text-sm text-[#0F172A] outline-none placeholder:text-[#9aa5ba]"
              placeholder="Re-enter your password"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                setError("");
              }}
            />
            <button
              className="login-icon-button text-[#64748B] transition hover:text-[#1f4d73]"
              type="button"
              onClick={() => setShowConfirmPassword((current) => !current)}
              aria-label={
                showConfirmPassword
                  ? "Hide confirm password"
                  : "Show confirm password"
              }
            >
              <EyeIcon isVisible={showConfirmPassword} />
            </button>
          </div>

          {error ? (
            <p className="mt-5 text-sm font-bold text-[#c2410c]">{error}</p>
          ) : null}
          {success ? (
            <p className="mt-5 text-sm font-bold text-[#138a4f]">{success}</p>
          ) : null}

          <button
            className={`login-button flex w-full items-center justify-center gap-3 bg-linear-to-r from-[#1f4d73] to-[#0F172A] font-black text-white shadow-xl shadow-[#0F172A]/25 transition hover:brightness-110 hover:shadow-2xl disabled:cursor-not-allowed disabled:opacity-70 ${isDesktopApp ? "mt-5 h-11 text-sm" : "mt-6 h-12 text-base"}`}
            type="submit"
            disabled={isSubmitting || sessionState !== "ready"}
          >
            <ShieldIcon className="h-6 w-6" />
            {isSubmitting
              ? "Saving..."
              : sessionState === "checking"
                ? "Checking your link..."
                : copy.action}
          </button>

          {supportLine}
        </form>
      )}
    </>
  );

  if (!isDesktopApp) {
    return (
      <AuthShell
        brand={
          <AuthBrandPanel
            eyebrow={copy.eyebrow}
            heading={copy.heading}
            blurb={copy.blurb}
            illustration={<LockMedallion />}
            assuranceTitle="Only you will know this password."
            assuranceBlurb="We store it encrypted and never show it to your administrator."
          />
        }
      >
        <AuthMobileLogo />
        {formPanel}
      </AuthShell>
    );
  }

  // The desktop shell keeps the floating-panel presentation, so it supplies the
  // page ground itself - the web layout is a full-bleed split now and no longer
  // centres anything for it.
  return (
    <div className="relative flex min-h-dvh w-full items-center justify-center overflow-x-hidden bg-linear-to-br from-white via-[#F7F4ED] to-[#F1F5F9] px-2 py-4 sm:px-6 sm:py-8">
      <div className="pointer-events-none absolute -left-24 top-16 h-80 w-80 rounded-full bg-[#F1F5F9] blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-14 h-96 w-96 rounded-full bg-[#E5E0D6] blur-3xl" />

      <div className="relative flex w-full max-w-7xl items-center justify-center">
        <section className="desktop-auth-soft-page desktop-auth-soft-forward mx-auto grid max-h-190 w-full min-w-0 max-w-6xl grid-cols-[1fr_0.92fr] overflow-hidden rounded-2xl border border-white/80 bg-white/70 shadow-2xl shadow-[#1f4d73]/12 backdrop-blur-xl sm:rounded-4xl">
          <div className="desktop-auth-info-panel relative order-2 block overflow-hidden bg-linear-to-br from-white via-[#F7F4ED] to-[#F1F5F9] p-8">
            <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-96 rounded-[50%] bg-[#E7E3DA]/80 blur-2xl" />
            {/* Kept clear of the copy: this panel is short, so a mid-height blob
                washes out the heading and blurb. */}
            <div className="pointer-events-none absolute -bottom-16 -right-28 h-56 w-56 rounded-full bg-[#1f4d73]/45 blur-3xl" />
            <div className="pointer-events-none absolute right-8 top-24 hidden grid-cols-6 gap-2.5 opacity-30 sm:grid">
              {Array.from({ length: 36 }).map((_, index) => (
                <span
                  key={index}
                  className="h-1.5 w-1.5 rounded-full bg-[#1f4d73]"
                />
              ))}
            </div>

            <div className="relative">
              <Image
                src="/images/branding/hms-logo-header.png"
                alt="Hall Management SaaS"
                width={612}
                height={408}
                priority
                unoptimized
                className="h-auto w-64 max-w-full object-contain"
              />

              <p className="mt-7 text-sm font-black text-[#1f4d73]">
                {copy.eyebrow}
              </p>
              <h1 className="mt-4 max-w-md text-4xl font-black leading-[1.1] tracking-tight text-[#0F172A]">
                {copy.heading}
              </h1>
              <p className="mt-3 max-w-md text-base leading-7 text-[#64748B]">
                {copy.blurb}
              </p>
            </div>
          </div>

          <div className="desktop-auth-form-panel box-border order-1 w-full min-w-0 bg-white p-8">
            <div className="mx-auto flex h-full w-full min-w-0 max-w-md flex-col justify-center">
              {formPanel}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
