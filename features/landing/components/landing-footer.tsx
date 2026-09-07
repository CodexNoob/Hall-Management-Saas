"use client";

import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import type { MouseEvent } from "react";
import { NewsletterForm } from "@/features/landing/components/newsletter-form";
import {
  companyLinks,
  quickLinks
} from "@/features/landing/navigation/footer-navigation";
import { preparePublicPageNavigation } from "@/features/landing/navigation/public-page-scroll";

function FooterBrandIcon() {
  return (
    <Image
      src="/images/branding/Footer-logo.png"
      alt="Hall Management SaaS"
      width={720}
      height={220}
      unoptimized
      className="h-auto w-64 max-w-full object-contain"
    />
  );
}

function ChevronIcon() {
  return (
    <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="m6 3 5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function openFooterTarget(href: string) {
  const url = new URL(href, window.location.origin);
  const currentPath = `${window.location.pathname}${window.location.search}`;
  const targetPath = `${url.pathname}${url.search}`;

  if (targetPath !== currentPath) {
    preparePublicPageNavigation(href);
    return false;
  }

  const id = decodeURIComponent(url.hash.slice(1));
  if (id === "contact") {
    window.dispatchEvent(new Event("event-core:open-contact"));
    return true;
  }

  if (!id) {
    window.history.pushState(null, "", targetPath || "/");
    window.scrollTo({ top: 0, left: 0 });
    return true;
  }

  const target = document.getElementById(id);
  if (!target) {
    preparePublicPageNavigation(href);
    return false;
  }

  window.history.pushState(null, "", `${targetPath}${url.hash}`);
  target.scrollIntoView({ block: "start" });
  return true;
}

function LinkList({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (openFooterTarget(href)) {
      event.preventDefault();
    }
  }

  return (
    <div className="border-white/10 lg:border-l lg:pl-9">
      <h3 className="text-xl font-black text-white">{title}</h3>
      <ul className="mt-8 space-y-5">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              className="group flex items-center gap-3 text-base font-medium text-[#aeb8d1] transition hover:text-[#1f4d73]"
              href={link.href as Route}
              onClick={(event) => handleClick(event, link.href)}
              scroll={false}
            >
              <span className="text-[#1f4d73]">
                <ChevronIcon />
              </span>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LandingFooter() {
  return (
    <footer className="relative overflow-hidden bg-[#061126] text-white" data-site-footer>
      <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-[#1f4d73]/15 blur-3xl" />
      <div className="absolute -right-24 top-0 h-72 w-72 rounded-full bg-[#0F172A]/20 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.35fr_0.85fr_0.9fr_1.25fr]">
          <div>
            <FooterBrandIcon />
            <p className="mt-6 max-w-xs text-lg leading-8 text-[#aeb8d1]">
              Event Core helps venue owners reduce manual work, avoid booking mistakes, improve client experience, and grow revenue with better control over daily operations.
            </p>
          </div>

          <LinkList title="Quick Links" links={quickLinks} />
          <LinkList title="Company" links={companyLinks} />

          <div className="border-white/10 lg:border-l lg:pl-9">
            <h3 className="text-xl font-black text-white">Stay Updated</h3>
            <p className="mt-8 text-base leading-8 text-[#aeb8d1]">
              Subscribe to our newsletter for the latest updates, product releases, and hall management tips.
            </p>

            <NewsletterForm />
          </div>
        </div>
      </div>

      <div className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 px-5 py-7 text-center text-base text-[#aeb8d1] sm:px-8">
          <p>© 2026 Event Core. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
