"use client";

import { MouseEvent, useEffect, useState } from "react";
import { LoginCard } from "@/components/login/login-card";

export function LoginModal() {
  const [isOpen, setIsOpen] = useState(false);

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

  if (!isOpen) {
    return null;
  }

  const close = () => setIsOpen(false);

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
      aria-labelledby="login-modal-title"
      onMouseDown={closeOnOverlayClick}
    >
      <div className="login-modal-content relative max-h-[90vh] w-[min(1100px,95vw)] overflow-y-auto overflow-x-hidden rounded-4xl shadow-[0_30px_90px_rgba(15,23,42,0.32)]" onMouseDown={(event) => event.stopPropagation()}>
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

        <LoginCard compact />
      </div>
    </div>
  );
}
