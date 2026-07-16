import { createSupabaseServiceClient } from "@/lib/supabase/server";

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
  if (!path.startsWith(`${organizationId}/`)) {
    throw new Error("Storage paths must be scoped to the active organization.");
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error) {
    throw error;
  }

  return data.signedUrl;
}
