"use client";

import { MouseEvent, useEffect, useRef, useState } from "react";
import { ForgotPasswordCard } from "@/components/login/forgot-password-card";
import { LoginCard } from "@/components/login/login-card";
import { SignupCard } from "@/components/signup/signup-card";

type AuthView = "login" | "signup" | "forgot";
type FlipDirection = "forward" | "back";

export function LoginModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [authView, setAuthView] = useState<AuthView>("login");
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState<FlipDirection>("forward");
  const modalContentRef = useRef<HTMLDivElement | null>(null);
  const contentSwapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flipEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetModalScroll = () => {
    const modalContent = modalContentRef.current;

    if (modalContent) {
      modalContent.scrollTop = 0;
    }

    const formScrollArea = modalContent?.querySelector<HTMLElement>(".auth-inner-scroll");

    if (formScrollArea) {
      formScrollArea.scrollTop = 0;
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    const handleClick = (event: globalThis.MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const trigger = target?.closest("[data-login-modal]");

      if (trigger) {
        event.preventDefault();
        setAuthView("login");
        setIsFlipping(false);
        setIsOpen(true);
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
      if (contentSwapTimerRef.current) {
        clearTimeout(contentSwapTimerRef.current);
      }

      if (flipEndTimerRef.current) {
        clearTimeout(flipEndTimerRef.current);
      }
    };
  }, []);

  if (!isOpen) {
    return null;
  }

  const close = () => {
    setIsOpen(false);
    setAuthView("login");
    setIsFlipping(false);

    if (contentSwapTimerRef.current) {
      clearTimeout(contentSwapTimerRef.current);
      contentSwapTimerRef.current = null;
    }

    if (flipEndTimerRef.current) {
      clearTimeout(flipEndTimerRef.current);
      flipEndTimerRef.current = null;
    }
  };

  const switchAuthView = (nextView: AuthView) => {
    if (isFlipping || nextView === authView) {
      return;
    }

    resetModalScroll();
    setFlipDirection(nextView === "login" ? "back" : "forward");
    setIsFlipping(true);

    contentSwapTimerRef.current = setTimeout(() => {
      setAuthView(nextView);
      requestAnimationFrame(() => {
        resetModalScroll();
      });
    }, 260);

    flipEndTimerRef.current = setTimeout(() => {
      setIsFlipping(false);
      contentSwapTimerRef.current = null;
      flipEndTimerRef.current = null;
    }, 620);
  };

  const closeOnOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      close();
    }
  };

  return (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center overflow-hidden bg-[rgba(15,23,42,0.58)] p-4 text-[#0b1433] backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={
        authView === "login" ? "login-modal-title" : authView === "signup" ? "signup-modal-title" : "forgot-password-modal-title"
      }
      onMouseDown={closeOnOverlayClick}
    >
      <div
        ref={modalContentRef}
        className="login-modal-content auth-flip-stage relative max-h-[90vh] w-[min(1100px,95vw)] overflow-y-auto overflow-x-hidden rounded-4xl shadow-[0_30px_90px_rgba(15,23,42,0.32)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="modal-round absolute right-5 top-5 z-30 flex h-11 w-11 items-center justify-center border border-[#dbe1ee] bg-white text-[#10172f] shadow-md shadow-[#10172f]/10 transition hover:scale-105 hover:bg-[#f8fafc]"
          type="button"
          aria-label="Close login modal"
          onClick={close}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>

        <div
          className={`auth-flip-page ${
            isFlipping ? (flipDirection === "forward" ? "is-flipping-forward" : "is-flipping-back") : ""
          }`}
        >
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
  );
}
