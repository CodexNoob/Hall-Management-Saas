"use client";

import Image from "next/image";

import { useDelayedInView } from "./use-delayed-in-view";

type FeatureCard = {
  title: string;
  description: string;
  iconSrc: string;
};

function FeatureIcon({ src }: { src: string }) {
  return (
    <div className="flex h-40 w-full shrink-0 items-center justify-center pt-6">
      <span className="saas-feature-icon flex h-24 w-24 items-center justify-center rounded-3xl bg-linear-to-br from-[#F7F4ED] to-[#eef4fa] p-5 transition-colors duration-300 group-hover:from-[#1f4d73] group-hover:to-[#0F172A] sm:h-28 sm:w-28">
        <Image
          src={src}
          alt=""
          width={192}
          height={192}
          className="h-16 w-16 object-contain transition duration-300 group-hover:scale-105 group-hover:brightness-0 group-hover:invert sm:h-20 sm:w-20"
        />
      </span>
    </div>
  );
}

const features: FeatureCard[] = [
  {
    title: "Event & Booking Management",
    description: "Create bookings, manage complete event records, and keep every event detail organized in one workspace.",
    iconSrc: "/features icons/Event-Booking-management.png"
  },
  {
    title: "Calendar & Availability",
    description: "Review monthly schedules, check room availability, manage holds, and block unavailable date ranges.",
    iconSrc: "/features icons/Calendar-Availability.png"
  },
  {
    title: "Kitchen Operations",
    description: "Plan kitchen events, portions, preparation notes, schedules, and assigned work across daily and weekly views.",
    iconSrc: "/features icons/Kitchen-Operations.png"
  },
  {
    title: "Menu Library & Packages",
    description: "Build reusable menu items, categories, packages, pricing, dietary details, and event-specific selections.",
    iconSrc: "/features icons/Menu-Library-Packages.png"
  },
  {
    title: "Dining & Seating Management",
    description: "Prepare dining layouts, place tables, manage seating counts, assign waiters, and save hall presets.",
    iconSrc: "/features icons/Dining-Sitting-management.png"
  },
  {
    title: "Hall Room Map Editor",
    description: "Create reusable hall layouts with movable, resizable, and rotatable tables, dividers, and service areas.",
    iconSrc: "/features icons/Hall-Room-Map.png"
  },
  {
    title: "Billing & Invoicing",
    description: "Create invoices, line items, deposits, payment schedules, transactions, refunds, and outstanding balances.",
    iconSrc: "/features icons/Billing-Invoicing.png"
  },
  {
    title: "Staff, Permissions & Files",
    description: "Manage staff roles and access while organizing event documents, pictures, videos, and operational files.",
    iconSrc: "/features icons/Staff-Permission-Files.png"
  }
];

export function FeaturesSection() {
  const [sectionRef, isSectionVisible] = useDelayedInView<HTMLElement>();

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

        <div className="mt-14 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {features.map((feature, index) => (
            <article
              key={feature.title}
              className={`saas-feature-slide-reveal group flex min-h-80 flex-col items-center rounded-3xl border border-[#E5E0D6] bg-white p-6 text-center shadow-sm shadow-[#1f4d73]/5 transition duration-300 hover:-translate-y-1 hover:border-[#1f4d73] hover:shadow-xl hover:shadow-[#1f4d73]/10 ${isSectionVisible ? "is-visible" : ""} ${
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
              <FeatureIcon src={feature.iconSrc} />
              <h3 className="mt-4 text-xl font-black leading-tight text-[#0F172A]">
                {feature.title}
              </h3>
              <p className="mt-3 text-sm font-semibold leading-6 text-[#64748B]">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
