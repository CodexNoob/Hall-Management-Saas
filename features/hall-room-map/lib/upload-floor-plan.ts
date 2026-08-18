"use client";

import { getCachedAuthSession } from "@/lib/auth/client";
import { HALL_FLOOR_PLAN_BUCKET } from "@/lib/storage/buckets";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * A floor plan is a photo or an exported PDF page rendered to an image; give
 * it more headroom than a card thumbnail but stay far under the 50 MB
 * document ceiling on /api/files.
 */
const MAX_FLOOR_PLAN_BYTES = 10 * 1024 * 1024;

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

/**
 * Uploads straight from the browser to Supabase Storage and returns the stored
 * path for the caller to persist on the preset. The tenant_storage_insert
 * policy requires the first path segment to be an organization the caller
 * belongs to, and the server re-checks the prefix before storing the path.
 *
 * The underlying storage error is surfaced in the message: the menu-picture
 * equivalent swallows it, and "Bucket not found" spent a day masquerading as
 * a transient failure because of that.
 */
export async function uploadHallFloorPlan(file: File) {
  const extension = EXTENSION_BY_CONTENT_TYPE[file.type];
  if (!extension) {
    throw new Error("Floor plans must be a JPEG, PNG or WebP image.");
  }

  if (file.size > MAX_FLOOR_PLAN_BYTES) {
    throw new Error("Floor plans must be 10 MB or smaller.");
  }

  const organizationId = getCachedAuthSession()?.activeOrganizationId;
  if (!organizationId) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  const path = `${organizationId}/hall-maps/${crypto.randomUUID()}.${extension}`;

  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.storage
    .from(HALL_FLOOR_PLAN_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    throw new Error(
      `The floor plan could not be uploaded${error.message ? ` (${error.message})` : ""}.`,
      { cause: error }
    );
  }

  return path;
}

/** Short-lived signed URL for rendering the private floor plan. */
export async function getFloorPlanUrl(path: string) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.storage
    .from(HALL_FLOOR_PLAN_BUCKET)
    .createSignedUrl(path, 3600);

  if (error || !data?.signedUrl) return null;

  return data.signedUrl;
}
