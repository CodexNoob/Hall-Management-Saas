/**
 * The one flag that authorizes creating an organization from nothing, and the
 * only way an OAuth round trip can carry it.
 *
 * Deliberately not a "use client" module, and deliberately free of `server-only`:
 * the sign-up form sets this, /auth/callback stamps it after a social sign-up,
 * and parseSupabaseProfile reads it. Three files on both sides of the boundary
 * used to spell the literal out themselves, which is one rename away from a
 * sign-up that quietly stops provisioning anything.
 */
export const OWNER_ACCOUNT_TYPE = "organization_owner";

/**
 * `signInWithOAuth` has no equivalent of `signUp`'s `options.data` - a provider
 * round trip cannot carry user metadata. The redirect URL is the only thing that
 * survives it, so the intent rides there and /auth/callback writes the metadata
 * on the way back, once a session exists to write it with.
 *
 * That makes the flag client-supplied. So is the email path's: `signUp({ options:
 * { data } })` is written by the browser too, so this grants no capability that
 * /signup did not already have - anyone who can complete a Google sign-in can
 * open a tenant, exactly as anyone with an email address can. It is also nothing
 * an existing account can be talked into, because provisioning consults the flag
 * only when no row of ours matches the identity at all; an employee's sign-in
 * never reaches that branch.
 *
 * Both Google buttons send it - /login as well as /signup. The provider has no
 * notion of which page you started on, and neither does anyone clicking it, so
 * splitting the behaviour by page only produced a sign-in that authenticated you
 * successfully and then refused you. What the flag guards is the OTHER
 * direction: /auth/callback also completes invitations, recovery and email
 * changes, and none of those may create an organization.
 */
export const OWNER_INTENT_PARAM = "intent";

/**
 * "organization", not "owner": `owner` is a starter ROLE key, and INV-1
 * (tests/unit/authz-no-role-names.test.ts) keeps role names out of application
 * code. The distinction is real rather than cosmetic - this flag says an
 * organization is being created, and what its creator may then DO is decided by
 * the founding role assignment, not by this word.
 */
export const ORGANIZATION_SIGNUP_INTENT = "organization";

export function isOwnerIntent(value: string | null | undefined) {
  return value === ORGANIZATION_SIGNUP_INTENT;
}
