"use client";

import { MouseEvent, useEffect, useRef, useState } from "react";
import { ForgotPasswordCard } from "@/components/login/forgot-password-card";
import { LoginCard } from "@/components/login/login-card";
import { FreeTrialCard } from "@/components/free-trial/free-trial-card";

type AuthView = "login" | "trial" | "forgot";
type SlideDirection = "forward" | "back";

export function AuthModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [authView, setAuthView] = useState<AuthView>("login");
  const [isSwitching, setIsSwitching] = useState(false);
  const [slideDirection, setSlideDirection] = useState<SlideDirection>("forward");

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const swapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetModalScroll = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };

    const handleClick = (event: globalThis.MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const loginTrigger = target?.closest("[data-login-modal]");
      const freeTrialTrigger = target?.closest("[data-free-trial-modal]");

      if (loginTrigger || freeTrialTrigger) {
        event.preventDefault();
        setAuthView(freeTrialTrigger ? "trial" : "login");
        setIsSwitching(false);
        setIsOpen(true);

        requestAnimationFrame(() => {
          resetModalScroll();
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("click", handleClick);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (swapTimerRef.current) {
        clearTimeout(swapTimerRef.current);
      }

      if (finishTimerRef.current) {
        clearTimeout(finishTimerRef.current);
      }
    };
  }, []);

  if (!isOpen) {
    return null;
  }

  const close = () => {
    setIsOpen(false);
    setAuthView("login");
    setIsSwitching(false);

    if (swapTimerRef.current) {
      clearTimeout(swapTimerRef.current);
      swapTimerRef.current = null;
    }

    if (finishTimerRef.current) {
      clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
  };

  const switchAuthView = (nextView: AuthView) => {
    if (isSwitching || nextView === authView) {
      return;
    }

    resetModalScroll();

    const nextDirection: SlideDirection = nextView === "login" ? "back" : "forward";
    setSlideDirection(nextDirection);
    setIsSwitching(true);

    swapTimerRef.current = setTimeout(() => {
      setAuthView(nextView);

      requestAnimationFrame(() => {
        resetModalScroll();
      });
    }, 50);

    finishTimerRef.current = setTimeout(() => {
      setIsSwitching(false);
      swapTimerRef.current = null;
      finishTimerRef.current = null;

      requestAnimationFrame(() => {
        resetModalScroll();
      });
    }, 170);
  };

  const closeOnOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      close();
    }
  };

  const contentClassName = [
    "auth-slide-page",
    isSwitching ? "is-switching" : "",
    isSwitching && slideDirection === "forward" ? "is-switching-forward" : "",
    isSwitching && slideDirection === "back" ? "is-switching-back" : "",
    !isSwitching && slideDirection === "forward" ? "is-entered-forward" : "",
    !isSwitching && slideDirection === "back" ? "is-entered-back" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center overflow-hidden bg-[rgba(15,23,42,0.58)] p-2 text-[#0b1433] backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={
        authView === "login"
          ? "login-modal-title"
          : authView === "trial"
            ? "free-trial-modal-title"
            : "forgot-password-modal-title"
      }
      onMouseDown={closeOnOverlayClick}
    >
      <div
        className="relative mx-auto max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-275 overflow-hidden rounded-2xl shadow-[0_30px_90px_rgba(15,23,42,0.32)] sm:max-h-[90vh] sm:w-[calc(100vw-3rem)] sm:rounded-4xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="modal-round absolute right-3 top-3 z-30 flex h-10 w-10 items-center justify-center border border-[#E5E0D6] bg-white text-[#0F172A] shadow-md shadow-[#0F172A]/10 transition hover:scale-105 hover:bg-[#F7F4ED] sm:right-5 sm:top-5 sm:h-11 sm:w-11"
          type="button"
          aria-label="Close login modal"
          onClick={close}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>

        <div
          ref={scrollContainerRef}
          className="login-modal-content max-h-[calc(100dvh-1rem)] overflow-y-auto overflow-x-hidden sm:max-h-[90vh]"
        >
          <div className={`${contentClassName} w-full min-w-0`}>
            {authView === "login" ? (
              <LoginCard
                compact
                onStartTrialClick={() => switchAuthView("trial")}
                onForgotPasswordClick={() => switchAuthView("forgot")}
              />
            ) : authView === "trial" ? (
              <FreeTrialCard compact onLoginClick={() => switchAuthView("login")} />
            ) : (
              <ForgotPasswordCard compact onBackToLogin={() => switchAuthView("login")} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
