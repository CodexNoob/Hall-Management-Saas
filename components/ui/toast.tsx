"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";
import { useAppLanguage } from "@/components/providers/app-language-provider";
import type { MessageKey } from "@/lib/i18n/messages";

export type ToastVariant = "error" | "success" | "info";

type ToastOptions = {
  duration?: number;
  title?: string;
  /**
   * The failed call's correlation id, from `ApiRequestError.requestId`.
   *
   * Shown verbatim under the message so a customer can read it down a phone
   * line: it is the one string that turns their report into a single query
   * against the server logs.
   */
  requestId?: string;
};

type ToastRecord = {
  id: string;
  variant: ToastVariant;
  title: string;
  message: string;
  duration: number;
  requestId: string;
};

type ToastApi = {
  error: (message: string, options?: ToastOptions) => void;
  success: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
  dismiss: (id: string) => void;
};

const MAX_VISIBLE_TOASTS = 3;
const ERROR_DURATION_MS = 6000;
const DEFAULT_DURATION_MS = 4000;

const ToastContext = createContext<ToastApi | null>(null);

export function useToast() {
  const api = useContext(ToastContext);

  if (!api) {
    throw new Error("useToast must be used inside a ToastProvider.");
  }

  return { toast: api };
}

function DismissIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ToastIcon({ variant }: { variant: ToastVariant }) {
  if (variant === "success") {
    return (
      <svg
        className="h-5 w-5 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path
          d="m8.5 12.4 2.3 2.3 4.7-4.9"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (variant === "info") {
    return (
      <svg
        className="h-5 w-5 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path
          d="M12 11v5.5"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <circle cx="12" cy="7.9" r="1.2" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg
      className="h-5 w-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 7.5V13"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.4" r="1.2" fill="currentColor" />
    </svg>
  );
}

/** Module scope, so it holds keys the provider resolves as it renders. */
const DEFAULT_TOAST_TITLES: Record<ToastVariant, MessageKey> = {
  error: "shell.somethingWentWrong",
  success: "shell.success",
  info: "shell.headsUp"
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useAppLanguage();
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pausedRef = useRef(new Set<string>());
  const counterRef = useRef(0);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const clearTimer = useCallback((id: string) => {
    const timer = timersRef.current.get(id);

    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      clearTimer(id);
      pausedRef.current.delete(id);
      setToasts((current) => current.filter((toast) => toast.id !== id));
    },
    [clearTimer]
  );

  const scheduleDismiss = useCallback(
    (id: string, duration: number) => {
      clearTimer(id);
      timersRef.current.set(
        id,
        setTimeout(() => dismiss(id), duration)
      );
    },
    [clearTimer, dismiss]
  );

  const push = useCallback(
    (variant: ToastVariant, message: string, options?: ToastOptions) => {
      const trimmed = message.trim();

      if (!trimmed) {
        return;
      }

      const duration =
        options?.duration ??
        (variant === "error" ? ERROR_DURATION_MS : DEFAULT_DURATION_MS);
      const title =
        options?.title?.trim() || t(DEFAULT_TOAST_TITLES[variant]);
      const requestId = options?.requestId?.trim() ?? "";

      let targetId = "";

      setToasts((current) => {
        const existing = current.find(
          (toast) => toast.variant === variant && toast.message === trimmed
        );

        // Repeat failures (three bad password attempts in a row) refresh the
        // visible toast instead of stacking duplicates. The id is refreshed with
        // it: each attempt is its own request, and showing the first attempt's
        // id would send support looking at the wrong line.
        if (existing) {
          targetId = existing.id;

          if (existing.requestId === requestId) return current;

          return current.map((toast) =>
            toast.id === existing.id ? { ...toast, requestId } : toast
          );
        }

        counterRef.current += 1;
        targetId = `toast-${counterRef.current}`;

        const next = [
          ...current,
          { id: targetId, variant, title, message: trimmed, duration, requestId }
        ];

        while (next.length > MAX_VISIBLE_TOASTS) {
          const dropped = next.shift();

          if (dropped) {
            clearTimer(dropped.id);
            pausedRef.current.delete(dropped.id);
          }
        }

        return next;
      });

      if (targetId) {
        pausedRef.current.delete(targetId);
        scheduleDismiss(targetId, duration);
      }
    },
    // `t` supplies the default title, so a language change has to produce a
    // fresh `push` rather than one closed over the old wording.
    [clearTimer, scheduleDismiss, t]
  );

  const api = useMemo<ToastApi>(
    () => ({
      error: (message, options) => push("error", message, options),
      success: (message, options) => push("success", message, options),
      info: (message, options) => push("info", message, options),
      dismiss
    }),
    [dismiss, push]
  );

  useEffect(() => {
    const timers = timersRef.current;

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const pause = (id: string) => {
    pausedRef.current.add(id);
    clearTimer(id);
  };

  const resume = (toast: ToastRecord) => {
    if (!pausedRef.current.has(toast.id)) {
      return;
    }

    pausedRef.current.delete(toast.id);
    scheduleDismiss(toast.id, toast.duration);
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {isMounted
        ? createPortal(
            <div
              // Anchored bottom-right so a toast never sits on top of the auth
              // modal's close button, which lives in the top-right corner.
              className="pointer-events-none fixed bottom-3 right-3 z-10001 flex w-[calc(100vw-1.5rem)] max-w-sm flex-col gap-3 sm:bottom-6 sm:right-6"
              role="region"
              aria-label={t("shell.notifications")}
            >
              {toasts.map((toast) => (
                <div
                  key={toast.id}
                  className={`event-toast event-toast-${toast.variant} pointer-events-auto flex items-start gap-3`}
                  role={toast.variant === "error" ? "alert" : "status"}
                  aria-live={toast.variant === "error" ? "assertive" : "polite"}
                  onMouseEnter={() => pause(toast.id)}
                  onMouseLeave={() => resume(toast)}
                  onFocus={() => pause(toast.id)}
                  onBlur={() => resume(toast)}
                >
                  <span className="event-toast-icon">
                    <ToastIcon variant={toast.variant} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="event-toast-title">{toast.title}</p>
                    <p className="event-toast-message">{toast.message}</p>
                    {toast.requestId ? (
                      // Selectable, wrapping and monospaced, because its only
                      // job is to be copied or read out accurately.
                      <p className="event-toast-request-id mt-1 font-mono text-[11px] break-all opacity-70">
                        Reference: {toast.requestId}
                      </p>
                    ) : null}
                  </div>
                  <button
                    className="event-toast-dismiss"
                    type="button"
                    aria-label={t("shell.dismissNotification")}
                    onClick={() => dismiss(toast.id)}
                  >
                    <DismissIcon />
                  </button>
                </div>
              ))}
            </div>,
            document.body
          )
        : null}
    </ToastContext.Provider>
  );
}
