"use client";

import { useEffect, useRef, useState } from "react";
import { Crown } from "lucide-react";
import {
  createContext,
  useContext,
  type ReactNode
} from "react";
import type { SyncSignedInUserResponse } from "@/lib/auth/client";
import {
  getTrialDaysRemaining,
  isTesterBypassEmail,
  TRIAL_DAYS
} from "@/lib/subscription/trial";
import { UpgradePlanDialog } from "@/components/forms/upgrade-plan-dialog";

type DashboardTrialProviderProps = {
  syncData: SyncSignedInUserResponse;
  children: ReactNode;
};

type TrialBadgeState = {
  daysRemaining: number | null;
  percentUsed: number;
  visible: boolean;
  label: string;
};

const DashboardTrialContext = createContext<TrialBadgeState>({
  daysRemaining: null,
  percentUsed: 0,
  visible: false,
  label: ""
});

function getTrialBadgeState(syncData: SyncSignedInUserResponse): TrialBadgeState {
  const activeOrganization =
    syncData.organizations.find(
      (organization) => organization.id === syncData.activeOrganizationId
    ) ?? null;
  const isTrial =
    activeOrganization?.subscriptionStatus === "trialing" &&
    !isTesterBypassEmail(syncData.user.email);

  if (!isTrial) {
    return {
      daysRemaining: null,
      percentUsed: 0,
      visible: false,
      label: ""
    };
  }

  const daysRemaining = getTrialDaysRemaining(activeOrganization.trialEndsAt);
  const label =
    daysRemaining === null
      ? "Free trial"
      : daysRemaining === 0
        ? "Ends today"
        : `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left`;

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
    label
  };
}

export function DashboardTrialProvider({
  children,
  syncData
}: DashboardTrialProviderProps) {
  return (
    <DashboardTrialContext.Provider value={getTrialBadgeState(syncData)}>
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
      <div className="relative inline-flex w-fit lg:mt-1" ref={trialCardRef}>
        <button
          aria-expanded={isTrialCardOpen}
          aria-haspopup="dialog"
          className="inline-flex items-center gap-1 rounded-xl border border-[#F1C86A] bg-[#FFF8E8] px-2 py-1 text-[11px] font-black text-[#8A5700] shadow-[0_8px_24px_rgba(185,151,77,0.12)] transition hover:bg-[#FFF4D7] focus:outline-none focus:ring-2 focus:ring-[#F1C86A]/70 sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs"
          onClick={() => setIsTrialCardOpen((current) => !current)}
          type="button"
        >
          <Crown className="h-3.5 w-3.5 text-[#D99A00]" strokeWidth={2.5} />
          <span>Trial</span>
          <span className="h-1 w-1 rounded-full bg-[#D99A00]" />
          <span>{trial.label}</span>
        </button>

        {isTrialCardOpen ? (
          <div
            className="absolute left-1/2 top-[calc(100%+0.55rem)] z-70 w-48 -translate-x-1/2 rounded-xl border border-[#D8DDE5] bg-white p-3 text-[#061126] opacity-100 shadow-[0_18px_36px_rgba(0,0,0,0.22)] transition duration-150"
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
