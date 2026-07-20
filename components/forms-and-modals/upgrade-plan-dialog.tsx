"use client";

import { useEffect, useId, useRef } from "react";

type UpgradePlanDialogProps = {
  open: boolean;
  onClose: () => void;
};

type SubscriptionPlan = {
  name: string;
  price: string;
  description: string;
  features: string[];
  popular?: boolean;
};

const subscriptionPlans: SubscriptionPlan[] = [
  {
    name: "Starter",
    price: "$149",
    description: "Perfect for small venues",
    features: [
      "Up to 2 Halls",
      "Unlimited Bookings",
      "Calendar & Scheduling",
      "Client Management",
      "Invoicing & Payments",
      "Email Support"
    ]
  },
  {
    name: "Professional",
    price: "$299",
    description: "Best for growing venues",
    features: [
      "Up to 10 Halls",
      "All Starter Features",
      "Staff Management",
      "Reports & Analytics",
      "PDF Contracts",
      "Priority Support"
    ],
    popular: true
  },
  {
    name: "Enterprise",
    price: "$599",
    description: "For large venues & chains",
    features: [
      "Unlimited Halls",
      "All Professional Features",
      "Advanced Analytics",
      "API Access",
      "Dedicated Account Manager",
      "24/7 Premium Support"
    ]
  }
];

function CheckIcon() {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#ebfaf2] text-[#18945f]">
      <svg
        aria-hidden="true"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
        viewBox="0 0 24 24"
      >
        <path d="m6 12 4 4 8-9" />
      </svg>
    </span>
  );
}

export function UpgradePlanDialog({ open, onClose }: UpgradePlanDialogProps) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center overflow-y-auto bg-[#17202a]/40 p-3 backdrop-blur-[1px] sm:p-5"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="my-auto w-full max-w-6xl overflow-hidden rounded-2xl border border-[#d8dde5] bg-[#f8f6f1] shadow-2xl"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#d8dde5] bg-white px-5 py-4">
          <div>
            <h2 className="text-xl font-black text-[#17202a]" id={titleId}>
              Subscription Plan
            </h2>
            <p className="mt-1 text-sm text-[#6a7483]">
              Choose the plan that fits your hall management operation.
            </p>
          </div>

          <button
            className="h-9 shrink-0 rounded-lg border border-[#c7d0dc] bg-white px-4 text-xs font-black text-[#233144] transition hover:bg-[#eef4fa]"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            Close
          </button>
        </header>

        <div className="grid gap-5 p-4 md:grid-cols-3 sm:p-6">
          {subscriptionPlans.map((plan) => (
            <article
              className={`relative flex min-h-126 flex-col rounded-3xl bg-white px-6 pb-6 pt-7 shadow-sm ${
                plan.popular
                  ? "border border-[#bd9847]"
                  : "border border-[#d8dde5]"
              }`}
              key={plan.name}
            >
              {plan.popular ? (
                <span className="absolute -left-px -right-px -top-4 rounded-full bg-[linear-gradient(90deg,#c7a65a_0%,#2d3440_100%)] px-3 py-2 text-center text-[11px] font-black uppercase tracking-[0.22em] text-white shadow-md">
                  Most Popular
                </span>
              ) : null}

              <h3 className="text-2xl font-black text-[#10182c]">
                {plan.name}
              </h3>
              <p className="mt-2 text-sm font-bold text-[#60708c]">
                {plan.description}
              </p>

              <p className="mt-8 text-[#10182c]">
                <strong className="text-5xl font-black tracking-tight">
                  {plan.price}
                </strong>
                <span className="ml-1 text-sm font-bold text-[#60708c]">
                  /month
                </span>
              </p>
              <p className="mt-1 text-sm text-[#60708c]">Billed annually</p>

              <ul className="mt-8 space-y-4 text-sm font-bold text-[#1c273a]">
                {plan.features.map((feature) => (
                  <li className="flex items-center gap-2" key={feature}>
                    <CheckIcon />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                className={`mt-auto h-12 rounded-xl border text-sm font-black text-[#111827] transition ${
                  plan.popular
                    ? "border-[#bd9847] bg-[#c6a04f] shadow-md hover:bg-[#b89140]"
                    : "border-[#ddd8cd] bg-white hover:bg-[#f8f6f1]"
                }`}
                type="button"
              >
                Get Started
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
