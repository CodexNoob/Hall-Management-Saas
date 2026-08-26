"use client";

import { useEffect, useRef, useState } from "react";
import { formatFileSize } from "@/features/files/lib/upload-file";
import { LineIcon } from "@/features/menu/components/menu-shared";
import {
  PICTURE_ACCEPTED_LABEL,
  PICTURE_ACCEPT_ATTRIBUTE,
  describeUnacceptablePicture
} from "@/features/menu/lib/upload-menu-picture";

type PictureFieldProps = {
  /**
   * The stored picture as a signed URL, for an edit. Absent on a create, where
   * there is nothing to show until a file is picked.
   */
  currentPictureUrl?: string | null;
  /** The file waiting to be uploaded, or null when nothing has been picked. */
  file: File | null;
  /** Whether the stored picture is marked to be dropped on the next save. */
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
  "h-8 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black normal-case tracking-normal text-[#17202a] transition hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-60";

/**
 * The picture on a library item: pick one, and see the one that is there.
 *
 * A bare `<input type="file">` said "No file chosen" next to an item that had a
 * photo on its card, which is the one thing it could not mean. Everything here
 * follows from showing the picture instead - a thumbnail needs somewhere to
 * live, and once the current picture is on screen, removing it stops being
 * something only the API can do.
 *
 * Nothing uploads from here. The file is handed up and the form uploads it on
 * save, so cancelling costs nothing and a failed save leaves no orphan in the
 * bucket.
 */
export function PictureField({
  currentPictureUrl,
  file,
  isCleared,
  isDisabled = false,
  onSelect,
  onClearStored,
  onRestoreStored
}: PictureFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rejection, setRejection] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // An object URL rather than a FileReader: it is handed back synchronously, so
  // the thumbnail is on screen in the same frame as the pick. It has to be
  // revoked, though - the blob outlives the component otherwise, and a form
  // opened and closed all afternoon would hold every photo ever chosen.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  // The pick wins, the stored picture is what shows without one, and a stored
  // picture marked for removal shows nothing - the empty state IS the preview
  // of what saving is about to do.
  const shownUrl = previewUrl ?? (isCleared ? null : (currentPictureUrl ?? null));
  const hasStoredPicture = Boolean(currentPictureUrl);

  const openPicker = () => inputRef.current?.click();

  const handlePicked = (picked: File | null) => {
    if (!picked) return;

    const reason = describeUnacceptablePicture(picked);
    setRejection(reason);
    // A refused file never reaches state, so the form cannot be carrying one
    // when Save is pressed - which is what used to turn a wrong file into a
    // failure several fields later.
    if (!reason) onSelect(picked);

    // The input holds onto the last pick, and an unchanged value fires no
    // change event - so without this, choosing the same file again after a
    // refusal does nothing at all.
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleRemove = () => {
    setRejection(null);
    // One button, two meanings, and both are what the picture on screen says:
    // discard the pick if that is what is showing, otherwise mark the stored
    // picture to be dropped when the form is saved.
    if (file) onSelect(null);
    else onClearStored();
  };

  return (
    <div>
      {/* A `<span>`, not a `<label>` wrapping the control: the input is
          visually hidden behind buttons of its own, and a label around them
          would open the picker twice on one click. */}
      <span className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]">
        Picture
      </span>
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
          // Only the first: this field holds one picture, and silently taking
          // the last of five would be a coin toss.
          handlePicked(dropEvent.dataTransfer.files?.[0] ?? null);
        }}
      >
        {shownUrl ? (
          <div className="flex items-center gap-3">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-[#d8dde5] bg-[#fbfcfd]">
              {/* Plain <img> for both sources, and for the same reason the
                  cards use one: a signed URL that rotates faster than the
                  optimizer could cache it, and a blob: URL it cannot fetch at
                  all. alt="" because the text beside it already says what this
                  is. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                src={shownUrl}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black normal-case tracking-normal text-[#17202a]">
                {file ? file.name : "Current picture"}
              </p>
              <p className="mt-0.5 text-xs font-medium normal-case tracking-normal text-[#6a7483]">
                {file
                  ? `${formatFileSize(file.size)} - uploads when you save`
                  : "Saved with this item"}
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
                  className="h-8 rounded-lg border border-[#efb6b6] bg-white px-3 text-xs font-black normal-case tracking-normal text-[#b42318] transition hover:bg-[#fff5f5] disabled:cursor-not-allowed disabled:opacity-60"
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
            <LineIcon className="h-6 w-6 text-[#8a94a3]" name="upload" />
            <span className="mt-1 text-sm font-black normal-case tracking-normal text-[#17202a]">
              Drop an image here or click to browse
            </span>
            <span className="text-xs font-medium normal-case tracking-normal text-[#8a94a3]">
              Optional. {PICTURE_ACCEPTED_LABEL}, up to 5 MB.
            </span>
          </button>
        )}

        {/* Said out loud rather than left to the empty slot above: the picture
            is still on the card until this form is saved, and an undo has to
            be reachable for as long as that is true. */}
        {isCleared && !file ? (
          <p className="mt-2 text-xs font-bold normal-case tracking-normal text-[#6a7483]">
            The current picture will be removed when you save.{" "}
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
          accept={PICTURE_ACCEPT_ATTRIBUTE}
          aria-label="Picture"
          className="sr-only"
          disabled={isDisabled}
          name="picture"
          onChange={(changeEvent) =>
            handlePicked(changeEvent.target.files?.[0] ?? null)
          }
          ref={inputRef}
          type="file"
        />
      </div>

      {rejection ? (
        <p
          className="mt-1 text-xs font-bold normal-case tracking-normal text-[#b42318]"
          role="alert"
        >
          {rejection}
        </p>
      ) : hasStoredPicture && file ? (
        <p className="mt-1 text-xs font-bold normal-case tracking-normal text-[#6a7483]">
          Saving replaces the picture this item has now.
        </p>
      ) : null}
    </div>
  );
}
