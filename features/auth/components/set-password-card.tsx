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
  ExternalLinkIcon,
  EyeIcon,
  LockIcon,
  SendIcon,
  ShieldIcon
} from "@/features/auth/components/auth-icons";

type SetPasswordFlow = "invite" | "recovery" | "required";

type SetPasswordCardProps = {
  compact?: boolean;
};

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

function LockMedallion() {
  // Laid out horizontally: the card only has two fields, so a tall stacked
  // illustration would drive the whole panel past the viewport.
  return (
    <div className="relative mt-6 flex items-center gap-5">
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

export function SetPasswordCard({ compact = false }: SetPasswordCardProps) {
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

  return (
    <section
      className={`mx-auto grid w-full min-w-0 overflow-hidden rounded-2xl border border-white/80 bg-white/70 shadow-2xl shadow-[#1f4d73]/12 backdrop-blur-xl sm:rounded-4xl ${isDesktopApp ? "desktop-auth-soft-page desktop-auth-soft-forward max-h-190 max-w-6xl grid-cols-[1fr_0.92fr]" : "lg:grid-cols-2"}`}
    >
      <div
        className={`relative overflow-hidden p-5 sm:p-8 ${isDesktopApp ? "desktop-auth-info-panel order-2 block bg-linear-to-br from-white via-[#F7F4ED] to-[#F1F5F9] p-8" : "order-2 bg-linear-to-br from-white via-[#F7F4ED] to-[#F1F5F9] lg:order-1"} ${!isDesktopApp && compact ? "hidden lg:block lg:p-8" : !isDesktopApp ? "lg:p-10" : ""}`}
      >
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-96 rounded-[50%] bg-[#E7E3DA]/80 blur-2xl" />
        {/* Kept clear of the copy: this panel is short, so a mid-height blob
            washes out the heading and blurb. */}
        <div className="pointer-events-none absolute -right-28 -bottom-16 h-56 w-56 rounded-full bg-[#1f4d73]/45 blur-3xl" />
        <div className="pointer-events-none absolute right-8 top-24 hidden grid-cols-6 gap-2.5 opacity-30 sm:grid">
          {Array.from({ length: 36 }).map((_, index) => (
            <span
              key={index}
              className="h-1.5 w-1.5 rounded-full bg-[#1f4d73]"
            />
          ))}
        </div>

        <div className="relative">
          {isDesktopApp ? (
            <Image
              src="/images/branding/hms-logo-header.png"
              alt="Hall Management SaaS"
              width={612}
              height={408}
              priority
              unoptimized
              className="h-auto w-64 max-w-full object-contain"
            />
          ) : (
            <Link href="/" aria-label="Back to Hall Management SaaS home">
              <Image
                src="/images/branding/hms-logo-header.png"
                alt="Hall Management SaaS"
                width={612}
                height={408}
                priority
                unoptimized
                className="h-auto w-64 max-w-full object-contain"
              />
            </Link>
          )}

          <p
            className={`${isDesktopApp ? "mt-7" : "mt-6"} text-sm font-black text-[#1f4d73]`}
          >
            {copy.eyebrow}
          </p>
          <h1
            className={`${isDesktopApp ? "mt-4 text-4xl" : "mt-2 text-2xl sm:mt-3 sm:text-4xl"} max-w-md font-black leading-[1.1] tracking-tight text-[#0F172A]`}
          >
            {copy.heading}
          </h1>
          <p
            className={`${isDesktopApp ? "mt-3 text-base leading-7" : "mt-3 text-sm leading-6 sm:text-base sm:leading-7"} max-w-md text-[#64748B]`}
          >
            {copy.blurb}
          </p>

          {isDesktopApp ? null : <LockMedallion />}

          {/* <div
            className={`${isDesktopApp ? "mt-5" : "mt-6"} flex items-center gap-3`}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/80 shadow-lg shadow-[#1f4d73]/10">
              <ShieldIcon className="h-5 w-5 text-[#1f4d73]" />
            </div>
            <div>
              <p className="text-sm font-black text-[#0F172A]">
                Only you will know this password.
              </p>
              <p className="mt-0.5 text-xs font-medium text-[#64748B]">
                We store it encrypted and never show it to your administrator.
              </p>
            </div>
          </div> */}
        </div>
      </div>

      <div
        className={`box-border w-full min-w-0 ${isDesktopApp ? "desktop-auth-form-panel order-1 bg-white p-8" : compact ? "order-1 bg-white p-5 pt-16 sm:p-8 lg:order-2 lg:p-8" : "order-1 bg-white p-5 sm:p-8 lg:order-2 lg:p-10"}`}
      >
        <div
          className={`mx-auto flex h-full w-full min-w-0 flex-col justify-center ${isDesktopApp ? "max-w-md" : "max-w-xl"}`}
        >
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
            <div className={isDesktopApp ? "mt-5" : "mt-10"}>
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
                className={`login-button mt-6 flex w-full items-center justify-center gap-3 bg-linear-to-r from-[#1f4d73] to-[#0F172A] font-black text-white shadow-xl shadow-[#0F172A]/25 transition hover:brightness-110 hover:shadow-2xl ${isDesktopApp ? "h-11 text-sm" : "h-16 text-lg"}`}
                href={forgotPasswordHref}
              >
                <SendIcon />
                Email me a new link
              </Link>

              <p
                className={`${isDesktopApp ? "mt-5 text-sm" : "mt-6 text-sm"} flex flex-wrap items-center justify-center gap-2 text-center text-[#64748B]`}
              >
                Need help?{" "}
                <button
                  className="inline-flex items-center gap-2 font-bold text-[#1f4d73] transition hover:text-[#1f4d73]"
                  data-contact-modal
                  type="button"
                >
                  Contact support
                  <ExternalLinkIcon />
                </button>
              </p>
            </div>
          ) : (
            <form className={isDesktopApp ? "mt-4" : "mt-6"} onSubmit={submit}>
              <label
                className={`${isDesktopApp ? "text-sm" : "text-base"} font-bold text-[#0F172A]`}
                htmlFor="newPassword"
              >
                New Password
              </label>
              <div
                className={`login-field mt-2 flex items-center gap-3 border border-[#E5E0D6] bg-white px-3 transition focus-within:border-[#1f4d73] focus-within:shadow-[0_0_0_4px_rgba(31,77,115,0.14)] ${isDesktopApp ? "h-10" : "h-12"}`}
              >
                <LockIcon />
                <input
                  id="newPassword"
                  name="newPassword"
                  autoComplete="new-password"
                  className="min-w-0 flex-1 bg-transparent text-base text-[#0F172A] outline-none placeholder:text-[#9aa5ba]"
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
                className={`${isDesktopApp ? "mt-4 text-sm" : "mt-4 text-base"} block font-bold text-[#0F172A]`}
                htmlFor="confirmPassword"
              >
                Confirm Password
              </label>
              <div
                className={`login-field mt-2 flex items-center gap-3 border border-[#E5E0D6] bg-white px-3 transition focus-within:border-[#1f4d73] focus-within:shadow-[0_0_0_4px_rgba(31,77,115,0.14)] ${isDesktopApp ? "h-10" : "h-12"}`}
              >
                <LockIcon />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  autoComplete="new-password"
                  className="min-w-0 flex-1 bg-transparent text-base text-[#0F172A] outline-none placeholder:text-[#9aa5ba]"
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
                <p className="mt-4 text-sm font-bold text-[#c2410c]">{error}</p>
              ) : null}
              {success ? (
                <p className="mt-4 text-sm font-bold text-[#138a4f]">
                  {success}
                </p>
              ) : null}

              <button
                className={`login-button flex w-full items-center justify-center gap-3 bg-linear-to-r from-[#1f4d73] to-[#0F172A] font-black text-white shadow-xl shadow-[#0F172A]/25 transition hover:brightness-110 hover:shadow-2xl disabled:cursor-not-allowed disabled:opacity-70 ${isDesktopApp ? "mt-5 h-11 text-sm" : "mt-6 h-13 text-base"}`}
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

              <p
                className={`${isDesktopApp ? "mt-5 text-sm" : "mt-6 text-sm"} flex flex-wrap items-center justify-center gap-2 text-center text-[#64748B]`}
              >
                Need help?{" "}
                <button
                  className="inline-flex items-center gap-2 font-bold text-[#1f4d73] transition hover:text-[#1f4d73]"
                  data-contact-modal
                  type="button"
                >
                  Contact support
                  <ExternalLinkIcon />
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
