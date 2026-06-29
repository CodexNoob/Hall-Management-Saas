"use client";

import type { ReactNode } from "react";

import { useDelayedInView } from "./use-delayed-in-view";

type FeatureCard = {
  title: string;
  description: string;
  icon: ReactNode;
};

function FeatureIcon({ children }: { children: ReactNode }) {
  return (
    <div className="saas-feature-icon flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-[#eef3ff] to-[#f1eaff] text-[#4f46ff] transition-colors duration-300 group-hover:from-[#3155ff] group-hover:to-[#7b2cff] group-hover:text-white">
      <span className="[&_svg]:h-6 [&_svg]:w-6 [&_svg]:stroke-current [&_svg]:stroke-2">{children}</span>
    </div>
  );
}

const features: FeatureCard[] = [
  {
    title: "Booking Management",
    description: "Create, manage, and track all hall bookings in one organized dashboard.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 5h14v15H5zM8 3v4M16 3v4M5 10h14M8 14h4M8 17h7" />
      </svg>
    )
  },
  {
    title: "Event Scheduling",
    description: "Schedule events, set timelines, manage dates, and avoid calendar conflicts.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 6h16v14H4zM8 3v5M16 3v5M4 11h16M8 15h3M14 15h2" />
      </svg>
    )
  },
  {
    title: "Multi-Hall Calendar",
    description: "View real-time availability across multiple halls and prevent double bookings.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z" />
      </svg>
    )
  },
  {
    title: "Client Management",
    description: "Store client details, booking history, contact information, and communication records.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0M18 8h3M19.5 6.5v3" />
      </svg>
    )
  },
  {
    title: "Invoicing & Payments",
    description: "Generate invoices, monitor payment status, collect dues, and track revenue.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 3h12v18l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2L6 21zM9 8h6M9 12h6M9 16h3" />
      </svg>
    )
  },
  {
    title: "Staff Coordination",
    description: "Assign tasks, manage staff schedules, and coordinate teams for every event.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 21a5 5 0 0 1 10 0M11 21a5 5 0 0 1 10 0" />
      </svg>
    )
  },
  {
    title: "Reports & Analytics",
    description: "Track bookings, occupancy, payments, and performance with clear visual insights.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 20h16M7 17v-5M12 17V7M17 17v-8M5 9l5-4 4 3 5-5" />
      </svg>
    )
  },
  {
    title: "PDF Contracts & Acceptances",
    description: "Create, send, and manage digital contracts, agreements, and client acceptances.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 3h9l3 3v15H6zM15 3v4h4M9 11h6M9 15h6M9 18h4" />
      </svg>
    )
  }
];

export function FeaturesSection() {
  const [sectionRef, isSectionVisible] = useDelayedInView<HTMLElement>();

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-white px-5 py-24 sm:px-8 lg:py-28">
      <div className="saas-feature-glow absolute left-1/2 top-0 h-40 w-xl -translate-x-1/2 rounded-full bg-[#eff3ff] blur-3xl" />
      <div className="saas-feature-glow absolute -right-32 top-32 h-72 w-72 rounded-full bg-[#f1eaff] opacity-60 blur-3xl" />

      <div className="saas-flip-stage relative mx-auto max-w-7xl">
        <div id="features" className="mx-auto max-w-3xl text-center">
          <p className={`saas-flip-reveal text-lg font-black uppercase tracking-[0.24em] text-[#3155ff] ${isSectionVisible ? "is-visible" : ""}`}>Features</p>
          <h2 className={`saas-flip-reveal saas-delay-100 mt-4 text-3xl font-black tracking-tight text-[#10172f] sm:text-4xl lg:text-5xl ${isSectionVisible ? "is-visible" : ""}`}>
            Everything You Need to Run Your Venue Seamlessly
          </h2>
          <p className={`saas-flip-reveal saas-delay-180 mx-auto mt-5 max-w-2xl text-base leading-7 text-[#53607d] sm:text-lg ${isSectionVisible ? "is-visible" : ""}`}>
            Manage bookings, events, payments, clients, staff, and reports from one centralized platform built for modern hall
            operations.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {features.map((feature, index) => (
            <article
              key={feature.title}
              className={`saas-feature-slide-reveal saas-feature-card group rounded-3xl border border-[#e4e9f7] bg-white p-6 shadow-sm shadow-[#3155ff]/5 hover:border-[#7062ff] ${isSectionVisible ? "is-visible" : ""} ${
                index === 0
                  ? ""
                  : index === 1
                    ? "saas-feature-delay-100"
                    : index === 2
                      ? "saas-feature-delay-200"
                      : index === 3
                        ? "saas-feature-delay-300"
                        : index === 4
                          ? "saas-feature-delay-400"
                          : index === 5
                            ? "saas-feature-delay-500"
                            : index === 6
                              ? "saas-feature-delay-600"
                              : "saas-feature-delay-700"
              }`}
            >
              <FeatureIcon>{feature.icon}</FeatureIcon>
              <h3 className="mt-6 text-lg font-black text-[#10172f]">{feature.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#53607d]">{feature.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
