import { completeAuthLink } from "@/lib/auth/complete-auth-link";

/**
 * Where OAuth returns land - `signInWithOAuthProvider` in lib/auth/client.ts
 * names this path - and where GoTrue sends any email link that still routes
 * through its own /verify endpoint.
 *
 * Same implementation as /auth/confirm. Both accept `token_hash` and `code`.
 */

export const dynamic = "force-dynamic";

export const GET = completeAuthLink;
