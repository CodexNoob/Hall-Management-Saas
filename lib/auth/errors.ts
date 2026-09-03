/**
 * Authorization failures, in one place so both the request-time guards
 * (`lib/authz/authorize.ts`) and the provisioning path
 * (`lib/auth/provisioning.ts`) can throw the same types without importing each
 * other. `createApiErrorResponse` maps every one of these to its status, so a
 * route only has to let them escape.
 *
 * Deliberately free of `server-only`: `lib/http/api-error.ts` is imported from
 * modules that are not all server-scoped, and this file holds no secrets and
 * touches no request state.
 */
/**
 * A stable, machine-readable reason. The browser branches on this; it must never
 * branch on the prose, which is written for a human and changes freely.
 *
 * An authorization outcome is never a 500. If a handler can answer "an
 * unexpected server error occurred" for a mistyped id, the UI shows a crash
 * where it should show a message - and the operator learns to ignore both.
 */
export type AuthorizationErrorCode =
  /** No session, or a session with no principal. */
  | "unauthenticated"
  /** A valid Supabase identity with no row of ours, and no right to create one. */
  | "invitation_required"
  /** The user, or their last active membership, was switched off. */
  | "account_deactivated"
  /** The actor lacks the key guarding this endpoint. */
  | "not_permitted"
  /** The organization's plan does not include this feature. */
  | "not_entitled"
  /** The set being granted is not a subset of the actor's own (INV-6). */
  | "amplification"
  /** Acting on, or assigning, a role at or above the actor's own rank. */
  | "rank_ceiling"
  /** The actor is the subject of a privilege-increasing change. */
  | "self_elevation"
  /** Also the answer for a valid id in another tenant - existence is information. */
  | "not_found"
  /** A concurrent edit committed first. `details.currentEpoch` carries the truth. */
  | "epoch_stale"
  /** Deleting a role people still hold. */
  | "role_in_use"
  /** Renaming the key of, or deleting, a starter role. */
  | "system_role_immutable"
  /** The change would leave the organization with nobody holding `role.manage`. */
  | "last_owner"
  /** A key that is not in the catalog. Never silently dropped. */
  | "invalid_permission_key";

export class AuthorizationError extends Error {
  constructor(
    public readonly status: 401 | 403 | 404 | 409 | 422,
    message: string,
    /**
     * Optional so the ~40 existing call sites that predate coded errors keep
     * compiling. New throws in `lib/authz/` always carry one.
     */
    public readonly code?: AuthorizationErrorCode,
    /** Extra machine-readable context, e.g. `{ currentEpoch: 43 }`. */
    public readonly details?: Record<string, unknown>
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
      "No employee account was found for this email. Ask your organization administrator for an invitation.",
      "invitation_required"
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
    super(403, message, "account_deactivated");
    this.name = "AccountDeactivatedError";
  }
}
