"use client";

import { type ReactNode } from "react";

import { isHiddenDashboardRoute } from "@/lib/ui/mvp-features";

export type SidebarIconName =
  | "dashboard"
  | "kitchen"
  | "calendar"
  | "events"
  | "menu"
  | "portal"
  | "dining"
  | "map"
  | "files"
  | "billing"
  | "staff"
  | "vendor"
  | "settings";

export type SidebarItem = {
  icon: SidebarIconName;
  iconSrc?: string;
  label: string;
  route?: string;
};

export type SidebarSection = {
  title: string;
  icon: SidebarIconName;
  collapsedIconSrc?: string;
  items: SidebarItem[];
};

/**
 * Every section the sidebar can offer, before the MVP gate.
 *
 * Kept whole rather than edited down so the shape of the finished navigation
 * stays readable, and so re-listing a module is one line in lib/ui/mvp-features
 * rather than a re-derivation of which section it belonged to.
 */
const allSidebarSections: SidebarSection[] = [
  {
    title: "Workspace",
    icon: "dashboard",
    items: [
      {
        icon: "dashboard",
        label: "Dashboard",
        route: "/dashboard"
      },
      {
        icon: "kitchen",
        iconSrc: "/images/icons/sidebar/kitchen-cutlery.png",
        label: "Kitchen",
        route: "/dashboard/kitchen"
      },
      {
        icon: "calendar",
        label: "Calendar",
        route: "/dashboard/calendar"
      },
      {
        icon: "events",
        label: "Events",
        route: "/dashboard/events"
      },
      { icon: "menu", label: "Menu", route: "/dashboard/menu" }
    ]
  },
  {
    title: "Operations",
    icon: "dining",
    collapsedIconSrc: "/images/icons/sidebar/operations-cogwheel.png",
    items: [
      {
        icon: "dining",
        iconSrc: "/images/icons/sidebar/dining-manager-table.png",
        label: "Dining Manager",
        route: "/dashboard/dining-manager"
      },
      {
        icon: "map",
        label: "Hall Room Map",
        route: "/dashboard/hall-room-map"
      },
      { icon: "files", label: "Files", route: "/dashboard/files" }
    ]
  },
  {
    title: "Office",
    icon: "billing",
    collapsedIconSrc: "/images/icons/sidebar/office-location.png",
    items: [
      {
        icon: "billing",
        label: "Billing",
        route: "/dashboard/billing"
      },
      /*
       * Staff management, all four parts of it: the directory, roles and
       * permissions, invitations, and the privilege trail.
       *
       * Access used to sit beside this as its own entry, so that the sidebar's
       * per-permission filter kept somebody who may edit a phone number away
       * from the screen that hands out privileges. It is a tab inside Staff now,
       * and that separation moved with it rather than being dropped: each tab
       * carries the permission its old route was gated on, so the Roles &
       * Permissions tab still needs `role.read` and is simply absent without it.
       * See features/administration/components/staff-tabs.ts.
       */
      { icon: "staff", label: "Staff", route: "/dashboard/staff" },
      {
        icon: "settings",
        label: "Settings",
        route: "/dashboard/settings"
      }
    ]
  }
];

/**
 * What the sidebar actually draws.
 *
 * A section whose every item is hidden is dropped rather than left as a heading
 * over nothing - Operations is entirely Dining Manager, Hall Room Map and Files,
 * so for the MVP it disappears and Office is left holding Staff alone. The
 * per-role filter in dashboard-sidebar.tsx runs over this and drops empty
 * sections again, for the same reason.
 */
export const sidebarSections: SidebarSection[] = allSidebarSections
  .map((section) => ({
    ...section,
    items: section.items.filter((item) => !isHiddenDashboardRoute(item.route))
  }))
  .filter((section) => section.items.length > 0);

// How a page asks for the room the sidebar is taking up. DashboardSidebar owns
// the collapsed state - it answers this event, then writes the dataset flag,
// localStorage and the `dashboard-sidebar-change` echo the topbar reads - so
// dispatching keeps that state with one writer instead of two.
//
// Only above lg: the collapsed width is applied inside the min-width: 1024px
// block in globals.css, so below it there is nothing to gain and collapsing
// would just persist a preference the user never expressed. matchMedia is
// missing under jsdom, and a viewport we cannot measure is not one we should
// collapse.
export function requestDashboardSidebarCollapse() {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function" ||
    !window.matchMedia("(min-width: 1024px)").matches
  ) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("dashboard-sidebar-toggle", {
      detail: { collapsed: true }
    })
  );
}

export function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

export function SidebarIcon({
  name,
  className = "h-4 w-4",
  strokeWidth = 2
}: {
  name: SidebarIconName;
  className?: string;
  strokeWidth?: number;
}) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  };

  const icons: Record<SidebarIconName, ReactNode> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
      </>
    ),
    kitchen: (
      <>
        <path d="M3 2h4" />
        <path d="M5 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V2" />
        <path d="M9 10v10" />
        <path d="M3 20h12" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </>
    ),
    events: (
      <>
        <path d="M8 2v4M16 2v4" />
        <rect x="3" y="5" width="18" height="15" rx="2" />
        <path d="M3 10h18M8 14h.01M12 14h.01M16 14h.01" />
      </>
    ),
    menu: (
      <>
        <path d="M4 6h16M4 12h16M4 18h16" />
      </>
    ),
    portal: (
      <>
        <path d="M3 7h18" />
        <path d="M5 7v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7" />
        <path d="M8 11h8" />
      </>
    ),
    dining: (
      <>
        <path d="M4 4h16" />
        <path d="M6 4v6a3 3 0 0 0 6 0V4" />
        <path d="M12 10v10M16 4v10" />
      </>
    ),
    map: (
      <>
        <path d="M3 6 9 3l6 3 6-3v15l-6 3-6-3-6 3Z" />
        <path d="M9 3v15M15 6v15" />
      </>
    ),

    files: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h8" />
        <path d="M8 17h8" />
      </>
    ),
    billing: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18M7 15h2" />
      </>
    ),
    staff: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    vendor: (
      <>
        <path d="M3 21V8l9-5 9 5v13" />
        <path d="M7 13h10M7 17h10" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.2a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z" />
      </>
    )
  };

  return <svg {...common}>{icons[name]}</svg>;
}
