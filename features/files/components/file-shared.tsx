"use client";

import { type ReactNode } from "react";

export type Folder = {
  id: string;
  name: string;
  fileCount: number;
  parentId: string | null;
  isPermanent: boolean;
};

export type FilesResponse = {
  folders: Array<{
    id: string;
    name: string;
    parentId: string | null;
    _count: { files: number };
  }>;
  files: Array<{
    id: string;
    folderId: string | null;
    fileName: string;
    contentType: string | null;
    sizeBytes: number | null;
  }>;
};

export function FolderIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M3.5 6.5h6l2 2h9v10a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2Z" />
    </svg>
  );
}

export function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function MoreIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  );
}

export function SyncBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#abdccc] bg-[#effbf6] px-3 py-1 text-xs font-black text-[#146c43]">
      {children}
    </span>
  );
}
