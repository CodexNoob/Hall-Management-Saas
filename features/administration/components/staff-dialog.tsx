"use client";

import { type FormEvent } from "react";
import {
  LineIcon,
  roleTemplates,
  secondaryButtonClass,
  type RoleName,
  type StaffMember
} from "@/features/administration/components/staff-shared";
import {
  accessPermissionKeys,
  accessForRole,
  activePermissionLabelsForRole,
  formatStaffRoleName,
  staffRoleValueByName,
  type RoleAccessMatrix
} from "@/lib/auth/permissions";

export type StaffDialogMode = "add" | "edit" | "role" | null;

export type StaffFormState = {
  name: string;
  email: string;
  phone: string;
  department: string;
  role: RoleName;
};

export function initialsForName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function formatStaffRole(role: string): RoleName {
  return formatStaffRoleName(role);
}

export function emptyForm(): StaffFormState {
  return {
    name: "",
    email: "",
    phone: "",
    department: "General",
    role: "Viewer"
  };
}

export function staffToForm(staff: StaffMember): StaffFormState {
  return {
    name: staff.name,
    email: staff.email,
    phone: staff.phone === "Not provided" ? "" : staff.phone,
    department: staff.department,
    role: staff.role
  };
}

export function accessFromStaff(staff: StaffMember): RoleAccessMatrix {
  const fallback = accessForRole(staffRoleValueByName[staff.role]);
  const savedAccess = staff.access ?? {};

  return accessPermissionKeys.reduce(
    (access, key) => ({
      ...access,
      [key]:
        typeof savedAccess[key] === "boolean"
          ? savedAccess[key] === true
          : fallback[key]
    }),
    {} as RoleAccessMatrix
  );
}

export async function readMutationResponse(response: Response) {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Unable to update staff.");
  }
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#687588]">
      {label}
      {children}
    </label>
  );
}

export function StaffDialog({
  canEdit,
  form,
  mode,
  mutationError,
  isSaving,
  selectedStaff,
  setForm,
  inviteInput,
  inviteEmails,
  onInviteInputChange,
  onAddInviteEmail,
  onRemoveInviteEmail,
  onClose,
  onSubmit
}: {
  canEdit: boolean;
  form: StaffFormState;
  mode: StaffDialogMode;
  mutationError: string;
  isSaving: boolean;
  selectedStaff: StaffMember | null;
  setForm: (form: StaffFormState) => void;
  inviteInput: string;
  inviteEmails: string[];
  onInviteInputChange: (value: string) => void;
  onAddInviteEmail: () => void;
  onRemoveInviteEmail: (email: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!mode) return null;

  const title =
    mode === "add"
      ? "Invite staff"
      : mode === "role"
        ? "Assign role"
        : "Edit staff";
  const subtitle =
    mode === "add"
      ? "Add one or more staff emails. Each address will be invited to this organization."
      : selectedStaff
        ? `Update ${selectedStaff.name}'s access inside this organization.`
        : "Update staff access.";

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-[#061126]/55 p-3 backdrop-blur-sm">
      <form
        aria-modal="true"
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-[#d8dde5] bg-white shadow-2xl"
        onSubmit={onSubmit}
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#d8dde5] px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#1f4d73]">
              Staff access
            </p>
            <h2 className="mt-1 text-xl font-black text-[#17202a]">{title}</h2>
            <p className="mt-1 max-w-lg text-sm text-[#64748b]">{subtitle}</p>
          </div>
          <button
            aria-label="Close staff dialog"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#233144] transition hover:bg-[#eef4fa]"
            onClick={onClose}
            type="button"
          >
            <svg
              aria-hidden="true"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                d="M5 5 19 19M19 5 5 19"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2.25"
              />
            </svg>
          </button>
        </header>

        <div
          className={`grid gap-4 p-5 ${mode === "add" ? "" : "sm:grid-cols-2"}`}
        >
          {mode === "add" ? (
            <Field label="Staff Gmail / email">
              <div className="flex items-center gap-2 rounded-lg border border-[#c7d0dc] px-2 py-1.5 focus-within:border-[#1f4d73]">
                <input
                  className="h-9 flex-1 border-0 bg-transparent px-1 text-sm font-semibold normal-case tracking-normal text-[#17202a] outline-none"
                  onChange={(event) => onInviteInputChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      onAddInviteEmail();
                    }
                  }}
                  placeholder="staff@gmail.com"
                  type="email"
                  value={inviteInput}
                />
                <button
                  className="inline-flex h-8 items-center justify-center rounded-md bg-[#1f4d73] px-3 text-xs font-black text-white shadow-sm transition hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!inviteInput.trim()}
                  onClick={onAddInviteEmail}
                  type="button"
                >
                  Add
                </button>
              </div>
              {inviteEmails.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {inviteEmails.map((email) => (
                    <button
                      className="inline-flex items-center gap-1 rounded-full border border-[#d8dde5] bg-[#f7f9fb] px-2.5 py-1 text-[11px] font-black text-[#17202a]"
                      key={email}
                      onClick={() => onRemoveInviteEmail(email)}
                      type="button"
                    >
                      {email}
                      <span className="text-[#64748b]">&times;</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </Field>
          ) : mode !== "role" ? (
            <>
              <Field label="Full name">
                <input
                  className="h-11 rounded-lg border border-[#c7d0dc] px-3 text-sm font-semibold normal-case tracking-normal text-[#17202a] outline-none focus:border-[#1f4d73]"
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  placeholder="Example: Sarah Cohen"
                  required
                  value={form.name}
                />
              </Field>
              <Field label="Gmail / email invite">
                <input
                  className="h-11 rounded-lg border border-[#c7d0dc] px-3 text-sm font-semibold normal-case tracking-normal text-[#17202a] outline-none focus:border-[#1f4d73]"
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                  placeholder="staff@gmail.com"
                  required
                  type="email"
                  value={form.email}
                />
              </Field>
              <Field label="Phone">
                <input
                  className="h-11 rounded-lg border border-[#c7d0dc] px-3 text-sm font-semibold normal-case tracking-normal text-[#17202a] outline-none focus:border-[#1f4d73]"
                  onChange={(event) =>
                    setForm({ ...form, phone: event.target.value })
                  }
                  placeholder="Optional"
                  value={form.phone}
                />
              </Field>
              <Field label="Department">
                <input
                  className="h-11 rounded-lg border border-[#c7d0dc] px-3 text-sm font-semibold normal-case tracking-normal text-[#17202a] outline-none focus:border-[#1f4d73]"
                  onChange={(event) =>
                    setForm({ ...form, department: event.target.value })
                  }
                  placeholder="Kitchen, Billing, Events..."
                  value={form.department}
                />
              </Field>
            </>
          ) : null}
          {mode !== "add" ? (
            <>
              <Field label="Role">
                <select
                  className="h-11 rounded-lg border border-[#c7d0dc] bg-white px-3 text-sm font-semibold normal-case tracking-normal text-[#17202a] outline-none focus:border-[#1f4d73]"
                  onChange={(event) =>
                    setForm({ ...form, role: event.target.value as RoleName })
                  }
                  value={form.role}
                >
                  {roleTemplates.map((template) => (
                    <option key={template.role} value={template.role}>
                      {template.role}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="rounded-xl border border-[#d8dde5] bg-[#fbfcfd] p-3 text-xs text-[#425166] sm:col-span-2">
                <strong className="text-[#17202a]">Role preview:</strong>{" "}
                {activePermissionLabelsForRole(
                  staffRoleValueByName[form.role]
                ).join(", ")}
              </div>
            </>
          ) : null}
          {mutationError ? (
            <p className="rounded-lg border border-[#f2b7ba] bg-[#fff2f2] px-3 py-2 text-xs font-bold text-[#c2262f] sm:col-span-2">
              {mutationError}
            </p>
          ) : null}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-[#d8dde5] px-5 py-4 sm:flex-row sm:justify-end">
          <button
            className={secondaryButtonClass}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#1f4d73] px-4 text-sm font-black text-white shadow-sm hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canEdit || isSaving}
            type="submit"
          >
            <LineIcon name={mode === "add" ? "mail" : "check"} />
            {isSaving
              ? "Saving..."
              : mode === "add"
                ? "Invite staff"
                : "Save changes"}
          </button>
        </footer>
      </form>
    </div>
  );
}
