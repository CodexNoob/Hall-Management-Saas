"use client";

import Image from "next/image";

import { useDelayedInView } from "@/features/landing/hooks/use-delayed-in-view";

type FeatureCard = {
  title: string;
  description: string;
  iconSrc: string;
  comingSoon?: boolean;
};

function FeatureIcon({ src, muted }: { src: string; muted?: boolean }) {
  return (
    <div className="flex h-40 w-full shrink-0 items-center justify-center pt-6">
      <span
        className={`saas-feature-icon flex h-24 w-24 items-center justify-center rounded-3xl p-5 transition-colors duration-300 sm:h-28 sm:w-28 ${
          muted
            ? "bg-linear-to-br from-[#F1F0EC] to-[#ECEFF3]"
            : "bg-linear-to-br from-[#F7F4ED] to-[#eef4fa] group-hover:from-[#1f4d73] group-hover:to-[#0F172A]"
        }`}
      >
        <Image
          src={src}
          alt=""
          width={192}
          height={192}
          className={`h-16 w-16 object-contain transition duration-300 sm:h-20 sm:w-20 ${
            muted ? "opacity-40 grayscale" : "group-hover:scale-105 group-hover:brightness-0 group-hover:invert"
          }`}
        />
      </span>
    </div>
  );
}

function FeatureCardArticle({ feature, index }: { feature: FeatureCard; index: number }) {
  const [cardRef, isCardVisible] = useDelayedInView<HTMLElement>({
    rootMargin: "0px 0px -12% 0px",
    threshold: 0.12
  });

  const delayClass =
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
                  : "saas-feature-delay-700";

  const comingSoon = feature.comingSoon === true;

  return (
    <article
      ref={cardRef}
      className={`saas-feature-slide-reveal ${
        index % 2 === 0 ? "saas-feature-mobile-left" : "saas-feature-mobile-right"
      } group relative flex min-h-80 flex-col items-center rounded-3xl border p-6 text-center shadow-sm transition duration-300 ${
        comingSoon
          ? "border-[#E8E5DE] bg-[#FAF9F7] shadow-[#0F172A]/3"
          : "border-[#E5E0D6] bg-white shadow-[#1f4d73]/5 hover:-translate-y-1 hover:border-[#1f4d73] hover:shadow-xl hover:shadow-[#1f4d73]/10"
      } ${isCardVisible ? "is-visible" : ""} ${delayClass}`}
    >
      {comingSoon ? (
        <span className="absolute right-4 top-4 rounded-full border border-[#1f4d73]/20 bg-[#1f4d73]/8 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#1f4d73]">
          Coming Soon
        </span>
      ) : null}
      <FeatureIcon src={feature.iconSrc} muted={comingSoon} />
      <h3
        className={`mt-4 text-xl font-black leading-tight ${
          comingSoon ? "text-[#94A3B8]" : "text-[#0F172A]"
        }`}
      >
        {feature.title}
      </h3>
      <p
        className={`mt-3 text-sm font-semibold leading-6 ${
          comingSoon ? "text-[#A3AEBD]" : "text-[#64748B]"
        }`}
      >
        {feature.description}
      </p>
    </article>
  );
}

const features: FeatureCard[] = [
  {
    title: "Event & Booking Management",
    description: "Create bookings, manage complete event records, and keep every event detail organized in one workspace.",
    iconSrc: "/images/features/Event-Booking-management.png"
  },
  {
    title: "Calendar & Availability",
    description: "Review monthly schedules, check room availability, manage holds, and block unavailable date ranges.",
    iconSrc: "/images/features/Calendar-Availability.png"
  },
  {
    title: "Kitchen Operations",
    description: "Plan kitchen events, portions, preparation notes, schedules, and assigned work across daily and weekly views.",
    iconSrc: "/images/features/Kitchen-Operations.png"
  },
  {
    title: "Menu Library & Packages",
    description: "Build reusable menu items, categories, packages, pricing, dietary details, and event-specific selections.",
    iconSrc: "/images/features/Menu-Library-Packages.png"
  },
  {
    title: "Dining & Seating Management",
    description: "Prepare dining layouts, place tables, manage seating counts, assign waiters, and save hall presets.",
    iconSrc: "/images/features/Dining-Sitting-management.png",
    comingSoon: true
  },
  {
    title: "Hall Room Map Editor",
    description: "Create reusable hall layouts with movable, resizable, and rotatable tables, dividers, and service areas.",
    iconSrc: "/images/features/Hall-Room-Map.png",
    comingSoon: true
  },
  {
    title: "Billing & Invoicing",
    description: "Create invoices, line items, deposits, payment schedules, transactions, refunds, and outstanding balances.",
    iconSrc: "/images/features/Billing-Invoicing.png",
    comingSoon: true
  },
  {
    title: "Staff & Permissions",
    description: "Manage staff records, assign roles, and control who can access each part of your venue workspace.",
    iconSrc: "/images/features/Staff-Permission-Files.png"
  },
  {
    title: "Files & Documents",
    description: "Organize event documents, pictures, videos, and operational files in one shared library.",
    iconSrc: "/images/features/Staff-Permission-Files.png",
    comingSoon: true
  }
];

export function FeaturesSection() {
  const [sectionRef, isSectionVisible] = useDelayedInView<HTMLElement>({
    rootMargin: "0px 0px -8% 0px",
    threshold: 0.01
  });

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-white px-5 py-24 sm:px-8 lg:py-28">
      <div className="saas-feature-glow absolute left-1/2 top-0 h-40 w-xl -translate-x-1/2 rounded-full bg-[#1f4d73]/12 blur-3xl" />
      <div className="saas-feature-glow absolute -right-32 top-32 h-72 w-72 rounded-full bg-[#F7F4ED] opacity-60 blur-3xl" />

      <div className="saas-flip-stage relative mx-auto max-w-7xl">
        <div id="features" className="mx-auto max-w-3xl text-center">
          <p className={`saas-flip-reveal text-lg font-black uppercase tracking-[0.24em] text-[#1f4d73] ${isSectionVisible ? "is-visible" : ""}`}>Features</p>
          <h2 className={`saas-flip-reveal saas-delay-100 mt-4 text-3xl font-black tracking-tight text-[#0F172A] sm:text-4xl lg:text-5xl ${isSectionVisible ? "is-visible" : ""}`}>
            Everything You Need to Run Your Venue Seamlessly
          </h2>
          <p className={`saas-flip-reveal saas-delay-180 mx-auto mt-5 max-w-2xl text-base leading-7 text-[#64748B] sm:text-lg ${isSectionVisible ? "is-visible" : ""}`}>
            Coordinate events, calendars, kitchen work, menus, dining layouts, billing, staff, and files from one connected
            operations platform.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {features.map((feature, index) => (
            <FeatureCardArticle feature={feature} index={index} key={feature.title} />
          ))}
        </div>
      </div>
    </section>
  );
}
