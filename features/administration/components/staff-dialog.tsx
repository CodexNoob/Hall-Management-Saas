"use client";

import { useEffect, useState, type FormEvent } from "react";
import { normalizeInviteEmails } from "@/features/administration/components/staff-invite-utils";
import type { StaffMember } from "@/features/administration/components/staff-shared";

/**
 * Invite somebody, or edit their profile. TWO DIALOGS, NEITHER OF WHICH TOUCHES
 * A PERMISSION.
 *
 * The role picker and the permission matrix that used to live here are gone -
 * not moved into a tab, gone. They are `/dashboard/access`, behind their own
 * keys, because the account that fixes a typo in a phone number should not be
 * the account that can mint an owner.
 */

export type StaffDialogMode = "add" | "edit" | null;

export type StaffFormState = {
  name: string;
  email: string;
  phone: string;
  department: string;
  title: string;
};

export function initialsForName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function emptyForm(): StaffFormState {
  return { name: "", email: "", phone: "", department: "", title: "" };
}

export function staffToForm(staff: StaffMember): StaffFormState {
  return {
    name: staff.name,
    email: staff.email,
    phone: staff.phone === "Not provided" ? "" : staff.phone,
    department: staff.department,
    title: staff.title ?? ""
  };
}

export type StaffInvitation = {
  email: string;
  status: "sent" | "failed";
  actionLink?: string | null;
  error?: string | null;
};

export async function readMutationResponse(response: Response) {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
    code?: string;
    invites?: StaffInvitation[];
    assignmentErrors?: string[];
  } | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "The change could not be saved.");
  }

  return payload;
}

type StaffDialogProps = {
  mode: StaffDialogMode;
  form: StaffFormState;
  inviteInput: string;
  inviteEmails: string[];
  error: string;
  isSaving: boolean;
  canInvite: boolean;
  onChangeForm: (form: StaffFormState) => void;
  onChangeInviteInput: (value: string) => void;
  onChangeInviteEmails: (emails: string[]) => void;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
};

export function StaffDialog({
  mode,
  form,
  inviteInput,
  inviteEmails,
  error,
  isSaving,
  canInvite,
  onChangeForm,
  onChangeInviteInput,
  onChangeInviteEmails,
  onSubmit,
  onClose
}: StaffDialogProps) {
  const [localInvite, setLocalInvite] = useState(inviteInput);

  useEffect(() => {
    setLocalInvite(inviteInput);
  }, [inviteInput]);

  if (!mode) return null;

  const commitInvites = (value: string) => {
    const emails = normalizeInviteEmails(value);
    onChangeInviteInput(value);
    onChangeInviteEmails(emails);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
      <form
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onSubmit={onSubmit}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[#d8dde5] px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-black">
              {mode === "add" ? "Invite staff" : `Edit ${form.name}`}
            </h2>
            <p className="mt-0.5 text-[10px] text-[#6a7483]">
              {mode === "add"
                ? "They arrive with no permissions. Give them a role from Access when they are ready."
                : "Profile only. What this person can do lives in Access."}
            </p>
          </div>
          <button
            className="rounded-lg border border-[#c7d0dc] px-3 py-1.5 text-xs font-black"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {mode === "add" ? (
            <>
              <label className="block text-[10px] font-black uppercase tracking-wide text-[#6a7483]">
                Email addresses
                <textarea
                  className="mt-1 min-h-20 w-full rounded-lg border border-[#c7d0dc] px-3 py-2 text-xs"
                  onBlur={(event) => commitInvites(event.target.value)}
                  onChange={(event) => setLocalInvite(event.target.value)}
                  placeholder="one@example.com, two@example.com"
                  value={localInvite}
                />
              </label>
              {inviteEmails.length > 0 ? (
                <p className="text-[10px] text-[#6a7483]">
                  {inviteEmails.length} invitation
                  {inviteEmails.length === 1 ? "" : "s"} will be sent.
                </p>
              ) : null}
              <label className="block text-[10px] font-black uppercase tracking-wide text-[#6a7483]">
                Department
                <input
                  className="mt-1 h-9 w-full rounded-lg border border-[#c7d0dc] px-3 text-xs"
                  onChange={(event) =>
                    onChangeForm({ ...form, department: event.target.value })
                  }
                  value={form.department}
                />
              </label>
            </>
          ) : (
            <>
              <label className="block text-[10px] font-black uppercase tracking-wide text-[#6a7483]">
                Name
                <input
                  className="mt-1 h-9 w-full rounded-lg border border-[#c7d0dc] px-3 text-xs"
                  onChange={(event) =>
                    onChangeForm({ ...form, name: event.target.value })
                  }
                  value={form.name}
                />
              </label>
              <label className="block text-[10px] font-black uppercase tracking-wide text-[#6a7483]">
                Phone
                <input
                  className="mt-1 h-9 w-full rounded-lg border border-[#c7d0dc] px-3 text-xs"
                  onChange={(event) =>
                    onChangeForm({ ...form, phone: event.target.value })
                  }
                  value={form.phone}
                />
              </label>
              <label className="block text-[10px] font-black uppercase tracking-wide text-[#6a7483]">
                Department
                <input
                  className="mt-1 h-9 w-full rounded-lg border border-[#c7d0dc] px-3 text-xs"
                  onChange={(event) =>
                    onChangeForm({ ...form, department: event.target.value })
                  }
                  value={form.department}
                />
              </label>
              <label className="block text-[10px] font-black uppercase tracking-wide text-[#6a7483]">
                Job title
                <input
                  className="mt-1 h-9 w-full rounded-lg border border-[#c7d0dc] px-3 text-xs"
                  onChange={(event) =>
                    onChangeForm({ ...form, title: event.target.value })
                  }
                  placeholder="Shown in the sidebar. Not a permission."
                  value={form.title}
                />
              </label>
            </>
          )}
        </div>

        <footer className="flex flex-col gap-2 border-t border-[#d8dde5] px-4 py-3">
          {error ? (
            <p className="rounded-lg border border-[#f2b7ba] bg-[#fff2f2] px-3 py-2 text-[11px] font-semibold text-[#a52a3d]">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              className="h-9 rounded-lg border border-[#c7d0dc] px-4 text-xs font-black"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="h-9 rounded-lg bg-[#17202a] px-4 text-xs font-black text-white disabled:opacity-50"
              disabled={
                isSaving ||
                (mode === "add" && (!canInvite || inviteEmails.length === 0))
              }
              type="submit"
            >
              {isSaving
                ? "Saving..."
                : mode === "add"
                  ? "Send invitations"
                  : "Save"}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
