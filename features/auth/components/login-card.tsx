"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import {
  getAuthErrorMessage,
  getAuthRejectionMessage
} from "@/lib/auth/auth-error-messages";
import {
  fetchAuthSession,
  isTerminalAuthSessionError,
  signInWithOAuthProvider,
  signOutCurrentSession
} from "@/lib/auth/client";
import {
  getBetaPendingPath,
  isBetaAccessCode
} from "@/lib/auth/redirect";
import { useDesktopAppMode } from "@/lib/desktop-app/client";
import {
  createSupabaseBrowserClient,
  setAuthSessionPersistence
} from "@/lib/supabase/browser";
import { MfaChallengeDialog } from "@/features/auth/components/mfa-challenge-dialog";
import { useDesktopAuthScrollLock } from "@/features/auth/components/use-desktop-auth-scroll-lock";
import { getLoginValidationError } from "@/features/auth/validations/auth.schema";
import { getSafeDashboardReturnPath } from "@/lib/auth/redirect";
import {
  ArrowLoginIcon,
  EmailIcon,
  EyeIcon,
  LockIcon,
  ShieldIcon
} from "@/features/auth/components/auth-icons";
import {
  AuthDivider,
  AuthSocialButtons,
  type AuthProvider
} from "@/features/auth/components/auth-social-buttons";

function DashboardIllustration() {
  // Scaled rather than re-laid-out. The composition is a dozen absolutely
  // positioned plates whose offsets are tuned to each other, and the panel has
  // to clear a 720px-tall laptop without the page scrolling - so the outer box
  // states the height the layout gets and the inner one shrinks to fit it.
  return (
    <div className="relative mt-8 h-52 lg:mt-10 xl:h-56">
      <div className="absolute bottom-0 left-2 h-44 w-44 rounded-full bg-[#E7E3DA]/65 blur-3xl" />
      <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[#1f4d73]/70 blur-3xl" />

      <div className="relative mx-auto w-full max-w-107.5 origin-top scale-90">
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
                  <svg
                    className="h-full w-full p-4 text-[#1f4d73]"
                    viewBox="0 0 160 80"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M8 64c22-42 42-10 62-38 16-22 39 18 82-12"
                      stroke="currentColor"
                      strokeWidth="5"
                      strokeLinecap="round"
                    />
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

export function LoginCard() {
  const router = useRouter();
  const { toast } = useToast();
  const returnPath = getSafeDashboardReturnPath(
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("next")
  );
  const isDesktopApp = useDesktopAppMode();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<AuthProvider | null>(null);
  const [isMfaChallengeOpen, setIsMfaChallengeOpen] = useState(false);

  useDesktopAuthScrollLock(isDesktopApp);

  // Why the dashboard sent them back. Read after mount rather than during
  // render, so the server's markup - which has no query string to read - and the
  // first client render still match.
  useEffect(() => {
    const message = getAuthRejectionMessage(
      new URLSearchParams(window.location.search).get("reason")
    );

    if (message) setError(message);
  }, []);

  // Coming back from Google with the Back button restores this page from the
  // bfcache with its React state intact, so the button stays disabled reading
  // "Opening Google..." and the only way to try again is a reload.
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setOauthProvider(null);
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  const failSignIn = (message: string) => {
    setError(message);
    toast.error(message, { title: "Sign-in failed" });
  };

  /**
   * The last two steps after the authenticator code was accepted.
   *
   * The session is synced again, forced, because the one synced after the
   * password step was `aal1` and still said a code was owed. The sync is what
   * stamps the active-organization cookie, provisions a first-time user and -
   * now that the factor is cleared - sends the new-device email if needed.
   */
  const completeSignIn = async (accessToken: string) => {
    await fetchAuthSession(accessToken, { force: true });
    router.replace(returnPath as Parameters<typeof router.replace>[0]);
    router.refresh();
  };

  /**
   * Extracted so the challenge step refuses the same way the password step
   * does. `fetchAuthSession` throws the terminal refusals - no invitation, a
   * deactivated account, a beta applicant - and those leave a live Supabase
   * session behind that has to be ended, whichever step reached them.
   */
  const handleSignInError = async (submitError: unknown) => {
    // Supabase accepted the credentials and we did not accept the account, so
    // a live session is sitting behind this error message. Left in place it
    // turns the next reload into a redirect to a dashboard that refuses them -
    // and proxy.ts will not let them back to /login while it exists.
    if (isTerminalAuthSessionError(submitError)) {
      await signOutCurrentSession().catch(() => undefined);

      // A beta applicant signing in early gets the page about the beta rather
      // than a sign-in error. Their credentials were correct; there is
      // nothing on this form for them to fix, and an error here reads as one.
      if (isBetaAccessCode(submitError.code)) {
        router.replace(
          getBetaPendingPath(submitError.code) as Parameters<
            typeof router.replace
          >[0]
        );
        return;
      }
    }

    failSignIn(getAuthErrorMessage(submitError));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting || isMfaChallengeOpen) return;

    // Validated here as well as by the browser: the native type="email" guard
    // is bypassable, and without this a malformed address reached Supabase and
    // came back as the misleading "Incorrect email or password".
    const validationError = getLoginValidationError({ email, password });

    if (validationError) {
      failSignIn(validationError);
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      setAuthSessionPersistence(rememberMe);
      const supabase = createSupabaseBrowserClient();
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });

      if (signInError) {
        failSignIn(getAuthErrorMessage(signInError));
        return;
      }

      if (data.session?.access_token) {
        /**
         * Does this sign-in owe the authenticator code? THE SERVER SAYS.
         *
         * Not Supabase's assurance level: an account with a factor is always
         * `aal1` here, but a trusted device that already cleared the factor
         * this trust period is not asked again - unless the organization
         * requires 2FA. Only the session sync knows that (it reads this
         * browser's httpOnly device cookie), and `resolveUserActor` refuses on
         * the same rule, so this dialog and the server cannot disagree.
         *
         * The sync is also what provisions a first-time user and stamps the
         * active organization, so it is needed on this path anyway.
         */
        const session = await fetchAuthSession(data.session.access_token, {
          force: true
        });

        if (session.mfa?.obligation === "challenge") {
          setIsMfaChallengeOpen(true);
          return;
        }

        router.replace(returnPath as Parameters<typeof router.replace>[0]);
        router.refresh();
      } else {
        router.replace(returnPath as Parameters<typeof router.replace>[0]);
        router.refresh();
      }
    } catch (submitError) {
      await handleSignInError(submitError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const signInWithProvider = async (provider: AuthProvider) => {
    setOauthProvider(provider);
    setError("");

    try {
      setAuthSessionPersistence(rememberMe);
      await signInWithOAuthProvider(provider, returnPath);
    } catch (providerError) {
      const message = getAuthErrorMessage(
        providerError,
        "Unable to start social login."
      );
      setError(message);
      toast.error(message, { title: "Social login failed" });
      setOauthProvider(null);
    }
  };

  const card = (
    <section
      className={
        isDesktopApp
          ? "desktop-auth-soft-page desktop-auth-soft-back mx-auto grid max-h-190 w-full min-w-0 grid-cols-[0.92fr_1fr] overflow-hidden rounded-2xl border border-white/80 bg-white/70 shadow-2xl shadow-[#1f4d73]/12 backdrop-blur-xl sm:rounded-4xl"
          : "grid min-h-dvh w-full min-w-0 lg:grid-cols-2"
      }
    >
      <div
        className={`relative overflow-hidden ${isDesktopApp ? "desktop-auth-info-panel order-2 block bg-linear-to-br from-white via-[#F7F4ED] to-[#F1F5F9] p-8 lg:order-1" : "order-1 hidden bg-linear-to-br from-[#1f4d73] via-[#1a4066] to-[#0F172A] p-8 text-white lg:flex lg:flex-col lg:justify-center xl:p-10 2xl:p-14"}`}
      >
        {isDesktopApp ? (
          <>
            <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-96 rounded-[50%] bg-[#E7E3DA]/80 blur-2xl" />
            <div className="pointer-events-none absolute -right-24 top-1/3 h-64 w-64 rounded-full bg-[#1f4d73]/80 blur-2xl" />
          </>
        ) : (
          <>
            <div className="pointer-events-none absolute -bottom-32 -left-28 h-80 w-md rounded-[50%] bg-[#3c86bd]/35 blur-3xl" />
            <div className="pointer-events-none absolute -right-28 top-1/4 h-72 w-72 rounded-full bg-[#0b5c8a]/35 blur-3xl" />
          </>
        )}
        <div className="pointer-events-none absolute right-10 top-36 hidden grid-cols-6 gap-3 opacity-35 sm:grid">
          {Array.from({ length: 36 }).map((_, index) => (
            <span
              key={index}
              className={`h-1.5 w-1.5 rounded-full ${isDesktopApp ? "bg-[#1f4d73]" : "bg-white/70"}`}
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
            // The white wordmark straight on the navy, which is the pairing
            // PORTAL_HEADER_FALLBACK_LOGO already makes for a dark ground. The
            // navy artwork used to sit here on a white plate to stay legible,
            // and that plate read as a card floating on the panel rather than
            // as branding.
            <Link
              href="/"
              aria-label="Back to Event Core home"
              className="inline-flex transition hover:opacity-80"
            >
              <Image
                src="/images/branding/Footer-logo.png"
                alt="Hall Management SaaS"
                width={565}
                height={185}
                priority
                unoptimized
                className="h-auto w-40 max-w-full object-contain"
              />
            </Link>
          )}

          <p
            className={`font-black ${isDesktopApp ? "mt-10 text-base text-[#1f4d73]" : "mt-8 text-sm text-[#8fc0e8]"}`}
          >
            Welcome Back!
          </p>
          <h1
            className={`max-w-md font-black leading-[1.12] tracking-tight ${isDesktopApp ? "mt-4 text-4xl text-[#0F172A]" : "mt-3 text-3xl text-white xl:text-4xl"}`}
          >
            Login to your account
          </h1>
          <p
            className={`max-w-md ${isDesktopApp ? "mt-5 text-base leading-8 text-[#64748B] sm:text-lg" : "mt-4 text-base leading-7 text-white/75"}`}
          >
            Access your dashboard to manage bookings, events, payments, and hall
            operations all in one place.
          </p>

          {isDesktopApp ? null : <DashboardIllustration />}

          <div
            className={`flex items-center gap-4 ${isDesktopApp ? "mt-10" : "mt-8"}`}
          >
            <div
              className={`flex shrink-0 items-center justify-center rounded-full ${isDesktopApp ? "h-14 w-14 bg-white/80 shadow-lg shadow-[#1f4d73]/10" : "h-12 w-12 bg-white/12 ring-1 ring-white/25"}`}
            >
              <ShieldIcon
                className={
                  isDesktopApp ? "h-7 w-7 text-[#1f4d73]" : "h-6 w-6 text-white"
                }
              />
            </div>
            <div>
              <p
                className={`font-black ${isDesktopApp ? "text-[#0F172A]" : "text-sm text-white"}`}
              >
                Your data is secure with us.
              </p>
              <p
                className={`mt-1 font-medium ${isDesktopApp ? "text-sm text-[#64748B]" : "text-xs text-white/70"}`}
              >
                We use industry-standard encryption.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`box-border w-full min-w-0 bg-white ${isDesktopApp ? "desktop-auth-form-panel order-1 p-8 lg:order-2" : "order-2 flex items-center justify-center px-5 py-8 sm:px-10 lg:px-14 2xl:px-16"}`}
      >
        <div
          className={`mx-auto flex h-full w-full min-w-0 flex-col justify-center ${isDesktopApp ? "max-w-md" : "max-w-xl"}`}
        >
          {isDesktopApp ? null : (
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
          <h2
            className={`${isDesktopApp ? "text-xl" : "text-2xl sm:text-3xl"} font-black tracking-tight text-[#0F172A]`}
          >
            Employee Login
          </h2>
          <p
            className={`${isDesktopApp ? "mt-2 text-sm" : "mt-2 text-sm sm:text-base"} text-[#64748B]`}
          >
            Use your organization account to continue.
          </p>

          <form
            className={isDesktopApp ? "mt-4" : "mt-6"}
            onSubmit={submit}
          >
            <label
              className="text-sm font-bold text-[#0F172A]"
              htmlFor="email"
            >
              Email Address
            </label>
            <div
              className={`login-field mt-2 flex items-center gap-3 border border-[#E5E0D6] bg-white px-3 transition focus-within:border-[#1f4d73] focus-within:shadow-[0_0_0_4px_rgba(31,77,115,0.14)] ${isDesktopApp ? "h-10" : "h-11"}`}
            >
              <EmailIcon />
              <input
                id="email"
                name="email"
                autoComplete="email"
                className="min-w-0 flex-1 bg-transparent text-sm text-[#0F172A] outline-none placeholder:text-[#9aa5ba]"
                placeholder="Enter your email address"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError("");
                }}
              />
            </div>

            <label
              className={`${isDesktopApp ? "mt-4 text-sm" : "mt-5 text-sm"} block font-bold text-[#0F172A]`}
              htmlFor="password"
            >
              Password
            </label>
            <div
              className={`login-field mt-2 flex items-center gap-3 border border-[#E5E0D6] bg-white px-3 transition focus-within:border-[#1f4d73] focus-within:shadow-[0_0_0_4px_rgba(31,77,115,0.14)] ${isDesktopApp ? "h-10" : "h-11"}`}
            >
              <LockIcon />
              <input
                id="password"
                name="password"
                autoComplete="current-password"
                className="min-w-0 flex-1 bg-transparent text-sm text-[#0F172A] outline-none placeholder:text-[#9aa5ba]"
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

            <div
              className={`${isDesktopApp ? "mt-3 text-sm" : "mt-4 text-sm"} flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4`}
            >
              <label
                className="flex cursor-pointer items-center gap-3 font-medium text-[#64748B]"
                htmlFor="remember"
              >
                <input
                  id="remember"
                  className="login-checkbox h-4 w-4 border border-[#E5E0D6] accent-[#1f4d73]"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                />
                Remember me
              </label>
              <Link
                className="font-bold text-[#1f4d73] transition hover:text-[#1f4d73]"
                href={
                  isDesktopApp
                    ? "/forgot-password?desktop=1"
                    : "/forgot-password"
                }
              >
                Forgot password?
              </Link>
            </div>

            {error ? (
              <p className="mt-5 text-sm font-bold text-[#c2410c]" role="alert">
                {error}
              </p>
            ) : null}

            <button
              className={`${isDesktopApp ? "mt-5" : "mt-6"} login-button flex w-full items-center justify-center gap-3 bg-linear-to-r from-[#1f4d73] to-[#0F172A] font-black text-white shadow-xl shadow-[#0F172A]/25 transition hover:brightness-110 hover:shadow-2xl disabled:cursor-not-allowed disabled:opacity-70 ${isDesktopApp ? "h-11 text-sm" : "h-12 text-base"}`}
              type="submit"
              disabled={isSubmitting || isMfaChallengeOpen}
            >
              <ArrowLoginIcon />
              {isSubmitting ? "Logging in..." : "Login"}
            </button>

            <AuthDivider
              className={isDesktopApp ? "my-5" : "my-6"}
            />

            <AuthSocialButtons
              size={isDesktopApp ? "sm" : "md"}
              oauthProvider={oauthProvider}
              onProviderClick={signInWithProvider}
            />

            {isDesktopApp ? (
              <div className="mt-3 shrink-0 rounded-xl border border-[#E5E0D6] bg-[#F7F4ED] p-3 text-center text-xs">
                <p className="text-sm font-bold text-[#0F172A]">
                  Joining an existing organization?
                </p>
                <p className="mt-1 leading-5 text-[#64748B]">
                  Ask your administrator for an invitation, then open the secure
                  link sent to your email.
                </p>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-[#E5E0D6] bg-[#F7F4ED] p-3 text-center">
                <p className="font-bold text-[#0F172A]">
                  Joining an existing organization?
                </p>
                <p className="mt-1 text-xs leading-5 text-[#64748B]">
                  Ask your administrator for an invitation, then open the secure
                  link sent to your email.
                </p>
              </div>
            )}

            {!isDesktopApp ? (
              <p className="mt-4 text-center text-sm text-[#64748B]">
                Opening a new hall organization?{" "}
                <Link
                  className="font-bold text-[#1f4d73] transition hover:text-[#15344f]"
                  href="/signup"
                >
                  Sign up
                </Link>
              </p>
            ) : null}
          </form>
        </div>
      </div>
    </section>
  );

  // Rendered beside the card rather than inside it: the dialog is fixed to the
  // viewport, and both presentations below need it.
  const challenge = isMfaChallengeOpen ? (
    <MfaChallengeDialog
      onCancel={async () => {
        // The password step already minted a session. Abandoning the challenge
        // has to end it, or the browser is left holding an `aal1` session that
        // proxy.ts will not let back to /login and the dashboard will refuse.
        await signOutCurrentSession().catch(() => undefined);
        setIsMfaChallengeOpen(false);
        setPassword("");
      }}
      onVerified={async (accessToken) => {
        try {
          await completeSignIn(accessToken);
        } catch (challengeError) {
          // A refusal at this point is about the ACCOUNT, not the code. Close
          // the challenge and report it on the form where the account is.
          setIsMfaChallengeOpen(false);
          await handleSignInError(challengeError);
        }
      }}
    />
  ) : null;

  if (!isDesktopApp) {
    return (
      <>
        {card}
        {challenge}
      </>
    );
  }

  // The desktop shell keeps the old floating-panel presentation, so it has to
  // supply the page ground itself - the web layout is a full-bleed split now
  // and no longer centres anything for it.
  return (
    <>
      <div className="relative flex min-h-dvh w-full items-center justify-center overflow-x-hidden bg-linear-to-br from-white via-[#F7F4ED] to-[#F1F5F9] px-2 py-4 sm:px-6 sm:py-8">
        <div className="pointer-events-none absolute -left-24 top-16 h-80 w-80 rounded-full bg-[#F1F5F9] blur-3xl" />
        <div className="pointer-events-none absolute -right-24 bottom-14 h-96 w-96 rounded-full bg-[#E5E0D6] blur-3xl" />
        <div className="relative flex w-full max-w-7xl items-center justify-center">
          {card}
        </div>
      </div>
      {challenge}
    </>
  );
}
