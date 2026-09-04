"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AuthBrandPanel,
  AuthMobileLogo,
  AuthShell
} from "@/features/auth/components/auth-shell";
import { ShieldIcon } from "@/features/auth/components/auth-icons";

/**
 * Where a beta applicant lands - after registering, and again if they try to
 * sign in before they are approved.
 *
 * ONE PAGE FOR BOTH, deliberately. They are the same fact ("your request is
 * with us"), and a second page saying nearly the same thing is a second place
 * for the wording to drift. It also replaces what used to happen on the second
 * path: a red error on the login form, which is the wrong shape for somebody
 * who has nothing to correct.
 *
 * SAYS NOTHING ABOUT THE ADDRESS. No email is echoed and no outcome is
 * distinguished beyond pending-versus-rejected, so it renders identically for a
 * brand new applicant, for somebody who registered twice, and for an address
 * that already has an account. Varying it would make this page an oracle for
 * whether an address is known to Event Core.
 */

/** The message required verbatim, kept as a constant so a test can pin it. */
export const BETA_PENDING_MESSAGE =
  "Thank you for your interest in Event Core. Your beta access request has been received. We'll reach out when your account is approved.";

const BETA_REJECTED_MESSAGE =
  "This account has not been approved for Event Core access. If you think that is a mistake, reply to the email you registered with and we will take another look.";

/**
 * The query string is attacker-supplied - anyone can type `?status=` - so it is
 * mapped through this fixed table rather than rendered. Anything unrecognized
 * falls through to the pending copy, which is the variant that says less.
 */
const COPY = {
  pending: {
    eyebrow: "Request received",
    heading: "You're on the list",
    blurb:
      "Event Core is in private beta. We review every request and get in touch as soon as your account is approved.",
    message: BETA_PENDING_MESSAGE,
    nextStep:
      "The Event Core team reviews your request. Once it is approved you can sign in and set up your organization."
  },
  rejected: {
    eyebrow: "Request reviewed",
    heading: "Not approved",
    blurb:
      "Event Core is in private beta and this request was not approved. Nothing was created for this account.",
    message: BETA_REJECTED_MESSAGE,
    nextStep:
      "No organization, trial or billing was set up, and nothing is charged."
  }
} as const;

export function BetaPendingCard() {
  /*
   * Read after mount rather than during render.
   *
   * This page is statically rendered, so the server has no query string to
   * read; reading it during the first client render instead would make the
   * markup disagree with the server's and produce a hydration error. Pending is
   * the initial state for the same reason it is the fallback - it is the
   * variant that claims less.
   */
  const [variant, setVariant] = useState<keyof typeof COPY>("pending");

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("status");
    if (status === "rejected") setVariant("rejected");
  }, []);

  const copy = COPY[variant];

  return (
    <AuthShell
      brand={
        <AuthBrandPanel
          eyebrow={copy.eyebrow}
          heading={copy.heading}
          blurb={copy.blurb}
          assuranceTitle="Nothing has been set up yet."
          assuranceBlurb="No organization, trial or billing is created until a request is approved."
        />
      }
    >
      <AuthMobileLogo />

      <h2 className="text-3xl font-black tracking-tight text-[#0F172A] sm:text-4xl">
        {variant === "pending" ? "Beta access requested" : "Beta access"}
      </h2>
      {/* role="status" so a screen reader announces the outcome on arrival:
          this page is the whole answer to whatever the person just did. */}
      <p
        className="mt-3 max-w-md text-base leading-7 text-[#64748B] sm:mt-4 sm:text-lg sm:leading-8"
        role="status"
      >
        {copy.message}
      </p>

      <div className="mt-8 rounded-2xl border border-[#E5E0D6] bg-[#F7F4ED] p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#1f4d73] shadow-sm">
            <ShieldIcon className="h-5 w-5 text-[#1f4d73]" />
          </div>
          <div>
            <p className="font-bold text-[#0F172A]">What happens next</p>
            <p className="mt-1 text-sm leading-6 text-[#64748B]">
              {copy.nextStep}
            </p>
          </div>
        </div>
      </div>

      <Link
        className="login-social mt-8 flex h-14 w-full items-center justify-center gap-4 border border-[#E5E0D6] bg-white text-base font-bold text-[#0F172A] transition hover:border-[#1f4d73] hover:bg-[#F7F4ED]"
        href="/"
      >
        Back to Event Core
      </Link>

      <p className="mt-7 text-center text-sm font-medium text-[#64748B]">
        Already approved?{" "}
        <Link
          className="font-bold text-[#1f4d73] transition hover:text-[#15344f]"
          href="/login"
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
