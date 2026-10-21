"use client";

import { getCachedAuthSession } from "@/lib/auth/client";
import { ORGANIZATION_LOGO_BUCKET } from "@/lib/storage/buckets";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ambientTranslate } from "@/lib/i18n/ambient";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * A logo is drawn at avatar size wherever it appears, so it needs less headroom
 * than a menu photograph - and a 5 MB logo is a photograph someone mistook for
 * one.
 */
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/**
 * The portal header background gets more room than the logo: it is drawn across
 * the full width of the portal, so it is the one branding image that really is
 * a photograph.
 */
export const MAX_PORTAL_HEADER_BYTES = 5 * 1024 * 1024;

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
export const BRANDING_ACCEPT_ATTRIBUTE = [
  ...Object.keys(EXTENSION_BY_CONTENT_TYPE),
  ".jpg",
  ".jpeg",
  ".png",
  ".webp"
].join(",");

export const BRANDING_ACCEPTED_LABEL = "JPEG, PNG or WebP";

/**
 * Why a branding image cannot be uploaded, or null when it can.
 *
 * Split out of the upload so the picker can refuse a file the moment it is
 * chosen: the settings form has one Save for the whole General section, and a
 * file rejected there would surface as a failed save of everything else too.
 *
 * `subject` and `maxLabel` are in the message because the two pickers sit on
 * the same screen: "The image must be smaller" would leave an operator looking
 * for which of the two refused them.
 */
export function describeUnacceptableImage(
  file: File,
  { subjectKey, maxBytes }: { subjectKey: MessageKey; maxBytes: number }
) {
  const subject = ambientTranslate(subjectKey);

  if (!EXTENSION_BY_CONTENT_TYPE[file.type]) {
    return ambientTranslate("files.brandingType", { subject });
  }

  if (file.size > maxBytes) {
    return ambientTranslate("files.brandingSize", {
      mb: Math.round(maxBytes / (1024 * 1024)),
      subject
    });
  }

  return null;
}

export function describeUnacceptableLogo(file: File) {
  return describeUnacceptableImage(file, {
    subjectKey: "settings.subjectLogo",
    maxBytes: MAX_LOGO_BYTES
  });
}

export function describeUnacceptablePortalHeaderImage(file: File) {
  return describeUnacceptableImage(file, {
    subjectKey: "settings.subjectHeaderImage",
    maxBytes: MAX_PORTAL_HEADER_BYTES
  });
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
 *
 * One bucket for both the logo and the portal header image. A second bucket
 * would have to be created by hand in the Supabase dashboard - nothing in this
 * repo provisions storage.buckets - and both are the same thing to storage: an
 * organization's own branding, private, addressed by an org-id prefix.
 */
async function uploadBrandingImage(
  file: File,
  {
    rejection,
    namePrefix
  }: {
    rejection: string | null;
    /** Distinguishes the two kinds inside the shared `branding/` folder. */
    namePrefix: string;
  }
) {
  // Re-checked here and not only in the picker: this is the last line before
  // the bucket, and nothing stops another caller from arriving with a file the
  // picker never saw.
  if (rejection) {
    throw new Error(rejection);
  }

  const extension = EXTENSION_BY_CONTENT_TYPE[file.type];

  const organizationId = getCachedAuthSession()?.activeOrganizationId;
  if (!organizationId) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  // A fresh UUID per upload is what makes `upsert: false` safe.
  const path = `${organizationId}/branding/${namePrefix}${crypto.randomUUID()}.${extension}`;

  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.storage
    .from(ORGANIZATION_LOGO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    // The underlying message is surfaced, the way the floor-plan upload learned
    // to: "Bucket not found" is an operator's task, not a transient failure to
    // retry, and swallowing it hides which of the two this is.
    throw new Error(
      `The image could not be uploaded${error.message ? ` (${error.message})` : ""}.`,
      { cause: error }
    );
  }

  return path;
}

export async function uploadOrganizationLogo(file: File) {
  return uploadBrandingImage(file, {
    rejection: describeUnacceptableLogo(file),
    namePrefix: ""
  });
}

export async function uploadPortalHeaderImage(file: File) {
  return uploadBrandingImage(file, {
    rejection: describeUnacceptablePortalHeaderImage(file),
    namePrefix: "portal-header-"
  });
}

/** Short-lived signed URL for rendering a private branding image. */
export async function getOrganizationBrandingUrl(path: string) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.storage
    .from(ORGANIZATION_LOGO_BUCKET)
    .createSignedUrl(path, 3600);

  if (error || !data?.signedUrl) return null;

  return data.signedUrl;
}
