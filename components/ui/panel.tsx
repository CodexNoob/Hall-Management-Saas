"use client";

import { type ReactNode } from "react";

/**
 * The card every dashboard page is built out of.
 *
 * It started in the Dining Manager and was copied by hand everywhere else,
 * which is how the Kitchen board ended up with square corners and its own
 * border colour while the rest of the product had neither.
 */
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
