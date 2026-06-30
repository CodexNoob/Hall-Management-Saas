"use client";

import { MouseEvent, useEffect, useRef, useState } from "react";
import { ForgotPasswordCard } from "@/components/login/forgot-password-card";
import { LoginCard } from "@/components/login/login-card";
import { SignupCard } from "@/components/signup/signup-card";

type AuthView = "login" | "signup" | "forgot";
type SlideDirection = "forward" | "back";

export function LoginModal() {
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
      const trigger = target?.closest("[data-login-modal]");

      if (trigger) {
        event.preventDefault();
        setAuthView("login");
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
      className="fixed inset-0 z-9999 flex items-center justify-center overflow-hidden bg-[rgba(15,23,42,0.58)] p-4 text-[#0b1433] backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={
        authView === "login"
          ? "login-modal-title"
          : authView === "signup"
            ? "signup-modal-title"
            : "forgot-password-modal-title"
      }
      onMouseDown={closeOnOverlayClick}
    >
      <div
        className="relative max-h-[90vh] w-[min(1100px,95vw)] overflow-hidden rounded-4xl shadow-[0_30px_90px_rgba(15,23,42,0.32)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="modal-round absolute right-5 top-5 z-30 flex h-11 w-11 items-center justify-center border border-[#E5E0D6] bg-white text-[#0F172A] shadow-md shadow-[#0F172A]/10 transition hover:scale-105 hover:bg-[#F7F4ED]"
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
          className="login-modal-content max-h-[90vh] overflow-y-auto overflow-x-hidden"
        >
          <div className={contentClassName}>
            {authView === "login" ? (
              <LoginCard
                compact
                onSignupClick={() => switchAuthView("signup")}
                onForgotPasswordClick={() => switchAuthView("forgot")}
              />
            ) : authView === "signup" ? (
              <SignupCard compact onLoginClick={() => switchAuthView("login")} />
            ) : (
              <ForgotPasswordCard compact onBackToLogin={() => switchAuthView("login")} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
