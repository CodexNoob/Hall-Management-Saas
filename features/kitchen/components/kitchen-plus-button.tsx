"use client";

import { LineIcon } from "@/features/events/components/event-manager-shared";

/**
 * Add an event straight onto one day, from that day's own header.
 *
 * At 24px square with a typed "+" glyph this was under half the smallest
 * comfortable touch target, on the screen most likely to be used with a thumb.
 */
export function PlusButton({
  disabled,
  label,
  onClick
}: {
  disabled?: boolean;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="flex h-5 w-5 shrink-0 items-center justify-center border border-[#c9d2de] bg-[#f8fafc] text-[#1f4d73] transition enabled:hover:border-[#1f4d73] enabled:hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-40"
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      <LineIcon className="h-3 w-3" name="plus" />
    </button>
  );
}
