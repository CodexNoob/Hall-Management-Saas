"use client";

import { type ReactNode } from "react";

export function Panel({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 overflow-hidden rounded-xl border border-[#d8dde5] bg-white ${className}`}
    >
      {children}
    </section>
  );
}

export function FieldLabel({
  children,
  htmlFor
}: {
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <label
      className="mb-1 block text-[10px] font-black uppercase tracking-wider text-[#59677c]"
      htmlFor={htmlFor}
    >
      {children}
    </label>
  );
}
