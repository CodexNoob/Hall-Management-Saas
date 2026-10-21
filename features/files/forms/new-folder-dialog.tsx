"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useAppLanguage } from "@/components/providers/app-language-provider";

export type NewFolderFormValues = { folderName: string };

type NewFolderDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (values: NewFolderFormValues) => void;
};

export function NewFolderDialog({ open, onClose, onCreate }: NewFolderDialogProps) {
  const { t } = useAppLanguage();
  const titleId = useId();
  const folderNameId = useId();
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [folderName, setFolderName] = useState("");

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    folderInputRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  function closeDialog() {
    setFolderName("");
    onClose();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = folderName.trim();

    if (!normalizedName) {
      folderInputRef.current?.focus();
      return;
    }

    onCreate({ folderName: normalizedName });
    setFolderName("");
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-[#17202a]/30 p-3 sm:p-5"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) closeDialog();
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-[470px] overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-2xl shadow-[#17202a]/20"
        role="dialog"
      >
        <header className="flex items-center justify-between gap-4 border-b border-[#d8dde5] px-4 py-3">
          <h2 className="text-base font-black text-[#17202a]" id={titleId}>{t("files.newFolder")}</h2>
          <button aria-label={t("files.closeNewFolder")} className="flex h-9 w-9 items-center justify-center rounded-full text-3xl leading-none text-[#17202a] transition hover:bg-[#eef4fa]" onClick={closeDialog} type="button"><span aria-hidden="true">×</span></button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="px-4 py-3">
            <label className="block text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]" htmlFor={folderNameId}>{t("files.folderName")}</label>
            <input
              ref={folderInputRef}
              autoComplete="off"
              className="mt-1 h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm text-[#17202a] outline-none placeholder:text-[#8a94a3] focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15"
              id={folderNameId}
              name="folderName"
              onChange={(event) => setFolderName(event.target.value)}
              placeholder={t("files.folderName")}
              required
              value={folderName}
            />
          </div>

          <footer className="flex justify-end gap-2 border-t border-[#d8dde5] bg-[#fbfcfd] px-4 py-3">
            <button className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-4 text-xs font-black text-[#17202a] transition hover:bg-[#eef4fa]" onClick={closeDialog} type="button">{t("common.cancel")}</button>
            <button className="h-9 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white shadow-sm transition hover:bg-[#15344f]" type="submit">{t("files.createFolder")}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
