"use client";

import { useEffect, useId, useRef, useState, type FormEvent, } from "react";

import {
    ACCEPTED_LABEL,
    ACCEPT_ATTRIBUTE,
    describeUnacceptableFile,
    formatFileSize
} from "@/features/files/lib/upload-file";
import {
    CUSTOM_SECTION,
    EVENT_FOLDER_SECTIONS
} from "@/features/files/lib/event-folders";

function formatEventDate(value: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";

    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC"
    }).format(parsed);
}

function UploadCloudIcon() {
    return (
        <svg
            aria-hidden="true"
            className="h-7 w-7 text-[#94a3b8]"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
        >
            <path d="M6.5 18a4.5 4.5 0 0 1-.5-8.97 6 6 0 0 1 11.6-1.5A4.25 4.25 0 0 1 18 18" />
            <path d="M12 12v7M9 14.5 12 11.5l3 3" />
        </svg>
    );
}

export type AddFileFormValues = {
    file: File;
    fileName: string;
    /** A section from EVENT_FOLDER_SECTIONS, or the name typed under "Other". */
    sectionName: string;
    /** Empty for general filing that belongs to no booking. */
    eventId: string;
    notes: string;
};

export type AddFileEventOption = {
    id: string;
    clientName: string;
    eventType: string | null;
    eventDate: string;
};

type AddFileDialogProps = {
    open: boolean;
    /** Bookings the file can be attached to. Empty hides the picker. */
    events?: AddFileEventOption[];
    /** Preselected booking, for the dialog opened from an event's Files tab. */
    lockedEventId?: string;
    /** True while the caller is uploading and writing the row. */
    isSaving?: boolean;
    /** Upload or save failure, shown in the footer so the file is not lost. */
    saveError?: string | null;
    onClose: () => void;
    onSave: (values: AddFileFormValues) => void;
};

const controlClass =
    "h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm " +
    "text-[#17202a] outline-none transition focus:border-[#1f4d73] " +
    "focus:ring-2 focus:ring-[#1f4d73]/15";

export function AddFileDialog({
    open,
    events = [],
    lockedEventId,
    isSaving = false,
    saveError = null,
    onClose,
    onSave,
}: AddFileDialogProps) {
    const titleId = useId();
    const fileId = useId();
    const fileNameId = useId();
    const sectionId = useId();
    const customSectionId = useId();
    const eventId = useId();
    const notesId = useId();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [fileName, setFileName] = useState("");
    const [section, setSection] = useState<string>(EVENT_FOLDER_SECTIONS[0]);
    const [customSection, setCustomSection] = useState("");
    const [selectedEventId, setSelectedEventId] = useState(lockedEventId ?? "");
    const [notes, setNotes] = useState("");
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const [fileError, setFileError] = useState("");

    const isCustomSection = section === CUSTOM_SECTION;
    const resolvedSection = isCustomSection ? customSection.trim() : section;

    useEffect(() => {
        if (!open) {
            return;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const handleKeyDown = (event:KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        window.addEventListener("keydown",handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [onClose, open]);

    if (!open) {
        return null;
    }

    function resetForm() {
        setSelectedFile(null);
        setFileName("");
        setSection(EVENT_FOLDER_SECTIONS[0]);
        setCustomSection("");
        setSelectedEventId(lockedEventId ?? "");
        setNotes("");
        setIsDraggingOver(false);
        setFileError("");

        if(fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }

    function closeDialog() {
        resetForm();
        onClose();
    }

    function handleFileChange(file:File | null) {
        // Refuse an oversized or unsupported file here rather than letting the
        // upload succeed and the API reject the row, which would leave an
        // orphaned object sitting in the bucket.
        const rejection = file ? describeUnacceptableFile(file) : null;
        if (rejection) {
            setFileError(rejection);
            setSelectedFile(null);
            return;
        }

        setFileError("");
        setSelectedFile(file);

        if (file && !fileName.trim()) {
            const nameWithoutExtension = file.name.lastIndexOf(".") > 0? file.name.slice(0, file.name.lastIndexOf("."))
            :file.name;

            setFileName(nameWithoutExtension);
            }
        }

        function handleSubmit(event:FormEvent<HTMLFormElement>){
            event.preventDefault();

            if (!selectedFile) {
                setFileError("Choose a file to upload.");
                return;
            }

            if (!resolvedSection) {
                setFileError("Name the folder this file belongs in.");
                return;
            }

            // The dialog no longer closes itself. The caller uploads to storage
            // and writes the row, either of which can fail - closing here would
            // discard the file and report success for something that did not
            // happen.
            onSave({
                file: selectedFile,
                fileName: fileName.trim(),
                sectionName: resolvedSection,
                eventId: selectedEventId,
                notes: notes.trim(),
            });
        }

        return (
            <div className="fixed inset-0 z-100 flex items-center justify-center bg-[#17202a]/30 p-3 sm:p-5"
            onMouseDown={(event) => {
                if (event.currentTarget === event.target) {
                    closeDialog();
                }
            }}
            >
                <section 
                aria-labelledby={titleId}
                aria-modal="true"
                className="w-full max-w-170 overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-2xl shadow-[#17202a]/20" role="dialog"
                >    
                    <header className="flex items-center justify-between gap-4 border-b border-[#d8dde5] px-4 py-3">
                        <h2 className="text-base font-black text-[#17202a]" id={titleId}>
                            Add File
                        </h2>

                        <button aria-label="Close add file" className="flex h-9 w-9 items-center justify-center rounded-full text-3xl leading-none text-[#17202a] transition hover:bg-[#eef4fa]" onClick={closeDialog} type="button">
                            <span aria-hidden="true">×</span>
                            </button>
                        </header> 

                        <form onSubmit={handleSubmit}>
                            <div className="grid gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-2">
                                <div className="sm:col-span-2">
                                    <span className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]">
                                        Upload files
                                    </span>

                                    {/* A drop target rather than a bare file input: the whole
                                        area is clickable, and a document dragged from the
                                        desktop lands without opening a picker at all. */}
                                    <div
                                        className={`mt-1 rounded-xl border-2 border-dashed px-4 py-7 text-center transition ${
                                            isDraggingOver
                                                ? "border-[#1f4d73] bg-[#eef4fa]"
                                                : fileError
                                                    ? "border-[#f3b4ae] bg-[#fef2f1]"
                                                    : "border-[#cbd5e1] bg-white hover:border-[#94a3b8] hover:bg-[#fbfcfd]"
                                        }`}
                                        onDragLeave={(event) => {
                                            event.preventDefault();
                                            setIsDraggingOver(false);
                                        }}
                                        onDragOver={(event) => {
                                            event.preventDefault();
                                            setIsDraggingOver(true);
                                        }}
                                        onDrop={(event) => {
                                            event.preventDefault();
                                            setIsDraggingOver(false);
                                            handleFileChange(event.dataTransfer.files?.[0] ?? null);
                                        }}
                                    >
                                        <button
                                            className="mx-auto flex w-full flex-col items-center gap-1 bg-transparent"
                                            onClick={() => fileInputRef.current?.click()}
                                            type="button"
                                        >
                                            <UploadCloudIcon />
                                            <span className="mt-1 text-sm font-black normal-case tracking-normal text-[#17202a]">
                                                {selectedFile
                                                    ? selectedFile.name
                                                    : "Drop files here or click to browse"}
                                            </span>
                                            <span className="text-xs font-medium normal-case tracking-normal text-[#8a94a3]">
                                                {selectedFile
                                                    ? `${formatFileSize(selectedFile.size)} - click to choose a different file`
                                                    : `${ACCEPTED_LABEL} up to 50MB`}
                                            </span>
                                        </button>

                                        <input
                                            ref={fileInputRef}
                                            accept={ACCEPT_ATTRIBUTE}
                                            aria-label="Upload files"
                                            className="sr-only"
                                            id={fileId}
                                            name="file"
                                            onChange={(event) =>
                                                handleFileChange(event.target.files?.[0] ?? null)
                                            }
                                            type="file"
                                        />
                                    </div>

                                    {fileError ? (
                                        <p className="mt-1 text-xs font-bold normal-case tracking-normal text-[#b42318]" role="alert">
                                            {fileError}
                                        </p>
                                    ) : null}
                                </div>
                                <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]" htmlFor={fileNameId}>
                                    File Name
                                    <input aria-label="File name" id={fileNameId} name="fileName" className={[controlClass, "mt-1"].join(" ")}
                                    onChange={(event) => setFileName(event.target.value)} 
                                    placeholder="file name"
                                    required
                                    value={fileName}
                                    />
                                </label>

                                {/* What kind of document this is, which is also
                                    the folder it is filed into. */}
                                <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]" htmlFor={sectionId}>
                                    Folder
                                    <select aria-label="Folder" id={sectionId} name="section" className={[controlClass, "mt-1"].join(" ")}
                                    onChange={(changeEvent) => setSection(changeEvent.target.value)}
                                    value={section}
                                    >
                                        {EVENT_FOLDER_SECTIONS.map((name) => (
                                            <option key={name} value={name}>
                                                {name}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                {isCustomSection ? (
                                    <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b] sm:col-span-2" htmlFor={customSectionId}>
                                        Folder name
                                        <input aria-label="Folder name" id={customSectionId} name="customSection" className={[controlClass, "mt-1"].join(" ")}
                                        onChange={(changeEvent) => setCustomSection(changeEvent.target.value)}
                                        placeholder="e.g. Insurance"
                                        value={customSection}
                                        />
                                    </label>
                                ) : null}

                                {/* Optional on purpose: a venue licence or a
                                    supplier price list belongs to no booking,
                                    and requiring one would push people to
                                    attach documents to an arbitrary event. */}
                                {events.length > 0 && !lockedEventId ? (
                                    <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b] sm:col-span-2" htmlFor={eventId}>
                                        Event
                                        <select aria-label="Event" id={eventId} name="eventId" className={[controlClass, "mt-1"].join(" ")}
                                        onChange={(changeEvent) => setSelectedEventId(changeEvent.target.value)}
                                        value={selectedEventId}
                                        >
                                            <option value="">No event - general filing</option>
                                            {events.map((option) => (
                                                <option key={option.id} value={option.id}>
                                                    {`${option.clientName}${option.eventType ? ` ${option.eventType}` : ""} - ${formatEventDate(option.eventDate)}`}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                ) : null}

                                <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b] sm:col-span-2" htmlFor={notesId}>
                                    Notes

                                    <textarea id={notesId} name="notes" className="mt-1 min-h-13 w-full resize-y rounded-lg border border-[#b9c2cf] bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-[#17202a] outline-none placeholder:text-[#8a94a3] focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15"
                                    onChange={(event) => setNotes(event.target.value)}
                                    placeholder="Optional Notes"
                                    value={notes}
                                    />
                                </label>
                            </div>

                            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-[#d8dde5] bg-[#fbfcfd] px-4 py-3">
                                {saveError ? (
                                    <p className="mr-auto max-w-full text-xs font-bold text-[#b42318]" role="alert">
                                        {saveError}
                                    </p>
                                ) : null}

                                <button className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-4 text-xs font-black text-[#17202a] transition hover:bg-[#eef4fa] disabled:opacity-50"
                                disabled={isSaving}
                                onClick={closeDialog}
                                type="button"
                                >
                                    Cancel
                                </button>

                                <button className="h-9 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white shadow-sm transition hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={isSaving}
                                type="submit"
                                >
                                    {isSaving ? "Uploading..." : "Save file"}
                                </button>
                            </footer>
                        </form>
                </section>
            </div>
        );
    }
