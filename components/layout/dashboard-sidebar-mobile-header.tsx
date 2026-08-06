"use client";

import Image from "next/image";

export function DashboardSidebarMobileHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex h-20 shrink-0 items-center justify-between border-b border-white/10 px-4 lg:hidden">
      <Image alt="Hall Management SaaS" className="h-14 w-auto object-contain" height={408} priority src="/images/branding/Footer-logo.png" unoptimized width={612} />
      <button aria-label="Close navigation" className="flex h-10 w-10 items-center justify-center rounded-xl text-white transition hover:bg-white/10" onClick={onClose} type="button">
        <span aria-hidden="true" className="relative h-5 w-5"><span className="absolute left-0 top-2 h-0.5 w-5 rotate-45 rounded-full bg-current" /><span className="absolute left-0 top-2 h-0.5 w-5 -rotate-45 rounded-full bg-current" /></span>
      </button>
    </div>
  );
}
