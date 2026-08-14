import { NextResponse, type NextRequest } from "next/server";
import {
  CONFIRMATION_PENDING_ERROR_CODE,
  isAuthCallbackType,
  isPasswordSetupFlow,
  type AuthCallbackType
} from "@/lib/auth/auth-callback-params";
import { getSafeDashboardReturnPath } from "@/lib/auth/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The one handler behind both /auth/confirm and /auth/callback.
 *
 * Two credential shapes arrive here and both are legitimate:
 *
 * - `token_hash` + `type` - what our email templates emit. Verified with
 *   verifyOtp, which needs nothing but the token, so the link works from any
 *   device. This is the shape that makes a staff invitation openable on a phone
 *   when it was sent from a desktop.
 * - `code` - PKCE. Produced by an OAuth return, and also by any email link that
 *   still routes through GoTrue's own /verify endpoint. Exchanged for a session
 *   using the `code_verifier` cookie, which only exists in the browser that
 *   started the flow.
 *
 * Serving both from one endpoint is deliberate. The alternative - each route
 * accepting only its own shape - means a link that is entirely valid gets
 * rejected for arriving at the neighbouring path, which is a failure mode with
 * no useful diagnosis attached to it.
 */

function authErrorRedirect(
  request: NextRequest,
  errorCode: string,
  errorDescription: string
) {
  const url = new URL("/auth/auth-error", request.nextUrl);
  url.searchParams.set("error_code", errorCode);
  url.searchParams.set("error_description", errorDescription);

  return NextResponse.redirect(url);
}

/**
 * `next` is honoured when present but is not how the destination is normally
 * decided - the email templates build their links as
 * `{{ .RedirectTo }}?token_hash=...&type=...`, so a redirectTo carrying its own
 * query string would produce a URL with two `?`. The producers therefore pass a
 * bare origin + path.
 *
 * When `type` is absent - a bare PKCE `?code=` return carries no type -
 * /dashboard is the right answer rather than a guess. The dashboard layout is
 * the authoritative gate and redirects onward by itself: to /dashboard/new for
 * an owner who has not named their organization, and to /set-password for an
 * account with no password of its own.
 */
function destinationFor(type: AuthCallbackType, next: string | null) {
  if (isPasswordSetupFlow(type)) {
    // Invite and recovery links only prove the address; the account still has
    // no password of its own. Recovery in particular cannot be left to the
    // dashboard gate - the user already has a password, so nothing downstream
    // would send them to set a new one.
    const suffix = next
      ? `&next=${encodeURIComponent(getSafeDashboardReturnPath(next))}`
      : "";

    return `/set-password?flow=${type}${suffix}`;
  }

  if (type === "signup" && !next) {
    return "/dashboard/new";
  }

  return getSafeDashboardReturnPath(next);
}

export async function completeAuthLink(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  // `type` comes straight off the query string, so narrow it against the
  // supported list rather than casting an attacker-supplied string into
  // verifyOtp.
  const rawType = searchParams.get("type");
  const type = isAuthCallbackType(rawType) ? rawType : null;

  // Supabase reports a link it rejected outright in the URL itself and never
  // mints a credential for it. Read that first, so a precise reason ("link has
  // expired") is not replaced by the generic message below.
  const errorDescription =
    searchParams.get("error_description") ?? searchParams.get("error");

  if (errorDescription) {
    return authErrorRedirect(
      request,
      searchParams.get("error_code") ?? "verification_failed",
      errorDescription
    );
  }

  if (tokenHash && !type) {
    return authErrorRedirect(
      request,
      "unsupported_type",
      "This link is not a kind we recognize. Request a new one."
    );
  }

  if (!tokenHash && !code) {
    // Also the health check for the template cutover: this must redirect, not
    // 404, before any email template is repointed here.
    return authErrorRedirect(
      request,
      "missing_token",
      "This link is incomplete. Request a new one and open it directly from your email."
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } =
    tokenHash && type
      ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      : await supabase.auth.exchangeCodeForSession(code as string);

  if (error) {
    return authErrorRedirect(
      request,
      error.code ?? "verification_failed",
      error.message
    );
  }

  // Branch on the session, not just on the error. With Supabase's default
  // "Secure email change" the first of the two confirmations succeeds with no
  // session at all, and redirecting to the dashboard there drops the user back
  // at login with nothing to explain it.
  if (!data.session) {
    return authErrorRedirect(
      request,
      CONFIRMATION_PENDING_ERROR_CODE,
      "No session was started for this link."
    );
  }

  // Built from `type` and the sanitized `next` only - neither the token hash
  // nor the code may survive onto the redirect, or they land in browser history
  // and in any Referer the destination page sends.
  return NextResponse.redirect(
    new URL(destinationFor(type, next), request.nextUrl)
  );
}
