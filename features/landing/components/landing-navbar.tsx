"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthPresence } from "@/lib/auth/use-auth-presence";
import {
  preparePublicPageNavigation,
  restorePublicPageScroll
} from "@/features/landing/navigation/public-page-scroll";
import { MVP_LANDING_ROUTE } from "@/lib/ui/mvp-features";

function LandingLogo() {
  return (
    <Image
      src="/images/branding/hms-logo-header.png"
      alt="Hall Management SaaS"
      width={612}
      height={408}
      priority
      unoptimized
      className="h-29 w-auto shrink-0 object-contain sm:h-30"
    />
  );
}

export function LandingNavbar() {
  // Advisory only - it picks which link to show, never what the visitor may
  // reach. Both destinations are gated by proxy.ts regardless of what is
  // rendered here.
  const presence = useAuthPresence();
  const isSignedIn = presence === "authenticated";
  const [hasScrolled, setHasScrolled] = useState(false);
  const [isFooterVisible, setIsFooterVisible] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    restorePublicPageScroll();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setHasScrolled(window.scrollY > 8);
    };

    const footer = document.querySelector("[data-site-footer]");
    const observer = footer
      ? new IntersectionObserver(
          ([entry]) => {
            setIsFooterVisible(entry.isIntersecting);
          },
          { threshold: 0.02 }
        )
      : null;

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    if (footer && observer) {
      observer.observe(footer);
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileMenuOpen(false);
    };
    const closeAtDesktop = () => {
      if (window.innerWidth >= 1024) setIsMobileMenuOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeAtDesktop);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeAtDesktop);
    };
  }, [isMobileMenuOpen]);

  return (
    <header
      className={`saas-animate-navbar fixed left-0 right-0 top-0 z-1000 border-b bg-white/95 backdrop-blur-xl transition-all duration-300 ${
        hasScrolled
          ? "border-[#E5E0D6] shadow-lg shadow-[#0F172A]/8"
          : "border-[#E5E0D6]/80 shadow-none"
      } ${isFooterVisible && !isMobileMenuOpen ? "-translate-y-full" : "translate-y-0"}`}
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
        <LandingLogo />
        <nav className="hidden items-center gap-8 text-base font-bold text-[#0F172A] lg:flex">
          <Link className="saas-nav-link text-[#1f4d73]" href="/#home">
            Home
          </Link>
          <Link className="saas-nav-link" href="/#features">
            Features
          </Link>
          <Link className="saas-nav-link" href="/#benefits">
            Benefits
          </Link>
          <Link className="saas-nav-link" href="/#pricing">
            Pricing
          </Link>
          <Link
            className="saas-nav-link"
            href="/documentation"
            onClick={() => preparePublicPageNavigation("/documentation")}
            scroll={false}
          >
            Documentation
          </Link>
          <button
            className="saas-nav-link bg-transparent p-0 text-sm font-bold text-[#0F172A]"
            type="button"
            data-contact-modal
          >
            Contact
          </button>
        </nav>
        <div className="flex items-center gap-2 lg:hidden">
          <button
            aria-controls="landing-mobile-navigation"
            aria-expanded={isMobileMenuOpen}
            aria-label={
              isMobileMenuOpen
                ? "Close navigation menu"
                : "Open navigation menu"
            }
            className="flex h-11 w-11 flex-col items-center justify-center gap-1.5 rounded-xl border border-[#E5E0D6] bg-white text-[#0f172a] shadow-sm lg:hidden"
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            type="button"
          >
            <span
              className={`h-0.5 w-5 bg-current transition ${isMobileMenuOpen ? "translate-y-2 rotate-45" : ""}`}
            />
            <span
              className={`h-0.5 w-5 bg-current transition ${isMobileMenuOpen ? "opacity-0" : ""}`}
            />
            <span
              className={`h-0.5 w-5 bg-current transition ${isMobileMenuOpen ? "-translate-y-2 -rotate-45" : ""}`}
            />
          </button>
          {/*
            `invisible` rather than unmounted while the session resolves: it
            keeps the button's footprint, so the navbar does not reflow a frame
            after hydration, and visibility:hidden also takes it out of the tab
            order so nobody can focus a link that is about to change.
          */}
          <Link
            aria-hidden={presence === "pending"}
            className={`navbar-login-button shrink-0 border border-[#E5E0D6] bg-white px-4 py-2.5 text-sm font-bold text-[#0f172a] shadow-sm transition-all duration-200 hover:border-[#1f4d73]/45 hover:shadow-md sm:hidden ${
              presence === "pending" ? "invisible" : ""
            }`}
            href={isSignedIn ? MVP_LANDING_ROUTE : "/login"}
          >
            {isSignedIn ? "Dashboard" : "Login"}
          </Link>
        </div>
        <div className="hidden items-center gap-3 sm:flex">
          {isSignedIn ? (
            <>
              <Link
                className="navbar-login-button border border-[#E5E0D6] bg-white px-6 py-3 text-sm font-bold text-[#0f172a] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#1f4d73]/45 hover:shadow-md"
                href="/login"
              >
                Login
              </Link>
              <Link
                className="saas-hover-lift rounded-xl bg-[#1f4d73] px-6 py-3 text-sm font-bold text-white! shadow-lg shadow-[#0F172A]/15 hover:bg-[#15344f]"
                href={MVP_LANDING_ROUTE}
              >
                Go to Dashboard
              </Link>
            </>
          ) : (
            <div
              aria-hidden={presence === "pending"}
              className={`flex items-center gap-3 ${
                presence === "pending" ? "invisible" : ""
              }`}
            >
              <Link
                className="navbar-login-button border border-[#E5E0D6] bg-white px-6 py-3 text-sm font-bold text-[#0f172a] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#1f4d73]/45 hover:shadow-md"
                href="/login"
              >
                Login
              </Link>
              <Link
                className="saas-hover-lift rounded-xl bg-[#1f4d73] px-6 py-3 text-sm font-bold text-white! shadow-lg shadow-[#0F172A]/15 hover:bg-[#15344f]"
                href="/signup"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
      <div
        className={`absolute left-0 right-0 top-20 border-b border-[#E5E0D6] bg-white/98 shadow-xl shadow-[#0f172a]/10 backdrop-blur-xl transition duration-250 lg:hidden ${
          isMobileMenuOpen
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-3 opacity-0"
        }`}
        id="landing-mobile-navigation"
      >
        <nav
          aria-label="Mobile navigation"
          className="mx-auto grid max-w-7xl gap-1 px-5 py-5 text-base font-bold text-[#0f172a] sm:px-8"
        >
          {(
            [
              ["Home", "/#home"],
              ["Features", "/#features"],
              ["Benefits", "/#benefits"],
              ["Pricing", "/#pricing"],
              ["Documentation", "/documentation"]
            ] as const
          ).map(([label, href]) => (
            <Link
              className="rounded-xl px-4 py-3 transition hover:bg-[#eef4fa] hover:text-[#1f4d73]"
              href={href}
              key={label}
              onClick={() => {
                setIsMobileMenuOpen(false);
                if (href === "/documentation")
                  preparePublicPageNavigation(href);
              }}
              scroll={href === "/documentation" ? false : undefined}
            >
              {label}
            </Link>
          ))}
          <button
            className="rounded-xl px-4 py-3 text-left font-bold transition hover:bg-[#eef4fa] hover:text-[#1f4d73]"
            data-contact-modal
            onClick={() => setIsMobileMenuOpen(false)}
            type="button"
          >
            Contact
          </button>
          {/*
            No pending placeholder here: the panel is closed at hydration, so
            there is nothing to reflow, and a visitor who opens it before the
            cookie read lands sees the sign-up CTA - which proxy.ts now bounces
            straight to the dashboard for them anyway.
          */}
          <Link
            className="mt-2 rounded-xl bg-[#1f4d73] px-4 py-3 text-center font-black text-white! sm:hidden"
            href={isSignedIn ? MVP_LANDING_ROUTE : "/signup"}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            {isSignedIn ? "Go to Dashboard" : "Get Started Free"}
          </Link>
        </nav>
      </div>
      <button
        aria-label="Close navigation menu"
        className={`fixed inset-0 top-20 -z-10 bg-[#061126]/30 backdrop-blur-[1px] lg:hidden ${isMobileMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setIsMobileMenuOpen(false)}
        tabIndex={isMobileMenuOpen ? 0 : -1}
        type="button"
      />
    </header>
  );
}
