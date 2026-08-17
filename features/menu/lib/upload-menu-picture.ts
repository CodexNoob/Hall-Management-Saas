"use client";

import { getCachedAuthSession } from "@/lib/auth/client";
import { MENU_IMAGE_BUCKET } from "@/lib/storage/buckets";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * A card thumbnail, not a document - the 50 MB ceiling on /api/files is sized
 * for contracts and floor plans.
 */
const MAX_PICTURE_BYTES = 5 * 1024 * 1024;

/**
 * Keyed by content type rather than read off the file name, so an upload
 * cannot carry its own extension into the bucket.
 */
const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

/**
 * Uploads straight from the browser to Supabase Storage and returns the stored
 * path for the caller to persist.
 *
 * Nothing is proxied through Next: the tenant_storage_insert policy in
 * prisma/supabase-rls.sql already requires the first path segment to be an
 * organization the caller belongs to, and the browser client carries the cookie
 * session, so the write runs as `authenticated` and that policy applies. The
 * server re-checks the prefix before it stores the path.
 */
export async function uploadMenuPicture(file: File) {
  const extension = EXTENSION_BY_CONTENT_TYPE[file.type];
  if (!extension) {
    throw new Error("Pictures must be a JPEG, PNG or WebP image.");
  }

  if (file.size > MAX_PICTURE_BYTES) {
    throw new Error("Pictures must be 5 MB or smaller.");
  }

  const organizationId = getCachedAuthSession()?.activeOrganizationId;
  if (!organizationId) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  // A fresh UUID per upload is what makes `upsert: false` safe.
  const path = `${organizationId}/menu/${crypto.randomUUID()}.${extension}`;

  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.storage
    .from(MENU_IMAGE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    throw new Error("The picture could not be uploaded. Please try again.", {
      cause: error
    });
  }

  return path;
}
