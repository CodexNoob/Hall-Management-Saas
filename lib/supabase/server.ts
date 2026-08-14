import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";
import {
  REMEMBER_AUTH_COOKIE,
  REMEMBER_UNTIL_COOKIE,
  authCookieMaxAge,
  mergeAuthCookieOptions
} from "@/lib/supabase/cookie-policy";

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

/**
 * Cookie-backed Supabase client for Server Components, Route Handlers and
 * Server Actions. Create it per request - unlike the browser client it must
 * never be memoised at module scope, or one request's session leaks into
 * another's.
 *
 * Always resolve identity from this client with `getUser()`, never
 * `getSession()`: only getUser revalidates the JWT against the Auth server,
 * where getSession trusts whatever the cookie happens to say.
 *
 * NOTE: createSupabaseTokenVerifier and createSupabaseServiceClient above are
 * deliberately left alone. Both are stateless by design - giving the service
 * client a cookie jar would leak the acting user's session into service-role
 * operations (storage signed URLs, auth.admin invitations).
 */
export async function createSupabaseServerClient() {
  const env = getEnv();

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Supabase public authentication credentials are not configured.");
  }

  const cookieStore = await cookies();
  // Same source of truth the staff-invitation links already use for "what is
  // our origin", rather than NODE_ENV - `next build && next start` over http
  // reports production, and a Secure cookie is silently dropped there.
  const isSecure = env.NEXT_PUBLIC_APP_URL.startsWith("https:");

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          const maxAge = authCookieMaxAge(
            cookieStore.get(REMEMBER_AUTH_COOKIE)?.value,
            cookieStore.get(REMEMBER_UNTIL_COOKIE)?.value
          );

          try {
            for (const { name, value, options } of cookiesToSet) {
              const merged = mergeAuthCookieOptions(
                options as Record<string, unknown>,
                value,
                isSecure,
                maxAge
              );

              cookieStore.set(
                name,
                value,
                merged as Parameters<typeof cookieStore.set>[2]
              );
            }
          } catch {
            // Server Components render with a read-only cookie store, so this
            // throws there and only there. Safe to swallow: middleware refreshes
            // the session on the same request, so nothing is actually lost.
            //
            // Route handlers are a different matter - a swallowed write there
            // means a successful sign-in that mints no cookie. They assert the
            // session landed before redirecting rather than relying on this.
          }
        }
      }
    }
  );
}
