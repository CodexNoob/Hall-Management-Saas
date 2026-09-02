"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { readApiErrorDetails } from "@/lib/http/api-request-error";
import { useScrollLock } from "@/lib/ui/use-scroll-lock";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel?: string;
  mode?: "confirm" | "notice";
  /** Used only when the rejection carries no message of its own. */
  fallbackErrorMessage?: string;
  onClose: () => void;
  onConfirm?: () => Promise<void>;
};

/**
 * A confirmation step for an action that cannot be undone.
 *
 * Generalised from `components/forms/logout-confirmation-dialog.tsx`, which is
 * the same dialog with the copy baked in. `window.confirm` would have done the
 * job, but it cannot show why the action failed, cannot be styled, and blocks
 * the whole tab - so a destructive action inside a grid gets this instead.
 *
 * It stays open on failure and shows the server's message: closing would hide
 * the only explanation the user is going to get. When the rejection names what
 * caused it - the events and packages still holding a menu item - those are
 * listed under the message, because "it is used somewhere" is not something the
 * user can go and fix.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  pendingLabel,
  mode = "confirm",
  fallbackErrorMessage = "The action could not be completed. Please try again.",
  onClose,
  onConfirm
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  // Mirrored in a ref because the Escape listener is registered once per open
  // and would otherwise close over the first render's `false`.
  const isSubmittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string[]>([]);

  // Shared with whatever this is stacked on top of, so closing an editor and
  // the confirmation over it in the same commit cannot leave the page locked.
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;

    setErrorMessage(null);
    setErrorDetails([]);
    cancelButtonRef.current?.focus();

    // Escape is not swallowed here. A dialog underneath listens on the same
    // window, and two listeners on one target cannot stop each other - so a
    // caller that stacks this on top of its own dialog has to suppress that
    // one's Escape itself while this is up.
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmittingRef.current) onClose();
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open]);

  if (!open || typeof document === "undefined") return null;

  async function confirm() {
    if (!onConfirm) return;

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);
    setErrorDetails([]);

    try {
      await onConfirm();
    } catch (error) {
      setErrorMessage(
        error instanceof Error && error.message
          ? error.message
          : fallbackErrorMessage
      );
      setErrorDetails(readApiErrorDetails(error));
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-110 flex items-center justify-center bg-[#17202a]/45 p-4 backdrop-blur-[1px]"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !isSubmitting) onClose();
      }}
    >
      <section
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-[#d8dde5] bg-white shadow-2xl"
        role={mode === "notice" ? "dialog" : "alertdialog"}
      >
        <div className="p-5 sm:p-6">
          <h2 className="text-xl font-black text-[#17202a]" id={titleId}>
            {title}
          </h2>
          <p
            className="mt-2 text-sm leading-6 text-[#6a7483]"
            id={descriptionId}
          >
            {description}
          </p>

          {errorMessage ? (
            <div
              className="mt-4 rounded-lg border border-[#efb6b6] bg-[#fff5f5] px-3 py-2"
              role="alert"
            >
              <p className="text-sm font-semibold text-[#b42318]">
                {errorMessage}
              </p>
              {errorDetails.length > 0 ? (
                // Scrolls rather than grows: the server caps the list, but the
                // dialog is short and a capped list is still several lines.
                <ul className="mt-2 max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-sm text-[#b42318]">
                  {errorDetails.map((detail, index) => (
                    <li key={`${index}-${detail}`}>{detail}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>

        <footer className="flex justify-end gap-3 border-t border-[#d8dde5] bg-[#f8f9fb] px-5 py-4">
          {mode === "confirm" ? (
            <button
              className="h-10 rounded-lg border border-[#c7d0dc] bg-white px-4 text-sm font-bold text-[#233144] transition hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
              onClick={onClose}
              ref={cancelButtonRef}
              type="button"
            >
              Cancel
            </button>
          ) : null}
          <button
            className={`h-10 rounded-lg px-4 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${mode === "notice" ? "bg-[#1f4d73] hover:bg-[#173a57]" : "bg-[#b42318] hover:bg-[#951b12]"}`}
            disabled={isSubmitting}
            onClick={mode === "notice" ? onClose : () => void confirm()}
            ref={mode === "notice" ? cancelButtonRef : undefined}
            type="button"
          >
            {isSubmitting ? pendingLabel : confirmLabel}
          </button>
        </footer>
      </section>
    </div>,
    document.body
  );
}
