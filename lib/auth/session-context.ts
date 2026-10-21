/**
 * The wire contract for POST /api/auth/session.
 *
 * This module owns the shape outright: the route serializes through
 * `serializeAuthSession`, `lib/auth/client.ts` re-exports these types rather
 * than restating them, and `isAuthSessionResponse` guards what comes back out of
 * the browser cache. Before this existed the same object was written by hand in
 * four places - the route, the client type, the client's runtime guard and the
 * test fixture - and nothing made them agree.
 *
 * THE BROWSER READS KEYS, NEVER ROLES (INV-1).
 *
 * There is no `role` field anywhere in this response and no administrator
 * concept on the client, because there is no administrator concept anywhere.
 * `useAccess("event.create")` is the whole client-side API.
 *
 * Client hints are FOR RENDERING ONLY. Every mutation re-decides server-side. A
 * hidden button is a courtesy; the 403 is the control.
 *
 * Kept free of Prisma and of `server-only` on purpose. The inputs are declared
 * structurally, so the serializer stays a pure function of plain data, is
 * importable from either side of the network boundary, and can be tested without
 * a database.
 */

import type { PermissionKey } from "@/lib/authz/catalog";
import type { ScopeFilter } from "@/lib/authz/types";
import type { RegionalSettings } from "@/lib/dates/regional-settings";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  venueName: string | null;
  /** Job title. Not a privilege - see the RBAC migration. */
  title: string | null;
  organizationId: string;
  /**
   * This person's OWN language choice, or null when they follow the
   * organization. Distinct from `language` below, which is the one that
   * actually applies: the picker needs to know whether a preference has been
   * expressed at all, and "en-US because I chose it" and "en-US because that is
   * what the hall is set to" are different answers.
   */
  language: AppLanguage | null;
};

export type AppLanguage = "en-US" | "en-GB" | "es-US" | "he-IL";

const APP_LANGUAGES: readonly AppLanguage[] = [
  "en-US",
  "en-GB",
  "es-US",
  "he-IL"
];

/**
 * A stored language string narrowed to one this build ships.
 *
 * Returns null rather than defaulting, because the caller has to be able to
 * tell "no preference" from "a preference this build no longer recognises" -
 * both of which mean fall back, but only one of which is a choice somebody
 * made. Both columns are plain `String`, so a value written by a newer build
 * reaches here as ordinary text.
 */
export function readAppLanguage(
  value: string | null | undefined
): AppLanguage | null {
  return APP_LANGUAGES.includes(value as AppLanguage)
    ? (value as AppLanguage)
    : null;
}

export type SessionOrganization = {
  id: string;
  name: string;
  slug: string;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  subscriptionStatus: string;
  subscriptionPlan: string | null;
  subscriptionStartedAt: string | null;
  subscriptionEndsAt: string | null;
  onboardingCompletedAt: string | null;
};

export type AuthSessionResponse = {
  user: SessionUser;
  /**
   * The language that APPLIES: this person's own choice when they have made
   * one, and the organization's otherwise. Resolved here rather than in the
   * browser so the dashboard, the kitchen board and anything else reading the
   * session cannot each fold the two together differently.
   */
  language?: AppLanguage;
  /** Every key the signed-in principal holds in the active organization. */
  permissions: PermissionKey[];
  /**
   * A RENDERING HINT, and deliberately lossy: the widest set of halls and event
   * types that ANY held permission reaches.
   *
   * Scope resolves per permission on the server, so a principal who is Kitchen
   * Staff at Hall A and Viewer organization-wide has different scopes for
   * different keys. Collapsing that into one filter is fine for deciding what to
   * put in a hall picker and wrong for deciding whether a write will succeed -
   * which is why the server never consults this and re-decides every mutation.
   */
  scope: ScopeFilter;
  /**
   * The permissions epoch these keys were computed under.
   *
   * Any API response carrying a higher one triggers a session refetch. That is
   * how a revoked permission takes effect without a sign-out, and it costs one
   * comparison in the fetch wrapper.
   */
  epoch: number;
  mustSetPassword: boolean;
  /**
   * True when the signed-in owner still has to name their organization and pick
   * a plan on /dashboard/new. The dashboard layout holds them there until they
   * do.
   */
  mustCompleteOnboarding: boolean;
  activeOrganizationId: string;
  organizations: SessionOrganization[];
  /**
   * HOW THIS ORGANIZATION WRITES A DATE AND A TIME.
   *
   * Carried on the session rather than fetched, and that is a deliberate choice
   * about who can see it. `/api/settings` needs `settings.read`, which kitchen
   * staff do not hold - so a component that fetched its date format from there
   * would format correctly for managers and fall back to defaults for cooks, on
   * the same screen. Every authenticated user gets this response, so every
   * authenticated user formats the same way.
   *
   * Resolved server-side from the AUTHENTICATED organization. The browser never
   * says which organization it wants settings for; it is told.
   *
   * Optional so a payload cached before this existed still reads as a valid
   * session rather than being discarded - a missing block means the documented
   * defaults, which is what an organization that never opened Settings gets
   * anyway.
   */
  regional?: RegionalSettings;
  /**
   * The inactivity policy, and whether THIS device is exempt from it.
   *
   * Sent so the browser can run the same rule for its countdown and its warning
   * dialog. It is a hint and nothing more: `resolveUserActor` refuses an idle
   * session on its own authority, so a browser that ignores this, lies about it
   * or never received it gets a 401 from the next request it makes.
   *
   * Optional, like the blocks around it, so a payload cached before this
   * existed still reads as a valid session. Absent means no countdown - which
   * is what the server does when it cannot tell either.
   */
  inactivity?: InactivityState;
  /**
   * What this session still owes on its second factor.
   *
   * Optional so a payload cached before two-factor existed still reads as a
   * valid session rather than being thrown away. A missing block is treated as
   * `satisfied` by the client, which is the only safe direction for a CLIENT
   * hint: the server refuses every other endpoint on its own authority, so the
   * worst an absent block can do is show a dashboard whose every request comes
   * back 403 - never let one through.
   */
  mfa?: MfaState;
  /**
   * Whether THIS browser is a trusted device of this person's.
   *
   * Booleans and nothing else - never the device secret (it lives only in an
   * httpOnly cookie) and never its hash. A HINT for the device gate: the
   * server reads the device row itself on every request (`resolveUserActor`)
   * and refuses an untrusted browser with `device_confirmation_required`, so a
   * browser that lies about this gains nothing. Optional so older cached
   * payloads stay valid.
   */
  device?: DeviceTrustState;
};

export type DeviceTrustState = {
  /** This browser had been seen for this person before. */
  known: boolean;
  /** Confirmed by email and inside its trust period. */
  trusted: boolean;
  /** Not trusted yet, and a confirmation code was emailed for this sign-in. */
  pendingConfirmation: boolean;
  /**
   * The dashboard must show the device gate instead of itself. The server
   * refuses the data either way (`device_confirmation_required`); this is
   * what lets the browser explain why rather than render a broken page.
   */
  confirmationRequired: boolean;
};

export type InactivityState = {
  /** The organization's limit, in minutes. Zero means never. */
  timeoutMinutes: number;
  /** A wall-mounted screen, exempt by an explicit and audited decision. */
  sharedDevice: boolean;
};

export type MfaState = {
  /** A verified factor exists on the account. */
  enrolled: boolean;
  /** The active organization mandates one for everybody. */
  requiredByOrganization: boolean;
  /**
   * `satisfied` - nothing owed. `challenge` - a factor exists and this session
   * did not use it. `enroll` - the policy requires one and there is none yet.
   */
  obligation: "satisfied" | "challenge" | "enroll";
};

type Timestamp = Date | string | null | undefined;

/** Rows as Prisma hands them over, before JSON turns the dates into strings. */
type UserRow = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  venueName: string | null;
  title: string | null;
  organizationId: string;
  passwordSetAt: Timestamp;
  /** Optional so a caller that never selected the column still type-checks. */
  language?: string | null;
};

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  trialStartedAt: Timestamp;
  trialEndsAt: Timestamp;
  subscriptionStatus: string;
  subscriptionPlan: string | null;
  subscriptionStartedAt: Timestamp;
  subscriptionEndsAt: Timestamp;
  onboardingCompletedAt: Timestamp;
};

type MembershipRow = {
  organizationId: string;
  organization: OrganizationRow;
};

/**
 * The key that gates naming the organization and choosing its plan.
 *
 * This used to read `normalizeStaffRole(membership.role) === "owner"`, which is
 * exactly the shape INV-1 forbids. Asking for the permission instead means a
 * tenant who invents a "Founder" role and gives it `settings.update` gets the
 * onboarding form, with no code change.
 */
const ONBOARDING_PERMISSION: PermissionKey = "settings.update";

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toNullableIsoString(value: Timestamp): string | null {
  if (!value) return null;

  return toIsoString(value);
}

function serializeOrganization(membership: MembershipRow): SessionOrganization {
  const { organization } = membership;

  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    trialStartedAt: toNullableIsoString(organization.trialStartedAt),
    trialEndsAt: toNullableIsoString(organization.trialEndsAt),
    subscriptionStatus: organization.subscriptionStatus,
    subscriptionPlan: organization.subscriptionPlan,
    subscriptionStartedAt: toNullableIsoString(
      organization.subscriptionStartedAt
    ),
    subscriptionEndsAt: toNullableIsoString(organization.subscriptionEndsAt),
    onboardingCompletedAt: toNullableIsoString(
      organization.onboardingCompletedAt
    )
  };
}

function unionDimension(
  left: string[] | "all",
  right: string[] | "all"
): string[] | "all" {
  if (left === "all" || right === "all") return "all";

  return [...new Set([...left, ...right])];
}

/** The widest scope any held permission reaches. See `AuthSessionResponse.scope`. */
export function widestScope(
  scopes: Iterable<ScopeFilter>
): ScopeFilter {
  let hallIds: string[] | "all" = [];
  let eventTypeIds: string[] | "all" = [];

  for (const scope of scopes) {
    hallIds = unionDimension(hallIds, scope.hallIds);
    eventTypeIds = unionDimension(eventTypeIds, scope.eventTypeIds);
  }

  return { hallIds, eventTypeIds };
}

export function serializeAuthSession(input: {
  user: UserRow;
  /** Sorted by the caller, so the cached payload is stable between fetches. */
  permissions: PermissionKey[];
  scope: ScopeFilter;
  epoch: number;
  /** Active memberships only - the caller has already filtered them. */
  memberships: MembershipRow[];
  /**
   * Whether the account can sign in with a password at all. An OAuth-only user
   * has no password to be missing, so they must never be sent to password setup.
   */
  usesEmailPassword: boolean;
  /** The organization's language. Overridden by the user's own when set. */
  language?: AppLanguage;
  /** This person's own choice, or null when they follow the organization. */
  userLanguage?: AppLanguage | null;
  /** Omitted by callers that do not hold a token to judge it from. */
  mfa?: MfaState;
  /** Omitted by callers with no settings document to read. */
  regional?: RegionalSettings;
  /** Omitted by callers with no session row to read the exemption from. */
  inactivity?: InactivityState;
  /** Omitted by callers that did not record a device sighting. */
  device?: DeviceTrustState;
}): AuthSessionResponse {
  const {
    user,
    permissions,
    scope,
    epoch,
    memberships,
    usesEmailPassword,
    language = "en-US",
    userLanguage = null,
    mfa,
    regional,
    inactivity,
    device
  } = input;

  // Deliberately the user's primary organization rather than the request-scoped
  // resolver's header/cookie precedence: this response tells the client where to
  // *start*, and switching organizations is a later, explicit act. Reusing the
  // resolver here would make a stale cookie decide what a fresh sign-in returns.
  const activeMembership = memberships.find(
    (membership) => membership.organizationId === user.organizationId
  );

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      venueName: user.venueName,
      title: user.title,
      organizationId: user.organizationId,
      language: userLanguage
    },
    // The person's own choice wins; the organization's is the fallback for
    // everyone who has never made one.
    language: userLanguage ?? language,
    permissions,
    scope,
    epoch,
    mustSetPassword: usesEmailPassword && !user.passwordSetAt,
    mustCompleteOnboarding:
      permissions.includes(ONBOARDING_PERMISSION) &&
      !activeMembership?.organization.onboardingCompletedAt,
    activeOrganizationId: user.organizationId,
    organizations: memberships.map(serializeOrganization),
    // Spread rather than `mfa` so the key is absent instead of explicitly
    // undefined when no caller supplied one - `isAuthSessionResponse` treats
    // the two the same, but a cached payload with `"mfa": null` in it reads as
    // a deliberate answer and this is not one.
    ...(mfa ? { mfa } : {}),
    /*
     * The date and time format, with the PERSON's language folded in.
     *
     * `regional.locale` is the organization's language, and somebody who chose
     * their own has to see months and weekdays in it - otherwise a Spanish
     * reader in an English venue gets "Sep 25, 2026" beside a Spanish sidebar.
     * The ORDER and the hour cycle stay the organization's: those are how the
     * venue writes a date, not a personal preference, and a contract and the
     * screen it was typed on must not disagree.
     */
    ...(regional
      ? { regional: { ...regional, locale: userLanguage ?? regional.locale } }
      : {}),
    ...(inactivity ? { inactivity } : {}),
    // Rebuilt from the two booleans, so nothing else a caller put on the
    // object can ride along into the browser.
    ...(device
      ? {
          device: {
            known: device.known,
            trusted: device.trusted,
            pendingConfirmation: device.pendingConfirmation,
            confirmationRequired: device.confirmationRequired
          }
        }
      : {})
  };
}

export function isAuthSessionResponse(
  value: unknown
): value is AuthSessionResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<AuthSessionResponse>;

  // `permissions` and `epoch` are checked so a payload cached before the RBAC
  // cutover - which carried a 23-boolean `access` object and no keys at all - is
  // rejected and refetched rather than read as "holds nothing".
  return Boolean(
    payload.user &&
      typeof payload.user === "object" &&
      Array.isArray(payload.permissions) &&
      payload.scope &&
      typeof payload.scope === "object" &&
      typeof payload.epoch === "number" &&
      typeof payload.mustSetPassword === "boolean" &&
      typeof payload.mustCompleteOnboarding === "boolean" &&
      typeof payload.activeOrganizationId === "string" &&
      Array.isArray(payload.organizations)
  );
}
