import { createSupabaseServiceClient } from "@/lib/supabase/server";

export type SignedFileUrlInput = {
  bucket: string;
  path: string;
  expiresInSeconds?: number;
};

export async function createSignedFileUrl({ bucket, path, expiresInSeconds = 300 }: SignedFileUrlInput) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);

  if (error) {
    throw error;
  }

  return data.signedUrl;
}
