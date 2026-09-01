"use client";

import { useEffect, useRef, useState } from "react";
import { Crown } from "lucide-react";
import {
  createContext,
  useContext,
  type ReactNode
} from "react";
import type { AuthSessionResponse } from "@/lib/auth/client";
import {
  getTrialDaysRemaining,
  isTesterBypassEmail,
  TRIAL_DAYS
} from "@/lib/subscription/trial";
import { UpgradePlanDialog } from "@/components/forms/upgrade-plan-dialog";

type DashboardTrialProviderProps = {
  authSession: AuthSessionResponse;
  children: ReactNode;
};

type TrialBadgeState = {
  daysRemaining: number | null;
  percentUsed: number;
  visible: boolean;
  label: string;
  compactLabel: string;
};

const DashboardTrialContext = createContext<TrialBadgeState>({
  daysRemaining: null,
  percentUsed: 0,
  visible: false,
  label: "",
  compactLabel: ""
});

function getTrialBadgeState(authSession: AuthSessionResponse): TrialBadgeState {
  const activeOrganization =
    authSession.organizations.find(
      (organization) => organization.id === authSession.activeOrganizationId
    ) ?? null;
  const isTrial =
    activeOrganization?.subscriptionStatus === "trialing" &&
    !isTesterBypassEmail(authSession.user.email);

  if (!isTrial) {
    return {
      daysRemaining: null,
      percentUsed: 0,
      visible: false,
      label: "",
      compactLabel: ""
    };
  }

  const daysRemaining = getTrialDaysRemaining(activeOrganization.trialEndsAt);
  const label =
    daysRemaining === null
      ? "Free trial"
      : daysRemaining === 0
        ? "Ends today"
        : `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left`;
  const compactLabel =
    daysRemaining === null
      ? "Free trial"
      : daysRemaining === 0
        ? "Today"
        : `${daysRemaining}d`;

  const safeDaysRemaining = daysRemaining ?? TRIAL_DAYS;
  const daysUsed = Math.max(0, TRIAL_DAYS - safeDaysRemaining);
  const percentUsed = Math.min(
    100,
    Math.max(0, Math.round((daysUsed / TRIAL_DAYS) * 100))
  );

  return {
    daysRemaining,
    percentUsed,
    visible: true,
    label,
    compactLabel
  };
}

export function DashboardTrialProvider({
  children,
  authSession
}: DashboardTrialProviderProps) {
  return (
    <DashboardTrialContext.Provider value={getTrialBadgeState(authSession)}>
      {children}
    </DashboardTrialContext.Provider>
  );
}

export function DashboardTrialBadge() {
  const trial = useContext(DashboardTrialContext);
  const trialCardRef = useRef<HTMLDivElement>(null);
  const [isTrialCardOpen, setIsTrialCardOpen] = useState(false);
  const [isUpgradePlanDialogOpen, setIsUpgradePlanDialogOpen] =
    useState(false);

  useEffect(() => {
    if (!isTrialCardOpen) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (
        trialCardRef.current &&
        !trialCardRef.current.contains(event.target as Node)
      ) {
        setIsTrialCardOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsTrialCardOpen(false);
      }
    }

    window.addEventListener("mousedown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("mousedown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isTrialCardOpen]);

  if (!trial.visible) {
    return null;
  }

  return (
    <>
      <div className="relative inline-flex w-fit shrink-0" ref={trialCardRef}>
        <button
          aria-expanded={isTrialCardOpen}
          aria-haspopup="dialog"
          aria-label={`Trial - ${trial.label}`}
          className="inline-flex max-w-full shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-[#dfe4ea] bg-[#f5f6f8] px-1.5 py-0.5 text-[11px] font-semibold leading-none text-[#6a7483] transition hover:border-[#c9d1da] hover:bg-[#eef0f4] hover:text-[#4a5563] focus:outline-none focus:ring-2 focus:ring-[#b9c2cf]/60 sm:gap-1.5 sm:px-2 sm:py-1 sm:text-xs sm:leading-none"
          onClick={() => setIsTrialCardOpen((current) => !current)}
          type="button"
        >
          <Crown className="h-3 w-3 shrink-0 text-[#a9b2c0] sm:h-3.5 sm:w-3.5" strokeWidth={2} />
          <span>Trial</span>
          {/* The title row keeps only ~176px between the mobile menu inset and
              the absolutely positioned action cluster, so the day count is
              dropped below 440px and the full wording waits until sm. */}
          <span className="hidden h-1 w-1 rounded-full bg-[#b9c2cf] min-[440px]:inline-flex" />
          <span className="hidden min-[440px]:inline sm:hidden">
            {trial.compactLabel}
          </span>
          <span className="hidden sm:inline">{trial.label}</span>
        </button>

        {isTrialCardOpen ? (
          <div
            className="absolute left-0 top-[calc(100%+0.55rem)] z-70 w-48 rounded-xl border border-[#D8DDE5] bg-white p-3 text-[#061126] opacity-100 shadow-[0_18px_36px_rgba(0,0,0,0.22)] transition duration-150 sm:left-1/2 sm:-translate-x-1/2"
            role="dialog"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFF4D7] text-[#D99A00]">
                <Crown className="h-4.5 w-4.5" strokeWidth={2.5} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-[#061126]">Trial Plan</p>
                <p className="mt-1 text-xs font-bold text-[#8A5700]">
                  {trial.daysRemaining === 0
                    ? "Ends today"
                    : `${trial.daysRemaining ?? TRIAL_DAYS} ${
                        (trial.daysRemaining ?? TRIAL_DAYS) === 1
                          ? "day"
                          : "days"
                      } remaining`}
                </p>
              </div>
            </div>
            <div className="mt-3">
              <div className="h-2 overflow-hidden rounded-full bg-[#E8EDF3]">
                <div
                  className="h-full rounded-full bg-[#F1B84B]"
                  style={{
                    width: `${trial.percentUsed}%`
                  }}
                />
              </div>
              <p className="mt-1.5 text-center text-[11px] font-semibold text-[#66758A]">
                {trial.percentUsed}% of trial period used
              </p>
            </div>
            <button
              className="mt-3 h-8 w-full rounded-lg border border-[#D6A23A] bg-white text-xs font-black text-[#8A5700] transition hover:bg-[#FFF8E8]"
              onClick={() => {
                setIsTrialCardOpen(false);
                setIsUpgradePlanDialogOpen(true);
              }}
              type="button"
            >
              Upgrade Plan
            </button>
          </div>
        ) : null}
      </div>

      <UpgradePlanDialog
        open={isUpgradePlanDialogOpen}
        onClose={() => setIsUpgradePlanDialogOpen(false)}
      />
    </>
  );
}
