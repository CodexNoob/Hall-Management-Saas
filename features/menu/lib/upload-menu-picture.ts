"use client";

import { getCachedAuthSession } from "@/lib/auth/client";
import { MENU_IMAGE_BUCKET } from "@/lib/storage/buckets";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * A card thumbnail, not a document - the 50 MB ceiling on /api/files is sized
 * for contracts and floor plans.
 */
export const MAX_PICTURE_BYTES = 5 * 1024 * 1024;

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
 * For the picker's `accept`, which matches on extension as well as type - the
 * same shape the files picker uses.
 */
export const PICTURE_ACCEPT_ATTRIBUTE = [
  ...Object.keys(EXTENSION_BY_CONTENT_TYPE),
  ".jpg",
  ".jpeg",
  ".png",
  ".webp"
].join(",");

export const PICTURE_ACCEPTED_LABEL = "JPEG, PNG or WebP";

/**
 * Why a picture cannot be uploaded, or null when it can.
 *
 * Split out of the upload so the picker can refuse a file the moment it is
 * chosen rather than at save time: the two used to disagree by the whole length
 * of a form, and a 12 MB photo was only rejected after the operator had filled
 * in the counting rules.
 */
export function describeUnacceptablePicture(file: File) {
  if (!EXTENSION_BY_CONTENT_TYPE[file.type]) {
    return "Pictures must be a JPEG, PNG or WebP image.";
  }

  if (file.size > MAX_PICTURE_BYTES) {
    return "Pictures must be 5 MB or smaller.";
  }

  return null;
}

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
  // Re-checked here and not only in the picker: this is the last line before
  // the bucket, and nothing stops another caller from arriving with a file the
  // picker never saw.
  const rejection = describeUnacceptablePicture(file);
  if (rejection) {
    throw new Error(rejection);
  }

  const extension = EXTENSION_BY_CONTENT_TYPE[file.type];

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
