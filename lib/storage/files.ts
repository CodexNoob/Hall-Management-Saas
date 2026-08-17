import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getEnv } from "@/lib/env";
import { MENU_IMAGE_BUCKET } from "@/lib/storage/buckets";

export type SignedFileUrlInput = {
  organizationId: string;
  bucket: string;
  path: string;
  expiresInSeconds?: number;
};

export type SignedFileUrlsInput = {
  organizationId: string;
  bucket: string;
  paths: string[];
  expiresInSeconds?: number;
};

/**
 * Shared by both signers so the two cannot drift: a path that one refuses must
 * not be one the other hands out a URL for.
 */
function assertReadable(
  organizationId: string,
  bucket: string,
  paths: string[]
) {
  for (const path of paths) {
    if (
      !path.startsWith(`${organizationId}/`) ||
      path.includes("..") ||
      path.includes("\\")
    ) {
      throw new Error(
        "Storage paths must be scoped to the active organization."
      );
    }
  }

  const env = getEnv();
  const allowedBuckets = new Set([
    env.SUPABASE_STORAGE_BUCKET_FILES,
    env.SUPABASE_STORAGE_BUCKET_LAYOUTS,
    env.SUPABASE_STORAGE_BUCKET_PDFS,
    MENU_IMAGE_BUCKET
  ]);
  if (!allowedBuckets.has(bucket)) {
    throw new Error("Storage bucket is not allowed.");
  }
}

function clampExpiry(expiresInSeconds: number) {
  return Math.min(300, Math.max(30, expiresInSeconds));
}

export async function createSignedFileUrl({
  organizationId,
  bucket,
  path,
  expiresInSeconds = 300
}: SignedFileUrlInput) {
  assertReadable(organizationId, bucket, [path]);

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, clampExpiry(expiresInSeconds));

  if (error) {
    throw error;
  }

  return data.signedUrl;
}

/**
 * One request for many paths, for list views that would otherwise sign each row
 * separately.
 *
 * Returns a path -> URL Map rather than an array so callers can look up by the
 * path they already hold. Entries Supabase reports an error for are omitted
 * instead of throwing: a single object deleted out from under the database
 * should blank one thumbnail, not the whole grid.
 */
export async function createSignedFileUrls({
  organizationId,
  bucket,
  paths,
  expiresInSeconds = 300
}: SignedFileUrlsInput) {
  const signedUrlsByPath = new Map<string, string>();
  if (paths.length === 0) {
    return signedUrlsByPath;
  }

  assertReadable(organizationId, bucket, paths);

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(paths, clampExpiry(expiresInSeconds));

  if (error) {
    throw error;
  }

  for (const entry of data ?? []) {
    if (entry.error || !entry.path || !entry.signedUrl) continue;
    signedUrlsByPath.set(entry.path, entry.signedUrl);
  }

  return signedUrlsByPath;
}
