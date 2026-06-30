"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

function LandingLogo() {
  return (
    <Image src="/hms-logo-header.png" alt="Hall Management SaaS" width={1160} height={300} priority className="h-18 w-auto object-contain" />
  );
}

export function LandingNavbar() {
  const [hasScrolled, setHasScrolled] = useState(false);
  const [isFooterVisible, setIsFooterVisible] = useState(false);

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

  return (
    <header
      className={`saas-animate-navbar fixed left-0 right-0 top-0 z-1000 border-b bg-white/95 backdrop-blur-xl transition-all duration-300 ${
        hasScrolled ? "border-[#E5E0D6] shadow-lg shadow-[#0F172A]/8" : "border-[#E5E0D6]/80 shadow-none"
      } ${isFooterVisible ? "-translate-y-full" : "translate-y-0"}`}
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
        <LandingLogo />
        <nav className="hidden items-center gap-8 text-base font-bold text-[#0F172A] lg:flex">
          <a className="saas-nav-link text-[#B9974D]" href="#home">
            Home
          </a>
          <a className="saas-nav-link" href="#features">
            Features
          </a>
          <a className="saas-nav-link" href="#benefits">
            Benefits
          </a>
          <a className="saas-nav-link" href="#pricing">
            Pricing
          </a>
          <button className="saas-nav-link bg-transparent p-0 text-sm font-bold text-[#0F172A]" type="button" data-contact-modal>
            Contact
          </button>
        </nav>
        <div className="hidden items-center gap-3 sm:flex">
          <button
            className="navbar-login-button border border-[#E5E0D6] bg-white px-6 py-3 text-sm font-bold text-[#0f172a] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#B9974D]/45 hover:shadow-md"
            type="button"
            data-login-modal
          >
            Login
          </button>
          <a className="saas-hover-lift rounded-xl bg-[#B9974D] px-6 py-3 text-sm font-bold text-white! shadow-lg shadow-[#0F172A]/15 hover:bg-[#9C7D37]" href="#demo">
            Free Trial
          </a>
        </div>
      </div>
    </header>
  );
}
