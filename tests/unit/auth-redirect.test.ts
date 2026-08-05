import { describe, expect, it } from "vitest";
import {
  getDashboardLoginPath,
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
});
