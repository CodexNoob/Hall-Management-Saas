import "server-only";

import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { AuthorizationError } from "@/lib/auth/errors";
import { bindActor, log } from "@/lib/logging/context";
import { getBearerToken, resolveAuthIdentity } from "@/lib/auth/identity";
import { mfaObligation } from "@/lib/auth/mfa";
import {
  DEVICE_COOKIE,
  hashDeviceSecret,
  isDeviceConfirmationEnforced,
  parseDeviceSecret,
  readDeviceSecret
} from "@/lib/auth/device-identity";
import {
  isDeviceTrusted,
  isMfaRememberedOnDevice
} from "@/lib/auth/device-trust-policy";
import { isSessionExpiredByInactivity } from "@/lib/auth/inactivity";
import { ACTIVE_ORGANIZATION_COOKIE } from "@/lib/supabase/cookie-policy";
import type { PermissionKey } from "@/lib/authz/catalog";
import { isEntitled } from "@/lib/authz/entitlement";
import {
  decideForPrincipal,
  effectiveAccessByPrincipal,
  type EffectiveAccess,
  type ResolvedPrincipal
} from "@/lib/authz/decide";
import {
  UNSCOPED,
  scopeDimensionKey,
  type DenialReason,
  type ScopeDimension,
  type ScopeFilter
} from "@/lib/authz/types";

/**
 * The two helpers every route calls, and the reason route forty-nine cannot
 * forget.
 *
 * Routes never call `decide()`. They call `authorize()`, which resolves
 * identity, tenancy and permission together and throws on denial - and then they
 * compose the verdict into the query with `tenant()` and `scoped()`.
 *
 * `tenant(ctx)` and `scoped(ctx, dimension)` are small pure functions returning
 * Prisma `where` fragments, and they are the whole scalability story. They exist
 * so that the forty-ninth route added six months from now cannot forget the
 * tenant filter - because forgetting it means omitting a CALL that a test
 * enumerates for. An inline `organizationId: ctx.organizationId` is correct
 * today and unenumerable forever.
 */

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export type AuthzContext = {
  principalId: string;
  organizationId: string;
  organization: ResolvedPrincipal["organization"];
  /** Null for a service account. */
  userId: string | null;
  /** Null for a service account. Activity logs and audit copy quote it. */
  userEmail: string | null;
  /** The name the audit trail snapshots - a person's name or the token's label. */
  actorName: string;
  isServiceAccount: boolean;
  /**
   * The epoch the verdict was computed under. Every response that carries one
   * lets the browser notice it is behind and refetch its session, which is how a
   * revoked permission takes effect without a sign-out.
   */
  epoch: number;
  /** Null when the caller was authorized as a member rather than for a key. */
  permission: PermissionKey | null;
  /**
   * The filter the query layer applies. For `authorizeMember` this is `UNSCOPED`
   * - membership alone carries no scope, so a member-gated route must not
   * pretend to be narrowed.
   */
  scope: ScopeFilter;
};

/**
 * Service-account tokens are prefixed so a bearer header can be routed to the
 * right verifier without asking Supabase about a string that was never a JWT.
 */
export const SERVICE_TOKEN_PREFIX = "evc_sa_";

export function hashServiceToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// ---------------------------------------------------------------------------
// Denial
// ---------------------------------------------------------------------------

/**
 * Every denial reason gets a status and a machine-readable code. None of them
 * is a 500: if a handler can answer "an unexpected server error occurred" for a
 * caller who simply lacks a permission, the UI shows a crash where it should
 * show a message, and the operator learns to ignore both.
 */
function denialError(reason: DenialReason): AuthorizationError {
  switch (reason) {
    case "inactive":
      return new AuthorizationError(
        403,
        "This account has been deactivated. Ask your organization administrator to restore it.",
        "not_permitted"
      );
    case "no-membership":
      return new AuthorizationError(
        403,
        "You do not have access to the requested organization.",
        "not_permitted"
      );
    case "not-entitled":
      return new AuthorizationError(
        403,
        "Your plan does not include this feature.",
        "not_entitled"
      );
    case "expired":
      return new AuthorizationError(
        403,
        "Your access to this has expired.",
        "not_permitted"
      );
    case "no-permission":
    default:
      return new AuthorizationError(
        403,
        "You do not have permission to perform this action.",
        "not_permitted"
      );
  }
}

// ---------------------------------------------------------------------------
// Who is asking, and about which organization
// ---------------------------------------------------------------------------

type MembershipRow = {
  isActive: boolean;
  principalId: string;
  organizationId: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    subscriptionPlan: string | null;
    subscriptionStatus: string;
    permissionsEpoch: bigint;
    /**
     * Null for an organization that has never opened Settings - the row is
     * created on first save, not at sign-up.
     *
     * Required rather than optional on this type deliberately. Optional would
     * compile for a query that forgot to select it, and the two-factor policy
     * would then read as "not required" for every request that path serves.
     * A policy that fails open because of a missing `select` is the kind of
     * hole that never shows up in a test.
     */
    settings: {
      twoFactorRequired: boolean;
      sessionTimeoutMinutes: number;
    } | null;
  };
};

/**
 * Which organization this request acts on.
 *
 * An explicit `x-organization-id` header naming an organization the caller is
 * not a member of is a hard 403 - they asked for something specific and got it
 * wrong.
 *
 * The cookie is ambient state, so a stale one degrades to the default instead.
 * It goes stale the moment an administrator revokes a membership, and 403-ing
 * every request with no way for the user to clear it is a worse outcome than
 * quietly falling back. POST /api/auth/session re-stamps it, so it heals.
 */
function pickMembership(
  memberships: MembershipRow[],
  defaultOrganizationId: string,
  requestedOrganizationId: string | null,
  hintedOrganizationId: string | null
): MembershipRow {
  const find = (organizationId: string) =>
    memberships.find(
      (candidate) => candidate.organizationId === organizationId
    );

  if (requestedOrganizationId) {
    const requested = find(requestedOrganizationId);

    if (!requested) {
      throw new AuthorizationError(
        403,
        "You do not have access to the requested organization.",
        "not_permitted"
      );
    }

    return requested;
  }

  const hinted = hintedOrganizationId ? find(hintedOrganizationId) : undefined;
  if (hinted) return hinted;

  const fallback = find(defaultOrganizationId) ?? memberships[0];

  if (!fallback) {
    throw new AuthorizationError(
      403,
      "You do not have access to the requested organization.",
      "not_permitted"
    );
  }

  return fallback;
}

const ORGANIZATION_SELECT = {
  id: true,
  name: true,
  slug: true,
  isActive: true,
  subscriptionPlan: true,
  subscriptionStatus: true,
  permissionsEpoch: true,
  // Carried on both resolution paths so `MembershipRow` can demand it. A
  // service account never reaches the two-factor check, but a shared select
  // that omits the column would make the field optional for everyone.
  settings: {
    select: { twoFactorRequired: true, sessionTimeoutMinutes: true }
  }
} as const;

async function resolveServiceActor(
  token: string,
  requestedOrganizationId: string | null,
  now: Date
): Promise<ResolvedPrincipal> {
  const account = await prisma.serviceAccount.findUnique({
    where: { tokenHash: hashServiceToken(token) },
    select: {
      id: true,
      name: true,
      expiresAt: true,
      principalId: true,
      organizationId: true,
      organization: { select: ORGANIZATION_SELECT },
      principal: { select: { isActive: true } }
    }
  });

  // A bad token, a lapsed one, a switched-off principal and a token for another
  // tenant all answer the same way. Distinguishing them tells an attacker which
  // half of the credential was right.
  const usable =
    account &&
    account.principal.isActive &&
    account.organization.isActive &&
    (!account.expiresAt || account.expiresAt > now) &&
    (!requestedOrganizationId ||
      requestedOrganizationId === account.organizationId);

  if (!usable) {
    throw new AuthorizationError(
      401,
      "Invalid or expired service credential.",
      "unauthenticated"
    );
  }

  // A service account does not carry an ambient organization cookie: its tenant
  // is a property of the credential, which is the point of issuing one per
  // tenant.
  await prisma.serviceAccount.update({
    where: { id: account.id },
    data: { lastUsedAt: now }
  });

  return {
    principalId: account.principalId,
    organizationId: account.organizationId,
    userId: null,
    userEmail: null,
    displayName: account.name,
    permissionsEpoch: account.organization.permissionsEpoch,
    organization: {
      id: account.organization.id,
      name: account.organization.name,
      slug: account.organization.slug,
      subscriptionPlan: account.organization.subscriptionPlan,
      subscriptionStatus: account.organization.subscriptionStatus
    }
  };
}

/**
 * This browser's device hash, or "" (which matches no row) when there is no
 * device cookie. Read from the request, or - for callers without one - from
 * the cookie store, the same way the session token itself is.
 */
async function currentDeviceHash(request: Request | undefined) {
  const secret = request
    ? readDeviceSecret(request)
    : parseDeviceSecret((await cookies()).get(DEVICE_COOKIE)?.value);

  if (!secret) return "";

  try {
    return hashDeviceSecret(secret);
  } catch (hashError) {
    // No server secret configured. Fail closed rather than 500 every request:
    // no row matches, so the device gate refuses and nothing is remembered.
    log.warn({ err: String(hashError) }, "device_hash_unavailable");
    return "";
  }
}

async function resolveUserActor(
  request: Request | undefined,
  requestedOrganizationId: string | null,
  options: { allowUnsatisfiedMfa: boolean; allowUnconfirmedDevice: boolean }
): Promise<ResolvedPrincipal> {
  const { allowUnsatisfiedMfa, allowUnconfirmedDevice } = options;
  const identity = await resolveAuthIdentity(request);
  const enforceDevice =
    !allowUnconfirmedDevice && isDeviceConfirmationEnforced();
  // Read whenever there is a cookie, gate or not: the same row says whether
  // this device remembers the authenticator, which the 2FA check needs.
  const deviceHash = await currentDeviceHash(request);
  const now = new Date();

  const user = await prisma.user.findUnique({
    where: { supabaseAuthId: identity.id },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      organizationId: true,
      mfaEnrolledAt: true,
      /**
       * This request's own session row, for the inactivity check.
       *
       * Joined onto the query that was already being made rather than fetched
       * separately: this runs on every authenticated request, and an extra
       * round trip here is the hottest path in the application paying for a
       * setting most organizations leave alone.
       *
       * An empty string when the token carries no `session_id` claim, which
       * matches nothing - so an unidentifiable session produces no row, and no
       * row means "cannot tell", which fails open.
       */
      sessions: {
        where: { sessionId: identity.sessionId ?? "" },
        select: { lastActiveAt: true, sharedDevice: true },
        take: 1
      },
      /**
       * THIS browser's device row, for the device gate and for a remembered
       * authenticator - joined like the session above rather than fetched
       * separately. "" when there is no device cookie: it matches nothing, and
       * no row means "not trusted, nothing remembered".
       */
      devices: {
        where: { deviceHash },
        select: {
          confirmedAt: true,
          revokedAt: true,
          trustExpiresAt: true,
          mfaVerifiedAt: true
        },
        take: 1
      },
      memberships: {
        select: {
          isActive: true,
          principalId: true,
          organizationId: true,
          // The policy travels with the membership rather than in a second
          // query: this runs on every authenticated request, and the whole
          // reason `mfa_enrolled_at` is mirrored onto the user row is to keep
          // this path down to the one round trip it already made.
          organization: { select: ORGANIZATION_SELECT },
          principal: { select: { isActive: true } }
        }
      }
    }
  });

  if (!user) {
    throw new AuthorizationError(
      403,
      "User account is not provisioned.",
      "not_permitted"
    );
  }

  if (!user.isActive) {
    throw new AuthorizationError(
      403,
      "User account is inactive.",
      "not_permitted"
    );
  }

  const active = user.memberships.filter(
    (membership) =>
      membership.isActive &&
      membership.organization.isActive &&
      membership.principal.isActive
  );

  const membership = pickMembership(
    active,
    user.organizationId,
    requestedOrganizationId,
    (await cookies()).get(ACTIVE_ORGANIZATION_COOKIE)?.value ?? null
  );

  /**
   * THE SECOND FACTOR, ENFORCED.
   *
   * Here rather than in the sign-in form, because the form is a convenience
   * and this is the control. `signInWithPassword` mints a perfectly valid
   * session before any code is entered - a challenge that only the browser
   * performs is a dialog somebody can decline by calling the API directly.
   *
   * After `pickMembership` on purpose: the policy belongs to the organization
   * being acted in, and which one that is has only just been decided. A person
   * in two venues can owe a factor in one of them and not the other.
   *
   * Never applied to service accounts - they resolve through
   * `resolveServiceActor` and never reach this line. A machine cannot hold a
   * phone, and a token it was issued is the credential.
   */
  /**
   * SIGN OUT AFTER INACTIVITY, ENFORCED.
   *
   * Before this, `session_timeout_minutes` was stored, validated, audited,
   * rendered as a dropdown - and read by nothing. Somebody could set it to
   * fifteen minutes and believe they were protected.
   *
   * Here rather than in the browser for the same reason the two-factor check is
   * here: an idle timer in a tab is something an API client simply does not
   * run. The countdown people see is the courtesy; this is the control.
   *
   * After `pickMembership`, because the policy belongs to the organization
   * being acted in - somebody working in two venues can be held to a different
   * limit in each.
   *
   * EVERY UNCERTAIN CASE FAILS OPEN, inside `isSessionExpiredByInactivity`: no
   * timeout configured, no activity recorded, a clock that disagrees, a shared
   * display. Wrongly keeping a session alive leaves an unattended screen open a
   * little longer; wrongly ending one puts a kitchen mid-service in front of a
   * login form. Those costs are not comparable.
   */
  const currentSession = user.sessions[0];
  const device = user.devices[0];

  if (
    isSessionExpiredByInactivity({
      timeoutMinutes: membership.organization.settings?.sessionTimeoutMinutes,
      lastActiveAt: currentSession?.lastActiveAt,
      sharedDevice: currentSession?.sharedDevice,
      now
    })
  ) {
    throw new AuthorizationError(
      401,
      "You were signed out after a period of inactivity. Sign in again to continue.",
      "session_expired"
    );
  }

  if (!allowUnsatisfiedMfa) {
    // A trusted device on which the code was entered this trust period. The
    // organization-required case is refused inside `mfaObligation` anyway.
    const obligation = mfaObligation({
      assuranceLevel: identity.assuranceLevel,
      enrolled: Boolean(user.mfaEnrolledAt),
      requiredByOrganization: Boolean(
        membership.organization.settings?.twoFactorRequired
      ),
      rememberedOnDevice: isMfaRememberedOnDevice({
        device,
        mfaEnrolledAt: user.mfaEnrolledAt,
        now
      })
    });

    if (obligation === "challenge") {
      throw new AuthorizationError(
        403,
        "Enter the code from your authenticator app to continue.",
        "mfa_required"
      );
    }

    if (obligation === "enroll") {
      throw new AuthorizationError(
        403,
        "Your organization requires two-factor authentication. Set up an authenticator app to continue.",
        "mfa_enrollment_required"
      );
    }
  }

  /**
   * THE DEVICE GATE, ENFORCED - third, after the password and the second
   * factor, and never instead of either.
   *
   * Here rather than only in the dashboard for the reason the two-factor check
   * is here: a screen is something an API client does not have to look at.
   * Without this, a correct password from an unconfirmed browser could skip
   * the gate by calling the API directly.
   *
   * Trusted means confirmed, not removed, and inside the trust period - so a
   * removal or an expiry takes effect on the very next request, not at the
   * next sign-in.
   *
   * Only an explicitly named route escapes it (`allowUnconfirmedDevice`): the
   * device confirmation routes, the 2FA set-up routes that come before it, and
   * the password-setup bookkeeping an invite or recovery link ends with.
   * tests/unit/authz-route-coverage.test.ts pins that list.
   */
  if (enforceDevice) {
    if (!isDeviceTrusted(device, now)) {
      throw new AuthorizationError(
        403,
        "Confirm this device to continue. We sent a code to your email.",
        "device_confirmation_required"
      );
    }
  }

  return {
    principalId: membership.principalId,
    organizationId: membership.organizationId,
    userId: user.id,
    userEmail: user.email,
    displayName: user.name,
    permissionsEpoch: membership.organization.permissionsEpoch,
    organization: {
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      subscriptionPlan: membership.organization.subscriptionPlan,
      subscriptionStatus: membership.organization.subscriptionStatus
    }
  };
}

/**
 * Resolve the caller from whichever mechanism they used.
 *
 * Two of the four access mechanisms land here - session RBAC and service tokens
 * - and both become the same principal. The other two never do: a capability
 * link is the grant (one event, read-mostly, never a principal), and a platform
 * callback is not a tenant actor at all.
 *
 * This is also where the acting principal is bound onto the log scope, so every
 * line emitted for the rest of the request carries the tenant.
 *
 * Binding HERE rather than in `toContext()` is deliberate, and it is the whole
 * reason the binding is worth having: `authorize()` throws on a denial before it
 * ever builds a context, so a `toContext()` binding would tag every request
 * except the denied ones - and "who was refused" is the question the logs get
 * asked. Resolution is the last point common to both outcomes and to both
 * `authorize()` and `authorizeMember()`.
 *
 * A caller who is not a principal at all still throws out of the resolvers
 * below, unbound and correctly so: there is no tenant to name.
 */
export async function resolveActor(
  request?: Request,
  now: Date = new Date(),
  options: ResolveActorOptions = {}
): Promise<ResolvedPrincipal> {
  const requestedOrganizationId =
    request?.headers.get("x-organization-id")?.trim() || null;
  const bearer = request ? getBearerToken(request) : null;
  const principal = bearer?.startsWith(SERVICE_TOKEN_PREFIX)
    ? await resolveServiceActor(bearer, requestedOrganizationId, now)
    : await resolveUserActor(request, requestedOrganizationId, {
        allowUnsatisfiedMfa: Boolean(options.allowUnsatisfiedMfa),
        allowUnconfirmedDevice: Boolean(options.allowUnconfirmedDevice)
      });

  // A no-op outside a request scope, so a cron or a seed script is unaffected.
  // `userEmail` is deliberately not passed: it is personal data, it is on the
  // redact list, and the two ids are the debugging axis.
  bindActor({
    organizationId: principal.organizationId,
    userId: principal.userId,
    principalId: principal.principalId
  });

  return principal;
}

// ---------------------------------------------------------------------------
// The two helpers routes actually call
// ---------------------------------------------------------------------------

function toContext(
  principal: ResolvedPrincipal,
  permission: PermissionKey | null,
  scope: ScopeFilter
): AuthzContext {
  return {
    principalId: principal.principalId,
    organizationId: principal.organizationId,
    organization: principal.organization,
    userId: principal.userId,
    userEmail: principal.userEmail,
    actorName: principal.displayName,
    isServiceAccount: principal.userId === null,
    // Exact below 2^53, which no amount of privilege editing reaches.
    epoch: Number(principal.permissionsEpoch),
    permission,
    scope
  };
}

/**
 * The guard. One permission key, one verdict, and a context that carries the
 * filter the query needs.
 *
 * A POST asks for `event.create` and a GET asks for `event.read` - distinct
 * keys, so a write can no longer be gated by a read permission. That was a bug
 * that typechecked.
 */
export async function authorize(
  request: Request | undefined,
  permission: PermissionKey
): Promise<AuthzContext> {
  const principal = await resolveActor(request);
  const decision = await decideForPrincipal(principal, permission);

  if (!decision.allow) {
    // Not a duplicate of the `handled_route_error` line `api-error.ts` writes
    // for the error thrown on the next line, and not the case the "do not log
    // an error you are about to throw" rule is about. That line carries the
    // WIRE code, where four of the five denial reasons collapse into
    // `not_permitted`. This one carries the reason itself - the difference
    // between "their plan does not include this" and "nobody ever granted them
    // the key", which are the same 403 to the caller and completely different
    // answers to the venue asking why their staff member cannot see a screen.
    //
    // `resolveActor` has already bound the tenant, so this line names who was
    // refused as well as what for.
    log.warn({ reason: decision.reason, permission }, "authorization_denied");
    throw denialError(decision.reason);
  }

  return toContext(principal, permission, decision.scope);
}

/**
 * "An active member of this tenant, and nothing more."
 *
 * This is a real authorization decision - it denies strangers, deactivated
 * accounts and members of other organizations - it is simply not keyed on a
 * permission. It exists for the handful of routes where every employee is
 * legitimately entitled: filing a support ticket, reading their own session.
 *
 * It is NOT an escape hatch. Adding a call here instead of a key is visible in
 * the diff, and tests/unit/authz-route-coverage.test.ts lists every route that
 * uses it.
 */
export async function authorizeMember(
  request?: Request,
  options: ResolveActorOptions = {}
): Promise<AuthzContext> {
  const principal = await resolveActor(request, new Date(), options);

  return toContext(principal, null, UNSCOPED);
}

/**
 * The narrow opt-outs from the two-factor and device checks.
 *
 * Each is set only where refusing would be circular: the 2FA enrolment routes
 * (`POST /api/me/mfa`, `/api/me/security-code/*`) record the very factor the
 * policy asks for; the device routes confirm the device the gate asks about;
 * and `POST /api/auth/password-set` records the password an invite or recovery
 * link was opened to set - the dashboard holds a person on `/set-password`
 * until it has, so refusing it would trap them before either gate could show.
 * None of these serves any organization data.
 *
 * Two other things survive the check without needing this, and it is worth
 * knowing why. `POST /api/auth/session` never goes through the authorize layer
 * at all, which is what lets it be the endpoint that TELLS the browser what it
 * owes. And signing out is a Supabase call from the browser, so it touches no
 * route of ours - a person who owes a factor can always leave.
 *
 * It is a named option rather than a default so that adding a second is a line
 * in a diff somebody has to justify. `tests/unit/authz-route-coverage.test.ts`
 * pins the list.
 */
export type ResolveActorOptions = {
  /**
   * Skip the `aal` check for this call. NOT "this endpoint is less important" -
   * it means "refusing here would leave the user with no way to comply".
   */
  allowUnsatisfiedMfa?: boolean;
  /**
   * Skip the device gate for this call. Same rule: it means "refusing here
   * would leave the person no way to comply" - the routes that confirm a
   * device, and the 2FA set-up routes that must finish before it. Never a way
   * to serve data to an unconfirmed browser.
   */
  allowUnconfirmedDevice?: boolean;
};

/**
 * The acting user's id, for the columns that record WHO DID THIS.
 *
 * A service account has no user row, so a route that stamps `createdById` on
 * something has to say what it means for a machine caller. Where the column is
 * nullable, `ctx.userId` goes in directly and a machine-created record simply has
 * no author. Where it is not - because "some person did this" is part of the
 * record's meaning - this refuses the call rather than inventing an author.
 *
 * 403 rather than 401: the credential was fine, the ACTION is not one a machine
 * may take. Issue a person a token if a machine genuinely needs to do it.
 */
export function requireUserActor(context: AuthzContext): string {
  if (context.userId) return context.userId;

  throw new AuthorizationError(
    403,
    "This action has to be performed by a person, not a service account.",
    "not_permitted"
  );
}

/**
 * A SECOND question, asked by a route that is already through the door.
 *
 * Some screens are one page composed of two audiences: the dashboard is gated on
 * `calendar.read`, and its revenue tiles are a narrower question. Asking again is
 * cheap - the effective set is already cached under this request's epoch - and it
 * is the only correct way to do it. Inferring "they can see money because they
 * got past the calendar guard" is precisely how a view flag comes to gate a
 * write.
 *
 * Never a substitute for `authorize()`. This does not throw, so it must only ever
 * decide what to RENDER, never whether to let a mutation through.
 */
export async function hasPermission(
  context: AuthzContext,
  permission: PermissionKey
): Promise<boolean> {
  if (!isEntitled(context.organization, permission)) return false;

  const access = await effectiveAccessOf(context);

  return access.permissions.has(permission);
}

/**
 * The throwing form of `hasPermission`, for a handler whose body reaches past
 * what its door check covers.
 *
 * A PATCH that edits ordinary settings AND redirects where client payments land
 * is two decisions on one endpoint. Gating the door on the stricter of them
 * locks out everyone who only needed the looser one; gating it on the looser one
 * and stopping there is how a settings edit comes to move money. So: the door
 * asks for what every caller needs, and the branch that reaches further asks
 * again, here.
 */
export async function assertPermission(
  context: AuthzContext,
  permission: PermissionKey
): Promise<void> {
  if (await hasPermission(context, permission)) return;

  throw new AuthorizationError(
    403,
    "You do not have permission to perform this action.",
    "not_permitted"
  );
}

/**
 * The scope of a second permission, for a route that needs to filter by a key it
 * was not gated on. Null when the caller does not hold it at all.
 */
export async function scopeFor(
  context: AuthzContext,
  permission: PermissionKey
): Promise<ScopeFilter | null> {
  if (!isEntitled(context.organization, permission)) return null;

  const access = await effectiveAccessOf(context);

  return access.permissions.get(permission) ?? null;
}

/** Every key this caller holds - for the session response and the access screens. */
export function effectiveAccessOf(
  context: Pick<AuthzContext, "principalId" | "organizationId" | "epoch">
): Promise<EffectiveAccess> {
  return effectiveAccessByPrincipal(
    context.principalId,
    context.organizationId,
    BigInt(context.epoch)
  );
}

// ---------------------------------------------------------------------------
// Query fragments
// ---------------------------------------------------------------------------

/**
 * The tenant filter, as a call rather than an inline object.
 *
 * A route that omits this should fail a TEST, not a security review. That is the
 * entire justification for making it a function: `organizationId:
 * ctx.organizationId` written by hand is correct today and unenumerable forever.
 */
export function tenant(context: Pick<AuthzContext, "organizationId">) {
  return { organizationId: context.organizationId };
}

const DEFAULT_SCOPE_FIELD: Record<ScopeDimension, string> = {
  hall: "hallId",
  event_type: "eventTypeId"
};

/**
 * The scope filter, as a Prisma `where` fragment.
 *
 * `{}` when the dimension is unrestricted, `{ hallId: { in: [...] } }` when it
 * is not - and `{ hallId: { in: [] } }` when the principal is scoped to nothing,
 * which correctly returns no rows rather than every row.
 *
 * `field` covers the models that name the column differently: `Hall` itself is
 * filtered on `id`, not `hallId`.
 */
export function scoped(
  context: Pick<AuthzContext, "scope">,
  dimension: ScopeDimension,
  options: { field?: string } = {}
): Record<string, { in: string[] }> {
  const values = context.scope[scopeDimensionKey(dimension)];

  if (values === "all") return {};

  return { [options.field ?? DEFAULT_SCOPE_FIELD[dimension]]: { in: values } };
}

/** True when this id is inside the verdict's scope for the given dimension. */
export function isInScope(
  context: Pick<AuthzContext, "scope">,
  dimension: ScopeDimension,
  id: string
): boolean {
  const values = context.scope[scopeDimensionKey(dimension)];

  return values === "all" || values.includes(id);
}

/**
 * The point check, for the routes that load one record by id and then have to
 * ask whether the caller may touch it. `scoped()` covers list queries; this
 * covers the single-record case, and both read the same verdict.
 */
export function assertInScope(
  context: Pick<AuthzContext, "scope">,
  dimension: ScopeDimension,
  id: string
): void {
  if (isInScope(context, dimension, id)) return;

  throw new AuthorizationError(
    403,
    dimension === "hall"
      ? "You do not have access to this hall."
      : "You do not have access to this event type.",
    "not_permitted"
  );
}
