"use client";

import { getCachedAuthSession } from "@/lib/auth/client";
import { ORGANIZATION_LOGO_BUCKET } from "@/lib/storage/buckets";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * A logo is drawn at avatar size wherever it appears, so it needs less headroom
 * than a menu photograph - and a 5 MB logo is a photograph someone mistook for
 * one.
 */
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/**
 * Keyed by content type rather than read off the file name, so an upload cannot
 * carry its own extension into the bucket.
 */
const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

/** For the picker's `accept`, which matches on extension as well as type. */
export const LOGO_ACCEPT_ATTRIBUTE = [
  ...Object.keys(EXTENSION_BY_CONTENT_TYPE),
  ".jpg",
  ".jpeg",
  ".png",
  ".webp"
].join(",");

export const LOGO_ACCEPTED_LABEL = "JPEG, PNG or WebP";

/**
 * Why a logo cannot be uploaded, or null when it can.
 *
 * Split out of the upload so the picker can refuse a file the moment it is
 * chosen: the settings form has one Save for the whole General section, and a
 * file rejected there would surface as a failed save of everything else too.
 */
export function describeUnacceptableLogo(file: File) {
  if (!EXTENSION_BY_CONTENT_TYPE[file.type]) {
    return "The logo must be a JPEG, PNG or WebP image.";
  }

  if (file.size > MAX_LOGO_BYTES) {
    return "The logo must be 2 MB or smaller.";
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
 * settings handler re-checks the prefix before it stores the path.
 */
export async function uploadOrganizationLogo(file: File) {
  // Re-checked here and not only in the picker: this is the last line before
  // the bucket, and nothing stops another caller from arriving with a file the
  // picker never saw.
  const rejection = describeUnacceptableLogo(file);
  if (rejection) {
    throw new Error(rejection);
  }

  const extension = EXTENSION_BY_CONTENT_TYPE[file.type];

  const organizationId = getCachedAuthSession()?.activeOrganizationId;
  if (!organizationId) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  // A fresh UUID per upload is what makes `upsert: false` safe.
  const path = `${organizationId}/branding/${crypto.randomUUID()}.${extension}`;

  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.storage
    .from(ORGANIZATION_LOGO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    // The underlying message is surfaced, the way the floor-plan upload learned
    // to: "Bucket not found" is an operator's task, not a transient failure to
    // retry, and swallowing it hides which of the two this is.
    throw new Error(
      `The logo could not be uploaded${error.message ? ` (${error.message})` : ""}.`,
      { cause: error }
    );
  }

  return path;
}

/** Short-lived signed URL for rendering the private logo. */
export async function getOrganizationLogoUrl(path: string) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.storage
    .from(ORGANIZATION_LOGO_BUCKET)
    .createSignedUrl(path, 3600);

  if (error || !data?.signedUrl) return null;

  return data.signedUrl;
}
