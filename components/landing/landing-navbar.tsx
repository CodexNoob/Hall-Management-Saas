"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

function LandingLogo() {
  return (
    <Image src="/hms-logo-header.png" alt="Hall Management SaaS" width={1160} height={300} priority className="h-14 w-auto object-contain" />
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
        hasScrolled ? "border-[#dfe5ff] shadow-lg shadow-[#10172f]/8" : "border-[#e9edff]/80 shadow-none"
      } ${isFooterVisible ? "-translate-y-full" : "translate-y-0"}`}
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
        <LandingLogo />
        <nav className="hidden items-center gap-8 text-sm font-bold text-[#16213f] lg:flex">
          <a className="saas-nav-link text-[#3155ff]" href="#home">
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
          <button className="saas-nav-link bg-transparent p-0 text-sm font-bold text-[#16213f]" type="button" data-contact-modal>
            Contact
          </button>
        </nav>
        <div className="hidden items-center gap-3 sm:flex">
          <button
            className="navbar-login-button border border-[#dbe3f0] bg-white px-6 py-3 text-sm font-bold text-[#0f172a] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#456ef7]/45 hover:shadow-md"
            type="button"
            data-login-modal
          >
            Login
          </button>
          <a className="saas-hover-lift rounded-xl bg-linear-to-r from-[#3155ff] to-[#7138f5] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[#5436ff]/25" href="#demo">
            Free Trial
          </a>
        </div>
      </div>
    </header>
  );
}
