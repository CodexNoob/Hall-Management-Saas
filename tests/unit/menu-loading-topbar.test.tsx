import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

vi.mock("@/features/dashboard/hooks/use-dashboard-permission", () => ({
  useDashboardAccess: () => ({
    canAccessRoute: () => true,
    hasPermission: () => true
  })
}));

import { DashboardPageState } from "@/components/layout/dashboard-page-state";

describe("Menu loading topbar", () => {
  it("does not restore removed default actions while menu data loads", () => {
    render(
      <DashboardPageState
        isLoading
        showDefaultActions={false}
        showSearch={false}
        subtitle="Menu library, packages, buffet, plated, drinks and add-ons."
        title="Menu"
      />
    );

    expect(
      screen.queryByPlaceholderText("Search menu items and packages")
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Open today notes" })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Create new booking" })
    ).toBeNull();
  });
});
