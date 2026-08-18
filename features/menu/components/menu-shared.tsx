"use client";

import { type ReactNode } from "react";
import type { MenuItemServiceRule } from "@/features/menu/lib/service-style";

export type IconName = "box" | "chevron" | "dollar" | "document" | "filter" | "plus";

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
    filter: <path d="M4 5h16l-6 7v5l-4 2v-7Z" />,
    plus: <path d="M12 5v14M5 12h14" />
  };

  return <svg {...common}>{paths[name]}</svg>;
}

export const tabs = [
  { label: "Menu Library", icon: "document" },
  { label: "Packages", icon: "box" },
  { label: "Buffet Menu", icon: "document" },
  { label: "Plated Menu", icon: "document" },
  { label: "Add-ons", icon: "dollar" }
] satisfies Array<{ label: string; icon: IconName }>;

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
