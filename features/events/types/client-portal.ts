/**
 * Shapes shared between the client-portal data layer and the components that
 * render it.
 *
 * These live outside `features/events/server/client-portal-data.ts` because
 * that module is `server-only`; a client component importing from it - even for
 * a type - risks pulling the guard into the browser bundle.
 */

export type ClientPortalOption = {
  id: string;
  name: string;
  description: string | null;
  /** Integer cents, or null for models that carry no price. */
  priceCents: number | null;
  selected: boolean;
};

export type ClientPortalTotals = {
  currency: string;
  totalCents: number;
  balanceDueCents: number;
};

/**
 * Everything the portal renders. The tenant id is deliberately absent so this
 * object is safe to ship to an unauthenticated browser by construction, rather
 * than by remembering to strip a field at each call site.
 */
export type ClientPortalEvent = {
  id: string;
  title: string;
  date: string;
  time: string;
  room: string;
  status: string;
  couples: string;
  children: string;
  /** Once the venue confirms the menu, the portal becomes read-only. */
  menuConfirmed: boolean;
  packages: ClientPortalOption[];
  menuItems: ClientPortalOption[];
  tablecloths: ClientPortalOption[];
  addOns: ClientPortalOption[];
  totals: ClientPortalTotals | null;
};

/**
 * The portal plus the tenant it belongs to, for server callers that still need
 * to resolve organization-scoped configuration such as the payment link.
 */
export type ClientPortalLookup = {
  organizationId: string;
  portal: ClientPortalEvent;
};
