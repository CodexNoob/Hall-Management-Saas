"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShieldIcon } from "@/features/auth/components/auth-icons";

/**
 * The one auth chrome, lifted out of /login and /signup.
 *
 * Every public auth screen is the same two panels: a navy brand panel that only
 * appears from `lg` up, and a white panel holding whatever the screen actually
 * asks the user to do. The screens used to each bring their own ground - a
 * cream floating card on /forgot-password and /set-password, a grey-blue page
 * with a gold wash on /verify-email and /auth/auth-error - so moving between
 * them changed the palette mid-flow.
 *
 * The desktop app keeps its floating-card presentation and does NOT come
 * through here; the cards that support it branch on `useDesktopAppMode` and
 * draw that shell themselves.
 */

type AuthShellProps = {
  brand: ReactNode;
  children: ReactNode;
};

export function AuthShell({ brand, children }: AuthShellProps) {
  return (
    <section className="grid min-h-dvh w-full min-w-0 lg:grid-cols-2">
      {brand}

      <div className="order-2 box-border flex w-full min-w-0 items-center justify-center bg-white px-5 py-8 sm:px-10 lg:px-14 2xl:px-16">
        <div className="mx-auto flex h-full w-full min-w-0 max-w-xl flex-col justify-center">
          {children}
        </div>
      </div>
    </section>
  );
}

type AuthBrandPanelProps = {
  eyebrow: ReactNode;
  heading: ReactNode;
  blurb: ReactNode;
  illustration?: ReactNode;
  assuranceTitle?: string;
  assuranceBlurb?: string;
};

export function AuthBrandPanel({
  eyebrow,
  heading,
  blurb,
  illustration,
  assuranceTitle = "Your data is secure with us.",
  assuranceBlurb = "We use industry-standard encryption."
}: AuthBrandPanelProps) {
  return (
    <div className="relative order-1 hidden overflow-hidden bg-linear-to-br from-[#1f4d73] via-[#1a4066] to-[#0F172A] p-8 text-white lg:flex lg:flex-col lg:justify-center xl:p-10 2xl:p-14">
      <div className="pointer-events-none absolute -bottom-32 -left-28 h-80 w-md rounded-[50%] bg-[#3c86bd]/35 blur-3xl" />
      <div className="pointer-events-none absolute -right-28 top-1/4 h-72 w-72 rounded-full bg-[#0b5c8a]/35 blur-3xl" />
      <div className="pointer-events-none absolute right-10 top-36 hidden grid-cols-6 gap-3 opacity-35 sm:grid">
        {Array.from({ length: 36 }).map((_, index) => (
          <span key={index} className="h-1.5 w-1.5 rounded-full bg-white/70" />
        ))}
      </div>

      <div className="relative">
        {/* The white wordmark straight on the navy, the same pairing the login
            panel makes for a dark ground. */}
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

        <p className="mt-8 text-sm font-black text-[#8fc0e8]">{eyebrow}</p>
        <h1 className="mt-3 max-w-md text-3xl font-black leading-[1.12] tracking-tight text-white xl:text-4xl">
          {heading}
        </h1>
        <p className="mt-4 max-w-md text-base leading-7 text-white/75">
          {blurb}
        </p>

        {illustration}

        <div className="mt-8 flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/12 ring-1 ring-white/25">
            <ShieldIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-sm font-black text-white">{assuranceTitle}</p>
            <p className="mt-1 text-xs font-medium text-white/70">
              {assuranceBlurb}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The brand panel is desktop-only, so small screens would otherwise lose the
 * logo and the way back to the marketing site.
 */
export function AuthMobileLogo() {
  return (
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
  );
}
