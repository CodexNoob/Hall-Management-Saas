import { completeAuthLink } from "@/lib/auth/complete-auth-link";

/**
 * Where our email templates point: signup confirmations, staff invitations,
 * password resets, magic links and email changes.
 *
 * Shares its implementation with /auth/callback so that a link is judged on the
 * credential it carries, not on which of the two paths it happened to name.
 */

export const dynamic = "force-dynamic";

export const GET = completeAuthLink;
