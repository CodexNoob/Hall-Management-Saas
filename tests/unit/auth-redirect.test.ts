import { describe, expect, it } from "vitest";
import {
  getDashboardLoginPath,
  getPasswordSetupPath,
  getSafeDashboardReturnPath
} from "@/lib/auth/redirect";
import { MVP_LANDING_ROUTE } from "@/lib/ui/mvp-features";

describe("dashboard authentication redirects", () => {
  it("preserves a valid dashboard destination", () => {
    expect(getSafeDashboardReturnPath("/dashboard/menu?tab=packages")).toBe(
      "/dashboard/menu?tab=packages"
    );
    expect(getDashboardLoginPath("/dashboard/menu")).toBe(
      "/login?next=%2Fdashboard%2Fmenu"
    );
  });

  it("rejects external and non-dashboard destinations", () => {
    expect(getSafeDashboardReturnPath("https://evil.example/dashboard")).toBe(
      MVP_LANDING_ROUTE
    );
    expect(getSafeDashboardReturnPath("//evil.example/dashboard")).toBe(
      MVP_LANDING_ROUTE
    );
    expect(getSafeDashboardReturnPath("/login")).toBe(MVP_LANDING_ROUTE);
  });

  // The overview and the four hidden modules would redirect straight back out
  // (see lib/ui/mvp-features), so a `next` naming one is answered here instead
  // of being handed out and bounced a moment later.
  it("collapses a destination the MVP hides", () => {
    expect(getSafeDashboardReturnPath("/dashboard")).toBe(MVP_LANDING_ROUTE);
    expect(getSafeDashboardReturnPath("/dashboard/billing")).toBe(
      MVP_LANDING_ROUTE
    );
    expect(getSafeDashboardReturnPath("/dashboard/files?folder=3")).toBe(
      MVP_LANDING_ROUTE
    );
    expect(getSafeDashboardReturnPath("/dashboard/hall-room-map")).toBe(
      MVP_LANDING_ROUTE
    );
    expect(getSafeDashboardReturnPath("/dashboard/dining-manager")).toBe(
      MVP_LANDING_ROUTE
    );
  });

  it("builds a password setup path that preserves the destination", () => {
    expect(getPasswordSetupPath("/dashboard/staff")).toBe(
      "/set-password?flow=required&next=%2Fdashboard%2Fstaff"
    );
  });

  it("collapses a hostile destination in the password setup path", () => {
    const landing = encodeURIComponent(MVP_LANDING_ROUTE);

    expect(getPasswordSetupPath("https://evil.example/dashboard")).toBe(
      `/set-password?flow=required&next=${landing}`
    );
    expect(getPasswordSetupPath("//evil.example/dashboard")).toBe(
      `/set-password?flow=required&next=${landing}`
    );
  });
});
