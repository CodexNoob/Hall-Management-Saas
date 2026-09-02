"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { subscriptionPlans } from "@/lib/subscription/plans";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";

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
  const [isMounted, setIsMounted] = useState(false);
  const [pendingPlan, setPendingPlan] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function choosePlan(planId: string) {
    setPendingPlan(planId);
    setErrorMessage("");
    try {
      const response = await authenticatedFetch(
        "/api/billing/stripe/subscription-checkout",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId })
        }
      );
      const result = (await response.json()) as {
        checkoutUrl?: string;
        error?: string;
      };
      if (!response.ok || !result.checkoutUrl) {
        throw new Error(
          result.error ?? "Could not start subscription checkout."
        );
      }
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not start subscription checkout."
      );
      setPendingPlan("");
    }
  }

  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  if (!open || !isMounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-[#17202a]/40 p-3 backdrop-blur-[1px] sm:p-5"
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
            <p className="mt-1 text-sm text-[#6a7483]">{description}</p>
          </div>

          {forceSelection ? null : (
            <button
              aria-label="Close subscription plans"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#233144] transition hover:bg-[#eef4fa]"
              onClick={onClose}
              ref={closeButtonRef}
              type="button"
            >
              <svg
                aria-hidden="true"
                className="h-6 w-6"
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
            </button>
          )}
        </header>

        <div className="grid gap-5 p-4 md:grid-cols-3 sm:p-6">
          {subscriptionPlans.map((plan) => (
            <article
              className={`relative flex min-h-126 flex-col rounded-3xl px-6 pb-6 pt-7 shadow-sm ${
                plan.comingSoon
                  ? "border border-[#e2e5ea] bg-[#fafafa]"
                  : plan.popular
                    ? "border border-[#1f4d73] bg-white shadow-md shadow-[#17202a]/10"
                    : "border border-[#d8dde5] bg-white"
              }`}
              key={plan.name}
            >
              {plan.popular ? (
                <span className="absolute -left-px -right-px -top-4 rounded-full bg-[linear-gradient(90deg,#1f4d73_0%,#061126_100%)] px-3 py-2 text-center text-[11px] font-black uppercase tracking-[0.22em] text-white shadow-md">
                  Available Now
                </span>
              ) : null}

              {plan.comingSoon ? (
                <span className="absolute right-5 top-5 rounded-full border border-[#1f4d73]/20 bg-[#1f4d73]/8 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#1f4d73]">
                  Coming Soon
                </span>
              ) : null}

              <h3
                className={`text-2xl font-black ${
                  plan.comingSoon ? "text-[#94a1b1]" : "text-[#17202a]"
                }`}
              >
                {plan.name}
              </h3>
              <p className="mt-2 text-sm font-bold text-[#6a7483]">
                {plan.description}
              </p>

              <p
                className={`mt-8 ${
                  plan.comingSoon ? "text-[#94a1b1]" : "text-[#17202a]"
                }`}
              >
                <strong className="text-5xl font-black tracking-tight">
                  {plan.price}
                </strong>
                <span className="ml-1 text-sm font-bold text-[#6a7483]">
                  /month
                </span>
              </p>
              <p className="mt-1 text-sm text-[#6a7483]">{plan.billingLabel}</p>

              <ul
                className={`mt-8 space-y-4 text-sm font-bold ${
                  plan.comingSoon ? "text-[#94a1b1]" : "text-[#17202a]"
                }`}
              >
                {plan.features.map((feature) => (
                  <li className="flex items-center gap-2" key={feature}>
                    <CheckIcon />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* A label, not a disabled button. A control that cannot be used
                  in any state is not disabled, it is absent - and a disabled
                  button still invites the click that does nothing. */}
              {plan.comingSoon ? (
                <p className="mt-auto flex h-12 items-center justify-center rounded-xl border border-dashed border-[#cbd5e1] bg-white/60 text-sm font-black text-[#94a1b1]">
                  Coming Soon
                </p>
              ) : (
                <button
                  className={`mt-auto h-12 rounded-xl border text-sm font-black transition ${
                    plan.popular
                      ? "border-[#1f4d73] bg-[#1f4d73] text-white shadow-md hover:bg-[#15344f]"
                      : "border-[#b9c2cf] bg-white text-[#17202a] hover:border-[#1f4d73]/60 hover:bg-[#eef4fa]"
                  }`}
                  type="button"
                  disabled={Boolean(pendingPlan)}
                  onClick={() => void choosePlan(plan.id)}
                >
                  {pendingPlan === plan.id ? "Opening checkout…" : "Get Started"}
                </button>
              )}
            </article>
          ))}
          {errorMessage ? (
            <p
              className="md:col-span-3 text-center text-sm font-bold text-[#a62b24]"
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}
        </div>
      </section>
    </div>,
    document.body
  );
}
