"use client";

import Image from "next/image";

/**
 * The drawer's own header: the logo and the control that closes it.
 *
 * On a phone the drawer is opened from the shell's burger in the top-left
 * corner, and the close button sits opposite the logo at the right.
 *
 * `overlay` is the kitchen board's docked sidebar. The board moves to the
 * sidebar's right, so its header button remains visible and toggles the drawer.
 * That version therefore only needs the logo here, with no duplicate X.
 */
export function DashboardSidebarMobileHeader({
  overlay = false,
  onClose
}: {
  overlay?: boolean;
  onClose: () => void;
}) {
  const closeButton = (
    <button
      aria-label="Close navigation"
      className={`flex items-center justify-center rounded-xl text-white transition hover:bg-white/10 ${
        overlay ? "h-10 w-10 shrink-0 sm:h-11 sm:w-11" : "h-10 w-10"
      }`}
      onClick={onClose}
      type="button"
    >
      <span aria-hidden="true" className="relative h-5 w-5">
        <span className="absolute left-0 top-2 h-0.5 w-5 rotate-45 rounded-full bg-current" />
        <span className="absolute left-0 top-2 h-0.5 w-5 -rotate-45 rounded-full bg-current" />
      </span>
    </button>
  );

  const logo = (
    <Image
      alt="Hall Management SaaS"
      className={`h-14 w-auto object-contain ${overlay ? "min-w-0" : ""}`}
      height={408}
      priority
      src="/images/branding/Footer-logo.png"
      unoptimized
      width={612}
    />
  );

  if (overlay) {
    return (
      <div className="flex h-20 shrink-0 items-center border-b border-white/10 px-6">
        {/* Match the standard expanded brand's geometry without reusing its
            stateful classes: the global collapsed-rail selectors intentionally
            hide that full logo, but Kitchen is always a full-width drawer. */}
        <div className="relative -ml-3 h-20 w-52 shrink-0">
          <span
            aria-label="Hall Management SaaS"
            className="absolute left-1/2 top-1/2 h-15 w-47 -translate-x-1/2 -translate-y-1/2 bg-[url('/images/branding/Footer-logo.png?v=20260722')] bg-contain bg-center bg-no-repeat"
            role="img"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-20 shrink-0 items-center justify-between border-b border-white/10 px-4 lg:hidden">
      {logo}
      {closeButton}
    </div>
  );
}
