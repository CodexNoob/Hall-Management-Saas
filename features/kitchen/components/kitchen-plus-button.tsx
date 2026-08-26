"use client";

import { LineIcon } from "@/features/events/components/event-manager-shared";

/**
 * Add an event straight onto one day, from that day's own header.
 *
 * SIZED AGAINST THE CELL, NOT THE GUIDELINE. 44px is the comfortable thumb
 * target, and it does not fit: this button shares a four-week day header with a
 * day name and a date inside about 125px, so a target that size would push one
 * of them out. 24px square with the tap area extended by padding is the most
 * that fits while the date still reads - and it had drifted down to 20px, which
 * is small enough that the neighbouring date was being tapped instead.
 *
 * The honest fix for the target size is a bigger cell or a different control,
 * not a smaller date.
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
      className="relative flex h-6 w-6 shrink-0 items-center justify-center border border-[#c9d2de] bg-[#f8fafc] text-[#1f4d73] transition after:absolute after:-inset-1.5 after:content-[''] enabled:hover:border-[#1f4d73] enabled:hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-40"
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      <LineIcon className="h-3 w-3" name="plus" />
    </button>
  );
}
