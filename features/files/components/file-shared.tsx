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
  /**
   * The storage bucket the browser should upload into. Served by the API
   * rather than duplicated as a client constant: the name comes from an env
   * var, and a second copy could drift and fail only in production.
   */
  bucket: string;
  folders: Array<{
    id: string;
    name: string;
    parentId: string | null;
    /** Set on folders created for a specific booking. */
    eventId: string | null;
    _count: { files: number };
  }>;
  files: Array<{
    id: string;
    folderId: string | null;
    /** Set when the file was uploaded against a booking. */
    eventId: string | null;
    fileName: string;
    contentType: string | null;
    sizeBytes: number | null;
  }>;
  /** Bookings a file can be filed against, for the Add File picker. */
  events: Array<{
    id: string;
    clientName: string;
    eventType: string | null;
    eventDate: string;
  }>;
};

/**
 * Maps a stored content type onto the values in the type filter. Kept beside
 * the shared types so the filter and any future badge agree on what counts as
 * a spreadsheet.
 */
export function fileTypeGroup(contentType: string | null) {
  if (!contentType) return "other";
  if (contentType === "application/pdf") return "pdf";
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  if (contentType.startsWith("audio/")) return "audio";
  if (
    contentType.includes("spreadsheet") ||
    contentType.includes("excel") ||
    contentType === "text/csv"
  ) {
    return "spreadsheet";
  }
  if (contentType.includes("word") || contentType.startsWith("text/")) {
    return "document";
  }

  return "other";
}

export function FileIcon({ className = "h-5 w-5" }: { className?: string }) {
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
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

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

export function SyncBadge({
  children,
  tone = "on"
}: {
  children: ReactNode;
  tone?: "on" | "off";
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black ${
        tone === "on"
          ? "border-[#abdccc] bg-[#effbf6] text-[#146c43]"
          : "border-[#d8dde5] bg-[#f5f6f8] text-[#6a7483]"
      }`}
    >
      {children}
    </span>
  );
}

export type DriveStatusResponse = {
  configured: boolean;
  missing: string[];
};

/**
 * The badge that used to read "Google Drive sync ready" whether or not
 * anything was connected. It now reports the deployment's real state, so it
 * cannot promise a capability that is switched off.
 */
export function DriveSyncBadge({
  status
}: {
  status: DriveStatusResponse | null | undefined;
}) {
  if (!status) return null;

  return status.configured ? (
    <SyncBadge>Google Drive synced</SyncBadge>
  ) : (
    <SyncBadge tone="off">Drive sync not connected</SyncBadge>
  );
}
