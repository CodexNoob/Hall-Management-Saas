"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useAuthenticatedMutation } from "@/features/dashboard/hooks/use-authenticated-mutation";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { useAppLanguage } from "@/components/providers/app-language-provider";

type TodayNotesDrawerProps = {
  open: boolean;
  onClose: () => void;
};

type TodayNote = {
  id: string;
  message: string;
  tone: "attention" | "default";
  createdAt: string;
  createdBy: { name: string } | null;
};

type TodayNotesResponse = {
  date: string;
  notes: TodayNote[];
};

type CreateTodayNoteResponse = {
  date: string;
  note: TodayNote;
};

function operatingDateKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function formatOperatingDate() {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric"
  }).format(new Date());
}

export function TodayNotesDrawer({ open, onClose }: TodayNotesDrawerProps) {
  const { t } = useAppLanguage();
  const titleId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [newNote, setNewNote] = useState("");
  const dateKey = operatingDateKey();
  const notesUrl = `/api/today-notes?date=${dateKey}`;
  const notesQuery = useAuthenticatedQuery<TodayNotesResponse>(notesUrl, open);
  const noteMutation = useAuthenticatedMutation<
    { message: string; tone: "default" },
    CreateTodayNoteResponse
  >(notesUrl);
  const notes = notesQuery.data?.notes ?? [];

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = newNote.trim();

    if (!message) {
      textareaRef.current?.focus();
      return;
    }

    try {
      await noteMutation.mutate({ message, tone: "default" });
      await notesQuery.refetch();
      setNewNote("");
      textareaRef.current?.focus();
    } catch {
      // The mutation error is displayed below the note field.
    }
  };

  return (
    <div
      className="fixed inset-0 z-100 bg-[#17202a]/25"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <aside
        aria-labelledby={titleId}
        aria-modal="true"
        className="ml-auto flex h-full w-full max-w-143.75 flex-col border-l border-[#d8dde5] bg-white shadow-2xl shadow-[#17202a]/20"
        role="dialog"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#d8dde5] px-4 py-3">
          <div>
            <h2 className="text-base font-black text-[#17202a]" id={titleId}>
              {t("common.todayNotes")}
            </h2>
            <p className="mt-0.5 text-xs text-[#6a7483]">
              Internal notes for {formatOperatingDate()} operating day.
            </p>
          </div>
          <button
            aria-label={t("shell.closeTodayNotes")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-4xl leading-none text-[#17202a] hover:bg-[#eef4fa]"
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

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-3">
              {notesQuery.isLoading ? (
                <p className="rounded-lg border border-dashed border-[#c7d0dc] p-4 text-center text-xs font-bold text-[#6a7483]">
                  {t("shell.loadingTodayNotes")}
                </p>
              ) : notesQuery.error ? (
                <div className="rounded-lg border border-[#efb5ad] bg-[#fff4f2] p-4 text-xs text-[#a92217]">
                  <p className="font-black">{notesQuery.error}</p>
                  <button
                    className="mt-2 font-black underline"
                    onClick={() => notesQuery.refetch()}
                    type="button"
                  >
                    {t("common.tryAgain")}
                  </button>
                </div>
              ) : notes.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[#c7d0dc] p-4 text-center text-xs font-bold text-[#6a7483]">
                  {t("shell.noTodayNotes")}
                </p>
              ) : (
                notes.map((note) => (
                  <article
                    className={`min-h-18 rounded-lg border px-3 py-3 text-xs leading-5 text-[#516174] ${
                      note.tone === "attention"
                        ? "border-[#ead9b8] bg-[#fffaf0]"
                        : "border-[#d8dde5] bg-[#f7f9fc]"
                    }`}
                    key={note.id}
                  >
                    {note.message}
                    <p className="mt-2 text-[10px] font-bold text-[#7b8797]">
                      {note.createdBy?.name ?? t("shell.teamMember")} ·{" "}
                      {new Intl.DateTimeFormat("en-US", {
                        hour: "numeric",
                        minute: "2-digit"
                      }).format(new Date(note.createdAt))}
                    </p>
                  </article>
                ))
              )}
            </div>

            <label
              className="mt-4 block text-xs font-black text-[#59677c]"
              htmlFor="today-note-message"
            >
              {t("shell.addNote")}
            </label>
            <textarea
              className="mt-4 min-h-30 w-full resize-y rounded-lg border border-[#b9c2cf] bg-white px-3 py-3 text-sm text-[#17202a] outline-none transition placeholder:text-[#8a94a3] focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15"
              id="today-note-message"
              onChange={(event) => setNewNote(event.target.value)}
              placeholder={t("shell.typeInternalNote")}
              ref={textareaRef}
              value={newNote}
            />
            {noteMutation.error ? (
              <p className="mt-2 text-xs font-bold text-[#b42318]">
                {noteMutation.error}
              </p>
            ) : null}
          </div>

          <footer className="flex shrink-0 justify-end border-t border-[#d8dde5] bg-white px-4 py-3">
            <button
              className="h-10 rounded-lg bg-[#1f4d73] px-5 text-sm font-black text-white shadow-sm transition hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!newNote.trim() || noteMutation.isPending}
              type="submit"
            >
              {noteMutation.isPending
                ? t("common.savingEllipsis")
                : t("shell.saveNote")}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );
}
