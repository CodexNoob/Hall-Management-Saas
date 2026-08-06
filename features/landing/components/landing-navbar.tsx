"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

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
  const [hasScrolled, setHasScrolled] = useState(false);
  const [isFooterVisible, setIsFooterVisible] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  function openAuthModal(view: "login" | "trial") {
    window.__eventCoreAuthRequest = view;
    window.dispatchEvent(
      new CustomEvent("event-core:open-auth", { detail: view })
    );
  }

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
          <Link className="saas-nav-link" href="/documentation">
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
            aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            className="flex h-11 w-11 flex-col items-center justify-center gap-1.5 rounded-xl border border-[#E5E0D6] bg-white text-[#0f172a] shadow-sm lg:hidden"
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            type="button"
          >
            <span className={`h-0.5 w-5 bg-current transition ${isMobileMenuOpen ? "translate-y-2 rotate-45" : ""}`} />
            <span className={`h-0.5 w-5 bg-current transition ${isMobileMenuOpen ? "opacity-0" : ""}`} />
            <span className={`h-0.5 w-5 bg-current transition ${isMobileMenuOpen ? "-translate-y-2 -rotate-45" : ""}`} />
          </button>
          <button
            className="navbar-login-button shrink-0 border border-[#E5E0D6] bg-white px-4 py-2.5 text-sm font-bold text-[#0f172a] shadow-sm transition-all duration-200 hover:border-[#1f4d73]/45 hover:shadow-md sm:hidden"
            type="button"
            data-login-modal
            onClick={() => openAuthModal("login")}
          >
            Login
          </button>
        </div>
        <div className="hidden items-center gap-3 sm:flex">
          <button
            className="navbar-login-button border border-[#E5E0D6] bg-white px-6 py-3 text-sm font-bold text-[#0f172a] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#1f4d73]/45 hover:shadow-md"
            type="button"
            data-login-modal
            onClick={() => openAuthModal("login")}
          >
            Login
          </button>
          <a
            className="saas-hover-lift rounded-xl bg-[#1f4d73] px-6 py-3 text-sm font-bold text-white! shadow-lg shadow-[#0F172A]/15 hover:bg-[#15344f]"
            href="/start-trial"
            data-free-trial-modal
          >
            Free Trial
          </a>
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
        <nav aria-label="Mobile navigation" className="mx-auto grid max-w-7xl gap-1 px-5 py-5 text-base font-bold text-[#0f172a] sm:px-8">
          {([
            ["Home", "/#home"],
            ["Features", "/#features"],
            ["Benefits", "/#benefits"],
            ["Pricing", "/#pricing"],
            ["Documentation", "/documentation"]
          ] as const).map(([label, href]) => (
            <Link className="rounded-xl px-4 py-3 transition hover:bg-[#eef4fa] hover:text-[#1f4d73]" href={href} key={label} onClick={() => setIsMobileMenuOpen(false)}>{label}</Link>
          ))}
          <button
            className="rounded-xl px-4 py-3 text-left font-bold transition hover:bg-[#eef4fa] hover:text-[#1f4d73]"
            data-contact-modal
            onClick={() => setIsMobileMenuOpen(false)}
            type="button"
          >
            Contact
          </button>
          <button
            className="mt-2 rounded-xl bg-[#1f4d73] px-4 py-3 font-black text-white sm:hidden"
            onClick={() => { setIsMobileMenuOpen(false); openAuthModal("trial"); }}
            type="button"
          >
            Start free trial
          </button>
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
