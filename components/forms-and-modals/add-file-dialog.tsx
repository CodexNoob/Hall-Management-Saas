"use client";

import { useEffect, useId, useRef, useState, type FormEvent, } from "react";

export type AddFileFormValues = {
    file: File;
    fileName: string;
    fileType: string;
    folderPath: string;
    notes: string;
};

type AddFileDialogProps = {
    open: boolean;
    folderPath: string;
    onClose: () => void;
    onSave: (values: AddFileFormValues) => void;
};

const controlClass =
    "h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm " +
    "text-[#17202a] outline-none transition focus:border-[#1f4d73] " +
    "focus:ring-2 focus:ring-[#1f4d73]/15";

export function AddFileDialog({
    open,
    folderPath,
    onClose,
    onSave,
}: AddFileDialogProps) {
    const titleId = useId();
    const fileId = useId();
    const fileNameId = useId();
    const fileTypeId = useId();
    const folderPathId = useId();
    const notesId = useId();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [fileName, setFileName] = useState("");
    const [fileType, setFileType] = useState("PDF");
    const [notes, setNotes] = useState("");

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
        setFileType("PDF");
        setNotes("");

        if(fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }

    function closeDialog() {
        resetForm();
        onClose();
    }

    function handleFileChange(file:File | null) {
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
                fileInputRef.current?.focus();
                return;
            }

            onSave({
                file: selectedFile,
                fileName: fileName.trim(),
                fileType,
                folderPath,
                notes: notes.trim(),
            });

            resetForm();
            onClose();
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

                        <button className="h-8 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black text-[#17202a] transition hover:bg-[#eef4fa]" onClick={closeDialog} type="button">
                            Close
                            </button>
                        </header> 

                        <form onSubmit={handleSubmit}>
                            <div className="grid gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-2">
                                <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b] sm:col-span-2" htmlFor={fileId}>
                                    Choose file
                                    <input ref={fileInputRef} id={fileId} name="file" className="mt-1 block h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-2 py-1 text-sm font-medium normal-case tracking-normal text-[#17202a] file:mr-2 file:rounded-sm file:border file:border-[#8a94a3] file:bg-[#f5f6f8] file:px-2 file:py-0.5" onChange={(event) =>
                                        handleFileChange(event.target.files?.[0]??null)
                                    } 
                                    required
                                    type="file" />
                                </label>
                                <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]" htmlFor={fileNameId}>
                                    File Name
                                    <input id={fileNameId} name="fileName" className={[controlClass, "mt-1"].join(" ")}
                                    onChange={(event) => setFileName(event.target.value)} 
                                    placeholder="file name"
                                    required
                                    value={fileName}
                                    />
                                </label>

                                <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b]" htmlFor={fileTypeId}>
                                    Type
                                    <select id={fileTypeId} name="fileType" className={[controlClass, "mt-1"].join(" ")}
                                    onChange={(event) => setFileType(event.target.value)}
                                    value={fileType}
                                    >
                                        <option value="PDF">PDF</option>
                                        <option value="Document">Document</option>
                                        <option value="Spreadsheet">Spreadsheet</option>
                                        <option value="Image">Image</option>
                                        <option value="Video">Video</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </label>

                                <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b] sm:col-span-2" htmlFor={folderPathId}>
                                    Folder Path
                                    <input id={folderPathId} name="folderPath" className={[controlClass, "mt-1 bg-[#f8fafc]"].join(" ")}
                                    readOnly
                                    value={folderPath}
                                    />
                                </label>

                                <label className="text-[11px] font-black uppercase tracking-[0.04em] text-[#64748b] sm:col-span-2" htmlFor={notesId}>
                                    Notes

                                    <textarea id={notesId} name="notes" className="mt-1 min-h-13 w-full resize-y rounded-lg border border-[#b9c2cf] bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-[#17202a] outline-none placeholder:text-[#8a94a3] focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15"
                                    onChange={(event) => setNotes(event.target.value)}
                                    placeholder="Optional Notes"
                                    value={notes}
                                    />
                                </label>
                            </div>

                            <footer className="flex justify-end gap-2 border-t border-[#d8dde5] bg-[#fbfcfd] px-4 py-3">
                                <button className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-4 text-xs font-black text-[#17202a] transition hover:bg-[#eef4fa]"
                                onClick={closeDialog}
                                type="button"
                                >
                                    Cancel
                                </button>

                                <button className="h-9 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white shadow-sm transition hover:bg-[#15344f]"
                                type="submit"
                                >
                                    Save file
                                </button>
                            </footer>
                        </form>
                </section>
            </div>
        );
    }
