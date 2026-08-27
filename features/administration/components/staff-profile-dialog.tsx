"use client";

import { useEffect } from "react";
import {
  LineIcon,
  StatusBadge,
  type StaffMember
} from "@/features/administration/components/staff-shared";
import { RoleBadge } from "@/features/access/components/role-editor";
import { describeScope } from "@/features/access/components/access-shared";

export function StaffProfileDialog({
  onClose,
  staff
}: {
  onClose: () => void;
  staff: StaffMember;
}) {
  const open = true;
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open]);

  if (!open) return null;

  const details = [
    ["Email", staff.email],
    ["Phone", staff.phone],
    ["Department", staff.department],
    ["Job title", staff.title ?? ""],
    ["Last login", staff.lastLogin]
  ];

  return (
    <div
      className="fixed inset-0 z-100 flex items-end justify-center bg-[#17202a]/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        aria-labelledby="staff-profile-title"
        aria-modal="true"
        className="max-h-[calc(100dvh-16px)] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-[#d8dde5] bg-white shadow-2xl sm:rounded-2xl"
        role="dialog"
      >
        <header className="flex items-center justify-between gap-3 border-b border-[#d8dde5] px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-black text-white ${staff.color}`}
            >
              {staff.initials}
            </span>
            <div className="min-w-0">
              <h2
                className="truncate text-base font-black text-[#17202a]"
                id="staff-profile-title"
              >
                {staff.name}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {staff.assignments.map((assignment) => (
                  <RoleBadge key={assignment.id} name={assignment.roleName} />
                ))}
                <StatusBadge status={staff.status} />
              </div>
            </div>
          </div>
          <button
            aria-label="Close staff profile"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-[#eef4fa]"
            onClick={onClose}
            type="button"
          >
            <LineIcon name="plus" className="h-5 w-5 rotate-45" />
          </button>
        </header>

        <div className="space-y-4 p-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            {details.map(([label, value]) => (
              <div
                className="rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-3"
                key={label}
              >
                <dt className="text-[10px] font-black uppercase tracking-[0.08em] text-[#6a7483]">
                  {label}
                </dt>
                <dd className="mt-1 wrap-break-word text-sm font-bold text-[#17202a]">
                  {value || "Not provided"}
                </dd>
              </div>
            ))}
          </dl>

          <section className="rounded-lg border border-[#d8dde5] p-3">
            <h3 className="text-xs font-black uppercase tracking-[0.08em] text-[#6a7483]">
              Access
            </h3>
            {/* What they HOLD, not what that resolves to. The full key-by-key
                answer is one screen away in Access, and duplicating a summary of
                it here is how the two come to disagree. */}
            <div className="mt-3 space-y-1.5">
              {staff.assignments.length ? (
                staff.assignments.map((assignment) => (
                  <div
                    className="flex flex-wrap items-center gap-2"
                    key={assignment.id}
                  >
                    <RoleBadge name={assignment.roleName} />
                    <span className="text-xs text-[#536172]">
                      {describeScope(assignment)}
                    </span>
                  </div>
                ))
              ) : (
                <span className="text-sm text-[#6a7483]">
                  No role yet, so nothing is permitted.
                </span>
              )}
            </div>
            <a
              className="mt-3 inline-block text-xs font-black text-[#1769aa]"
              href="/dashboard/staff?tab=roles"
            >
              See exactly what this resolves to
            </a>
          </section>
        </div>
      </section>
    </div>
  );
}
