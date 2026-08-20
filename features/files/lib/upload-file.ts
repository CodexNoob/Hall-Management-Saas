"use client";

import { getCachedAuthSession } from "@/lib/auth/client";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/** Matches MAX_FILE_SIZE_BYTES in app/api/files/route.ts. */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

/**
 * The document types app/api/files/route.ts will accept. Kept here as well so
 * the picker can refuse a file before it is uploaded rather than after - the
 * storage write would otherwise succeed and only the database row be rejected,
 * leaving an orphaned object in the bucket.
 */
export const ACCEPTED_CONTENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4"
] as const;

/** For the file picker's `accept`, which matches on extension too. */
export const ACCEPT_ATTRIBUTE = [
  ...ACCEPTED_CONTENT_TYPES,
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".mp4"
].join(",");

export const ACCEPTED_LABEL = "PDF, Word, Excel, CSV, JPG, PNG, WebP, MP4";

/**
 * The name to store: what the user typed, but carrying the original
 * extension. Without it a document saved as "Signed agreement" downloads
 * with no extension and the operating system cannot open it.
 */
export function buildStoredFileName(typedName: string, originalName: string) {
  const trimmed = typedName.trim();
  if (!trimmed) return originalName;

  const dot = originalName.lastIndexOf(".");
  const extension = dot > 0 ? originalName.slice(dot) : "";
  if (!extension || trimmed.toLowerCase().endsWith(extension.toLowerCase())) {
    return trimmed;
  }

  return `${trimmed}${extension}`;
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function describeUnacceptableFile(file: File) {
  if (!ACCEPTED_CONTENT_TYPES.includes(file.type as never)) {
    return `${file.name} is not a supported file type. Allowed: ${ACCEPTED_LABEL}.`;
  }
  if (file.size > MAX_FILE_BYTES) {
    return `${file.name} is ${formatFileSize(file.size)}. The limit is 50 MB.`;
  }
  return null;
}

/**
 * Keeps the stored object name readable without letting it steer the path.
 * Whitespace becomes dashes, then anything outside a conservative set is
 * dropped - which removes slashes, backslashes and control characters along
 * with everything else that has no business in a storage key.
 */
function safeStorageName(fileName: string) {
  const cleaned = fileName
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/^\.+/, "")
    .slice(-120);

  return cleaned || "file";
}

/**
 * Uploads to Supabase Storage from the browser and returns the stored path for
 * the caller to persist through POST /api/files.
 *
 * The first path segment must be an organization the caller belongs to: that
 * is what the tenant_storage_insert policy checks, and the route re-checks the
 * prefix before it writes the row. The storage error is surfaced in the
 * message rather than swallowed - "Bucket not found" is otherwise
 * indistinguishable from a network blip.
 */
export async function uploadOrganizationFile(file: File, bucket: string) {
  const rejection = describeUnacceptableFile(file);
  if (rejection) throw new Error(rejection);

  const organizationId = getCachedAuthSession()?.activeOrganizationId;
  if (!organizationId) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  const path = `${organizationId}/files/${crypto.randomUUID()}-${safeStorageName(file.name)}`;

  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    throw new Error(
      `${file.name} could not be uploaded${error.message ? ` (${error.message})` : ""}.`,
      { cause: error }
    );
  }

  return path;
}

/**
 * Opens a stored file through a short-lived signed URL from the API.
 *
 * authenticatedFetch rather than fetch: it carries the X-Organization-Id
 * header, without which a user who belongs to more than one organization
 * would be resolved against the wrong one.
 */
export async function openStoredFile(fileId: string) {
  const response = await authenticatedFetch(
    `/api/files?fileId=${encodeURIComponent(fileId)}`
  );
  if (!response.ok) {
    throw new Error("That file could not be opened.");
  }

  const { url } = (await response.json()) as { url?: string };
  if (!url) throw new Error("That file could not be opened.");

  window.open(url, "_blank", "noopener,noreferrer");
}
