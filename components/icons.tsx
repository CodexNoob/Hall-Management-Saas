import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const baseProps = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "butt",
  strokeLinejoin: "miter"
} satisfies IconProps;

export function CalendarIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props} aria-hidden="true">
      <path d="M4 6h16v14H4z" />
      <path d="M7 3v5M17 3v5M4 11h16" />
    </svg>
  );
}

export function EventIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props} aria-hidden="true">
      <path d="M5 4h14v16H5z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

export function KitchenIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props} aria-hidden="true">
      <path d="M5 3v18M9 3v18M5 9h4" />
      <path d="M15 3v18M19 3v18M15 7h4M15 13h4" />
    </svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props} aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props} aria-hidden="true">
      <path d="M12 8h4v4h-4z" />
      <path d="M4 6h5M16 6h4M4 18h7M15 18h5M4 12h5M16 12h4" />
    </svg>
  );
}

export function NotificationIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props} aria-hidden="true">
      <path d="M6 10a6 6 0 0 1 12 0v5l2 3H4l2-3z" />
      <path d="M10 21h4" />
    </svg>
  );
}
