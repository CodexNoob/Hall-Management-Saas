"use client";

import { FormEvent, useState } from "react";

const quickLinks = [
  { label: "Home", href: "#home" },
  { label: "Features", href: "#features" },
  { label: "Benefits", href: "#benefits" },
  { label: "Pricing", href: "#pricing" },
  { label: "Contact", href: "#contact" }
];

const productLinks = [
  { label: "Booking Management", href: "#features" },
  { label: "Calendar", href: "#features" },
  { label: "Payments", href: "#features" }
];

const companyLinks = [
  { label: "About Us", href: "#home" },
  { label: "Careers", href: "#home" },
  { label: "Privacy Policy", href: "#home" },
  { label: "Terms of Service", href: "#home" }
];

function FooterBrandIcon() {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-[#1187ff] to-[#8b37f6] shadow-xl shadow-[#3155ff]/30">
      <svg className="h-10 w-10" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path d="M7 31V15L20 7l13 8v16" stroke="white" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M15 31V20h10v11M7 31h26" stroke="white" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M18 24h4" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="m6 3 5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h16v12H4zM4 6l8 7 8-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="h-6 w-6 text-[#8b6cff]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="m8.5 12 2.2 2.2 4.8-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SocialIcon({ type }: { type: "facebook" | "linkedin" | "instagram" }) {
  const icons = {
    facebook: (
      <path
        d="M14 8h2V4h-3c-3 0-5 2-5 5v3H5v4h3v8h4v-8h3l1-4h-4V9c0-.6.4-1 1-1h1Z"
        fill="currentColor"
      />
    ),
    linkedin: (
      <>
        <path d="M6 9h4v11H6zM6 5h4v3H6zM13 9h4v2c.7-1.3 1.8-2.2 3.5-2.2 2.5 0 4.5 1.8 4.5 5.2v6h-4v-5.4c0-1.5-.7-2.4-1.9-2.4-1.3 0-2.1.9-2.1 2.5V20h-4z" />
      </>
    ),
    instagram: (
      <>
        <rect x="5" y="5" width="14" height="14" rx="4" />
        <circle cx="12" cy="12" r="3.2" />
        <circle cx="16.5" cy="7.5" r="0.8" fill="currentColor" />
      </>
    )
  };

  return (
    <a
      className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/5 text-[#2f8cff] transition duration-300 hover:-translate-y-1 hover:border-[#7b2cff] hover:bg-[#3155ff]/20 hover:text-white hover:shadow-lg hover:shadow-[#3155ff]/20"
      href="#home"
      aria-label={type}
    >
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill={type === "instagram" ? "none" : "currentColor"} aria-hidden="true">
        <g stroke={type === "instagram" ? "currentColor" : "none"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {icons[type]}
        </g>
      </svg>
    </a>
  );
}

function LinkList({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div className="border-white/10 lg:border-l lg:pl-9">
      <h3 className="text-xl font-black text-white">{title}</h3>
      <ul className="mt-8 space-y-5">
        {links.map((link) => (
          <li key={link.label}>
            <a className="group flex items-center gap-3 text-base font-medium text-[#aeb8d1] transition hover:text-[#4f9cff]" href={link.href}>
              <span className="text-[#2f8cff]">
                <ChevronIcon />
              </span>
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LandingFooter() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const subscribe = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !email.includes("@")) {
      setMessage("Please enter a valid email.");
      return;
    }

    setEmail("");
    setMessage("Thank you for subscribing!");
  };

  return (
    <footer className="relative overflow-hidden bg-[#061126] text-white" data-site-footer>
      <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-[#1187ff]/15 blur-3xl" />
      <div className="absolute -right-24 top-0 h-72 w-72 rounded-full bg-[#8b37f6]/20 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.35fr_0.85fr_0.9fr_0.9fr_1.25fr]">
          <div>
            <FooterBrandIcon />
            <h2 className="mt-5 text-2xl font-black tracking-tight text-white">
              Hall Management{" "}
              <span className="bg-linear-to-r from-[#1187ff] to-[#8b37f6] bg-clip-text text-transparent">SaaS</span>
            </h2>
            <p className="mt-6 max-w-xs text-lg leading-8 text-[#aeb8d1]">
              The all-in-one hall management software to simplify bookings, operations, payments, and growth.
            </p>
            <div className="mt-8 flex gap-4">
              <SocialIcon type="facebook" />
              <SocialIcon type="linkedin" />
              <SocialIcon type="instagram" />
            </div>
          </div>

          <LinkList title="Quick Links" links={quickLinks} />
          <LinkList title="Product" links={productLinks} />
          <LinkList title="Company" links={companyLinks} />

          <div className="border-white/10 lg:border-l lg:pl-9">
            <h3 className="text-xl font-black text-white">Stay Updated</h3>
            <p className="mt-8 text-base leading-8 text-[#aeb8d1]">
              Subscribe to our newsletter for the latest updates, product releases, and hall management tips.
            </p>

            <form className="mt-8" onSubmit={subscribe}>
              <label className="sr-only" htmlFor="footer-email">
                Email
              </label>
              <div className="flex h-14 items-center gap-3 rounded-2xl border border-white/20 bg-white/5 px-4 text-[#aeb8d1]">
                <MailIcon />
                <input
                  id="footer-email"
                  className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-[#aeb8d1]"
                  placeholder="Your email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setMessage("");
                  }}
                />
              </div>
              <button
                className="group mt-5 flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-linear-to-r from-[#1187ff] to-[#8b37f6] text-base font-black text-white shadow-lg shadow-[#3155ff]/20 transition hover:brightness-110"
                type="submit"
              >
                Subscribe
                <ArrowIcon />
              </button>
              {message ? <p className="mt-4 text-sm font-semibold text-[#9ec5ff]">{message}</p> : null}
            </form>
          </div>
        </div>
      </div>

      <div className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 px-5 py-7 text-center text-base text-[#aeb8d1] sm:px-8">
          <ShieldIcon />
          <p>© 2026 Hall Management SaaS. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
