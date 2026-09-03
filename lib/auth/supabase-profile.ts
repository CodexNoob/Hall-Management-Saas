import type { User } from "@supabase/supabase-js";
import { OWNER_ACCOUNT_TYPE } from "@/lib/auth/owner-signup";
import { phoneSchema } from "@/lib/validation/phone";

/**
 * Layer 2a: everything provisioning needs to know about a Supabase account,
 * extracted and validated once.
 *
 * Pulling this out of the route turns "what does Supabase actually give us"
 * into a value with a name. It is a pure function of the Supabase user, so the
 * awkward cases - a display name in either of two metadata keys, an unusable
 * phone number, an OAuth-only account - are testable without a database or an
 * HTTP request.
 */
export type SupabaseProfile = {
  authUserId: string;
  email: string;
  /**
   * The display name Supabase supplied, or null when it supplied none. Kept
   * separate from `name` because the difference decides whether we write:
   * invited staff carry no auth metadata, and mirroring the fallback over the
   * name an administrator typed would quietly overwrite it on every sign-in.
   */
  metadataName: string | null;
  /** `metadataName`, or the email local part - only ever used when creating. */
  name: string;
  phone: string | null;
  venueName: string | null;
  /** True only for the owner sign-up flow, which may create an organization. */
  isOwnerSignUp: boolean;
  /**
   * Whether a password is applicable at all. Users who only ever authenticate
   * through an OAuth provider never need a password of their own, so they must
   * not be pushed into password setup.
   */
  usesEmailPassword: boolean;
  /** Supabase's own sign-in stamp - the only reliable "this is a new session". */
  lastSignInAt: Date | null;
};

function readTrimmedString(source: unknown, key: string): string | null {
  const value = (source as Record<string, unknown> | null | undefined)?.[key];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function parseSupabaseProfile(user: User): SupabaseProfile {
  const metadata = user.user_metadata ?? {};
  const email = user.email!;
  const metadataName =
    readTrimmedString(metadata, "full_name") ??
    readTrimmedString(metadata, "name");
  const rawPhone = readTrimmedString(metadata, "phone");
  const providers = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers.filter(
        (provider): provider is string => typeof provider === "string"
      )
    : [];

  return {
    authUserId: user.id,
    email,
    metadataName,
    name: metadataName ?? email.split("@")[0],
    // Mirrored from Supabase metadata rather than typed into a form here, so a
    // bad value is dropped instead of failing the sync - refusing to mirror an
    // account because of an unusable phone would lock the user out entirely.
    // It is still normalized, so anything stored matches the forms' format.
    phone: rawPhone ? (phoneSchema().safeParse(rawPhone).data ?? null) : null,
    venueName: readTrimmedString(metadata, "venue_name"),
    isOwnerSignUp:
      readTrimmedString(metadata, "account_type") === OWNER_ACCOUNT_TYPE,
    usesEmailPassword: providers.length === 0 || providers.includes("email"),
    lastSignInAt: user.last_sign_in_at ? new Date(user.last_sign_in_at) : null
  };
}
