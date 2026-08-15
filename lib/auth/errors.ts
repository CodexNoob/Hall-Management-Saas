/**
 * Authorization failures, in one place so both the request-time guards
 * (`lib/auth/server-auth.ts`) and the provisioning path
 * (`lib/auth/provisioning.ts`) can throw the same types without importing each
 * other. `createApiErrorResponse` maps every one of these to its status, so a
 * route only has to let them escape.
 *
 * Deliberately free of `server-only`: `lib/http/api-error.ts` is imported from
 * modules that are not all server-scoped, and this file holds no secrets and
 * touches no request state.
 */
export class AuthorizationError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * A stranger signed in with valid Supabase credentials and no row of ours.
 * Only the owner sign-up flow may create an organization from nothing;
 * everyone else has to be invited first, so this is where a typo'd work email
 * lands.
 */
export class InvitationRequiredError extends AuthorizationError {
  constructor() {
    super(
      403,
      "No employee account was found for this email. Ask your organization administrator for an invitation."
    );
    this.name = "InvitationRequiredError";
  }
}

/**
 * The account exists but has been switched off, either as a whole user or by
 * having its last active membership revoked.
 *
 * This has to be an error rather than a repair. `DELETE /api/staff` clears
 * `isActive` on our side and leaves the Supabase account alone, so a removed
 * employee keeps working credentials indefinitely - and provisioning runs
 * before any permission check the browser makes. Treating the flag as
 * something to heal on sign-in is what let a removed employee reinstate
 * themselves simply by signing in again.
 */
export class AccountDeactivatedError extends AuthorizationError {
  constructor(
    message = "This account has been deactivated. Ask your organization administrator to restore it."
  ) {
    super(403, message);
    this.name = "AccountDeactivatedError";
  }
}
