import { describe, expect, it } from "vitest";

import {
  DEFAULT_PORTAL_HEADER_COLOR,
  PORTAL_HEADER_COLOR_PRESETS,
  isPortalHeaderColor,
  portalHeaderTone,
  resolvePortalHeaderColor
} from "@/lib/ui/portal-header-theme";

describe("portal header theme", () => {
  it("accepts six-digit hex and nothing else", () => {
    expect(isPortalHeaderColor("#1f4d73")).toBe(true);
    expect(isPortalHeaderColor("#1F4D73")).toBe(true);
    // Everything a stored value must not be able to become: a CSS declaration
    // of its own, a shorthand the pickers never emit, or a colour keyword.
    expect(isPortalHeaderColor("#fff")).toBe(false);
    expect(isPortalHeaderColor("red")).toBe(false);
    expect(isPortalHeaderColor("#1f4d73; background: url(x)")).toBe(false);
    expect(isPortalHeaderColor(undefined)).toBe(false);
  });

  it("resolves anything unusable to the colour the portal has always worn", () => {
    expect(resolvePortalHeaderColor("#6d1f2c")).toBe("#6d1f2c");
    expect(resolvePortalHeaderColor("")).toBe(DEFAULT_PORTAL_HEADER_COLOR);
    expect(resolvePortalHeaderColor(null)).toBe(DEFAULT_PORTAL_HEADER_COLOR);
  });

  it("puts dark text on pale backgrounds and white text on deep ones", () => {
    expect(portalHeaderTone(DEFAULT_PORTAL_HEADER_COLOR)).toBe("light");
    expect(portalHeaderTone("#000000")).toBe("light");
    expect(portalHeaderTone("#ffffff")).toBe("dark");
    // The one an operator picks that a fixed white-on-anything header would
    // have made unreadable.
    expect(portalHeaderTone("#e8dcc4")).toBe("dark");
  });

  it("offers only presets the picker can round-trip", () => {
    for (const preset of PORTAL_HEADER_COLOR_PRESETS) {
      expect(isPortalHeaderColor(preset.value)).toBe(true);
    }
  });
});
