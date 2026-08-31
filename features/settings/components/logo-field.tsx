"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/features/settings/components/settings-shared";
import { formatFileSize } from "@/features/files/lib/upload-file";
import {
  LOGO_ACCEPTED_LABEL,
  LOGO_ACCEPT_ATTRIBUTE,
  describeUnacceptableLogo
} from "@/features/settings/lib/upload-organization-logo";

type LogoFieldProps = {
  /**
   * The stored logo as a signed URL. Null while it is still being signed, and
   * for an organization that has never uploaded one.
   */
  currentLogoUrl?: string | null;
  /** The file waiting to be uploaded, or null when nothing has been picked. */
  file: File | null;
  /** Whether the stored logo is marked to be dropped on the next save. */
  isCleared: boolean;
  isDisabled?: boolean;
  /**
   * A file that has already passed the checks below, or null to drop the pick
   * and fall back to whatever is stored.
   */
  onSelect: (file: File | null) => void;
  onClearStored: () => void;
  onRestoreStored: () => void;
};

const actionClass =
  "h-8 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black text-[#17202a] transition hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-60";

/**
 * The organization logo: pick one, and see the one that is there.
 *
 * Replaces the Logo URL box, which asked an operator to host the image
 * somewhere else first and paste a link - so the field was almost always empty
 * and the profile almost always fell back to an initial.
 *
 * Nothing uploads from here. The file is handed up and the General panel
 * uploads it when Save is pressed, so leaving the screen costs nothing and a
 * failed save leaves no orphan in the bucket.
 */
export function LogoField({
  currentLogoUrl,
  file,
  isCleared,
  isDisabled = false,
  onSelect,
  onClearStored,
  onRestoreStored
}: LogoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rejection, setRejection] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // An object URL rather than a FileReader: it is handed back synchronously, so
  // the preview is on screen in the same frame as the pick. It has to be
  // revoked, though - the blob outlives the component otherwise.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  // The pick wins, the stored logo is what shows without one, and a stored logo
  // marked for removal shows nothing - the empty state IS the preview of what
  // saving is about to do.
  const shownUrl = previewUrl ?? (isCleared ? null : (currentLogoUrl ?? null));
  const hasStoredLogo = Boolean(currentLogoUrl);

  const openPicker = () => inputRef.current?.click();

  const handlePicked = (picked: File | null) => {
    if (!picked) return;

    const reason = describeUnacceptableLogo(picked);
    setRejection(reason);
    // A refused file never reaches state, so the panel cannot be carrying one
    // when Save is pressed.
    if (!reason) onSelect(picked);

    // The input holds onto the last pick, and an unchanged value fires no
    // change event - so without this, choosing the same file again after a
    // refusal does nothing at all.
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleRemove = () => {
    setRejection(null);
    // One button, two meanings, and both are what is on screen: discard the
    // pick if that is what is showing, otherwise mark the stored logo to be
    // dropped when the panel is saved.
    if (file) onSelect(null);
    else onClearStored();
  };

  return (
    <div className="sm:col-span-2">
      {/* A `<span>`, not a `<label>` wrapping the control: the input is
          visually hidden behind buttons of its own, and a label around them
          would open the picker twice on one click. */}
      <span className="text-[10px] font-bold text-[#17202a]">Logo</span>
      <div
        className={`mt-1 rounded-xl border-2 border-dashed p-3 transition ${
          isDraggingOver
            ? "border-[#1f4d73] bg-[#eef4fa]"
            : rejection
              ? "border-[#f3b4ae] bg-[#fef2f1]"
              : "border-[#cbd5e1] bg-white"
        }`}
        onDragLeave={(dragEvent) => {
          dragEvent.preventDefault();
          setIsDraggingOver(false);
        }}
        onDragOver={(dragEvent) => {
          if (isDisabled) return;
          dragEvent.preventDefault();
          setIsDraggingOver(true);
        }}
        onDrop={(dropEvent) => {
          dropEvent.preventDefault();
          setIsDraggingOver(false);
          if (isDisabled) return;
          // Only the first: this field holds one logo, and silently taking the
          // last of five would be a coin toss.
          handlePicked(dropEvent.dataTransfer.files?.[0] ?? null);
        }}
      >
        {shownUrl ? (
          <div className="flex items-center gap-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-[#d8dde5] bg-[#fbfcfd]">
              {/* Plain <img>, for both sources and for the same reason the menu
                  cards use one: a signed URL that rotates faster than the
                  optimizer could cache it, and a blob: URL it cannot fetch at
                  all. `object-contain`, not cover - a cropped logo is a
                  different logo. alt="" because the text beside it already says
                  what this is. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                className="absolute inset-0 h-full w-full object-contain p-1"
                src={shownUrl}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black text-[#17202a]">
                {file ? file.name : "Current logo"}
              </p>
              <p className="mt-0.5 text-[10px] font-medium text-[#6a7483]">
                {file
                  ? `${formatFileSize(file.size)} - uploads when you save`
                  : "Saved for this organization"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  className={actionClass}
                  disabled={isDisabled}
                  onClick={openPicker}
                  type="button"
                >
                  Change
                </button>
                <button
                  className="h-8 rounded-lg border border-[#efb6b6] bg-white px-3 text-xs font-black text-[#b42318] transition hover:bg-[#fff5f5] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isDisabled}
                  onClick={handleRemove}
                  type="button"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ) : (
          // The whole area is the target, and it is a single button so there is
          // nothing to nest inside it - which is why the filled state above
          // draws its own two buttons instead.
          <button
            className="flex w-full flex-col items-center gap-1 rounded-lg px-4 py-5 text-center transition hover:bg-[#fbfcfd] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isDisabled}
            onClick={openPicker}
            type="button"
          >
            <Icon className="h-6 w-6 text-[#8a94a3]" name="upload" />
            <span className="mt-1 text-xs font-black text-[#17202a]">
              Drop an image here or click to browse
            </span>
            <span className="text-[10px] font-medium text-[#8a94a3]">
              Optional. {LOGO_ACCEPTED_LABEL}, up to 2 MB.
            </span>
          </button>
        )}

        {/* Said out loud rather than left to the empty slot above: the logo is
            still stored until this panel is saved, and an undo has to be
            reachable for as long as that is true. */}
        {isCleared && !file ? (
          <p className="mt-2 text-[10px] font-bold text-[#6a7483]">
            The current logo will be removed when you save.{" "}
            <button
              className="font-black text-[#1f4d73] underline disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isDisabled}
              onClick={onRestoreStored}
              type="button"
            >
              Undo
            </button>
          </p>
        ) : null}

        <input
          accept={LOGO_ACCEPT_ATTRIBUTE}
          aria-label="Logo"
          className="sr-only"
          disabled={isDisabled}
          name="organizationLogo"
          onChange={(changeEvent) =>
            handlePicked(changeEvent.target.files?.[0] ?? null)
          }
          ref={inputRef}
          type="file"
        />
      </div>

      {rejection ? (
        <p className="mt-1 text-[10px] font-bold text-[#b42318]" role="alert">
          {rejection}
        </p>
      ) : hasStoredLogo && file ? (
        <p className="mt-1 text-[10px] font-bold text-[#6a7483]">
          Saving replaces the logo this organization has now.
        </p>
      ) : null}
    </div>
  );
}
