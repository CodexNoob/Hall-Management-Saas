"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import {
  describeAuthCallbackError,
  isExpiredLinkError,
  parseAuthCallbackParams,
  type AuthCallbackParams
} from "@/lib/auth/auth-callback-params";
import {
  AuthBrandPanel,
  AuthMobileLogo,
  AuthShell
} from "@/features/auth/components/auth-shell";
import { ShieldIcon } from "@/features/auth/components/auth-icons";

/**
 * `initial` comes from the server, parsed out of the query string, and is what
 * both the server and the first client render use - so the markup matches and
 * hydration is clean.
 *
 * The fragment is the only thing this has to do on the client: `#error=...` is
 * never sent to the server, so a page rendered purely from searchParams would
 * show the generic message for a link Supabase rejected with a precise reason.
 * Reading it after mount upgrades the copy without risking a mismatch, because
 * the first render is identical on both sides.
 */

/** Sits on the navy brand panel, so its plate is white and its accents light. */
function DeadLinkIllustration() {
  return (
    <div className="relative mt-8 h-52 lg:mt-10 xl:h-56">
      <div className="absolute bottom-0 left-4 h-44 w-44 rounded-full bg-[#E7E3DA]/65 blur-3xl" />
      <div className="absolute right-0 top-6 h-44 w-44 rounded-full bg-[#1f4d73]/70 blur-3xl" />

      <div className="relative mx-auto w-full max-w-107.5 origin-top scale-90">
        <div className="relative mx-auto h-56 w-[88%] rotate-[-4deg] overflow-hidden rounded-3xl border border-white/80 bg-white shadow-2xl shadow-[#1f4d73]/20">
          <div className="flex h-10 items-center gap-2 border-b border-[#E5E0D6] px-4">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff6b6b]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#ffbf4d]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#32d583]" />
          </div>
          <div className="p-5">
            <div className="h-3 w-32 rounded-full bg-[#E5E0D6]" />
            <div className="mt-4 h-12 rounded-2xl bg-[#F7F4ED]" />
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="h-16 rounded-2xl bg-[#F7F4ED]" />
              <div className="h-16 rounded-2xl bg-[#F7F4ED]" />
            </div>
          </div>
        </div>

        <div className="absolute left-1/2 top-24 flex h-28 w-28 -translate-x-1/2 items-center justify-center rounded-full bg-linear-to-br from-[#1f4d73] to-[#0F172A] text-white shadow-2xl shadow-[#1f4d73]/30">
          <AlertCircle className="h-11 w-11" strokeWidth={1.6} />
        </div>
      </div>
    </div>
  );
}

export function AuthErrorView({ initial }: { initial: AuthCallbackParams }) {
  const [params, setParams] = useState(initial);

  useEffect(() => {
    if (!window.location.hash) return;

    const fromUrl = parseAuthCallbackParams(window.location.href);

    if (fromUrl.errorCode || fromUrl.errorDescription) {
      setParams(fromUrl);
    }
  }, []);

  const message = describeAuthCallbackError(params);
  // Reloading an expired or already-spent link re-sends the same dead token, so
  // offer the only route that can work: sign in, or get a fresh invitation.
  const isExpired = isExpiredLinkError(params);

  return (
    <AuthShell
      brand={
        <AuthBrandPanel
          eyebrow="Let's sort this out"
          heading="Your account is still fine"
          blurb="A link that will not open changes nothing on your account. Getting a working one back takes a few seconds."
          illustration={<DeadLinkIllustration />}
          assuranceTitle="Nothing was confirmed or reset."
          assuranceBlurb="A refused link leaves your account exactly as it was."
        />
      }
    >
      <AuthMobileLogo />

      <h2 className="text-2xl font-black tracking-tight text-[#0F172A] sm:text-3xl">
        Confirmation needs attention
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[#64748B] sm:text-base sm:leading-7">
        {message}
      </p>

      <div className="mt-6 rounded-2xl border border-[#E5E0D6] bg-[#F7F4ED] p-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#1f4d73] shadow-sm">
            <ShieldIcon className="h-5 w-5 text-[#1f4d73]" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#0F172A]">Secure workspace setup</p>
            <p className="mt-1 text-xs leading-5 text-[#64748B]">
              Confirmation links can only be opened once, and they stop working
              after a while. A fresh one always works.
            </p>
          </div>
        </div>
      </div>

      {isExpired ? (
        <Link
          className="login-button mt-6 flex h-12 w-full items-center justify-center gap-3 bg-linear-to-r from-[#1f4d73] to-[#0F172A] text-base font-black text-white shadow-xl shadow-[#0F172A]/25 transition hover:brightness-110 hover:shadow-2xl"
          href="/login"
        >
          Go to sign in
        </Link>
      ) : (
        <Link
          className="login-button mt-6 flex h-12 w-full items-center justify-center gap-3 bg-linear-to-r from-[#1f4d73] to-[#0F172A] text-base font-black text-white shadow-xl shadow-[#0F172A]/25 transition hover:brightness-110 hover:shadow-2xl"
          href="/forgot-password"
        >
          Email me a new link
        </Link>
      )}

      <Link
        className="login-social mt-3 flex h-11 w-full items-center justify-center gap-4 border border-[#E5E0D6] bg-white text-sm font-bold text-[#0F172A] transition hover:border-[#1f4d73] hover:bg-[#F7F4ED]"
        href="/"
      >
        Back to Home
      </Link>
    </AuthShell>
  );
}
