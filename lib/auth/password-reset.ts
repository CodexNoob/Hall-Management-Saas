import {
  generatePasswordResetLink,
  staffInviteRedirectTo
} from "@/features/administration/server/staff-invitations";
import { getEnv } from "@/lib/env";
import { trackOutbound } from "@/lib/logging/outbound";
import {
  createSupabaseServiceClient,
  createSupabaseTokenVerifier
} from "@/lib/supabase/server";

/**
 * Password-reset delivery, shared by "Forgot your current password?" on My
 * Account and "Send password reset" on the Staff page.
 *
 * Both land on the same place the logged-out Forgot Password page does: the
 * emailed link goes to /auth/confirm, which verifies it and hands over to the
 * existing Set Password screen in its `recovery` flow. Nothing here decides WHO
 * may be reset - the routes do that before calling in. The address is always
 * one the route read from the database, never one the request supplied.
 */

function resetRedirectTo() {
  return staffInviteRedirectTo(getEnv().NEXT_PUBLIC_APP_URL);
}

/** Sends Supabase's reset email. `error` is its message when it refused. */
export async function sendPasswordResetEmail(email: string) {
  const { error } = await trackOutbound(
    { vendor: "supabase", operation: "auth.resetPasswordForEmail" },
    () =>
      createSupabaseTokenVerifier().auth.resetPasswordForEmail(email, {
        redirectTo: resetRedirectTo()
      })
  );

  return { error: error?.message ?? null };
}

/**
 * A reset link to pass on by hand, for when email is not an option.
 *
 * Replaces any reset token already emailed - so a link emailed a minute ago
 * stops working once this runs. That is the right outcome: only one way in is
 * live at a time.
 */
export async function createPasswordResetLink(email: string) {
  const admin = createSupabaseServiceClient().auth.admin;

  return trackOutbound(
    { vendor: "supabase", operation: "auth.admin.generateLink.recovery" },
    () => generatePasswordResetLink(admin, email, resetRedirectTo())
  );
}
