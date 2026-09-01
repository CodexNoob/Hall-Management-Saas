/**
 * The client portal header's background, in the one place everything that
 * touches it can read: the settings screen that sets it, the API route that
 * defaults it, and the portal that paints it.
 *
 * No React and nothing server-only, on purpose - the portal renders on the
 * server, the settings preview in the browser, and both have to agree on what a
 * given colour looks like.
 */

/**
 * The navy the portal header wore before any of this was configurable, and what
 * an organization that has never chosen a colour still gets.
 */
export const DEFAULT_PORTAL_HEADER_COLOR = "#1f4d73";

/**
 * Six-digit hex only. `<input type="color">` emits exactly this shape, and it
 * is narrow enough that the value can be dropped into an inline style without
 * asking what else a CSS colour is allowed to contain.
 */
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export function isPortalHeaderColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR_PATTERN.test(value);
}

/**
 * The colour to paint, given whatever the settings document holds - including
 * nothing at all, which is what every organization saved before this setting
 * existed holds.
 */
export function resolvePortalHeaderColor(value: unknown) {
  return isPortalHeaderColor(value) ? value : DEFAULT_PORTAL_HEADER_COLOR;
}

/**
 * Which way the text on the header has to go: `light` for white text on a dark
 * background, `dark` for near-black text on a pale one.
 *
 * The operator picks a colour, not a colour scheme, so nothing stops them from
 * picking cream - and white-on-cream is an unreadable portal for the venue's
 * own clients.
 */
export type PortalHeaderTone = "light" | "dark";

function channelLuminance(value: number) {
  const channel = value / 255;
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

/**
 * WCAG relative luminance, and the 0.179 crossover: below it white text has the
 * better contrast ratio against the background, above it black does.
 */
export function portalHeaderTone(color: string): PortalHeaderTone {
  if (!isPortalHeaderColor(color)) return "light";

  const luminance =
    0.2126 * channelLuminance(parseInt(color.slice(1, 3), 16)) +
    0.7152 * channelLuminance(parseInt(color.slice(3, 5), 16)) +
    0.0722 * channelLuminance(parseInt(color.slice(5, 7), 16));

  return luminance > 0.179 ? "dark" : "light";
}

/**
 * What the header shows for an organization that has not uploaded a logo, keyed
 * by the tone the background asks for: the white wordmark on a dark header, the
 * navy one - the same artwork the auth cards use - on a pale header.
 *
 * A branded header beats an empty one, and the venue replaces it the moment it
 * uploads its own logo.
 */
export const PORTAL_HEADER_FALLBACK_LOGO: Record<PortalHeaderTone, string> = {
  light: "/images/branding/Footer-logo.png",
  dark: "/images/branding/hms-logo-header.png"
};

/**
 * A short list rather than a free-for-all: an operator who wants a colour that
 * works picks one of these, and the picker beside them is there for the venue
 * that has a brand colour to match.
 */
export const PORTAL_HEADER_COLOR_PRESETS = [
  { label: "Event Core navy", value: DEFAULT_PORTAL_HEADER_COLOR },
  { label: "Midnight", value: "#17202a" },
  { label: "Forest", value: "#1f5138" },
  { label: "Burgundy", value: "#6d1f2c" },
  { label: "Plum", value: "#4a2a5a" },
  { label: "Champagne", value: "#e8dcc4" }
];
