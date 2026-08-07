import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getEnv } from "@/lib/env";

export type SignedFileUrlInput = {
  organizationId: string;
  bucket: string;
  path: string;
  expiresInSeconds?: number;
};

export async function createSignedFileUrl({
  organizationId,
  bucket,
  path,
  expiresInSeconds = 300
}: SignedFileUrlInput) {
  if (
    !path.startsWith(`${organizationId}/`) ||
    path.includes("..") ||
    path.includes("\\")
  ) {
    throw new Error("Storage paths must be scoped to the active organization.");
  }

  const env = getEnv();
  const allowedBuckets = new Set([
    env.SUPABASE_STORAGE_BUCKET_FILES,
    env.SUPABASE_STORAGE_BUCKET_LAYOUTS,
    env.SUPABASE_STORAGE_BUCKET_PDFS
  ]);
  if (!allowedBuckets.has(bucket)) {
    throw new Error("Storage bucket is not allowed.");
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, Math.min(300, Math.max(30, expiresInSeconds)));

  if (error) {
    throw error;
  }

  return data.signedUrl;
}
