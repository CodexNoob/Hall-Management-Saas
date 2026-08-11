import { describe, expect, it } from "vitest";
import {
  getDashboardLoginPath,
  getPasswordSetupPath,
  getSafeDashboardReturnPath
} from "@/lib/auth/redirect";

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
      "/dashboard"
    );
    expect(getSafeDashboardReturnPath("//evil.example/dashboard")).toBe(
      "/dashboard"
    );
    expect(getSafeDashboardReturnPath("/login")).toBe("/dashboard");
  });

  it("builds a password setup path that preserves the destination", () => {
    expect(getPasswordSetupPath("/dashboard/staff")).toBe(
      "/set-password?flow=required&next=%2Fdashboard%2Fstaff"
    );
  });

  it("collapses a hostile destination in the password setup path", () => {
    expect(getPasswordSetupPath("https://evil.example/dashboard")).toBe(
      "/set-password?flow=required&next=%2Fdashboard"
    );
    expect(getPasswordSetupPath("//evil.example/dashboard")).toBe(
      "/set-password?flow=required&next=%2Fdashboard"
    );
  });
});
