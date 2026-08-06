"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";

export type EditProfileValues = {
  displayName: string;
  username: string;
};

type EditProfileDialogProps = {
  open: boolean;
  initials: string;
  initialValues: EditProfileValues;
  onClose: () => void;
  onSave: (values: EditProfileValues) => void;
};

export function EditProfileDialog({
  open,
  initials,
  initialValues,
  onClose,
  onSave
}: EditProfileDialogProps) {
  const titleId = useId();
  const displayNameId = useId();
  const usernameId = useId();
  const displayNameRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(initialValues.displayName);
  const [username, setUsername] = useState(initialValues.username);

  useEffect(() => {
    if (!open) return;

    setDisplayName(initialValues.displayName);
    setUsername(initialValues.username);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = window.requestAnimationFrame(() => {
      displayNameRef.current?.focus();
      displayNameRef.current?.select();
    });

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [initialValues.displayName, initialValues.username, onClose, open]);

  if (!open) return null;

  function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedDisplayName = displayName.trim();
    const normalizedUsername = username.trim().replace(/\s+/g, "");
    if (!normalizedDisplayName || !normalizedUsername) return;

    onSave({
      displayName: normalizedDisplayName,
      username: normalizedUsername
    });
  }

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[1px]"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-white/15 bg-[#061126] text-white shadow-2xl"
        role="dialog"
      >
        <form className="p-4 sm:p-5" onSubmit={submitProfile}>
          <h2 className="text-lg font-medium" id={titleId}>
            Edit profile
          </h2>

          <div className="flex justify-center py-9">
            <div className="relative">
              <div className="flex h-34 w-34 items-center justify-center rounded-full border-3 border-[#f0f0f0] bg-[#facb0b] text-5xl font-light text-white ring-2 ring-[#15344f] ring-offset-2 ring-offset-[#061126]">
                {initials}
              </div>

              <span
                aria-hidden="true"
                className="absolute bottom-2 right-1 flex h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-[#15344f] text-white"
              >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  viewBox="0 0 24 24"
                >
                  <path d="M14.5 5 13 3h-2L9.5 5H6a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3Z" />
                  <circle cx="12" cy="12" r="4" />
                </svg>
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label
              className="block rounded-md border border-white/30 px-3 py-2 focus-within:border-white/70"
              htmlFor={displayNameId}
            >
              <span className="block text-xs text-white">Display name</span>
              <input
                autoComplete="name"
                className="mt-1 w-full bg-transparent text-sm text-white outline-none"
                id={displayNameId}
                name="displayName"
                onChange={(event) => setDisplayName(event.target.value)}
                ref={displayNameRef}
                required
                value={displayName}
              />
            </label>

            <label
              className="block rounded-md border border-white/30 px-3 py-2 focus-within:border-white/70"
              htmlFor={usernameId}
            >
              <span className="block text-xs text-white">Username</span>
              <input
                autoCapitalize="none"
                autoComplete="username"
                className="mt-1 w-full bg-transparent text-sm text-white outline-none"
                id={usernameId}
                name="username"
                onChange={(event) => setUsername(event.target.value)}
                required
                spellCheck={false}
                value={username}
              />
            </label>
          </div>

          <p className="mt-4 text-center text-xs text-white/70">
            Your profile helps your team recognize you across the dashboard.
          </p>

          <footer className="mt-4 flex justify-end gap-3">
            <button
              className="h-9 rounded-full border border-white/40 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="h-9 rounded-full bg-white px-4 text-sm font-semibold text-[#061126] transition hover:bg-[#eef4fa]"
              type="submit"
            >
              Save
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
