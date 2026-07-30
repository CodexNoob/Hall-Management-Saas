"use client";

import { type ReactNode } from "react";

export function InspectorField({
  children,
  htmlFor
}: {
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <label
      className="mb-1 block text-[10px] font-black uppercase tracking-[0.04em] text-[#59677c]"
      htmlFor={htmlFor}
    >
      {children}
    </label>
  );
}
