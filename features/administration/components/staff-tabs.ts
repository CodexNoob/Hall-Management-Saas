import type { MessageKey } from "@/lib/i18n/messages";
import type { DashboardAccess } from "@/features/dashboard/hooks/use-dashboard-permission";

/**
 * The four things Staff management is, and who may see each.
 *
 * ONE TAB PER PERMISSION, NOT ONE PAGE PER PERMISSION. Access used to be its own
 * sidebar entry, and the sidebar's per-permission filter was what kept somebody
 * who may edit a phone number away from the screen that hands out privileges.
 * Folding it in here would have thrown that away if the tabs were unconditional,
 * so each one carries the permission its old route was gated on:
 * `/dashboard/staff` was `staff.read` and `/dashboard/access` was `role.read`,
 * and those are exactly the two keys below.
 *
 * A caller therefore sees the tabs they could have reached before and no others,
 * and somebody holding only one of the two keys still gets a usable page rather
 * than a locked one.
 */
export const STAFF_TABS = [
  {
    value: "people",
    labelKey: "staff.tab.people",
    /// The directory. What `/dashboard/staff` always was.
    permission: "staff.read"
  },
  {
    value: "roles",
    labelKey: "staff.tab.roles",
    /// What `/dashboard/access` was, which is why the compatibility redirect
    /// points at this one.
    permission: "role.read"
  },
  {
    value: "invitations",
    labelKey: "staff.tab.invitations",
    /// Sending one is `staff.invite`; the tab shows who has not accepted yet,
    /// which is a fact about the directory.
    permission: "staff.read"
  },
  {
    value: "audit",
    labelKey: "staff.tab.activity",
    /// The privilege trail. An audit nobody can read is storage, not a control.
    permission: "audit.read"
  }
] as const satisfies ReadonlyArray<{
  value: string;
  labelKey: MessageKey;
  permission: string;
}>;

export type StaffTab = (typeof STAFF_TABS)[number]["value"];

export const DEFAULT_STAFF_TAB: StaffTab = "people";

export function isStaffTab(value: string | null | undefined): value is StaffTab {
  return STAFF_TABS.some((tab) => tab.value === value);
}

/**
 * The tabs this caller may open, in declaration order.
 *
 * Empty is a real answer - it means the page itself should refuse rather than
 * render an empty tab strip.
 */
export function visibleStaffTabs(access: Pick<DashboardAccess, "hasPermission">) {
  return STAFF_TABS.filter((tab) => access.hasPermission(tab.permission));
}

/**
 * The tab to actually show, given what the URL asked for.
 *
 * Falls back rather than 404s: a bookmark of `?tab=audit` kept by somebody whose
 * `audit.read` was revoked should land them on a tab they can read, not on an
 * error. Returns null when they may see nothing at all, which the page renders
 * as its restricted state.
 */
export function resolveStaffTab(
  requested: string | null | undefined,
  access: Pick<DashboardAccess, "hasPermission">
): StaffTab | null {
  const allowed = visibleStaffTabs(access);
  if (allowed.length === 0) return null;

  if (isStaffTab(requested)) {
    const match = allowed.find((tab) => tab.value === requested);
    if (match) return match.value;
  }

  const preferred = allowed.find((tab) => tab.value === DEFAULT_STAFF_TAB);

  return (preferred ?? allowed[0]).value;
}
