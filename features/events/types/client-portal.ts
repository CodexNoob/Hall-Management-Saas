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
  /**
   * A signed URL for the option's picture, or null when the row stores none.
   * The menu bucket is private, so this is minted per request and expires in
   * minutes - it is a thing to render now, never a value to cache or store.
   *
   * Menu items and add-ons are the two models with a picture column, so they
   * are the two that can fill this. Packages and tablecloths store none and
   * always report null.
   */
  imageUrl: string | null;
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
  /** Food only. Drinks are the same model, asked as their own question below. */
  menuItems: ClientPortalOption[];
  /**
   * Menu items with `kind = "Drink"`. Selections from here go back in
   * `menuItemIds` with the food - the split is how the portal asks, not a
   * second kind of record.
   */
  drinks: ClientPortalOption[];
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
