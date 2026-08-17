"use client";

import { type ReactNode } from "react";

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
    usageType: string;
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

export const packageItems = [
  {
    name: "Challah rolls",
    mode: "Buffet",
    rule: "1 roll per 1 people",
    price: "$0.00"
  },
  {
    name: "Dips platter",
    mode: "Buffet",
    rule: "1 set per 1 tables",
    price: "$0.00"
  },
  {
    name: "Chicken soup",
    mode: "Plated",
    rule: "1 bowl per 1 people",
    price: "$0.00"
  },
  {
    name: "Grilled chicken",
    mode: "Plated",
    rule: "1 plate per 1 people",
    price: "$0.00"
  },
  {
    name: "Potato kugel",
    mode: "Buffet",
    rule: "1 tray per 30 people",
    price: "$0.00"
  },
  {
    name: "Roasted vegetables",
    mode: "Plated",
    rule: "1 portion per 1 people",
    price: "$0.00"
  },
  {
    name: "Soda package",
    mode: "Buffet",
    rule: "1 bottle per 8 people",
    price: "$0.00"
  },
  {
    name: "Dessert cups",
    mode: "Plated",
    rule: "1 cup per 1 people",
    price: "$0.00"
  }
];

export const packageAddItems = [
  {
    name: "Grilled chicken",
    category: "Buffet",
    rule: "1 tray per 30 people",
    price: "$0.00"
  },
  {
    name: "Challah rolls",
    category: "Plated",
    rule: "1 roll per 1 people",
    price: "$0.00"
  }
];

export const buffetSections = [
  {
    title: "Appetizers",
    items: [
      {
        name: "Challah rolls",
        category: "Buffet",
        rule: "1 roll per 1 people",
        price: "$0.00"
      },
      {
        name: "Dips platter",
        category: "Buffet",
        rule: "1 set per 1 tables",
        price: "$0.00"
      }
    ]
  },
  { title: "Soups", items: [] },
  {
    title: "Mains",
    items: [
      {
        name: "Grilled chicken",
        category: "Buffet",
        rule: "1 tray per 30 people",
        price: "$0.00"
      }
    ]
  },
  {
    title: "Sides",
    items: [
      {
        name: "Potato kugel",
        category: "Buffet",
        rule: "1 tray per 30 people",
        price: "$0.00"
      }
    ]
  },
  {
    title: "Drinks",
    items: [
      {
        name: "Soda package",
        category: "Buffet",
        rule: "1 bottle per 8 people",
        price: "$0.00"
      }
    ]
  },
  { title: "Desserts", items: [] },
  { title: "Other", items: [] }
];

export const platedSections = [
  { title: "Appetizers", items: [] },
  {
    title: "Soups",
    items: [
      {
        name: "Chicken soup",
        category: "Plated",
        rule: "1 bowl per 1 people",
        price: "$0.00"
      }
    ]
  },
  {
    title: "Mains",
    items: [
      {
        name: "Grilled chicken",
        category: "Plated",
        rule: "1 plate per 1 people",
        price: "$0.00"
      },
      {
        name: "Roasted vegetables",
        category: "Plated",
        rule: "1 portion per 1 people",
        price: "$0.00"
      }
    ]
  },
  { title: "Sides", items: [] },
  { title: "Drinks", items: [] },
  {
    title: "Desserts",
    items: [
      {
        name: "Dessert cups",
        category: "Plated",
        rule: "1 cup per 1 people",
        price: "$0.00"
      }
    ]
  },
  { title: "Other", items: [] }
];
