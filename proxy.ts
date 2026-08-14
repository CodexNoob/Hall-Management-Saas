import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next 16 renamed the `middleware` file convention to `proxy`. The export must
 * be named `proxy` (or be the default) - Next resolves it as
 * `(isProxy ? mod.proxy : mod.middleware) || mod.default` and throws at build
 * time otherwise. `config.matcher` is unchanged.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Navigations only. Everything below is excluded on purpose:
     *
     * - `api/**` - the single most important exclusion. Every route handler
     *   already resolves the user itself, so matching API calls would put a
     *   second round trip to Supabase in front of all 39 of them. Worse, a
     *   dashboard that fires 21 queries at once against an expired token would
     *   have N requests each racing to refresh with the same refresh token,
     *   and every loser gets "Already Used". This also keeps the Stripe webhook
     *   (signature-verified, no session) and the health check untouched.
     * - `_next/static`, `_next/image`, `images/`, `sw.js` and image/font files
     *   - static assets that carry no session and would only burn invocations.
     */
    "/((?!api/|_next/static|_next/image|images/|favicon.ico|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf)$).*)"
  ]
};
