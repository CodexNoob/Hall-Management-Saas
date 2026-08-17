"use client";

import { useEffect, useId, useRef, useState } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  /** Used only when the rejection carries no message of its own. */
  fallbackErrorMessage?: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
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
 * the only explanation the user is going to get.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  pendingLabel,
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

  useEffect(() => {
    if (!open) return;

    setErrorMessage(null);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelButtonRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmittingRef.current) onClose();
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open]);

  if (!open) return null;

  async function confirm() {
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onConfirm();
    } catch (error) {
      setErrorMessage(
        error instanceof Error && error.message
          ? error.message
          : fallbackErrorMessage
      );
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
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
        role="alertdialog"
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
            <p
              className="mt-4 rounded-lg border border-[#efb6b6] bg-[#fff5f5] px-3 py-2 text-sm font-semibold text-[#b42318]"
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}
        </div>

        <footer className="flex justify-end gap-3 border-t border-[#d8dde5] bg-[#f8f9fb] px-5 py-4">
          <button
            className="h-10 rounded-lg border border-[#c7d0dc] bg-white px-4 text-sm font-bold text-[#233144] transition hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            onClick={onClose}
            ref={cancelButtonRef}
            type="button"
          >
            Cancel
          </button>
          <button
            className="h-10 rounded-lg bg-[#b42318] px-4 text-sm font-black text-white transition hover:bg-[#951b12] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            onClick={() => void confirm()}
            type="button"
          >
            {isSubmitting ? pendingLabel : confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}
