"use client";

import { useDelayedInView } from "./use-delayed-in-view";

type PricingPlan = {
  name: string;
  description: string;
  price: string;
  billingNote: string;
  features: string[];
  buttonLabel: string;
  highlighted?: boolean;
};

const plans: PricingPlan[] = [
  {
    name: "Starter",
    description: "Perfect for small venues",
    price: "$149",
    billingNote: "Billed annually",
    features: ["Up to 2 Halls", "Unlimited Bookings", "Calendar & Scheduling", "Client Management", "Invoicing & Payments", "Email Support"],
    buttonLabel: "Start Free Trial"
  },
  {
    name: "Professional",
    description: "Best for growing venues",
    price: "$299",
    billingNote: "Billed annually",
    features: ["Up to 10 Halls", "All Starter Features", "Staff Management", "Reports & Analytics", "PDF Contracts", "Priority Support"],
    buttonLabel: "Start Free Trial",
    highlighted: true
  },
  {
    name: "Enterprise",
    description: "For large venues & chains",
    price: "$599",
    billingNote: "Billed annually",
    features: ["Unlimited Halls", "All Professional Features", "Advanced Analytics", "API Access", "Dedicated Account Manager", "24/7 Premium Support"],
    buttonLabel: "Contact Sales"
  }
];

function CheckIcon({ highlighted }: { highlighted?: boolean }) {
  return (
    <span
      className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full ${
        highlighted ? "bg-[#eef3ff] text-[#4f46ff]" : "bg-[#ecfdf3] text-[#138a4f]"
      }`}
    >
      <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="m3.5 8.4 2.8 2.7 6.2-6.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function PricingSection() {
  const [pricingHeaderRef, isPricingHeaderVisible] = useDelayedInView<HTMLDivElement>();
  const [pricingCardsRef, isPricingCardsVisible] = useDelayedInView<HTMLDivElement>({ threshold: 0.18 });
  const [trialCtaRef, isTrialCtaVisible] = useDelayedInView<HTMLDivElement>({ threshold: 0.22 });

  return (
    <section className="relative overflow-hidden bg-white px-5 py-24 sm:px-8 lg:py-28">
      <div className="saas-pricing-glow absolute left-1/2 top-8 h-64 w-2xl -translate-x-1/2 rounded-full bg-[#eef3ff] blur-3xl" />
      <div className="saas-pricing-glow absolute bottom-0 right-0 h-72 w-72 rounded-full bg-[#f0e7ff] blur-3xl" />

      <div className="saas-flip-stage relative mx-auto max-w-7xl">
        <div ref={pricingHeaderRef} id="pricing" className="mx-auto max-w-3xl text-center">
          <p className={`saas-flip-reveal text-xs font-black uppercase tracking-[0.24em] text-[#3155ff] ${isPricingHeaderVisible ? "is-visible" : ""}`}>Pricing</p>
          <h2 className={`saas-flip-reveal saas-delay-100 mt-4 text-3xl font-black tracking-tight text-[#10172f] sm:text-4xl lg:text-5xl ${isPricingHeaderVisible ? "is-visible" : ""}`}>
            Simple, Transparent Pricing
          </h2>
          <p className={`saas-flip-reveal saas-delay-180 mx-auto mt-5 max-w-2xl text-base leading-7 text-[#53607d] sm:text-lg ${isPricingHeaderVisible ? "is-visible" : ""}`}>
            Choose the right plan for your venue. Start small, upgrade anytime, and manage your hall operations with
            confidence.
          </p>
        </div>

        <div ref={pricingCardsRef} className="mx-auto mt-14 grid max-w-6xl gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan, planIndex) => (
            <article
              key={plan.name}
              className={`saas-pricing-slide-reveal saas-pricing-card ${
                planIndex === 0 ? "from-left" : planIndex === 1 ? "from-bottom" : "from-right"
              } ${planIndex === 0 ? "saas-slide-delay-120" : planIndex === 1 ? "saas-slide-delay-260" : "saas-slide-delay-400"} ${
                isPricingCardsVisible ? "is-visible" : ""
              } group relative flex flex-col rounded-3xl bg-white p-6 ${
                plan.highlighted
                  ? "is-recommended border border-[#6657ff] shadow-2xl shadow-[#3155ff]/18 lg:-mt-4"
                  : "border border-[#e4e9f7] shadow-sm shadow-[#3155ff]/5 hover:border-[#7062ff] hover:shadow-2xl hover:shadow-[#3155ff]/12"
              }`}
            >
              {plan.highlighted ? (
                <div className="saas-popular-badge absolute left-5 right-5 top-0 -translate-y-1/2 rounded-full bg-linear-to-r from-[#3155ff] to-[#7b2cff] px-4 py-2 text-center text-xs font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-[#5436ff]/25">
                  Most Popular
                </div>
              ) : null}

              <div className={plan.highlighted ? "pt-5" : ""}>
                <h3 className="text-xl font-black text-[#10172f]">{plan.name}</h3>
                <p className="mt-2 text-sm font-semibold text-[#53607d]">{plan.description}</p>

                <div className="mt-7 flex items-end gap-2">
                  <p className="text-5xl font-black tracking-tight text-[#10172f]">{plan.price}</p>
                  <p className="pb-2 text-sm font-bold text-[#53607d]">/month</p>
                </div>
                <p className="mt-1 text-sm text-[#6b7692]">{plan.billingNote}</p>
              </div>

              <ul className="mt-7 space-y-3">
                {plan.features.map((feature, featureIndex) => (
                  <li
                    key={feature}
                    className={`saas-fade-reveal flex gap-3 text-sm font-semibold leading-6 text-[#34405f] ${isPricingCardsVisible ? "is-visible" : ""} ${
                      featureIndex === 0
                        ? "saas-delay-520"
                        : featureIndex === 1
                          ? "saas-delay-640"
                          : featureIndex === 2
                            ? "saas-delay-760"
                            : featureIndex === 3
                              ? "saas-delay-880"
                              : featureIndex === 4
                                ? "saas-delay-1000"
                                : "saas-delay-1120"
                    }`}
                  >
                    <CheckIcon highlighted={plan.highlighted} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <a
                className={`saas-pricing-button mt-8 inline-flex h-12 w-full items-center justify-center rounded-xl text-sm font-black transition duration-300 ${
                  plan.highlighted
                    ? "bg-linear-to-r from-[#892fd3] to-[#456ef7] text-white shadow-lg shadow-[#5436ff]/25 hover:brightness-110"
                    : "border border-[#cd62ff] bg-white text-[#584ff7] hover:bg-[#f5f7ff] hover:brightness-105"
                }`}
                href={plan.name === "Enterprise" ? "#pricing" : "#trial"}
              >
                {plan.buttonLabel}
              </a>
            </article>
          ))}
        </div>

        <div
          ref={trialCtaRef}
          className={`saas-zoom-reveal relative mx-auto mt-16 max-w-7xl overflow-hidden rounded-4xl bg-linear-to-r from-[#2138a8] to-[#5f31ca] px-6 py-16 text-center text-white shadow-2xl shadow-[#3155ff]/25 sm:px-12 lg:px-20 ${
            isTrialCtaVisible ? "is-visible" : ""
          }`}
        >
          <div className="absolute -left-20 top-10 h-48 w-96 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-[#8b37f6]/35 blur-3xl" />
          <svg className="pointer-events-none absolute left-0 top-20 hidden h-48 w-136 opacity-35 md:block" viewBox="0 0 560 200" fill="none" aria-hidden="true">
            <path d="M0 112C78 64 118 128 188 86C268 38 324 122 402 82C460 52 510 46 560 68" stroke="white" strokeWidth="1.5" />
            <path d="M0 146C74 94 132 152 210 112C284 74 338 156 424 108C474 80 516 78 560 94" stroke="white" strokeWidth="1.5" />
            {Array.from({ length: 56 }).map((_, index) => (
              <circle key={index} cx={(index % 14) * 38 + 8} cy={Math.floor(index / 14) * 28 + 18} r="1.4" fill="white" opacity="0.75" />
            ))}
          </svg>

          <div className="relative">
            <h3
              className={`saas-fade-reveal saas-delay-100 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl ${
                isTrialCtaVisible ? "is-visible" : ""
              }`}
            >
              Start your free trial today!
            </h3>
            <p
              className={`saas-fade-reveal saas-delay-180 mx-auto mt-6 max-w-4xl text-base font-medium leading-8 text-white/90 sm:text-lg ${
                isTrialCtaVisible ? "is-visible" : ""
              }`}
            >
              Want to learn more about how Hall Management SaaS can help your venue? Contact our team now. Our experts are
              available to answer questions, walk you through setup, and help you try our 30-day free trial with full support
              included.
            </p>
            <div
              className={`saas-fade-reveal saas-delay-260 mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row ${
                isTrialCtaVisible ? "is-visible" : ""
              }`}
            >
              <a className="saas-hover-lift inline-flex h-13 min-w-48 items-center justify-center rounded-full bg-[#3f6ae2] px-8 text-sm font-black text-white shadow-lg shadow-black/10 transition hover:brightness-110" href="#trial">
                Book a Demo
              </a>
              <a className="saas-hover-lift inline-flex h-13 min-w-48 items-center justify-center rounded-full bg-black px-8 text-sm font-black text-black shadow-lg shadow-black/10 transition hover:brightness-105" type="button" data-contact-modal>
                Contact us
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
