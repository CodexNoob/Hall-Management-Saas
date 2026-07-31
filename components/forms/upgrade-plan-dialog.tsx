"use client";

import { useEffect, useId, useRef } from "react";

import { subscriptionPlans } from "@/lib/subscription/plans";

type UpgradePlanDialogProps = {
  description?: string;
  forceSelection?: boolean;
  open: boolean;
  onClose: () => void;
  title?: string;
};

function CheckIcon() {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#eef4fa] text-[#1f4d73]">
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

export function UpgradePlanDialog({
  description = "Choose the plan that fits your hall management operation.",
  forceSelection = false,
  open,
  onClose,
  title = "Subscription Plan"
}: UpgradePlanDialogProps) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !forceSelection) onClose();
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [forceSelection, onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center overflow-y-auto bg-[#17202a]/40 p-3 backdrop-blur-[1px] sm:p-5"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !forceSelection) onClose();
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="my-auto w-full max-w-6xl overflow-hidden rounded-2xl border border-[#d8dde5] bg-[#f5f6f8] shadow-2xl"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#d8dde5] bg-white px-5 py-4">
          <div>
            <h2 className="text-xl font-black text-[#17202a]" id={titleId}>
              {title}
            </h2>
            <p className="mt-1 text-sm text-[#6a7483]">
              {description}
            </p>
          </div>

          {forceSelection ? null : (
            <button
              aria-label="Close subscription plans"
              className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[0] leading-none text-[#233144] transition hover:bg-[#eef4fa]"
              onClick={onClose}
              ref={closeButtonRef}
              type="button"
            >
              <svg
                aria-hidden="true"
                className="absolute h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  d="M5 5 19 19M19 5 5 19"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="2.25"
                />
              </svg>
              <span aria-hidden="true">?</span>
            </button>
          )}
        </header>

        <div className="grid gap-5 p-4 md:grid-cols-3 sm:p-6">
          {subscriptionPlans.map((plan) => (
            <article
              className={`relative flex min-h-126 flex-col rounded-3xl bg-white px-6 pb-6 pt-7 shadow-sm ${
                plan.popular
                  ? "border border-[#1f4d73] shadow-md shadow-[#17202a]/10"
                  : "border border-[#d8dde5]"
              }`}
              key={plan.name}
            >
              {plan.popular ? (
                <span className="absolute -left-px -right-px -top-4 rounded-full bg-[linear-gradient(90deg,#1f4d73_0%,#061126_100%)] px-3 py-2 text-center text-[11px] font-black uppercase tracking-[0.22em] text-white shadow-md">
                  Most Popular
                </span>
              ) : null}

              <h3 className="text-2xl font-black text-[#17202a]">
                {plan.name}
              </h3>
              <p className="mt-2 text-sm font-bold text-[#6a7483]">
                {plan.description}
              </p>

              <p className="mt-8 text-[#17202a]">
                <strong className="text-5xl font-black tracking-tight">
                  {plan.price}
                </strong>
                <span className="ml-1 text-sm font-bold text-[#6a7483]">
                  /month
                </span>
              </p>
              <p className="mt-1 text-sm text-[#6a7483]">
                {plan.billingLabel}
              </p>

              <ul className="mt-8 space-y-4 text-sm font-bold text-[#17202a]">
                {plan.features.map((feature) => (
                  <li className="flex items-center gap-2" key={feature}>
                    <CheckIcon />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                className={`mt-auto h-12 rounded-xl border text-sm font-black transition ${
                  plan.popular
                    ? "border-[#1f4d73] bg-[#1f4d73] text-white shadow-md hover:bg-[#15344f]"
                    : "border-[#b9c2cf] bg-white text-[#17202a] hover:border-[#1f4d73]/60 hover:bg-[#eef4fa]"
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
