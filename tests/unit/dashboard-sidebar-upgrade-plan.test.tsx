import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import type { SessionUser } from "@/lib/auth/client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    prefetch: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn()
  })
}));

vi.mock("next/image", () => ({
  default: ({ alt = "", ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  )
}));

vi.mock("next/dynamic", () => ({
  default: () =>
    // Every dialog here is mounted only while it is open, so a missing `open`
    // prop - My Account takes none - still means open.
    function DialogMock({ open = true }: { open?: boolean }) {
      return open ? <div role="dialog">Subscription Plan</div> : null;
    }
}));

vi.mock("@/lib/auth/client", () => ({
  signOutCurrentSession: vi.fn()
}));

vi.mock("@/features/dashboard/hooks/use-authenticated-query", () => ({
  clearAuthenticatedQueryCache: vi.fn()
}));

vi.mock("@/features/dashboard/hooks/use-dashboard-permission", () => ({
  useDashboardAccess: () => ({
    canAccessRoute: () => true
  })
}));

const user: SessionUser = {
  id: "user-1",
  email: "sample@example.com",
  name: "Sample",
  phone: null,
  venueName: null,
  language: null,
  title: null,
  organizationId: "org-1"
};

function renderOpenKitchenSidebar() {
  const view = render(
    <DashboardSidebar
      activeLabel="Kitchen"
      forceOverlay
      profileSubtitle="Upgrade Now"
      roleLabel="Owner"
      user={user}
    />
  );
  const sidebar = view.container.querySelector("aside.app-sidebar");
  expect(sidebar).not.toBeNull();

  act(() => {
    window.dispatchEvent(
      new CustomEvent("dashboard-mobile-sidebar-toggle", {
        detail: { open: true }
      })
    );
  });

  expect(sidebar).toHaveClass("translate-x-0");

  return { sidebar };
}

describe("DashboardSidebar profile menu", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(min-width: 1024px)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }));
  });

  it.each(["Upgrade Plan", "My Account", "Logout"])(
    "keeps Kitchen's desktop sidebar open when opening %s",
    async (itemLabel) => {
      const { sidebar } = renderOpenKitchenSidebar();

      fireEvent.click(screen.getByRole("button", { name: /sample/i }));
      fireEvent.click(screen.getByRole("menuitem", { name: itemLabel }));

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(sidebar).toHaveClass("translate-x-0");
    }
  );

  it("keeps Kitchen's desktop sidebar open when opening a Help dialog", async () => {
    const { sidebar } = renderOpenKitchenSidebar();

    fireEvent.click(screen.getByRole("button", { name: /sample/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Help" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Help Center" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(sidebar).toHaveClass("translate-x-0");
  });
});
