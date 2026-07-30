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
      className={`overflow-hidden rounded-xl border border-[#d8dde5] bg-white ${className}`}
    >
      {children}
    </section>
  );
}
