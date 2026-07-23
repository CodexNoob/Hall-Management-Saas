"use client";

import Image from "next/image";
import type { ReactNode } from "react";

import { useDelayedInView } from "@/features/landing/hooks/use-delayed-in-view";

type BenefitCard = {
  title: string;
  description: string;
  metric: string;
  icon: ReactNode;
  iconSrc?: string;
};

function BenefitVisual({ children, src }: { children: ReactNode; src?: string }) {
  return (
    <div className="saas-benefit-visual relative flex h-48 items-center justify-center overflow-hidden rounded-3xl bg-linear-to-br from-[#F7F4ED] via-white to-[#F7F4ED] text-[#1f4d73] transition-transform duration-300 group-hover:scale-[1.04]">
      {src ? (
        <Image
          src={src}
          alt=""
          width={192}
          height={192}
          unoptimized
          className="h-48 w-48 object-contain drop-shadow-[0_18px_26px_rgba(15,23,42,0.22)] transition duration-300 group-hover:drop-shadow-[0_22px_32px_rgba(15,23,42,0.3)]"
        />
      ) : (
        <span className="[&_svg]:h-16 [&_svg]:w-16 [&_svg]:stroke-current [&_svg]:stroke-2">{children}</span>
      )}
    </div>
  );
}

const benefits: BenefitCard[] = [
  {
    title: "Save Time",
    description: "Automate bookings, invoicing, scheduling, and daily operations to reduce manual work every day.",
    metric: "Up to 70% Time Saved",
    iconSrc: "/images/benefits/Save-time.png",
    icon: (
      <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path d="M32 56a22 22 0 1 0 0-44 22 22 0 0 0 0 44Z" />
        <path d="M32 22v12l8 5M24 6h16M32 6v6M9 32H3M61 32h-6M14 16l-5-5" />
      </svg>
    )
  },
  {
    title: "Reduce Double Bookings",
    description: "Use real-time hall availability and smart scheduling to prevent overlapping events.",
    metric: "99% Fewer Conflicts",
    iconSrc: "/images/benefits/Reduce-double-bookings.png",
    icon: (
      <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path d="M10 14h34v34H10zM18 8v12M36 8v12M10 24h34M17 32h6M29 32h6M17 40h6" />
        <path d="M42 44 50 52 62 34" />
        <path d="M50 18h8v8" />
      </svg>
    )
  },
  {
    title: "Improve Client Experience",
    description: "Give clients faster responses, clearer communication, digital agreements, and smoother booking updates.",
    metric: "4.8/5 Client Satisfaction",
    iconSrc: "/images/benefits/Improve-client-experience.png",
    icon: (
      <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path d="M18 30a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM46 30a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM6 56a12 12 0 0 1 24 0M34 56a12 12 0 0 1 24 0" />
        <path d="M25 39h14l7 7v-7h8V25H25z" />
        <path d="m29 48 2-4 2 4 4 .5-3 3 .8 4-3.8-2-3.8 2 .8-4-3-3z" />
      </svg>
    )
  },
  {
    title: "Grow Revenue",
    description: "Track occupancy, payments, upsells, and booking performance to maximize venue income.",
    metric: "30%+ Revenue Growth",
    iconSrc: "/images/benefits/Grow-revenue.png",
    icon: (
      <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path d="M8 54h48M14 48V34M28 48V26M42 48V18M10 30l14-12 12 8 18-18" />
        <path d="M46 8h8v8" />
      </svg>
    )
  }
];

export function BenefitsSection() {
  const [sectionRef, isSectionVisible] = useDelayedInView<HTMLElement>();

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-linear-to-b from-white to-[#F7F4ED] px-5 py-24 sm:px-8 lg:py-28">
      <div className="saas-benefit-glow absolute -left-32 top-12 h-72 w-72 rounded-full bg-[#1f4d73]/12 blur-3xl" />
      <div className="saas-benefit-glow absolute -right-28 bottom-0 h-80 w-80 rounded-full bg-[#0F172A]/8 blur-3xl" />

      <div className="saas-flip-stage relative mx-auto max-w-7xl">
        <div id="benefits" className="mx-auto max-w-3xl text-center">
          <p className={`saas-flip-reveal text-xl font-black uppercase tracking-[0.24em] text-[#1f4d73] ${isSectionVisible ? "is-visible" : ""}`}>Benefits</p>
          <h2 className={`saas-flip-reveal saas-delay-100 mt-4 text-3xl font-black tracking-tight text-[#0F172A] sm:text-4xl lg:text-5xl ${isSectionVisible ? "is-visible" : ""}`}>
            Run Smarter. Save More. Grow Faster.
          </h2>
          <p className={`saas-flip-reveal saas-delay-180 mx-auto mt-5 max-w-3xl text-base leading-7 text-[#64748B] sm:text-lg ${isSectionVisible ? "is-visible" : ""}`}>
            Hall Management SaaS helps venue owners reduce manual work, avoid booking mistakes, improve client experience, and
            grow revenue with better control over daily operations.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {benefits.map((benefit, index) => (
            <article
              key={benefit.title}
              className={`saas-benefit-slide-reveal saas-benefit-card group rounded-3xl border border-[#E5E0D6] bg-white/90 p-6 shadow-sm shadow-[#1f4d73]/5 backdrop-blur hover:border-[#1f4d73] ${
                benefit.title === "Save Time" ? "from-left" : benefit.title === "Grow Revenue" ? "from-right" : "from-bottom"
              } ${isSectionVisible ? "is-visible" : ""} ${
                index === 0 ? "saas-delay-260" : index === 1 ? "saas-delay-340" : index === 2 ? "saas-delay-420" : "saas-delay-520"
              }`}
            >
              <BenefitVisual src={benefit.iconSrc}>{benefit.icon}</BenefitVisual>
              <h3 className="mt-6 text-xl font-black text-[#0F172A]">{benefit.title}</h3>
              <p className="mt-3 min-h-24 text-sm leading-6 text-[#64748B]">{benefit.description}</p>
              <div
                className={`saas-scale-reveal mt-6 inline-flex rounded-2xl border border-[#E5E0D6] bg-linear-to-r from-[#F7F4ED] to-white px-4 py-3 text-sm font-black text-[#15344f] ${isSectionVisible ? "is-visible" : ""} ${
                  index === 0 ? "saas-delay-420" : index === 1 ? "saas-delay-520" : index === 2 ? "saas-delay-640" : "saas-delay-760"
                }`}
              >
                {benefit.metric}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
