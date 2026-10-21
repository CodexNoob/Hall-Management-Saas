"use client";

import { type ReactNode } from "react";
import type { MenuItemServiceRule } from "@/features/menu/lib/service-style";

export type IconName =
  | "box"
  | "check"
  | "chevron"
  | "dollar"
  | "document"
  | "drink"
  | "filter"
  | "fork"
  | "plate"
  | "plus"
  | "trash"
  | "tray"
  | "upload";

export function LineIcon({
  name,
  className = "h-4 w-4"
}: {
  name: IconName;
  className?: string;
}) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  };

  const paths: Record<IconName, ReactNode> = {
    box: (
      <>
        <path d="m21 8-9-5-9 5 9 5Z" />
        <path d="M3 8v8l9 5 9-5V8M12 13v8" />
      </>
    ),
    check: <path d="m4 12 5 5L20 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    dollar: (
      <>
        <path d="M12 2v20" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" />
      </>
    ),
    document: (
      <>
        <path d="M6 3h12v18H6Z" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </>
    ),
    drink: (
      <>
        <path d="M5 3h14l-1.6 7.2a5.5 5.5 0 0 1-10.8 0Z" />
        <path d="M12 16v5M8.5 21h7" />
      </>
    ),
    filter: <path d="M4 5h16l-6 7v5l-4 2v-7Z" />,
    // Cover for a dish with no picture. The same fork and knife the event
    // manager's menu cards draw, so an item without a photograph looks like
    // itself on both screens.
    fork: <path d="M4 3v7a3 3 0 0 0 6 0V3M7 3v18M18 3v18M18 3c2 2 3 4 3 7v2h-3" />,
    // Two silhouettes rather than two variations on a dome: a covered plate and
    // a covered chafing dish are the same shape at 16px, and these two sit side
    // by side in the picker where telling them apart is the whole job.
    plate: (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3.25" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    trash: (
      <>
        <path d="M4 7h16M10 4h4M6 7l1 13h10l1-13" />
        <path d="M10 11v6M14 11v6" />
      </>
    ),
    // A chafing dish, steam and all - the thing guests queue at, rather than a
    // dome that would read as the plated one beside it.
    tray: (
      <>
        <path d="M3 13h18l-2 6H5Z" />
        <path d="M8 9c0-1.2 1-1.2 1-2.4S8 5.4 8 4.2M12 9c0-1.2 1-1.2 1-2.4S12 5.4 12 4.2M16 9c0-1.2 1-1.2 1-2.4S16 5.4 16 4.2" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4m0 0L8 8m4-4 4 4" />
        <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
      </>
    )
  };

  return <svg {...common}>{paths[name]}</svg>;
}

import type { MessageKey } from "@/lib/i18n/messages";
export const tabs = [
  { label: "Menu Library", labelKey: "menu.tab.library", icon: "document" },
  { label: "Packages", labelKey: "menu.tab.packages", icon: "box" },
  { label: "Buffet Menu", labelKey: "menu.tab.buffet", icon: "document" },
  { label: "Plated Menu", labelKey: "menu.tab.plated", icon: "document" },
  // A view over the same catalog the library tab renders, filtered on `kind`
  // rather than on service style - which is what keeps a drink out of the food
  // library without giving it a table of its own.
  { label: "Drink Menu", labelKey: "menu.tab.drinks", icon: "drink" },
  { label: "Add-ons", labelKey: "menu.tab.addOns", icon: "dollar" }
] satisfies Array<{
  /** Also the `activeTab` value the page switches on, so it stays English. */
  label: string;
  labelKey: MessageKey;
  icon: IconName;
}>;

export type MenuResponse = {
  items: Array<{
    id: string;
    name: string;
    category: string | null;
    /** School | Simcha | Both. The service style lives in `services`. */
    usageType: string;
    kind: string;
    // One row per style the dish is served in, so `unknown` here and parsed
    // with `readServiceRules` rather than asserted into shape.
    services: unknown;
    kosherType: string | null;
    /** Null on a dish, which is never asked - see `MenuLibraryItem`. */
    containsAlcohol: boolean | null;
    allergens: string[];
    notes: string | null;
    // Signed by GET /api/menu; the raw bucket and path never reach the client.
    pictureUrl: string | null;
  }>;
  packages: Array<{
    id: string;
    name: string;
    regularPrice: string | number | null;
    includedMenuItemIds: string[];
  }>;
  addOns: Array<{
    id: string;
    name: string;
    price: string | number | null;
    pricingType: string;
    notes: string | null;
    // Signed by GET /api/menu, exactly as the items above are.
    pictureUrl: string | null;
  }>;
  categories: Array<{ id: string; name: string }>;
};

/**
 * A library item as the grid works with it: the same row as `MenuResponse`,
 * with the nullable category resolved to the bucket the UI files it under.
 */
export type MenuLibraryItem = {
  id: string;
  name: string;
  category: string;
  /** School | Simcha | Both. */
  usageType: string;
  kind: string;
  /**
   * One rule per style the dish is served in. Empty means catalogued but not
   * served, which is what drives the Buffet and Plated tabs - a dish appears
   * under a tab iff it has a rule for that style.
   */
  services: MenuItemServiceRule[];
  kosherType: string | null;
  /**
   * Whether a drink contains alcohol.
   *
   * Null for a dish, and for any drink saved before the switch existed: the
   * drink form asks it in place of the category and kashrut selects, and a food
   * item is never put the question. Read as "not alcoholic" wherever a badge
   * needs an answer - the distinction that matters on a drinks list is which
   * ones ARE.
   */
  containsAlcohol: boolean | null;
  allergens: string[];
  notes: string | null;
  pictureUrl: string | null;
};

// The hardcoded `buffetItems` and `platedSections` that used to live here are
// gone: both tabs now read `menu_items` and filter on service style, so there
// is no second copy of the menu to keep in sync.
//
// The `packageItems` and `packageAddItems` fixtures went the same way. Every
// one of these arrays carried a "$0.00" price on the dish itself, and a priced
// menu item is exactly what this schema says cannot exist - price belongs to a
// package or an add-on - so leaving them would have contradicted the rule the
// rest of this feature now enforces. The Packages pane fills its add grid from
// the library instead, through `PackageItemPicker`.
