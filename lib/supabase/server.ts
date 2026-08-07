import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";

const serverAuthOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
} as const;

export function createSupabaseTokenVerifier() {
  const env = getEnv();

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Supabase public authentication credentials are not configured.");
  }

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serverAuthOptions
  );
}

export function createSupabaseServiceClient() {
  const env = getEnv();
  const secretKey = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !secretKey) {
    throw new Error("Supabase service credentials are not configured.");
  }

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, secretKey, serverAuthOptions);
}
