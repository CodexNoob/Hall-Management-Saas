/**
 * What the MVP does not ship yet.
 *
 * The Dashboard overview, Hall Room Map, Billing, Dining Manager, Files and
 * Vendors
 * modules are finished enough to run but are out of scope for the first
 * release, which is Bookings/Calendar, Events, Menu, Kitchen, Staff and
 * Settings. Their routes,
 * components, API handlers and tables are all left in place - only the ways a
 * user could reach them are withdrawn, so turning one back on is an edit to
 * this file rather than a revert.
 *
 * Everything that offers a destination reads from here: the sidebar, the topbar
 * search, the event workspace's tabs, the login return-path sanitiser, and the
 * hidden routes' own pages, which redirect rather than render. That last one is
 * what makes this a real gate instead of a coat of paint - a bookmarked
 * /dashboard/billing lands on Events like any other unavailable page.
 *
 * Vendors is the exception: that page was deleted rather than withheld, so a
 * bookmark gets a 404 instead of a redirect. See the note on the list below.
 *
 * This is a product decision, not a permission one: `lib/auth/dashboard-routes`
 * still describes who *may* open each page, and the API routes still enforce it.
 * A module hidden here is hidden from everyone, admins included.
 */

/// Where the app opens, and where a hidden route sends you. Replaces
/// `/dashboard` as the landing page, because the overview is one of the hidden
/// modules.
export const MVP_LANDING_ROUTE = "/dashboard/events";

/// Prefix-matched, so `/dashboard/billing/invoices/123` is hidden along with the
/// page it hangs off. `/dashboard` is exact-matched instead - it is the parent
/// of every route in the app, and prefix-matching it would hide all of them.
const hiddenDashboardRoutes = [
  "/dashboard/billing",
  "/dashboard/dining-manager",
  "/dashboard/hall-room-map",
  "/dashboard/files",
  // Vendors differs from the rest: its page is deleted, not withheld, so it
  // answers 404 rather than redirecting. It is listed anyway because the other
  // readers of this file still need to know the route is unavailable - the
  // topbar search must not offer it, and the login return-path sanitiser must
  // not send a signed-in user back to it.
  "/dashboard/vendors"
] as const;

export function isHiddenDashboardRoute(route: string | null | undefined) {
  if (!route) return false;

  const normalized =
    route.split(/[?#]/)[0]?.replace(/\/+$/, "") || "/dashboard";

  // The overview itself, not the section: only the bare path is the hidden page.
  if (normalized === "/dashboard") return true;

  return hiddenDashboardRoutes.some(
    (hidden) => normalized === hidden || normalized.startsWith(`${hidden}/`)
  );
}

/// Tabs withdrawn from the event workspace, by label. The tab components stay
/// imported and rendered by `event-workspace.tsx` - unreachable while the label
/// is listed here, and back the moment it is not.
export const hiddenEventWorkspaceTabs: readonly string[] = [
  "Billing",
  "Hall map",
  "Files",
  "Vendors"
];

/**
 * Whether to draw invoice, balance and payment-status readouts.
 *
 * Separate from the route list because these are not links: the event header's
 * open-balance badge, the event list's balance column, the "Billing reviewed"
 * readiness check and the Clients page's Billed/Paid/Outstanding metrics all
 * render numbers that only the hidden Billing module can act on. Shown without
 * it, "See billing" names a page that cannot be opened, and the readiness check
 * blocks Print packet behind a review nobody can perform.
 */
/// Annotated `boolean` rather than left to infer `false`, so the branches that
/// read it stay ordinary conditionals instead of narrowing to dead code that
/// TypeScript and eslint then argue about.
export const showBillingReadouts: boolean = false;

/**
 * Whether to draw readiness checks for the hidden operations modules.
 *
 * Same reasoning as above, for the "Hall map selected" and "Dining plan notes
 * ready" items: both are satisfied from pages the MVP does not offer.
 */
export const showOperationsReadiness: boolean = false;

/// Whether to draw counts of documents held by the hidden Files module - the
/// Clients page's "Files" metric is the only one.
export const showFileReadouts: boolean = false;
