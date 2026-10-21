import type { PermissionKey } from "@/lib/authz/catalog";

/**
 * Which permission a dashboard route needs, for navigation and redirects.
 *
 * KEYED BY PERMISSION, NEVER BY ROLE (INV-1). There is no administrator branch
 * here, because there is no administrator concept anywhere - a role that reaches
 * a new page is a data change, not an edit to this file.
 *
 * This is a UX layer only. The API routes remain the real enforcement boundary,
 * and every entry below mirrors the key its route's GET handler passes to
 * `authorize()`. A page reachable through a stale nav link still gets a 403 from
 * the data it tries to load.
 */

type PermissionCheck = PermissionKey | PermissionKey[];

export const dashboardRoutePermissions: Record<string, PermissionCheck> = {
  "/dashboard": ["calendar.read", "event.read"],
  "/dashboard/calendar": "calendar.read",
  "/dashboard/events": "event.read",
  "/dashboard/event-manager": "event.read",
  "/dashboard/kitchen": "kitchen.read",
  "/dashboard/menu": "menu.read",
  "/dashboard/dining-manager": "dining.read",
  "/dashboard/hall-room-map": "hallmap.read",
  "/dashboard/files": "file.read",
  "/dashboard/clients": "client.read",
  "/dashboard/client-portal": "client.read",
  "/dashboard/vendors": "vendor.read",
  "/dashboard/billing": "invoice.read",
  /*
   * EITHER key, because Staff is four tabs behind two permissions now.
   *
   * The directory needs `staff.read` and the Roles & Permissions tab needs
   * `role.read`, exactly as the two separate routes did. Requiring `staff.read`
   * alone would lock somebody who may read roles out of the only screen that
   * shows them - the page itself renders whichever tabs the caller holds, and
   * refuses when that is none.
   */
  "/dashboard/staff": ["staff.read", "role.read"],
  /// Kept so the compatibility redirect is reachable by the people it is for.
  "/dashboard/access": "role.read",
  "/dashboard/settings": "settings.read"
};

const sortedDashboardRoutes = Object.keys(dashboardRoutePermissions).sort(
  (a, b) => b.length - a.length
);

/**
 * The home page's own entry, which must NOT act as a prefix.
 *
 * Every dashboard path starts with `/dashboard/`, so matching this one by
 * prefix would make it the silent floor under every route in the app - and an
 * unmapped page would then quietly require the home page's keys instead of
 * being open. That is the opposite of the contract above: a page nobody has
 * mapped yet is open in the nav and refused by its own API calls.
 */
const DASHBOARD_ROOT = "/dashboard";

export function getRequiredDashboardPermission(
  route: string | null | undefined
): PermissionCheck | null {
  if (!route) return null;

  const normalized = route.replace(/\/+$/, "") || DASHBOARD_ROOT;
  const match = sortedDashboardRoutes.find((candidate) =>
    candidate === DASHBOARD_ROOT
      ? normalized === candidate
      : normalized === candidate || normalized.startsWith(`${candidate}/`)
  );

  return match ? dashboardRoutePermissions[match] : null;
}

export function canAccessDashboardRoute(
  route: string | null | undefined,
  permissions: readonly string[] | null | undefined
): boolean {
  const required = getRequiredDashboardPermission(route);
  if (!required) return true;

  const keys = Array.isArray(required) ? required : [required];

  return keys.some((key) => permissions?.includes(key) ?? false);
}

/**
 * Where to send somebody who has not asked for anywhere in particular.
 *
 * `MVP_LANDING_ROUTE` is `/dashboard/events`, which was a safe default only for
 * as long as every role held `event.read`. Kitchen Manager and Kitchen Staff no
 * longer do, and a fixed landing route would put every cook on "Access
 * restricted" the moment they signed in - a dead end reached by doing nothing
 * wrong.
 *
 * ORDER IS THE PREFERENCE, most general first. Events is still the front door
 * for anybody who can open it; the kitchen is where a production role belongs;
 * the rest are there so a narrowly-composed tenant role - a bookkeeper with
 * `invoice.read` and nothing else - still lands somewhere it can read.
 *
 * THIS IS NOT A PERMISSION DECISION and must never become one. It only picks
 * among routes the caller already holds the key for, and an explicit
 * navigation to a route they do NOT hold is still refused by the layout's own
 * check and by the API underneath it. Nothing here grants anything.
 */
const LANDING_PREFERENCE: readonly string[] = [
  "/dashboard/events",
  "/dashboard/kitchen",
  "/dashboard/calendar",
  "/dashboard/menu",
  "/dashboard/clients",
  "/dashboard/billing",
  "/dashboard/staff",
  "/dashboard/settings"
];

/**
 * Where to send somebody whose access to the page they are ON has just been
 * withdrawn - or null to leave them where they are.
 *
 * ONLY A REVOCATION, which is what `previous` is for. "They cannot open this
 * route" and "they could open it a moment ago and now cannot" are different
 * situations with different right answers: the first is somebody typing a url
 * for a page they never had, and that gets the refusal card, because hiding
 * navigation and refusing direct navigation are separate jobs. The second is
 * somebody mid-task whose screen is about to turn into an error through no act
 * of their own, and moving them somewhere usable is the kind thing to do.
 *
 * NOT A SECURITY CONTROL in either direction. The API refuses on its own
 * authority whatever this returns; a redirect here only decides what the person
 * looks at next.
 *
 * Null also covers "there is nowhere to send them" - somebody holding no key
 * that opens any page. Falling through to the restricted-access state is the
 * honest answer there; redirecting to another equally refused route would just
 * move the dead end.
 */
export function resolveRevocationRedirect(input: {
  pathname: string | null | undefined;
  /** The permission set before this change, or null on the first render. */
  previous: readonly string[] | null;
  current: readonly string[];
  isHidden?: (route: string) => boolean;
}): string | null {
  const { pathname, previous, current, isHidden } = input;

  // Nothing to compare against yet. The first render is not a revocation.
  if (!previous) return null;
  if (canAccessDashboardRoute(pathname, current)) return null;
  // They could not open this route before either, so nothing was taken away.
  if (!canAccessDashboardRoute(pathname, previous)) return null;

  const landing = resolveLandingRoute(current, isHidden);

  return landing && landing !== pathname ? landing : null;
}

export function resolveLandingRoute(
  permissions: readonly string[] | null | undefined,
  /**
   * Routes the product is not shipping, passed in rather than imported so this
   * module stays free of the MVP feature flags - it is read by the login
   * redirect sanitiser, which has its own reasons to know about them.
   */
  isHidden: (route: string) => boolean = () => false
): string | null {
  return (
    LANDING_PREFERENCE.find(
      (route) => !isHidden(route) && canAccessDashboardRoute(route, permissions)
    ) ?? null
  );
}
